"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { formatDate } from "@/lib/utils";
import { jobStatusLabel, jobStatusVariant } from "@/lib/status";

export default function SchedulePage() {
  const [crewId, setCrewId] = useState("");
  const utils = trpc.useUtils();
  const { data: crews } = trpc.crews.list.useQuery();
  const { data: jobs, isLoading } = trpc.jobs.scheduleView.useQuery({ crewId: crewId || undefined });
  const start = trpc.jobs.start.useMutation({ onSuccess: () => utils.jobs.scheduleView.invalidate() });

  const groups = useMemo(() => {
    const map = new Map<string, typeof jobs>();
    for (const job of jobs ?? []) {
      const key = job.scheduledDate ? formatDate(job.scheduledDate) : "Unscheduled";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(job);
    }
    return Array.from(map.entries());
  }, [jobs]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Schedule</h1>
          <p className="text-sm text-neutral-500">Scheduled and in-progress jobs, soonest first.</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={crewId} onChange={(e) => setCrewId(e.target.value)} className="w-40">
            <option value="">All crews</option>
            {crews?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <Link href="/schedule/new" className={buttonVariants({})}>
            Schedule a job
          </Link>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-neutral-500">Loading…</p>
      ) : !jobs || jobs.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-neutral-500">
            Nothing scheduled. Convert an accepted estimate or schedule a job directly.
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-6">
          {groups.map(([date, jobsForDate]) => (
            <div key={date}>
              <h2 className="mb-2 text-sm font-semibold text-neutral-500">{date}</h2>
              <div className="flex flex-col divide-y divide-neutral-200 rounded-lg border border-neutral-200 bg-white">
                {jobsForDate!.map((job) => (
                  <div key={job.id} className="flex items-center justify-between gap-4 px-5 py-4">
                    <div className="min-w-0">
                      <Link href={`/jobs/${job.id}`} className="truncate font-medium text-neutral-900 hover:underline">
                        {job.name}
                      </Link>
                      <p className="text-sm text-neutral-500">
                        {job.customer.name}
                        {job.scheduledWindow && ` · ${job.scheduledWindow}`}
                        {job.crew && ` · ${job.crew.name}`}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <Badge variant={jobStatusVariant[job.status]}>{jobStatusLabel[job.status]}</Badge>
                      {job.status === "SCHEDULED" && (
                        <Button size="sm" variant="secondary" onClick={() => start.mutate({ id: job.id })} disabled={start.isPending}>
                          Start
                        </Button>
                      )}
                      <Link href={`/jobs/${job.id}`} className={buttonVariants({ size: "sm" })}>
                        Work order
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
