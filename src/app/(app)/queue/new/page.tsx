"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { PhotoUploader, type UploadedPhoto } from "@/components/photo-uploader";

export default function NewJobPage() {
  const router = useRouter();
  const utils = trpc.useUtils();
  const { data: customers } = trpc.customers.list.useQuery();

  const [customerId, setCustomerId] = useState("");
  const [newCustomerName, setNewCustomerName] = useState("");
  const [name, setName] = useState("");
  const [doneDate, setDoneDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);
  const [error, setError] = useState<string | null>(null);

  const createCustomer = trpc.customers.create.useMutation();
  const createJob = trpc.jobs.create.useMutation();
  const addAttachment = trpc.jobs.addAttachment.useMutation();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    let resolvedCustomerId = customerId;
    if (!resolvedCustomerId && newCustomerName.trim()) {
      const created = await createCustomer.mutateAsync({ name: newCustomerName.trim() });
      resolvedCustomerId = created.id;
    }
    if (!resolvedCustomerId || !name.trim()) {
      setError("Pick or create a customer, and name the job.");
      return;
    }

    const job = await createJob.mutateAsync({
      customerId: resolvedCustomerId,
      name: name.trim(),
      doneDate,
      notes: notes.trim() || undefined,
    });

    for (const photo of photos) {
      await addAttachment.mutateAsync({ jobId: job.id, url: photo.url });
    }

    await utils.jobs.queue.invalidate();
    router.push("/queue");
  }

  const isSubmitting = createCustomer.isPending || createJob.isPending || addAttachment.isPending;

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="mb-6 text-2xl font-semibold text-neutral-900">Log a finished job</h1>
      <Card>
        <CardHeader>
          <CardTitle>Job details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="customer">Customer</Label>
              <Select
                id="customer"
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
              >
                <option value="">— New customer —</option>
                {customers?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
              {!customerId && (
                <Input
                  placeholder="New customer name"
                  value={newCustomerName}
                  onChange={(e) => setNewCustomerName(e.target.value)}
                />
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name">Job name</Label>
              <Input
                id="name"
                placeholder="e.g. Backyard tree removal"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="doneDate">Done date</Label>
              <Input
                id="doneDate"
                type="date"
                value={doneDate}
                onChange={(e) => setDoneDate(e.target.value)}
                required
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                rows={3}
                placeholder="Field notes, what the crew did, anything worth billing"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Before/after photos</Label>
              <PhotoUploader photos={photos} onChange={setPhotos} />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="mt-2 flex gap-2">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Saving…" : "Add to queue"}
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
