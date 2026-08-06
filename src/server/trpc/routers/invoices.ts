import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc";
import { pushInvoiceToQbo } from "@/lib/qbo/sync";
import { computeLineAmount, computeTotals } from "@/lib/totals";
import {
  canCreateInvoiceFromJob,
  canEditInvoiceLines,
  canFinalizeInvoice,
  canRetrySyncInvoice,
} from "@/lib/status-transitions";

const lineInput = z.object({
  catalogItemId: z.string().optional(),
  description: z.string().min(1),
  quantity: z.coerce.number().positive().default(1),
  rate: z.coerce.number().min(0),
  lineType: z.enum(["STANDARD", "CHANGE_ORDER"]).default("STANDARD"),
  notes: z.string().optional(),
});

export const invoicesRouter = router({
  list: protectedProcedure.query(({ ctx }) => {
    return ctx.prisma.invoice.findMany({
      where: { orgId: ctx.orgId },
      include: { customer: true },
      orderBy: { createdAt: "desc" },
    });
  }),

  getById: protectedProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    const invoice = await ctx.prisma.invoice.findUnique({
      where: { id: input.id, orgId: ctx.orgId },
      include: {
        customer: true,
        lines: { orderBy: { sortOrder: "asc" } },
        attachments: true,
        job: true,
      },
    });
    if (!invoice) throw new TRPCError({ code: "NOT_FOUND" });
    return invoice;
  }),

  create: protectedProcedure
    .input(
      z.object({
        customerId: z.string(),
        jobId: z.string().optional(),
        memo: z.string().optional(),
        lines: z.array(lineInput).min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { subtotal, total } = computeTotals(input.lines);

      if (input.jobId) {
        const job = await ctx.prisma.job.findUnique({ where: { id: input.jobId, orgId: ctx.orgId } });
        if (!job) throw new TRPCError({ code: "NOT_FOUND", message: "Job not found" });
        if (!canCreateInvoiceFromJob(job.status)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Job is not in the uninvoiced queue" });
        }
      }

      return ctx.prisma.invoice.create({
        data: {
          orgId: ctx.orgId,
          customerId: input.customerId,
          memo: input.memo,
          subtotal,
          total,
          lines: {
            create: input.lines.map((line, i) => ({
              catalogItemId: line.catalogItemId,
              description: line.description,
              quantity: line.quantity,
              rate: line.rate,
              amount: computeLineAmount(line.quantity, line.rate),
              lineType: line.lineType,
              notes: line.notes,
              sortOrder: i,
            })),
          },
          ...(input.jobId ? { job: { connect: { id: input.jobId } } } : {}),
        },
        include: { lines: true },
      });
    }),

  updateLines: protectedProcedure
    .input(
      z.object({
        invoiceId: z.string(),
        memo: z.string().optional(),
        lines: z.array(lineInput).min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const invoice = await ctx.prisma.invoice.findUnique({
        where: { id: input.invoiceId, orgId: ctx.orgId },
      });
      if (!invoice) throw new TRPCError({ code: "NOT_FOUND" });
      if (!canEditInvoiceLines(invoice.status)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Only draft invoices can be edited" });
      }

      const { subtotal, total } = computeTotals(input.lines);

      await ctx.prisma.$transaction([
        ctx.prisma.invoiceLine.deleteMany({ where: { invoiceId: input.invoiceId } }),
        ctx.prisma.invoiceLine.createMany({
          data: input.lines.map((line, i) => ({
            invoiceId: input.invoiceId,
            catalogItemId: line.catalogItemId,
            description: line.description,
            quantity: line.quantity,
            rate: line.rate,
            amount: computeLineAmount(line.quantity, line.rate),
            lineType: line.lineType,
            notes: line.notes,
            sortOrder: i,
          })),
        }),
        ctx.prisma.invoice.update({
          where: { id: input.invoiceId },
          data: { memo: input.memo, subtotal, total },
        }),
      ]);

      return ctx.prisma.invoice.findUniqueOrThrow({
        where: { id: input.invoiceId },
        include: { lines: { orderBy: { sortOrder: "asc" } } },
      });
    }),

  /**
   * Locks the invoice and attempts to push it to QBO. Per spec P0-5, a QBO failure
   * never loses the invoice: it's already persisted locally, so we catch the sync
   * error, flag it on the invoice (status NOT_POSTED + lastSyncError), and let the
   * caller show a retry banner instead of throwing the whole finalize away.
   */
  finalize: protectedProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    const invoice = await ctx.prisma.invoice.findUnique({
      where: { id: input.id, orgId: ctx.orgId },
      include: { job: true },
    });
    if (!invoice) throw new TRPCError({ code: "NOT_FOUND" });
    if (!canFinalizeInvoice(invoice.status)) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Invoice already finalized" });
    }

    await ctx.prisma.$transaction(async (tx) => {
      await tx.invoice.update({
        where: { id: invoice.id },
        data: { status: "NOT_POSTED", finalizedAt: new Date() },
      });
      if (invoice.job) {
        await tx.job.update({ where: { id: invoice.job.id }, data: { status: "INVOICED" } });
      }
    });

    try {
      await pushInvoiceToQbo(invoice.id);
    } catch {
      // Swallow: pushInvoiceToQbo already persisted lastSyncError + queued a SyncJob retry.
    }

    return ctx.prisma.invoice.findUniqueOrThrow({
      where: { id: invoice.id },
      include: { lines: true, customer: true },
    });
  }),

  retrySync: protectedProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    const invoice = await ctx.prisma.invoice.findUnique({ where: { id: input.id, orgId: ctx.orgId } });
    if (!invoice) throw new TRPCError({ code: "NOT_FOUND" });
    if (!canRetrySyncInvoice(invoice.status)) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Finalize the invoice before syncing" });
    }
    try {
      await pushInvoiceToQbo(invoice.id);
    } catch {
      // Same as finalize: error already recorded on the invoice/SyncJob.
    }
    return ctx.prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
  }),

  addAttachment: protectedProcedure
    .input(z.object({ invoiceId: z.string(), url: z.string(), caption: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const invoice = await ctx.prisma.invoice.findUnique({
        where: { id: input.invoiceId, orgId: ctx.orgId },
      });
      if (!invoice) throw new TRPCError({ code: "NOT_FOUND" });
      return ctx.prisma.attachment.create({
        data: { invoiceId: input.invoiceId, url: input.url, caption: input.caption },
      });
    }),
});
