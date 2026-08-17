import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Clock } from "lucide-react";
import { toast } from "sonner";
import { Panel } from "@/components/medra/DashboardShell";
import { AdminPage, FilterTabs, Pill } from "@/components/medra/RoleDashboard";
import { EmptyState, QueryBoundary } from "@/components/medra/States";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { formatDate } from "@/lib/medra";
import { statusLabel } from "@/lib/dashboard";
import { useLateDeliveries } from "@/lib/ops";

export const Route = createFileRoute("/admin_/late-deliveries")({
  head: () => ({
    meta: [
      { title: "Late deliveries — Medra admin" },
      {
        name: "description",
        content:
          "Investigate Medra deliveries flagged as late, record findings and close them out with a note.",
      },
      { property: "og:title", content: "Late deliveries — Medra admin" },
      { property: "og:description", content: "Late delivery investigations on Medra." },
    ],
  }),
  component: AdminLateDeliveriesPage,
});

const FILTERS = [
  { key: "open", label: "Open" },
  { key: "investigating", label: "Investigating" },
  { key: "resolved", label: "Resolved" },
  { key: "compensated", label: "Compensated" },
  { key: "dismissed", label: "Dismissed" },
  { key: "all", label: "All" },
];

const TONE: Record<string, string> = {
  open: "bg-destructive/15 text-destructive",
  investigating: "bg-amber/20 text-amber",
  resolved: "bg-leaf/15 text-leaf",
  compensated: "bg-leaf/15 text-leaf",
  dismissed: "bg-muted text-muted-foreground",
};

function AdminLateDeliveriesPage() {
  const [filter, setFilter] = useState("open");
  const events = useLateDeliveries();
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState<Record<string, string>>({});

  const rows = (events.data ?? []).filter((e) => filter === "all" || e.status === filter);

  const resolve = useMutation({
    mutationFn: async (input: { id: string; status: string }) => {
      const note = notes[input.id]?.trim();
      const { error } = await supabase.rpc("resolve_late_delivery", {
        _event_id: input.id,
        _status: input.status,
        ...(note ? { _note: note } : {}),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Late delivery updated");
      void queryClient.invalidateQueries({ queryKey: ["late-deliveries"] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Could not update this event"),
  });

  return (
    <AdminPage title="Late deliveries" subtitle="Deliveries automatically flagged past their promise time">
      <FilterTabs options={FILTERS} value={filter} onChange={setFilter} />
      <Panel title="Flagged deliveries">
        <QueryBoundary
          isLoading={events.isLoading}
          error={events.error}
          isEmpty={rows.length === 0}
          onRetry={() => void events.refetch()}
          empty={
            <EmptyState
              icon={<Clock className="size-5" />}
              title="No late deliveries in this view"
              body="Deliveries running more than 20 minutes past their promise time are flagged here automatically."
            />
          }
        >
          <div className="space-y-3">
            {rows.map((e) => (
              <div key={e.id} className="rounded-xl border border-border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold">
                      {e.orders?.order_number ?? "Order"} · {e.delay_minutes ?? 0} min late
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Expected {formatDate(e.expected_at)} · Detected {formatDate(e.detected_at)}
                      {e.deliveries?.status ? ` · Delivery ${statusLabel(e.deliveries.status)}` : ""}
                    </p>
                    {e.admin_note && (
                      <p className="mt-1 text-sm text-muted-foreground">Note: {e.admin_note}</p>
                    )}
                  </div>
                  <Pill tone={TONE[e.status]}>{statusLabel(e.status)}</Pill>
                </div>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <Input
                    value={notes[e.id] ?? ""}
                    onChange={(ev) => setNotes((prev) => ({ ...prev, [e.id]: ev.target.value }))}
                    placeholder="Investigation note"
                    className="h-10 rounded-lg"
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-lg font-bold"
                      disabled={resolve.isPending}
                      onClick={() => resolve.mutate({ id: e.id, status: "investigating" })}
                    >
                      Investigating
                    </Button>
                    <Button
                      size="sm"
                      className="rounded-lg font-bold"
                      disabled={resolve.isPending}
                      onClick={() => resolve.mutate({ id: e.id, status: "resolved" })}
                    >
                      Resolve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-lg font-bold"
                      disabled={resolve.isPending}
                      onClick={() => resolve.mutate({ id: e.id, status: "dismissed" })}
                    >
                      Dismiss
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </QueryBoundary>
      </Panel>
    </AdminPage>
  );
}
