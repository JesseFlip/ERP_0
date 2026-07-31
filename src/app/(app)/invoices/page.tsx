"use client";

import Link from "next/link";
import { trpc } from "@/lib/trpc/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/utils";
import { invoiceStatusLabel, invoiceStatusVariant } from "@/lib/status";

export default function InvoicesPage() {
  const { data: invoices, isLoading } = trpc.invoices.list.useQuery();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Invoices</h1>
          <p className="text-sm text-neutral-500">Status syncs from QuickBooks Online.</p>
        </div>
        <Link href="/queue" className={buttonVariants({ variant: "secondary" })}>
          Go to queue
        </Link>
      </div>

      {isLoading ? (
        <p className="text-sm text-neutral-500">Loading…</p>
      ) : !invoices || invoices.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-neutral-500">
            No invoices yet. Compose one from the uninvoiced queue.
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-5 py-3 font-medium">Customer</th>
                <th className="px-5 py-3 font-medium">Created</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {invoices.map((inv) => (
                <tr key={inv.id} className="cursor-pointer hover:bg-neutral-50">
                  <td className="px-5 py-3">
                    <Link href={`/invoices/${inv.id}`} className="block font-medium text-neutral-900">
                      {inv.customer.name}
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-neutral-500">{formatDate(inv.createdAt)}</td>
                  <td className="px-5 py-3">
                    <Badge variant={invoiceStatusVariant[inv.status]}>{invoiceStatusLabel[inv.status]}</Badge>
                  </td>
                  <td className="px-5 py-3 text-right font-medium text-neutral-900">{formatCurrency(inv.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
