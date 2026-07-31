"use client";

import { useRef, useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils";

function parseCsv(text: string) {
  const lines = text.trim().split(/\r?\n/);
  const [headerLine, ...rest] = lines;
  const headers = headerLine.split(",").map((h) => h.trim().toLowerCase());
  return rest
    .filter((line) => line.trim().length > 0)
    .map((line) => {
      const cells = line.split(",").map((c) => c.trim());
      const row = Object.fromEntries(headers.map((h, i) => [h, cells[i]]));
      return {
        name: row.name ?? "",
        description: row.description || undefined,
        unit: row.unit || "ea",
        kind: (row.kind?.toUpperCase() === "MATERIAL" ? "MATERIAL" : "SERVICE") as "SERVICE" | "MATERIAL",
        defaultRate: Number(row.rate ?? row.defaultrate ?? 0),
      };
    })
    .filter((row) => row.name);
}

export default function CatalogPage() {
  const utils = trpc.useUtils();
  const { data: items, isLoading } = trpc.catalog.list.useQuery();
  const { data: qboStatus } = trpc.qbo.status.useQuery();

  const [name, setName] = useState("");
  const [unit, setUnit] = useState("ea");
  const [kind, setKind] = useState<"SERVICE" | "MATERIAL">("SERVICE");
  const [rate, setRate] = useState("");

  const create = trpc.catalog.create.useMutation({ onSuccess: () => utils.catalog.list.invalidate() });
  const setActive = trpc.catalog.setActive.useMutation({ onSuccess: () => utils.catalog.list.invalidate() });
  const importRows = trpc.catalog.importRows.useMutation({ onSuccess: () => utils.catalog.list.invalidate() });
  const syncFromQbo = trpc.catalog.pullFromQbo.useMutation({ onSuccess: () => utils.catalog.list.invalidate() });
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !rate) return;
    create.mutate({ name: name.trim(), unit, kind, defaultRate: Number(rate) });
    setName("");
    setRate("");
  }

  async function handleCsvFile(file: File) {
    const text = await file.text();
    const rows = parseCsv(text);
    if (rows.length > 0) importRows.mutate(rows);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Price list</h1>
          <p className="text-sm text-neutral-500">Services and materials with default rates.</p>
        </div>
        <div className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleCsvFile(e.target.files[0])}
          />
          <Button variant="secondary" onClick={() => fileInputRef.current?.click()} disabled={importRows.isPending}>
            {importRows.isPending ? "Importing…" : "Import CSV"}
          </Button>
          {qboStatus?.connected && (
            <Button variant="secondary" onClick={() => syncFromQbo.mutate()} disabled={syncFromQbo.isPending}>
              {syncFromQbo.isPending ? "Syncing…" : "Sync from QBO"}
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add an item</CardTitle>
          <CardDescription>CSV columns: name, description, kind, unit, rate</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="item-name">Name</Label>
              <Input id="item-name" value={name} onChange={(e) => setName(e.target.value)} className="w-56" required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="item-kind">Kind</Label>
              <Select id="item-kind" value={kind} onChange={(e) => setKind(e.target.value as "SERVICE" | "MATERIAL")} className="w-32">
                <option value="SERVICE">Service</option>
                <option value="MATERIAL">Material</option>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="item-unit">Unit</Label>
              <Input id="item-unit" value={unit} onChange={(e) => setUnit(e.target.value)} className="w-20" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="item-rate">Rate</Label>
              <Input
                id="item-rate"
                type="number"
                min={0}
                step="0.01"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                className="w-28"
                required
              />
            </div>
            <Button type="submit" disabled={create.isPending}>
              Add
            </Button>
          </form>
        </CardContent>
      </Card>

      {isLoading ? (
        <p className="text-sm text-neutral-500">Loading…</p>
      ) : !items || items.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-neutral-500">
            No catalog items yet. Add one above or import a CSV.
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-5 py-3 font-medium">Name</th>
                <th className="px-5 py-3 font-medium">Kind</th>
                <th className="px-5 py-3 font-medium">Unit</th>
                <th className="px-5 py-3 font-medium">Rate</th>
                <th className="px-5 py-3 font-medium">Active</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {items.map((item) => (
                <tr key={item.id} className={item.active ? "" : "opacity-50"}>
                  <td className="px-5 py-3 font-medium text-neutral-900">{item.name}</td>
                  <td className="px-5 py-3 text-neutral-500 capitalize">{item.kind.toLowerCase()}</td>
                  <td className="px-5 py-3 text-neutral-500">{item.unit}</td>
                  <td className="px-5 py-3 text-neutral-500">{formatCurrency(item.defaultRate)}</td>
                  <td className="px-5 py-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setActive.mutate({ id: item.id, active: !item.active })}
                    >
                      {item.active ? "Deactivate" : "Activate"}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
