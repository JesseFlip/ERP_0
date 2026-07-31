import { initTRPC, TRPCError } from "@trpc/server";
import { superjson } from "@/lib/superjson-server";
import type { Context } from "./context";

const t = initTRPC.context<Context>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

/** Requires a logged-in user; injects `orgId`/`userId` so routers never forget the tenant scope. */
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({
    ctx: {
      ...ctx,
      session: ctx.session,
      orgId: ctx.session.orgId,
      userId: ctx.session.userId,
    },
  });
});
