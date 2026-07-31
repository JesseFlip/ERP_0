import { z } from "zod";
import { router, protectedProcedure } from "../trpc";

export const crewsRouter = router({
  list: protectedProcedure.query(({ ctx }) => {
    return ctx.prisma.crew.findMany({
      where: { orgId: ctx.orgId },
      orderBy: { name: "asc" },
    });
  }),

  create: protectedProcedure
    .input(z.object({ name: z.string().min(1), colorHex: z.string().optional() }))
    .mutation(({ ctx, input }) => {
      return ctx.prisma.crew.create({ data: { ...input, orgId: ctx.orgId } });
    }),

  update: protectedProcedure
    .input(z.object({ id: z.string(), name: z.string().min(1), colorHex: z.string().optional() }))
    .mutation(({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.prisma.crew.update({ where: { id, orgId: ctx.orgId }, data });
    }),

  setActive: protectedProcedure
    .input(z.object({ id: z.string(), active: z.boolean() }))
    .mutation(({ ctx, input }) => {
      return ctx.prisma.crew.update({
        where: { id: input.id, orgId: ctx.orgId },
        data: { active: input.active },
      });
    }),
});
