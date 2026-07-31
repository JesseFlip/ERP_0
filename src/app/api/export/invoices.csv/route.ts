import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function csvEscape(value: unknown) {
  const s = String(value ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET() {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const invoices = await prisma.invoice.findMany({
    where: { orgId: user.orgId },
    include: { customer: true },
    orderBy: { createdAt: "desc" },
  });

  const header = ["Invoice ID", "Customer", "Status", "Subtotal", "Tax", "Total", "QBO Invoice ID", "Created", "Finalized"];
  const rows = invoices.map((inv) => [
    inv.id,
    inv.customer.name,
    inv.status,
    inv.subtotal.toString(),
    inv.taxAmount.toString(),
    inv.total.toString(),
    inv.qboInvoiceId ?? "",
    inv.createdAt.toISOString(),
    inv.finalizedAt?.toISOString() ?? "",
  ]);

  const csv = [header, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": 'attachment; filename="invoices.csv"',
    },
  });
}
