import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { pullCustomersFromQbo } from "@/lib/qbo/sync";

export const customersRouter = router({
  list: protectedProcedure.query(({ ctx }) => {
    return ctx.prisma.customer.findMany({
      where: { orgId: ctx.orgId },
      orderBy: { name: "asc" },
    });
  }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        email: z.string().email().optional().or(z.literal("")),
        phone: z.string().optional(),
      })
    )
    .mutation(({ ctx, input }) => {
      return ctx.prisma.customer.create({
        data: {
          orgId: ctx.orgId,
          name: input.name,
          email: input.email || undefined,
          phone: input.phone,
        },
      });
    }),

  pullFromQbo: protectedProcedure.mutation(async ({ ctx }) => {
    const count = await pullCustomersFromQbo(ctx.orgId);
    return { imported: count };
  }),
});
