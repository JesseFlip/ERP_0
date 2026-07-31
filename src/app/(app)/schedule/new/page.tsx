"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";

export default function ScheduleNewJobPage() {
  const router = useRouter();
  const utils = trpc.useUtils();
  const { data: customers } = trpc.customers.list.useQuery();
  const { data: crews } = trpc.crews.list.useQuery();

  const [customerId, setCustomerId] = useState("");
  const [name, setName] = useState("");
  const [scheduledDate, setScheduledDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [scheduledWindow, setScheduledWindow] = useState("");
  const [crewId, setCrewId] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const createScheduled = trpc.jobs.createScheduled.useMutation();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!customerId || !name.trim()) {
      setError("Pick a customer and name the job.");
      return;
    }
    const job = await createScheduled.mutateAsync({
      customerId,
      name: name.trim(),
      scheduledDate,
      scheduledWindow: scheduledWindow.trim() || undefined,
      crewId: crewId || undefined,
      notes: notes.trim() || undefined,
    });
    await utils.jobs.scheduleView.invalidate();
    router.push(`/jobs/${job.id}`);
  }

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="mb-6 text-2xl font-semibold text-neutral-900">Schedule a job</h1>
      <Card>
        <CardHeader>
          <CardTitle>Job details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="customer">Customer</Label>
              <Select id="customer" value={customerId} onChange={(e) => setCustomerId(e.target.value)} required>
                <option value="">Select a customer…</option>
                {customers?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name">Job name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>

            <div className="flex gap-3">
              <div className="flex flex-1 flex-col gap-1.5">
                <Label htmlFor="date">Date</Label>
                <Input
                  id="date"
                  type="date"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  required
                />
              </div>
              <div className="flex flex-1 flex-col gap-1.5">
                <Label htmlFor="window">Time window</Label>
                <Input
                  id="window"
                  placeholder="e.g. 8am–10am"
                  value={scheduledWindow}
                  onChange={(e) => setScheduledWindow(e.target.value)}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="crew">Crew</Label>
              <Select id="crew" value={crewId} onChange={(e) => setCrewId(e.target.value)}>
                <option value="">Unassigned</option>
                {crews?.filter((c) => c.active).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="mt-2 flex gap-2">
              <Button type="submit" disabled={createScheduled.isPending}>
                {createScheduled.isPending ? "Saving…" : "Schedule job"}
              </Button>
              <Button type="button" variant="secondary" onClick={() => router.back()}>
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
