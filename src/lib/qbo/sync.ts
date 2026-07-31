import "server-only";
import { prisma } from "@/lib/prisma";
import {
  createQboCustomer,
  createQboInvoice,
  listQboCustomers,
  listQboItems,
} from "./client";

const MAX_SYNC_ATTEMPTS = 8;

function backoffMinutes(attempt: number) {
  // 1, 2, 4, 8, 16, 32, 64, 128 minutes, capped
  return Math.min(2 ** attempt, 240);
}

/** Ensures the local customer has a QBO counterpart, creating one if new. */
async function ensureQboCustomer(orgId: string, customerId: string): Promise<string> {
  const customer = await prisma.customer.findUniqueOrThrow({ where: { id: customerId } });
  if (customer.qboCustomerId) return customer.qboCustomerId;

  const created = await createQboCustomer(orgId, {
    name: customer.name,
    email: customer.email ?? undefined,
    phone: customer.phone ?? undefined,
  });
  await prisma.customer.update({
    where: { id: customer.id },
    data: { qboCustomerId: created.Id },
  });
  return created.Id;
}

/**
 * Pushes a finalized invoice to QBO. Safe to call repeatedly for the same invoice:
 * the idempotency key travels with the invoice row and QBO-side dedup (see
 * findQboInvoiceByIdempotencyKey) means a retry never creates a duplicate bill.
 */
export async function pushInvoiceToQbo(invoiceId: string): Promise<void> {
  const invoice = await prisma.invoice.findUniqueOrThrow({
    where: { id: invoiceId },
    include: { lines: { include: { catalogItem: true } } },
  });

  if (invoice.qboInvoiceId) return; // already synced

  try {
    const qboCustomerId = await ensureQboCustomer(invoice.orgId, invoice.customerId);

    const qboInvoice = await createQboInvoice(invoice.orgId, {
      customerId: qboCustomerId,
      idempotencyKey: invoice.idempotencyKey,
      memo: invoice.memo ?? undefined,
      lines: invoice.lines.map((line) => ({
        description: line.description,
        quantity: Number(line.quantity),
        rate: Number(line.rate),
        amount: Number(line.amount),
        qboItemId: line.catalogItem?.qboItemId ?? undefined,
      })),
    });

    await prisma.$transaction([
      prisma.invoice.update({
        where: { id: invoice.id },
        data: {
          qboInvoiceId: qboInvoice.Id,
          qboSyncToken: qboInvoice.SyncToken,
          status: "POSTED",
          lastSyncedAt: new Date(),
          lastSyncError: null,
        },
      }),
      prisma.syncJob.updateMany({
        where: { invoiceId: invoice.id, status: { in: ["PENDING", "FAILED", "RUNNING"] } },
        data: { status: "SUCCEEDED" },
      }),
    ]);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown QBO sync error";
    await prisma.$transaction(async (tx) => {
      await tx.invoice.update({
        where: { id: invoice.id },
        data: { lastSyncError: message, status: "NOT_POSTED" },
      });

      const existingJob = await tx.syncJob.findFirst({
        where: { invoiceId: invoice.id, status: { in: ["PENDING", "FAILED", "RUNNING"] } },
      });

      const attempts = (existingJob?.attempts ?? 0) + 1;
      const nextAttemptAt = new Date(Date.now() + backoffMinutes(attempts) * 60_000);
      const status = attempts >= MAX_SYNC_ATTEMPTS ? "FAILED" : "PENDING";

      if (existingJob) {
        await tx.syncJob.update({
          where: { id: existingJob.id },
          data: { attempts, lastError: message, nextAttemptAt, status },
        });
      } else {
        await tx.syncJob.create({
          data: {
            orgId: invoice.orgId,
            invoiceId: invoice.id,
            attempts,
            lastError: message,
            nextAttemptAt,
            status,
          },
        });
      }
    });
    throw error;
  }
}

/** Processes due retry jobs across all orgs. Intended to run on a cron schedule. */
export async function processSyncQueue(limit = 20): Promise<{ processed: number; succeeded: number; failed: number }> {
  const dueJobs = await prisma.syncJob.findMany({
    where: { status: "PENDING", nextAttemptAt: { lte: new Date() } },
    take: limit,
    orderBy: { nextAttemptAt: "asc" },
  });

  let succeeded = 0;
  let failed = 0;

  for (const job of dueJobs) {
    await prisma.syncJob.update({ where: { id: job.id }, data: { status: "RUNNING" } });
    try {
      await pushInvoiceToQbo(job.invoiceId);
      succeeded += 1;
    } catch {
      failed += 1;
    }
  }

  return { processed: dueJobs.length, succeeded, failed };
}

/** Pulls the org's QBO customers into the local table (used on connect + manual refresh). */
export async function pullCustomersFromQbo(orgId: string): Promise<number> {
  const remoteCustomers = await listQboCustomers(orgId);
  for (const c of remoteCustomers) {
    await prisma.customer.upsert({
      where: { orgId_qboCustomerId: { orgId, qboCustomerId: c.Id } },
      create: {
        orgId,
        qboCustomerId: c.Id,
        name: c.DisplayName,
        email: c.PrimaryEmailAddr?.Address,
        phone: c.PrimaryPhone?.FreeFormNumber,
        billingLine1: c.BillAddr?.Line1,
        billingCity: c.BillAddr?.City,
        billingState: c.BillAddr?.CountrySubDivisionCode,
        billingZip: c.BillAddr?.PostalCode,
      },
      update: {
        name: c.DisplayName,
        email: c.PrimaryEmailAddr?.Address,
        phone: c.PrimaryPhone?.FreeFormNumber,
        billingLine1: c.BillAddr?.Line1,
        billingCity: c.BillAddr?.City,
        billingState: c.BillAddr?.CountrySubDivisionCode,
        billingZip: c.BillAddr?.PostalCode,
      },
    });
  }
  return remoteCustomers.length;
}

/** Pulls the org's QBO items into the local catalog (used on connect + manual refresh). */
export async function pullItemsFromQbo(orgId: string): Promise<number> {
  const remoteItems = await listQboItems(orgId);
  const billable = remoteItems.filter((item) => item.Type === "Service" || item.Type === "Inventory" || item.Type === "NonInventory");
  for (const item of billable) {
    await prisma.catalogItem.upsert({
      where: { orgId_qboItemId: { orgId, qboItemId: item.Id } },
      create: {
        orgId,
        qboItemId: item.Id,
        name: item.Name,
        description: item.Description,
        kind: item.Type === "Service" ? "SERVICE" : "MATERIAL",
        defaultRate: item.UnitPrice ?? 0,
      },
      update: {
        name: item.Name,
        description: item.Description,
        defaultRate: item.UnitPrice ?? 0,
      },
    });
  }
  return billable.length;
}
