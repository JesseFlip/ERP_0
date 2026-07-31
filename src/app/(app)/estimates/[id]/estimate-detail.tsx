"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, X, Send, CalendarPlus } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import { estimateStatusLabel, estimateStatusVariant } from "@/lib/status";

export function EstimateDetail({ id }: { id: string }) {
  const router = useRouter();
  const utils = trpc.useUtils();
  const { data: estimate, isLoading } = trpc.estimates.getById.useQuery({ id });

  const send = trpc.estimates.send.useMutation({ onSuccess: () => utils.estimates.getById.invalidate({ id }) });
  const respond = trpc.estimates.respond.useMutation({ onSuccess: () => utils.estimates.getById.invalidate({ id }) });
  const convertToJob = trpc.estimates.convertToJob.useMutation({
    onSuccess: (job) => {
      utils.estimates.getById.invalidate({ id });
      router.push(`/jobs/${job.id}`);
    },
  });

  if (isLoading) return <p className="text-sm text-neutral-500">Loading…</p>;
  if (!estimate) return <p className="text-sm text-red-600">Estimate not found.</p>;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <Link href="/estimates" className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-700">
        <ArrowLeft className="h-3.5 w-3.5" /> All estimates
      </Link>

      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold text-neutral-900">{estimate.customer.name}</h1>
            <Badge variant={estimateStatusVariant[estimate.status]}>{estimateStatusLabel[estimate.status]}</Badge>
          </div>
          {estimate.memo && <p className="text-sm text-neutral-500">{estimate.memo}</p>}
          <p className="mt-1 text-xs text-neutral-400">
            Created {formatDate(estimate.createdAt)}
            {estimate.validUntil && ` · valid until ${formatDate(estimate.validUntil)}`}
          </p>
        </div>
        <p className="text-2xl font-semibold text-neutral-900">{formatCurrency(estimate.total)}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {estimate.status === "DRAFT" && (
          <Button onClick={() => send.mutate({ id })} disabled={send.isPending}>
            <Send className="h-3.5 w-3.5" /> Mark as sent
          </Button>
        )}
        {estimate.status === "SENT" && (
          <>
            <Button onClick={() => respond.mutate({ id, accepted: true })} disabled={respond.isPending}>
              <Check className="h-3.5 w-3.5" /> Customer accepted
            </Button>
            <Button
              variant="secondary"
              onClick={() => respond.mutate({ id, accepted: false })}
              disabled={respond.isPending}
            >
              <X className="h-3.5 w-3.5" /> Customer declined
            </Button>
          </>
        )}
        {estimate.status === "ACCEPTED" && !estimate.job && (
          <Button onClick={() => convertToJob.mutate({ id })} disabled={convertToJob.isPending}>
            <CalendarPlus className="h-3.5 w-3.5" />
            {convertToJob.isPending ? "Scheduling…" : "Convert to scheduled job"}
          </Button>
        )}
        {estimate.job && (
          <Link href={`/jobs/${estimate.job.id}`} className="inline-flex h-9 items-center justify-center rounded-md bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-700">
            View scheduled job
          </Link>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Line items</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col divide-y divide-neutral-100">
          {estimate.lines.map((line) => (
            <div key={line.id} className="flex items-center justify-between gap-3 py-3">
              <span className="text-sm text-neutral-800">{line.description}</span>
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
    </div>
  );
}
