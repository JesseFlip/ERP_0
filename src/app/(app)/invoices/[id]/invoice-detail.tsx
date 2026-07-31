"use client";

import Link from "next/link";
import { AlertTriangle, ArrowLeft, RefreshCw, Sparkles } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import { invoiceStatusLabel, invoiceStatusVariant } from "@/lib/status";

export function InvoiceDetail({ id }: { id: string }) {
  const utils = trpc.useUtils();
  const { data: invoice, isLoading } = trpc.invoices.getById.useQuery({ id });
  const retrySync = trpc.invoices.retrySync.useMutation({
    onSuccess: () => utils.invoices.getById.invalidate({ id }),
  });

  if (isLoading) return <p className="text-sm text-neutral-500">Loading…</p>;
  if (!invoice) return <p className="text-sm text-red-600">Invoice not found.</p>;

  const needsRetry = invoice.status === "NOT_POSTED";

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <Link href="/invoices" className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-700">
          <ArrowLeft className="h-3.5 w-3.5" /> All invoices
        </Link>
      </div>

      {needsRetry && (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-800">Not posted to QuickBooks</p>
            <p className="mt-0.5 text-sm text-red-700">
              This invoice is saved and safe, but the push to QBO failed and hasn&rsquo;t been
              retried yet.
              {invoice.lastSyncError && (
                <span className="mt-1 block font-mono text-xs text-red-600/80">{invoice.lastSyncError}</span>
              )}
            </p>
            <Button
              size="sm"
              variant="destructive"
              className="mt-3"
              onClick={() => retrySync.mutate({ id: invoice.id })}
              disabled={retrySync.isPending}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              {retrySync.isPending ? "Retrying…" : "Retry now"}
            </Button>
          </div>
        </div>
      )}

      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold text-neutral-900">{invoice.customer.name}</h1>
            <Badge variant={invoiceStatusVariant[invoice.status]}>{invoiceStatusLabel[invoice.status]}</Badge>
          </div>
          {invoice.memo && <p className="text-sm text-neutral-500">{invoice.memo}</p>}
          <p className="mt-1 text-xs text-neutral-400">
            Created {formatDate(invoice.createdAt)}
            {invoice.finalizedAt && ` · finalized ${formatDate(invoice.finalizedAt)}`}
            {invoice.qboInvoiceId && ` · QBO #${invoice.qboInvoiceId}`}
          </p>
        </div>
        <p className="text-2xl font-semibold text-neutral-900">{formatCurrency(invoice.total)}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Line items</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col divide-y divide-neutral-100">
          {invoice.lines.map((line) => (
            <div key={line.id} className="flex items-center justify-between gap-3 py-3">
              <div className="flex items-center gap-2">
                <span className="text-sm text-neutral-800">{line.description}</span>
                {line.lineType === "CHANGE_ORDER" && (
                  <span className="flex items-center gap-1 rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                    <Sparkles className="h-3 w-3" /> Added on site
                  </span>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-4 text-sm text-neutral-500">
                <span>
                  {Number(line.quantity)} × {formatCurrency(line.rate)}
                </span>
                <span className="w-20 text-right font-medium text-neutral-900">{formatCurrency(line.amount)}</span>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {invoice.attachments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Photos</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            {invoice.attachments.map((a) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={a.id} src={a.url} alt="" className="h-24 w-24 rounded-md border border-neutral-200 object-cover" />
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
