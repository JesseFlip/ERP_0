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

  const customers = await prisma.customer.findMany({
    where: { orgId: user.orgId },
    orderBy: { name: "asc" },
  });

  const header = ["Name", "Email", "Phone", "QBO Customer ID", "Billing Line 1", "City", "State", "Zip"];
  const rows = customers.map((c) => [
    c.name,
    c.email ?? "",
    c.phone ?? "",
    c.qboCustomerId ?? "",
    c.billingLine1 ?? "",
    c.billingCity ?? "",
    c.billingState ?? "",
    c.billingZip ?? "",
  ]);

  const csv = [header, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": 'attachment; filename="customers.csv"',
    },
  });
}
