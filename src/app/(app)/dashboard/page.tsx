"use client";

import Link from "next/link";
import { trpc } from "@/lib/trpc/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-sm text-neutral-500">{label}</p>
        <p className="mt-1 text-2xl font-semibold text-neutral-900">{value}</p>
        {sub && <p className="mt-0.5 text-xs text-neutral-400">{sub}</p>}
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const { data: stats, isLoading } = trpc.dashboard.stats.useQuery();
  const { data: queue } = trpc.jobs.queue.useQuery();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-neutral-900">Dashboard</h1>
        <Link href="/queue/new" className={buttonVariants({})}>
          Log a finished job
        </Link>
      </div>

      {!isLoading && stats && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard label="Waiting to invoice" value={String(stats.uninvoicedCount)} />
          <StatCard
            label="Invoiced this month"
            value={String(stats.invoicedThisMonthCount)}
            sub={formatCurrency(stats.invoicedThisMonthTotal)}
          />
          <StatCard
            label="Median time-to-invoice"
            value={stats.avgHoursToInvoice != null ? `${stats.avgHoursToInvoice.toFixed(1)}h` : "—"}
            sub="from job done to sent"
          />
          <StatCard label="Change-orders captured" value={String(stats.changeOrdersThisMonth)} sub="this month" />
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Oldest waiting jobs</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col divide-y divide-neutral-100">
          {!queue || queue.length === 0 ? (
            <p className="py-4 text-sm text-neutral-500">Nothing waiting — you&rsquo;re caught up.</p>
          ) : (
            queue.slice(0, 5).map((job) => (
              <div key={job.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-medium text-neutral-900">{job.name}</p>
                  <p className="text-xs text-neutral-500">{job.customer.name}</p>
                </div>
                <Link href={`/invoices/new?jobId=${job.id}`} className={buttonVariants({ size: "sm" })}>
                  Compose invoice
                </Link>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
