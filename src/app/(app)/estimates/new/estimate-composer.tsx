"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { LineItemEditor, type EditableLine } from "@/components/line-item-editor";

export function EstimateComposer() {
  const router = useRouter();
  const { data: customers } = trpc.customers.list.useQuery();
  const { data: catalog } = trpc.catalog.list.useQuery();
  const activeCatalog = useMemo(() => catalog?.filter((c) => c.active) ?? [], [catalog]);

  const [customerId, setCustomerId] = useState("");
  const [memo, setMemo] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [lines, setLines] = useState<EditableLine[]>([
    { key: crypto.randomUUID(), description: "", quantity: 1, rate: 0 },
  ]);
  const [error, setError] = useState<string | null>(null);

  const createEstimate = trpc.estimates.create.useMutation();

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
      const estimate = await createEstimate.mutateAsync({
        customerId,
        memo: memo.trim() || undefined,
        validUntil: validUntil || undefined,
        lines: cleanLines.map((l) => ({
          catalogItemId: l.catalogItemId,
          description: l.description.trim(),
          quantity: l.quantity,
          rate: l.rate,
        })),
      });
      router.push(`/estimates/${estimate.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-1 text-2xl font-semibold text-neutral-900">New estimate</h1>
      <p className="mb-6 text-sm text-neutral-500">
        Same price list as invoicing. Send it, then convert to a scheduled job once it&rsquo;s accepted.
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Customer &amp; details</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
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
              <Label htmlFor="memo">Memo / job description</Label>
              <Textarea id="memo" rows={2} value={memo} onChange={(e) => setMemo(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="validUntil">Valid until (optional)</Label>
              <Input
                id="validUntil"
                type="date"
                className="w-48"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Line items</CardTitle>
          </CardHeader>
          <CardContent>
            <LineItemEditor lines={lines} onChange={setLines} catalog={activeCatalog} />
          </CardContent>
        </Card>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-2">
          <Button type="submit" size="lg" disabled={createEstimate.isPending}>
            {createEstimate.isPending ? "Saving…" : "Save estimate"}
          </Button>
          <Button type="button" variant="secondary" size="lg" onClick={() => router.back()}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
