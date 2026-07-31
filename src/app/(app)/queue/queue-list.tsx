"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/utils";

function DismissRow({ jobId }: { jobId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const utils = trpc.useUtils();
  const dismiss = trpc.jobs.dismiss.useMutation({
    onSuccess: () => utils.jobs.queue.invalidate(),
  });

  if (!open) {
    return (
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        Dismiss
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Input
        autoFocus
        placeholder="Reason (e.g. billed manually)"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        className="h-8 w-48"
      />
      <Button
        size="sm"
        variant="destructive"
        disabled={!reason.trim() || dismiss.isPending}
        onClick={() => dismiss.mutate({ id: jobId, reason: reason.trim() })}
      >
        Confirm
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
        Cancel
      </Button>
    </div>
  );
}

export function QueueList() {
  const { data: jobs, isLoading } = trpc.jobs.queue.useQuery();

  if (isLoading) return <p className="text-sm text-neutral-500">Loading…</p>;

  if (!jobs || jobs.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-neutral-500">
          Nothing waiting to be invoiced. Log a finished job to add one to the queue.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col divide-y divide-neutral-200 rounded-lg border border-neutral-200 bg-white">
      {jobs.map((job) => (
        <div key={job.id} className="flex items-center justify-between gap-4 px-5 py-4">
          <div className="min-w-0">
            <p className="truncate font-medium text-neutral-900">{job.name}</p>
            <p className="text-sm text-neutral-500">
              {job.customer.name} · done {formatDate(job.doneDate)}
              {job.attachments.length > 0 ? ` · ${job.attachments.length} photo${job.attachments.length > 1 ? "s" : ""}` : ""}
            </p>
            {job.notes && <p className="mt-1 line-clamp-1 text-sm text-neutral-400">{job.notes}</p>}
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <DismissRow jobId={job.id} />
            <Link
              href={`/invoices/new?jobId=${job.id}`}
              className="inline-flex h-9 items-center justify-center rounded-md bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-700"
            >
              Compose invoice
            </Link>
          </div>
        </div>
      ))}
    </div>
  );
}
