"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Sparkles, Trash2, Plus } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Select } from "@/components/ui/input";
import { PhotoUploader, type UploadedPhoto } from "@/components/photo-uploader";
import { type CatalogOption } from "@/components/line-item-editor";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { jobStatusLabel, jobStatusVariant } from "@/lib/status";

function AddChangeOrderLine({ jobId, catalog }: { jobId: string; catalog: CatalogOption[] }) {
  const utils = trpc.useUtils();
  const [description, setDescription] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [rate, setRate] = useState(0);
  const addLine = trpc.jobs.addChangeOrderLine.useMutation({
    onSuccess: () => {
      utils.jobs.getById.invalidate({ id: jobId });
      setDescription("");
      setQuantity(1);
      setRate(0);
    },
  });

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!description.trim()) return;
    addLine.mutate({ jobId, description: description.trim(), quantity, rate });
  }

  return (
    <form onSubmit={handleAdd} className="flex flex-col gap-2 rounded-md border border-dashed border-amber-300 bg-amber-50/50 p-3 sm:flex-row sm:items-center">
      <Select
        className="w-full sm:w-48"
        value=""
        onChange={(e) => {
          const item = catalog.find((c) => c.id === e.target.value);
          if (item) {
            setDescription(item.name);
            setRate(Number(item.defaultRate));
          }
        }}
      >
        <option value="">From price list…</option>
        {catalog.map((item) => (
          <option key={item.id} value={item.id}>
            {item.name}
          </option>
        ))}
      </Select>
      <Input
        className="sm:flex-1"
        placeholder="What got added on site"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      <Input
        type="number"
        min={0}
        step="0.01"
        className="w-full sm:w-20"
        value={quantity}
        onChange={(e) => setQuantity(Number(e.target.value))}
        aria-label="Quantity"
      />
      <Input
        type="number"
        min={0}
        step="0.01"
        className="w-full sm:w-24"
        value={rate}
        onChange={(e) => setRate(Number(e.target.value))}
        aria-label="Rate"
      />
      <Button type="submit" size="sm" disabled={addLine.isPending || !description.trim()}>
        <Plus className="h-3.5 w-3.5" /> Add
      </Button>
    </form>
  );
}

export function JobDetail({ id }: { id: string }) {
  const utils = trpc.useUtils();
  const { data: job, isLoading } = trpc.jobs.getById.useQuery({ id });
  const { data: catalog } = trpc.catalog.list.useQuery();
  const activeCatalog = useMemo(() => catalog?.filter((c) => c.active) ?? [], [catalog]);

  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);
  const addAttachment = trpc.jobs.addAttachment.useMutation({
    onSuccess: () => utils.jobs.getById.invalidate({ id }),
  });
  const start = trpc.jobs.start.useMutation({ onSuccess: () => utils.jobs.getById.invalidate({ id }) });
  const complete = trpc.jobs.complete.useMutation({ onSuccess: () => utils.jobs.getById.invalidate({ id }) });
  const removeLine = trpc.jobs.removeLine.useMutation({ onSuccess: () => utils.jobs.getById.invalidate({ id }) });

  async function handlePhotosChange(next: UploadedPhoto[]) {
    const added = next.filter((p) => !photos.some((existing) => existing.url === p.url));
    for (const photo of added) {
      await addAttachment.mutateAsync({ jobId: id, url: photo.url });
    }
    // Persisted photos now show in the "already attached" grid above (via the
    // getById refetch), so clear the uploader's local list instead of holding
    // a second, duplicate copy of the same thumbnails.
    setPhotos([]);
  }

  if (isLoading) return <p className="text-sm text-neutral-500">Loading…</p>;
  if (!job) return <p className="text-sm text-red-600">Job not found.</p>;

  const canEditLines = job.status !== "INVOICED" && job.status !== "DISMISSED";

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <Link href="/schedule" className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-700">
        <ArrowLeft className="h-3.5 w-3.5" /> Schedule
      </Link>

      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold text-neutral-900">{job.name}</h1>
            <Badge variant={jobStatusVariant[job.status]}>{jobStatusLabel[job.status]}</Badge>
          </div>
          <p className="text-sm text-neutral-500">{job.customer.name}</p>
          <p className="mt-1 text-xs text-neutral-400">
            {job.scheduledDate && `Scheduled ${formatDate(job.scheduledDate)}`}
            {job.scheduledWindow && ` · ${job.scheduledWindow}`}
            {job.crew && ` · ${job.crew.name}`}
            {job.doneDate && ` · done ${formatDate(job.doneDate)}`}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          {job.status === "SCHEDULED" && (
            <Button onClick={() => start.mutate({ id })} disabled={start.isPending}>
              Start job
            </Button>
          )}
          {job.status === "IN_PROGRESS" && (
            <Button onClick={() => complete.mutate({ id })} disabled={complete.isPending}>
              Mark complete
            </Button>
          )}
          {job.status === "DONE_NOT_INVOICED" && (
            <Link href={`/invoices/new?jobId=${job.id}`} className={buttonVariants({})}>
              Compose invoice
            </Link>
          )}
          {job.status === "INVOICED" && job.invoiceId && (
            <Link href={`/invoices/${job.invoiceId}`} className={buttonVariants({ variant: "secondary" })}>
              View invoice
            </Link>
          )}
        </div>
      </div>

      {job.notes && (
        <Card>
          <CardContent className="p-4 text-sm text-neutral-700">{job.notes}</CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Line items</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {job.lines.length === 0 ? (
            <p className="text-sm text-neutral-500">No planned lines yet — add anything billed on site below.</p>
          ) : (
            <div className="flex flex-col divide-y divide-neutral-100">
              {job.lines.map((line) => (
                <div key={line.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-neutral-800">{line.description}</span>
                    {line.lineType === "CHANGE_ORDER" && (
                      <span className={cn("flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium", "border-amber-300 bg-amber-100 text-amber-800")}>
                        <Sparkles className="h-3 w-3" /> Added on site
                      </span>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-4 text-sm text-neutral-500">
                    <span>
                      {Number(line.quantity)} × {formatCurrency(line.rate)}
                    </span>
                    <span className="w-20 text-right font-medium text-neutral-900">{formatCurrency(line.amount)}</span>
                    {canEditLines && (
                      <button
                        type="button"
                        onClick={() => removeLine.mutate({ jobId: id, lineId: line.id })}
                        className="text-neutral-400 hover:text-red-600"
                        aria-label="Remove line"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {canEditLines && <AddChangeOrderLine jobId={id} catalog={activeCatalog} />}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Photos</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {job.attachments.length > 0 && (
            <div className="flex flex-wrap gap-3">
              {job.attachments.map((a) => (
                // eslint-disable-next-line @next/next/no-img-element -- uploaded field photos, not build-time assets
                <img key={a.id} src={a.url} alt="" className="h-20 w-20 rounded-md border border-neutral-200 object-cover" />
              ))}
            </div>
          )}
          <PhotoUploader photos={photos} onChange={handlePhotosChange} />
        </CardContent>
      </Card>
    </div>
  );
}
