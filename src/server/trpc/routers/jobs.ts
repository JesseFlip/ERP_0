import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc";

export const jobsRouter = router({
  /** The uninvoiced-work queue: everything done but not yet billed, oldest first. */
  queue: protectedProcedure.query(({ ctx }) => {
    return ctx.prisma.job.findMany({
      where: { orgId: ctx.orgId, status: "DONE_NOT_INVOICED" },
      include: { customer: true, attachments: true },
      orderBy: { doneDate: "asc" },
    });
  }),

  list: protectedProcedure.query(({ ctx }) => {
    return ctx.prisma.job.findMany({
      where: { orgId: ctx.orgId },
      include: { customer: true, crew: true },
      orderBy: { createdAt: "desc" },
    });
  }),

  /** Scheduled + in-progress jobs for the schedule board, optionally filtered by crew. */
  scheduleView: protectedProcedure
    .input(z.object({ crewId: z.string().optional() }).optional())
    .query(({ ctx, input }) => {
      return ctx.prisma.job.findMany({
        where: {
          orgId: ctx.orgId,
          status: { in: ["SCHEDULED", "IN_PROGRESS"] },
          ...(input?.crewId ? { crewId: input.crewId } : {}),
        },
        include: { customer: true, crew: true, lines: true },
        orderBy: [{ scheduledDate: "asc" }, { createdAt: "asc" }],
      });
    }),

  getById: protectedProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    const job = await ctx.prisma.job.findUnique({
      where: { id: input.id, orgId: ctx.orgId },
      include: {
        customer: true,
        attachments: true,
        crew: true,
        estimate: true,
        lines: { orderBy: { sortOrder: "asc" } },
      },
    });
    if (!job) throw new TRPCError({ code: "NOT_FOUND" });
    return job;
  }),

  /** Manual "log a finished job" — the v1 flow, unchanged: goes straight to the uninvoiced queue. */
  create: protectedProcedure
    .input(
      z.object({
        customerId: z.string(),
        name: z.string().min(1),
        doneDate: z.coerce.date(),
        notes: z.string().optional(),
      })
    )
    .mutation(({ ctx, input }) => {
      return ctx.prisma.job.create({
        data: { ...input, orgId: ctx.orgId, status: "DONE_NOT_INVOICED" },
      });
    }),

  /** Manually schedule a job (no estimate) — the Phase 3 entry point alongside estimate conversion. */
  createScheduled: protectedProcedure
    .input(
      z.object({
        customerId: z.string(),
        name: z.string().min(1),
        scheduledDate: z.coerce.date(),
        scheduledWindow: z.string().optional(),
        crewId: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(({ ctx, input }) => {
      return ctx.prisma.job.create({
        data: { ...input, orgId: ctx.orgId, status: "SCHEDULED" },
      });
    }),

  schedule: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        scheduledDate: z.coerce.date(),
        scheduledWindow: z.string().optional(),
        crewId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const job = await ctx.prisma.job.findUnique({ where: { id, orgId: ctx.orgId } });
      if (!job) throw new TRPCError({ code: "NOT_FOUND" });
      return ctx.prisma.job.update({ where: { id }, data });
    }),

  start: protectedProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    const job = await ctx.prisma.job.findUnique({ where: { id: input.id, orgId: ctx.orgId } });
    if (!job) throw new TRPCError({ code: "NOT_FOUND" });
    if (job.status !== "SCHEDULED") {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Only scheduled jobs can be started" });
    }
    return ctx.prisma.job.update({ where: { id: input.id }, data: { status: "IN_PROGRESS" } });
  }),

  /** Field completion: closes out scheduling and drops the job into the uninvoiced queue. */
  complete: protectedProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    const job = await ctx.prisma.job.findUnique({ where: { id: input.id, orgId: ctx.orgId } });
    if (!job) throw new TRPCError({ code: "NOT_FOUND" });
    if (job.status !== "SCHEDULED" && job.status !== "IN_PROGRESS") {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Only scheduled or in-progress jobs can be completed" });
    }
    return ctx.prisma.job.update({
      where: { id: input.id },
      data: { status: "DONE_NOT_INVOICED", doneDate: new Date() },
    });
  }),

  dismiss: protectedProcedure
    .input(z.object({ id: z.string(), reason: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const job = await ctx.prisma.job.findUnique({ where: { id: input.id, orgId: ctx.orgId } });
      if (!job) throw new TRPCError({ code: "NOT_FOUND" });
      if (job.status !== "DONE_NOT_INVOICED") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Only queued jobs can be dismissed" });
      }
      return ctx.prisma.job.update({
        where: { id: input.id },
        data: { status: "DISMISSED", dismissedReason: input.reason },
      });
    }),

  /** Field change-order: an extra line billed on-site, flagged distinctly through to invoicing. */
  addChangeOrderLine: protectedProcedure
    .input(
      z.object({
        jobId: z.string(),
        catalogItemId: z.string().optional(),
        description: z.string().min(1),
        quantity: z.coerce.number().positive().default(1),
        rate: z.coerce.number().min(0),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const job = await ctx.prisma.job.findUnique({
        where: { id: input.jobId, orgId: ctx.orgId },
        include: { lines: true },
      });
      if (!job) throw new TRPCError({ code: "NOT_FOUND" });
      if (job.status === "INVOICED") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "This job is already invoiced" });
      }
      return ctx.prisma.jobLine.create({
        data: {
          jobId: input.jobId,
          catalogItemId: input.catalogItemId,
          description: input.description,
          quantity: input.quantity,
          rate: input.rate,
          amount: input.quantity * input.rate,
          lineType: "CHANGE_ORDER",
          sortOrder: job.lines.length,
        },
      });
    }),

  removeLine: protectedProcedure
    .input(z.object({ jobId: z.string(), lineId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const job = await ctx.prisma.job.findUnique({ where: { id: input.jobId, orgId: ctx.orgId } });
      if (!job) throw new TRPCError({ code: "NOT_FOUND" });
      if (job.status === "INVOICED") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "This job is already invoiced" });
      }
      await ctx.prisma.jobLine.delete({ where: { id: input.lineId, jobId: input.jobId } });
      return { ok: true };
    }),

  addAttachment: protectedProcedure
    .input(z.object({ jobId: z.string(), url: z.string(), caption: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const job = await ctx.prisma.job.findUnique({ where: { id: input.jobId, orgId: ctx.orgId } });
      if (!job) throw new TRPCError({ code: "NOT_FOUND" });
      return ctx.prisma.attachment.create({
        data: { jobId: input.jobId, url: input.url, caption: input.caption },
      });
    }),
});
