import { router, protectedProcedure } from "../trpc";

export const dashboardRouter = router({
  stats: protectedProcedure.query(async ({ ctx }) => {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const startOfTomorrow = new Date(startOfToday);
    startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);

    const [uninvoicedCount, invoicesThisMonth, changeOrderLines, scheduledTodayCount, pendingEstimatesCount] =
      await Promise.all([
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
        ctx.prisma.job.count({
          where: {
            orgId: ctx.orgId,
            status: { in: ["SCHEDULED", "IN_PROGRESS"] },
            scheduledDate: { gte: startOfToday, lt: startOfTomorrow },
          },
        }),
        ctx.prisma.estimate.count({ where: { orgId: ctx.orgId, status: "SENT" } }),
      ]);

    const withJobTiming = invoicesThisMonth.filter(
      (inv): inv is typeof inv & { job: NonNullable<typeof inv.job> & { doneDate: Date } } =>
        Boolean(inv.job?.doneDate && inv.finalizedAt)
    );
    const avgHoursToInvoice =
      withJobTiming.length > 0
        ? withJobTiming.reduce((sum, inv) => {
            const doneMs = inv.job.doneDate.getTime();
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
      scheduledTodayCount,
      pendingEstimatesCount,
    };
  }),
});
