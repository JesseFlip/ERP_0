"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils";

export type EditableLine = {
  key: string;
  catalogItemId?: string;
  description: string;
  quantity: number;
  rate: number;
};

export type CatalogOption = { id: string; name: string; defaultRate: number | string | { toString(): string }; unit: string };

/**
 * Shared line-item table for the estimate and invoice composers: pick from
 * the catalog or type a custom line, quantity × rate, running total.
 */
export function LineItemEditor({
  lines,
  onChange,
  catalog,
  extraColumn,
}: {
  lines: EditableLine[];
  onChange: (lines: EditableLine[]) => void;
  catalog: CatalogOption[];
  /** Optional per-line control rendered before the remove button (e.g. a change-order toggle). */
  extraColumn?: (line: EditableLine, update: (patch: Partial<EditableLine>) => void) => React.ReactNode;
}) {
  function updateLine(key: string, patch: Partial<EditableLine>) {
    onChange(lines.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function addCatalogLine(catalogItemId: string) {
    const item = catalog.find((c) => c.id === catalogItemId);
    if (!item) return;
    onChange([
      ...lines,
      {
        key: crypto.randomUUID(),
        catalogItemId: item.id,
        description: item.name,
        quantity: 1,
        rate: Number(item.defaultRate),
      },
    ]);
  }

  function addCustomLine() {
    onChange([...lines, { key: crypto.randomUUID(), description: "", quantity: 1, rate: 0 }]);
  }

  const subtotal = lines.reduce((sum, l) => sum + l.quantity * l.rate, 0);

  return (
    <div className="flex flex-col gap-3">
      {lines.map((line) => (
        <div
          key={line.key}
          className="flex flex-col gap-2 rounded-md border border-neutral-200 p-3 sm:flex-row sm:items-center"
        >
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
          {extraColumn?.(line, (patch) => updateLine(line.key, patch))}
          <button
            type="button"
            onClick={() => onChange(lines.filter((l) => l.key !== line.key))}
            className="shrink-0 text-neutral-400 hover:text-red-600"
            aria-label="Remove line"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <Button type="button" variant="secondary" size="sm" onClick={addCustomLine}>
          <Plus className="h-3.5 w-3.5" /> Custom line
        </Button>
        {catalog.length > 0 && (
          <Select
            className="w-56"
            value=""
            onChange={(e) => {
              if (e.target.value) addCatalogLine(e.target.value);
            }}
          >
            <option value="">+ Add from price list…</option>
            {catalog.map((item) => (
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
    </div>
  );
}
