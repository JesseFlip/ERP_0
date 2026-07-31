"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

export default function CrewsPage() {
  const utils = trpc.useUtils();
  const { data: crews, isLoading } = trpc.crews.list.useQuery();
  const create = trpc.crews.create.useMutation({ onSuccess: () => utils.crews.list.invalidate() });
  const setActive = trpc.crews.setActive.useMutation({ onSuccess: () => utils.crews.list.invalidate() });

  const [name, setName] = useState("");

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    create.mutate({ name: name.trim() });
    setName("");
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Crews</h1>
        <p className="text-sm text-neutral-500">Named teams you can assign to scheduled jobs.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add a crew</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAdd} className="flex items-end gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="crew-name">Name</Label>
              <Input
                id="crew-name"
                placeholder="e.g. Crew A, Mike & Dave"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-64"
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
      ) : !crews || crews.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-neutral-500">
            No crews yet. Add one above to start assigning scheduled jobs.
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-5 py-3 font-medium">Name</th>
                <th className="px-5 py-3 font-medium">Active</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {crews.map((crew) => (
                <tr key={crew.id} className={crew.active ? "" : "opacity-50"}>
                  <td className="px-5 py-3 font-medium text-neutral-900">{crew.name}</td>
                  <td className="px-5 py-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setActive.mutate({ id: crew.id, active: !crew.active })}
                    >
                      {crew.active ? "Deactivate" : "Activate"}
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
