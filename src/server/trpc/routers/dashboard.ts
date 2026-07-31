import { router, protectedProcedure } from "../trpc";

export const dashboardRouter = router({
  stats: protectedProcedure.query(async ({ ctx }) => {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const [uninvoicedCount, invoicesThisMonth, changeOrderLines] = await Promise.all([
      ctx.prisma.job.count({ where: { orgId: ctx.orgId, status: "DONE_NOT_INVOICED" } }),
      ctx.prisma.invoice.findMany({
        where: { orgId: ctx.orgId, finalizedAt: { gte: startOfMonth } },
        include: { job: true },
      }),
      ctx.prisma.invoiceLine.count({
        where: {
          lineType: "CHANGE_ORDER",
          invoice: { orgId: ctx.orgId, finalizedAt: { gte: startOfMonth } },
        },
      }),
    ]);

    const withJobTiming = invoicesThisMonth.filter((inv) => inv.job && inv.finalizedAt);
    const avgHoursToInvoice =
      withJobTiming.length > 0
        ? withJobTiming.reduce((sum, inv) => {
            const doneMs = inv.job!.doneDate.getTime();
            const finalizedMs = inv.finalizedAt!.getTime();
            return sum + Math.max(0, finalizedMs - doneMs) / (1000 * 60 * 60);
          }, 0) / withJobTiming.length
        : null;

    return {
      uninvoicedCount,
      invoicedThisMonthCount: invoicesThisMonth.length,
      invoicedThisMonthTotal: invoicesThisMonth.reduce((sum, inv) => sum + Number(inv.total), 0),
      avgHoursToInvoice,
      changeOrdersThisMonth: changeOrderLines,
    };
  }),
});
