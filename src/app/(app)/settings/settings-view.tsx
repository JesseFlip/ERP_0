"use client";

import { CheckCircle2, XCircle } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";

export function SettingsView({ connected, error }: { connected: boolean; error?: string }) {
  const utils = trpc.useUtils();
  const { data: status, isLoading } = trpc.qbo.status.useQuery();
  const disconnect = trpc.qbo.disconnect.useMutation({
    onSuccess: () => utils.qbo.status.invalidate(),
  });
  const { data: pendingSyncJobs } = trpc.qbo.pendingSyncJobs.useQuery();

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <h1 className="text-2xl font-semibold text-neutral-900">Settings</h1>

      {connected && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          QuickBooks connected. Customers and items are syncing in.
        </div>
      )}
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          Couldn&rsquo;t connect QuickBooks ({error}). Try again, or check your Intuit app credentials.
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>QuickBooks Online</CardTitle>
          <CardDescription>
            Invoices, customers, and your price list all stay in sync with QBO.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-neutral-500">Loading…</p>
          ) : !status?.configured ? (
            <p className="text-sm text-neutral-500">
              QBO app credentials aren&rsquo;t configured yet (set{" "}
              <code className="rounded bg-neutral-100 px-1">QBO_CLIENT_ID</code> /{" "}
              <code className="rounded bg-neutral-100 px-1">QBO_CLIENT_SECRET</code> in your
              environment).
            </p>
          ) : status.connected ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-neutral-700">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                Connected{status.connectedAt ? ` since ${formatDate(status.connectedAt)}` : ""} · realm{" "}
                {status.realmId}
              </div>
              <Button variant="secondary" size="sm" onClick={() => disconnect.mutate()} disabled={disconnect.isPending}>
                Disconnect
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-neutral-500">
                <XCircle className="h-4 w-4" />
                Not connected
              </div>
              <a href="/api/qbo/oauth/start" className="inline-flex h-9 items-center justify-center rounded-md bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-700">
                Connect QuickBooks
              </a>
            </div>
          )}
        </CardContent>
      </Card>

      {pendingSyncJobs && pendingSyncJobs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Pending QBO syncs</CardTitle>
            <CardDescription>Invoices waiting on a retry.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col divide-y divide-neutral-100">
            {pendingSyncJobs.map((job) => (
              <div key={job.id} className="flex items-center justify-between py-2 text-sm">
                <span>{job.invoice.customer.name}</span>
                <span className="text-neutral-400">attempt {job.attempts}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Data export</CardTitle>
          <CardDescription>
            Your data is never locked in. Export customers, catalog, and invoices as CSV any time.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex gap-2">
          <a href="/api/export/invoices.csv" className="text-sm font-medium text-emerald-700 hover:underline">
            Export invoices
          </a>
          <span className="text-neutral-300">·</span>
          <a href="/api/export/customers.csv" className="text-sm font-medium text-emerald-700 hover:underline">
            Export customers
          </a>
        </CardContent>
      </Card>
    </div>
  );
}
