import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc";

const lineInput = z.object({
  catalogItemId: z.string().optional(),
  description: z.string().min(1),
  quantity: z.coerce.number().positive().default(1),
  rate: z.coerce.number().min(0),
});

function computeTotals(lines: { quantity: number; rate: number }[]) {
  const subtotal = lines.reduce((sum, l) => sum + l.quantity * l.rate, 0);
  return { subtotal, total: subtotal };
}

export const estimatesRouter = router({
  list: protectedProcedure.query(({ ctx }) => {
    return ctx.prisma.estimate.findMany({
      where: { orgId: ctx.orgId },
      include: { customer: true, job: true },
      orderBy: { createdAt: "desc" },
    });
  }),

  getById: protectedProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    const estimate = await ctx.prisma.estimate.findUnique({
      where: { id: input.id, orgId: ctx.orgId },
      include: {
        customer: true,
        lines: { orderBy: { sortOrder: "asc" } },
        job: true,
      },
    });
    if (!estimate) throw new TRPCError({ code: "NOT_FOUND" });
    return estimate;
  }),

  create: protectedProcedure
    .input(
      z.object({
        customerId: z.string(),
        memo: z.string().optional(),
        validUntil: z.coerce.date().optional(),
        lines: z.array(lineInput).min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { subtotal, total } = computeTotals(input.lines);
      return ctx.prisma.estimate.create({
        data: {
          orgId: ctx.orgId,
          customerId: input.customerId,
          memo: input.memo,
          validUntil: input.validUntil,
          subtotal,
          total,
          lines: {
            create: input.lines.map((line, i) => ({
              catalogItemId: line.catalogItemId,
              description: line.description,
              quantity: line.quantity,
              rate: line.rate,
              amount: line.quantity * line.rate,
              sortOrder: i,
            })),
          },
        },
        include: { lines: true },
      });
    }),

  updateLines: protectedProcedure
    .input(
      z.object({
        estimateId: z.string(),
        memo: z.string().optional(),
        validUntil: z.coerce.date().optional(),
        lines: z.array(lineInput).min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const estimate = await ctx.prisma.estimate.findUnique({
        where: { id: input.estimateId, orgId: ctx.orgId },
      });
      if (!estimate) throw new TRPCError({ code: "NOT_FOUND" });
      if (estimate.status !== "DRAFT") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Only draft estimates can be edited" });
      }

      const { subtotal, total } = computeTotals(input.lines);

      await ctx.prisma.$transaction([
        ctx.prisma.estimateLine.deleteMany({ where: { estimateId: input.estimateId } }),
        ctx.prisma.estimateLine.createMany({
          data: input.lines.map((line, i) => ({
            estimateId: input.estimateId,
            catalogItemId: line.catalogItemId,
            description: line.description,
            quantity: line.quantity,
            rate: line.rate,
            amount: line.quantity * line.rate,
            sortOrder: i,
          })),
        }),
        ctx.prisma.estimate.update({
          where: { id: input.estimateId },
          data: { memo: input.memo, validUntil: input.validUntil, subtotal, total },
        }),
      ]);

      return ctx.prisma.estimate.findUniqueOrThrow({
        where: { id: input.estimateId },
        include: { lines: { orderBy: { sortOrder: "asc" } } },
      });
    }),

  send: protectedProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    const estimate = await ctx.prisma.estimate.findUnique({ where: { id: input.id, orgId: ctx.orgId } });
    if (!estimate) throw new TRPCError({ code: "NOT_FOUND" });
    if (estimate.status !== "DRAFT") {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Only draft estimates can be sent" });
    }
    return ctx.prisma.estimate.update({
      where: { id: input.id },
      data: { status: "SENT", sentAt: new Date() },
    });
  }),

  respond: protectedProcedure
    .input(z.object({ id: z.string(), accepted: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const estimate = await ctx.prisma.estimate.findUnique({ where: { id: input.id, orgId: ctx.orgId } });
      if (!estimate) throw new TRPCError({ code: "NOT_FOUND" });
      if (estimate.status !== "SENT") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Only sent estimates can be responded to" });
      }
      return ctx.prisma.estimate.update({
        where: { id: input.id },
        data: { status: input.accepted ? "ACCEPTED" : "DECLINED", respondedAt: new Date() },
      });
    }),

  /**
   * Converts an accepted estimate into a scheduled job, carrying its lines
   * over as JobLine(PLANNED) — the invoice composer later seeds from those
   * same lines so what was quoted is what gets scheduled and billed.
   */
  convertToJob: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const estimate = await ctx.prisma.estimate.findUnique({
        where: { id: input.id, orgId: ctx.orgId },
        include: { lines: true, job: true },
      });
      if (!estimate) throw new TRPCError({ code: "NOT_FOUND" });
      if (estimate.status !== "ACCEPTED") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Only accepted estimates can convert to a job" });
      }
      if (estimate.job) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "This estimate already has a job" });
      }

      return ctx.prisma.job.create({
        data: {
          orgId: ctx.orgId,
          customerId: estimate.customerId,
          name: estimate.memo || "Estimated job",
          status: "SCHEDULED",
          estimateId: estimate.id,
          lines: {
            create: estimate.lines.map((line) => ({
              catalogItemId: line.catalogItemId,
              description: line.description,
              quantity: line.quantity,
              rate: line.rate,
              amount: line.amount,
              lineType: "PLANNED",
              sortOrder: line.sortOrder,
            })),
          },
        },
        include: { lines: true, customer: true },
      });
    }),
});
