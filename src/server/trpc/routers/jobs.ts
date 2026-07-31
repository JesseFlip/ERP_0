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
      include: { customer: true },
      orderBy: { doneDate: "desc" },
    });
  }),

  getById: protectedProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    const job = await ctx.prisma.job.findUnique({
      where: { id: input.id, orgId: ctx.orgId },
      include: { customer: true, attachments: true },
    });
    if (!job) throw new TRPCError({ code: "NOT_FOUND" });
    return job;
  }),

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
        data: { ...input, orgId: ctx.orgId },
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
