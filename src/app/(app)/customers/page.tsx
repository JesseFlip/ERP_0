"use client";

import { trpc } from "@/lib/trpc/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function CustomersPage() {
  const utils = trpc.useUtils();
  const { data: customers, isLoading } = trpc.customers.list.useQuery();
  const { data: qboStatus } = trpc.qbo.status.useQuery();
  const syncCustomers = trpc.qbo.syncCustomers.useMutation({
    onSuccess: () => utils.customers.list.invalidate(),
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Customers</h1>
          <p className="text-sm text-neutral-500">
            Pulled from QuickBooks Online, or created here when a job comes in for someone new.
          </p>
        </div>
        {qboStatus?.connected && (
          <Button
            variant="secondary"
            onClick={() => syncCustomers.mutate()}
            disabled={syncCustomers.isPending}
          >
            {syncCustomers.isPending ? "Syncing…" : "Sync from QBO"}
          </Button>
        )}
      </div>

      {isLoading ? (
        <p className="text-sm text-neutral-500">Loading…</p>
      ) : !customers || customers.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-neutral-500">
            No customers yet. Connect QuickBooks in Settings to import them, or add one while
            logging a job.
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-5 py-3 font-medium">Name</th>
                <th className="px-5 py-3 font-medium">Email</th>
                <th className="px-5 py-3 font-medium">Phone</th>
                <th className="px-5 py-3 font-medium">QBO</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {customers.map((c) => (
                <tr key={c.id}>
                  <td className="px-5 py-3 font-medium text-neutral-900">{c.name}</td>
                  <td className="px-5 py-3 text-neutral-600">{c.email ?? "—"}</td>
                  <td className="px-5 py-3 text-neutral-600">{c.phone ?? "—"}</td>
                  <td className="px-5 py-3 text-neutral-400">{c.qboCustomerId ? "Synced" : "Local only"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
