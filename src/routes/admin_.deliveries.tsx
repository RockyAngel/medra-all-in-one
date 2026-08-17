import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Truck } from "lucide-react";
import { Panel } from "@/components/medra/DashboardShell";
import { AdminPage, DataTable, FilterTabs, Pill } from "@/components/medra/RoleDashboard";
import { EmptyState, QueryBoundary } from "@/components/medra/States";
import { formatDate, formatNaira } from "@/lib/medra";
import { statusLabel } from "@/lib/dashboard";
import { useAdminDeliveries } from "@/lib/ops";

export const Route = createFileRoute("/admin_/deliveries")({
  head: () => ({
    meta: [
      { title: "Delivery monitoring — Medra admin" },
      {
        name: "description",
        content:
          "Track every Medra delivery, rider assignment, fee split and priority dispatch in one operations queue.",
      },
      { property: "og:title", content: "Delivery monitoring — Medra admin" },
      { property: "og:description", content: "Live delivery operations across the Medra platform." },
    ],
  }),
  component: AdminDeliveriesPage,
});

const FILTERS = [
  { key: "all", label: "All" },
  { key: "open", label: "Awaiting rider" },
  { key: "active", label: "In progress" },
  { key: "priority", label: "Priority" },
  { key: "delivered", label: "Delivered" },
];

const TONE: Record<string, string> = {
  delivered: "bg-leaf/15 text-leaf",
  completed: "bg-leaf/15 text-leaf",
  failed: "bg-destructive/15 text-destructive",
  cancelled: "bg-destructive/15 text-destructive",
  pending: "bg-amber/20 text-amber",
  queued: "bg-amber/20 text-amber",
};

function AdminDeliveriesPage() {
  const [filter, setFilter] = useState("all");
  const deliveries = useAdminDeliveries();

  const rows = (deliveries.data ?? []).filter((d) => {
    if (filter === "all") return true;
    if (filter === "priority") return d.is_priority === true;
    if (filter === "delivered") return d.status === "delivered" || d.status === "completed";
    if (filter === "open") return !d.rider_id;
    return !!d.rider_id && d.status !== "delivered" && d.status !== "completed";
  });

  return (
    <AdminPage title="Deliveries" subtitle="Rider assignments, milestones and fee splits">
      <FilterTabs options={FILTERS} value={filter} onChange={setFilter} />
      <Panel title="Delivery queue">
        <QueryBoundary
          isLoading={deliveries.isLoading}
          error={deliveries.error}
          isEmpty={rows.length === 0}
          onRetry={() => void deliveries.refetch()}
          empty={
            <EmptyState
              icon={<Truck className="size-5" />}
              title="No deliveries in this view"
              body="Deliveries appear as soon as a paid order is dispatched to riders."
            />
          }
        >
          <DataTable
            columns={["Order", "Store", "Status", "Milestone", "Rider fee", "Platform", "Created", "Flags"]}
          >
            {rows.map((d) => (
              <tr key={d.id}>
                <td className="py-3 pr-4 font-semibold">{d.orders?.order_number ?? "—"}</td>
                <td className="py-3 pr-4 text-muted-foreground">
                  {d.stores?.name ?? "—"}
                  {d.stores?.city ? ` · ${d.stores.city}` : ""}
                </td>
                <td className="py-3 pr-4">
                  <Pill tone={TONE[d.status]}>{statusLabel(d.status)}</Pill>
                </td>
                <td className="py-3 pr-4 text-muted-foreground">
                  {d.milestone ? statusLabel(d.milestone) : "—"}
                </td>
                <td className="py-3 pr-4">{formatNaira(d.rider_amount ?? 0)}</td>
                <td className="py-3 pr-4">{formatNaira(d.platform_amount ?? 0)}</td>
                <td className="py-3 pr-4 text-muted-foreground">{formatDate(d.created_at)}</td>
                <td className="py-3 pr-4 space-x-1">
                  {d.is_priority ? <Pill tone="bg-destructive/15 text-destructive">Priority</Pill> : null}
                  {d.is_peak ? <Pill tone="bg-amber/20 text-amber">Peak</Pill> : null}
                  {!d.rider_id ? <Pill tone="bg-sky/15 text-sky">Unassigned</Pill> : null}
                </td>
              </tr>
            ))}
          </DataTable>
        </QueryBoundary>
      </Panel>
    </AdminPage>
  );
}
