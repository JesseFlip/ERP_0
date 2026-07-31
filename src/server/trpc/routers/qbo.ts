import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { isQboConfigured } from "@/lib/qbo/config";
import { pullCustomersFromQbo, pullItemsFromQbo, processSyncQueue } from "@/lib/qbo/sync";
import { prisma } from "@/lib/prisma";

export const qboRouter = router({
  status: protectedProcedure.query(async ({ ctx }) => {
    const org = await ctx.prisma.org.findUniqueOrThrow({ where: { id: ctx.orgId } });
    return {
      configured: isQboConfigured(),
      connected: Boolean(org.qboRealmId && org.qboAccessToken),
      connectedAt: org.qboConnectedAt,
      realmId: org.qboRealmId,
    };
  }),

  disconnect: protectedProcedure.mutation(async ({ ctx }) => {
    await prisma.org.update({
      where: { id: ctx.orgId },
      data: {
        qboRealmId: null,
        qboAccessToken: null,
        qboRefreshToken: null,
        qboAccessTokenExpiresAt: null,
        qboRefreshTokenExpiresAt: null,
        qboDisconnectedAt: new Date(),
      },
    });
    return { ok: true };
  }),

  syncCustomers: protectedProcedure.mutation(async ({ ctx }) => {
    const imported = await pullCustomersFromQbo(ctx.orgId);
    return { imported };
  }),

  syncItems: protectedProcedure.mutation(async ({ ctx }) => {
    const imported = await pullItemsFromQbo(ctx.orgId);
    return { imported };
  }),

  pendingSyncJobs: protectedProcedure.query(({ ctx }) => {
    return ctx.prisma.syncJob.findMany({
      where: { orgId: ctx.orgId, status: { in: ["PENDING", "FAILED", "RUNNING"] } },
      include: { invoice: { include: { customer: true } } },
      orderBy: { nextAttemptAt: "asc" },
    });
  }),

  runQueueNow: protectedProcedure.input(z.object({}).optional()).mutation(async () => {
    return processSyncQueue();
  }),
});
