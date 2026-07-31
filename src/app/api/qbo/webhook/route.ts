import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getQboInvoice } from "@/lib/qbo/client";

type QboWebhookPayload = {
  eventNotifications: Array<{
    realmId: string;
    dataChangeEvent: {
      entities: Array<{ name: string; id: string; operation: string; lastUpdated: string }>;
    };
  }>;
};

function verifySignature(rawBody: string, signatureHeader: string | null): boolean {
  const verifierToken = process.env.QBO_WEBHOOK_VERIFIER_TOKEN;
  if (!verifierToken || !signatureHeader) return false;
  const expected = createHmac("sha256", verifierToken).update(rawBody).digest("base64");
  const a = Buffer.from(expected);
  const b = Buffer.from(signatureHeader);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Maps a QBO invoice's Balance/EmailStatus onto our local InvoiceStatus enum. */
function deriveStatus(totalAmt: number, balance: number, emailStatus?: string): "POSTED" | "SENT" | "PAID" {
  if (balance <= 0 && totalAmt > 0) return "PAID";
  if (emailStatus === "EmailSent") return "SENT";
  return "POSTED";
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("intuit-signature");

  if (!verifySignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const payload = JSON.parse(rawBody) as QboWebhookPayload;

  for (const notification of payload.eventNotifications ?? []) {
    const org = await prisma.org.findFirst({ where: { qboRealmId: notification.realmId } });
    if (!org) continue;

    const invoiceEntities = notification.dataChangeEvent.entities.filter((e) => e.name === "Invoice");
    for (const entity of invoiceEntities) {
      const localInvoice = await prisma.invoice.findFirst({
        where: { orgId: org.id, qboInvoiceId: entity.id },
      });
      if (!localInvoice) continue; // not one of ours (or not synced yet)

      try {
        const remote = await getQboInvoice(org.id, entity.id);
        const status = deriveStatus(remote.TotalAmt, remote.Balance, remote.EmailStatus);
        await prisma.invoice.update({
          where: { id: localInvoice.id },
          data: { status, lastSyncedAt: new Date() },
        });
      } catch {
        // Best-effort: the on-demand refresh (invoice detail page) will catch up.
      }
    }
  }

  return NextResponse.json({ ok: true });
}
