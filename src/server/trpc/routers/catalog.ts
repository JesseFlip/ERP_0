import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { pullItemsFromQbo } from "@/lib/qbo/sync";

export const catalogRouter = router({
  list: protectedProcedure.query(({ ctx }) => {
    return ctx.prisma.catalogItem.findMany({
      where: { orgId: ctx.orgId },
      orderBy: { name: "asc" },
    });
  }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        description: z.string().optional(),
        kind: z.enum(["SERVICE", "MATERIAL"]).default("SERVICE"),
        unit: z.string().min(1).default("ea"),
        defaultRate: z.coerce.number().min(0),
      })
    )
    .mutation(({ ctx, input }) => {
      return ctx.prisma.catalogItem.create({
        data: { ...input, orgId: ctx.orgId },
      });
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1),
        description: z.string().optional(),
        kind: z.enum(["SERVICE", "MATERIAL"]),
        unit: z.string().min(1),
        defaultRate: z.coerce.number().min(0),
        active: z.boolean(),
      })
    )
    .mutation(({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.prisma.catalogItem.update({
        where: { id, orgId: ctx.orgId },
        data,
      });
    }),

  setActive: protectedProcedure
    .input(z.object({ id: z.string(), active: z.boolean() }))
    .mutation(({ ctx, input }) => {
      return ctx.prisma.catalogItem.update({
        where: { id: input.id, orgId: ctx.orgId },
        data: { active: input.active },
      });
    }),

  importRows: protectedProcedure
    .input(
      z.array(
        z.object({
          name: z.string().min(1),
          description: z.string().optional(),
          kind: z.enum(["SERVICE", "MATERIAL"]).default("SERVICE"),
          unit: z.string().min(1).default("ea"),
          defaultRate: z.coerce.number().min(0),
        })
      )
    )
    .mutation(async ({ ctx, input }) => {
      const created = await ctx.prisma.catalogItem.createMany({
        data: input.map((row) => ({ ...row, orgId: ctx.orgId })),
      });
      return created.count;
    }),

  pullFromQbo: protectedProcedure.mutation(async ({ ctx }) => {
    const count = await pullItemsFromQbo(ctx.orgId);
    return { imported: count };
  }),
});
