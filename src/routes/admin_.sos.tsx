import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Panel } from "@/components/medra/DashboardShell";
import { AdminPage, FilterTabs, Pill } from "@/components/medra/RoleDashboard";
import { EmptyState, QueryBoundary } from "@/components/medra/States";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { formatDate } from "@/lib/medra";
import { statusLabel } from "@/lib/dashboard";
import { useSosIncidents } from "@/lib/ops";

export const Route = createFileRoute("/admin_/sos")({
  head: () => ({
    meta: [
      { title: "SOS incidents — Medra admin" },
      {
        name: "description",
        content:
          "Respond to Medra rider SOS alerts with live location, incident type and an acknowledgement trail.",
      },
      { property: "og:title", content: "SOS incidents — Medra admin" },
      { property: "og:description", content: "Rider safety incident response on Medra." },
    ],
  }),
  component: AdminSosPage,
});

const FILTERS = [
  { key: "open", label: "Open" },
  { key: "acknowledged", label: "Acknowledged" },
  { key: "resolved", label: "Resolved" },
  { key: "all", label: "All" },
];

const TONE: Record<string, string> = {
  open: "bg-destructive/15 text-destructive",
  acknowledged: "bg-amber/20 text-amber",
  resolved: "bg-leaf/15 text-leaf",
};

function AdminSosPage() {
  const [filter, setFilter] = useState("open");
  const incidents = useSosIncidents();
  const queryClient = useQueryClient();

  const rows = (incidents.data ?? []).filter((i) => filter === "all" || i.status === filter);

  const update = useMutation({
    mutationFn: async (input: { id: string; status: string }) => {
      const { error } = await supabase
        .from("sos_incidents")
        .update({
          status: input.status,
          ...(input.status === "acknowledged" ? { acknowledged_at: new Date().toISOString() } : {}),
        })
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Incident updated");
      void queryClient.invalidateQueries({ queryKey: ["sos-incidents"] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Could not update incident"),
  });

  return (
    <AdminPage title="SOS incidents" subtitle="Rider safety alerts, newest first">
      <FilterTabs options={FILTERS} value={filter} onChange={setFilter} />
      <Panel title="Incidents">
        <QueryBoundary
          isLoading={incidents.isLoading}
          error={incidents.error}
          isEmpty={rows.length === 0}
          onRetry={() => void incidents.refetch()}
          empty={
            <EmptyState
              icon={<ShieldAlert className="size-5" />}
              title="No SOS incidents in this view"
              body="Alerts raised by riders appear here immediately, ahead of the normal support queue."
            />
          }
        >
          <div className="space-y-3">
            {rows.map((i) => (
              <div
                key={i.id}
                className="rounded-xl border border-border p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold">{statusLabel(i.kind ?? "sos")}</p>
                    <p className="text-sm text-muted-foreground">
                      Raised {formatDate(i.created_at)}
                      {i.acknowledged_at ? ` · Acknowledged ${formatDate(i.acknowledged_at)}` : ""}
                    </p>
                    {i.note && <p className="mt-1 text-sm">{i.note}</p>}
                    {i.latitude != null && i.longitude != null && (
                      <a
                        className="mt-1 inline-block text-sm font-semibold text-primary hover:underline"
                        href={`https://www.google.com/maps?q=${i.latitude},${i.longitude}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Open rider location
                      </a>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Pill tone={TONE[i.status]}>{statusLabel(i.status)}</Pill>
                    {i.status !== "acknowledged" && i.status !== "resolved" && (
                      <Button
                        size="sm"
                        className="rounded-lg font-bold"
                        disabled={update.isPending}
                        onClick={() => update.mutate({ id: i.id, status: "acknowledged" })}
                      >
                        Acknowledge
                      </Button>
                    )}
                    {i.status !== "resolved" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-lg font-bold"
                        disabled={update.isPending}
                        onClick={() => update.mutate({ id: i.id, status: "resolved" })}
                      >
                        Resolve
                      </Button>
                    )}
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
