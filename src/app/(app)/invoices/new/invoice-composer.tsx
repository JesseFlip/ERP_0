"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Sparkles } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { PhotoUploader, type UploadedPhoto } from "@/components/photo-uploader";
import { cn, formatCurrency } from "@/lib/utils";

type Line = {
  key: string;
  catalogItemId?: string;
  description: string;
  quantity: number;
  rate: number;
  lineType: "STANDARD" | "CHANGE_ORDER";
};

function emptyLine(): Line {
  return { key: crypto.randomUUID(), description: "", quantity: 1, rate: 0, lineType: "STANDARD" };
}

export function InvoiceComposer({ jobId }: { jobId?: string }) {
  const router = useRouter();
  const { data: job } = trpc.jobs.getById.useQuery({ id: jobId! }, { enabled: Boolean(jobId) });
  const { data: customers } = trpc.customers.list.useQuery();
  const { data: catalog } = trpc.catalog.list.useQuery();

  // job (and its planned/change-order lines from scheduling) loads asynchronously;
  // these fall back to its values below rather than syncing via an effect.
  const [customerIdOverride, setCustomerIdOverride] = useState<string | null>(null);
  const [memoOverride, setMemoOverride] = useState<string | null>(null);
  const [linesOverride, setLinesOverride] = useState<Line[] | null>(null);
  const customerId = customerIdOverride ?? job?.customerId ?? "";
  const memo = memoOverride ?? job?.name ?? "";

  const defaultLines: Line[] = job
    ? job.lines.length > 0
      ? job.lines.map((l) => ({
          key: l.id,
          catalogItemId: l.catalogItemId ?? undefined,
          description: l.description,
          quantity: Number(l.quantity),
          rate: Number(l.rate),
          lineType: l.lineType === "CHANGE_ORDER" ? "CHANGE_ORDER" : "STANDARD",
        }))
      : [emptyLine()]
    : jobId
      ? [] // job not loaded yet — avoid flashing a blank line that then gets replaced
      : [emptyLine()];
  const lines = linesOverride ?? defaultLines;

  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);
  const [error, setError] = useState<string | null>(null);

  const activeCatalog = useMemo(() => catalog?.filter((c) => c.active) ?? [], [catalog]);
  const subtotal = lines.reduce((sum, l) => sum + l.quantity * l.rate, 0);

  const createInvoice = trpc.invoices.create.useMutation();
  const addAttachment = trpc.invoices.addAttachment.useMutation();
  const finalize = trpc.invoices.finalize.useMutation();
  const utils = trpc.useUtils();

  function updateLine(key: string, patch: Partial<Line>) {
    setLinesOverride(lines.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function addCatalogLine(catalogItemId: string) {
    const item = activeCatalog.find((c) => c.id === catalogItemId);
    if (!item) return;
    setLinesOverride([
      ...lines,
      {
        key: crypto.randomUUID(),
        catalogItemId: item.id,
        description: item.name,
        quantity: 1,
        rate: Number(item.defaultRate),
        lineType: "STANDARD",
      },
    ]);
  }

  const isSubmitting = createInvoice.isPending || addAttachment.isPending || finalize.isPending;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const cleanLines = lines.filter((l) => l.description.trim().length > 0);
    if (!customerId) {
      setError("Pick a customer.");
      return;
    }
    if (cleanLines.length === 0) {
      setError("Add at least one line.");
      return;
    }

    try {
      const invoice = await createInvoice.mutateAsync({
        customerId,
        jobId,
        memo: memo.trim() || undefined,
        lines: cleanLines.map((l) => ({
          catalogItemId: l.catalogItemId,
          description: l.description.trim(),
          quantity: l.quantity,
          rate: l.rate,
          lineType: l.lineType,
        })),
      });

      for (const photo of photos) {
        await addAttachment.mutateAsync({ invoiceId: invoice.id, url: photo.url });
      }

      await finalize.mutateAsync({ id: invoice.id });
      await utils.jobs.queue.invalidate();
      await utils.invoices.list.invalidate();
      router.push(`/invoices/${invoice.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-1 text-2xl font-semibold text-neutral-900">Compose invoice</h1>
      <p className="mb-6 text-sm text-neutral-500">
        Pick lines from your price list or type them free-form. Flag anything billed on the fly as
        &ldquo;added on site&rdquo; so it never gets forgotten.
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Customer &amp; memo</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="customer">Customer</Label>
              <Select
                id="customer"
                value={customerId}
                onChange={(e) => setCustomerIdOverride(e.target.value)}
                disabled={Boolean(jobId)}
                required
              >
                <option value="">{jobId ? "Loading…" : "Select a customer…"}</option>
                {customers?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="memo">Memo (shows on the invoice)</Label>
              <Textarea id="memo" rows={2} value={memo} onChange={(e) => setMemoOverride(e.target.value)} />
            </div>
            {job && job.attachments.length > 0 && (
              <p className="text-xs text-neutral-500">
                {job.attachments.length} photo{job.attachments.length > 1 ? "s" : ""} already attached
                to this job.
              </p>
            )}
            {job && job.lines.length > 0 && !linesOverride && (
              <p className="text-xs text-neutral-500">
                Lines below were carried over from this job{job.estimateId ? "'s estimate" : ""} —
                edit freely before sending.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Line items</CardTitle>
            <CardDescription>{formatCurrency(subtotal)} so far</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {lines.map((line) => (
              <div key={line.key} className="flex flex-col gap-2 rounded-md border border-neutral-200 p-3 sm:flex-row sm:items-center">
                <Input
                  className="sm:flex-1"
                  placeholder="Description"
                  value={line.description}
                  onChange={(e) => updateLine(line.key, { description: e.target.value })}
                />
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  className="w-full sm:w-20"
                  value={line.quantity}
                  onChange={(e) => updateLine(line.key, { quantity: Number(e.target.value) })}
                  aria-label="Quantity"
                />
                <span className="hidden text-neutral-400 sm:inline">×</span>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  className="w-full sm:w-24"
                  value={line.rate}
                  onChange={(e) => updateLine(line.key, { rate: Number(e.target.value) })}
                  aria-label="Rate"
                />
                <span className="w-24 text-right text-sm font-medium text-neutral-700">
                  {formatCurrency(line.quantity * line.rate)}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    updateLine(line.key, {
                      lineType: line.lineType === "CHANGE_ORDER" ? "STANDARD" : "CHANGE_ORDER",
                    })
                  }
                  className={cn(
                    "flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium",
                    line.lineType === "CHANGE_ORDER"
                      ? "border-amber-300 bg-amber-100 text-amber-800"
                      : "border-neutral-200 text-neutral-400 hover:border-neutral-300"
                  )}
                  title="Flag as added on site / change order"
                >
                  <Sparkles className="h-3 w-3" />
                  Added on site
                </button>
                <button
                  type="button"
                  onClick={() => setLinesOverride(lines.filter((l) => l.key !== line.key))}
                  className="shrink-0 text-neutral-400 hover:text-red-600"
                  aria-label="Remove line"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Button type="button" variant="secondary" size="sm" onClick={() => setLinesOverride([...lines, emptyLine()])}>
                <Plus className="h-3.5 w-3.5" /> Custom line
              </Button>
              {activeCatalog.length > 0 && (
                <Select
                  className="w-56"
                  value=""
                  onChange={(e) => {
                    if (e.target.value) addCatalogLine(e.target.value);
                  }}
                >
                  <option value="">+ Add from price list…</option>
                  {activeCatalog.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} — {formatCurrency(item.defaultRate)}/{item.unit}
                    </option>
                  ))}
                </Select>
              )}
            </div>

            <div className="flex justify-end border-t border-neutral-100 pt-3 text-base font-semibold text-neutral-900">
              Total: {formatCurrency(subtotal)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Photos</CardTitle>
            <CardDescription>Before/after evidence, attached to this invoice.</CardDescription>
          </CardHeader>
          <CardContent>
            <PhotoUploader photos={photos} onChange={setPhotos} />
          </CardContent>
        </Card>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-2">
          <Button type="submit" size="lg" disabled={isSubmitting}>
            {isSubmitting ? "Sending…" : "Finalize & send to QuickBooks"}
          </Button>
          <Button type="button" variant="secondary" size="lg" onClick={() => router.back()}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
