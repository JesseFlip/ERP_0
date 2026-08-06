"use client";

import Link from "next/link";
import { trpc } from "@/lib/trpc/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/utils";
import { estimateStatusLabel, estimateStatusVariant } from "@/lib/status";

export default function EstimatesPage() {
  const { data: estimates, isLoading } = trpc.estimates.list.useQuery();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Estimates</h1>
          <p className="text-sm text-neutral-500">
            Accepted estimates convert straight to a scheduled job with the quoted lines carried over.
          </p>
        </div>
        <Link href="/estimates/new" className={buttonVariants({})}>
          New estimate
        </Link>
      </div>

      {isLoading ? (
        <p className="text-sm text-neutral-500">Loading…</p>
      ) : !estimates || estimates.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-neutral-500">
            No estimates yet.
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
              {estimates.map((est) => (
                <tr key={est.id} className="hover:bg-neutral-50">
                  <td className="px-5 py-3">
                    <Link href={`/estimates/${est.id}`} className="block font-medium text-neutral-900">
                      {est.customer.name}
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-neutral-500">{formatDate(est.createdAt)}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <Badge variant={estimateStatusVariant[est.status]}>{estimateStatusLabel[est.status]}</Badge>
                      {est.job && <Badge variant="success">Job scheduled</Badge>}
                    </div>
                  </td>
                  <td className="px-5 py-3 text-right font-medium text-neutral-900">{formatCurrency(est.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
