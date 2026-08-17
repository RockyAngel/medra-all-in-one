import { createFileRoute } from "@tanstack/react-router";
import { History } from "lucide-react";
import { Panel } from "@/components/medra/DashboardShell";
import { DataTable, Pill, RiderPage } from "@/components/medra/RoleDashboard";
import { EmptyState, QueryBoundary } from "@/components/medra/States";
import { formatDate, formatNaira } from "@/lib/medra";
import { useRiderDeliveries } from "@/lib/ops";

export const Route = createFileRoute("/rider_/history")({
  head: () => ({
    meta: [
      { title: "Delivery history — Medra rider" },
      {
        name: "description",
        content:
          "Review every Medra delivery you have completed or missed, with the fee you earned on each job.",
      },
      { property: "og:title", content: "Delivery history — Medra rider" },
      { property: "og:description", content: "Your completed Medra deliveries." },
    ],
  }),
  component: RiderHistoryPage,
});

const TONE: Record<string, string> = {
  delivered: "bg-leaf/15 text-leaf",
  completed: "bg-leaf/15 text-leaf",
  cancelled: "bg-destructive/15 text-destructive",
  delivery_failed: "bg-destructive/15 text-destructive",
  failed: "bg-destructive/15 text-destructive",
};

function RiderHistoryPage() {
  const deliveries = useRiderDeliveries("history");

  return (
    <RiderPage title="Delivery history" subtitle="Everything you have delivered on Medra">
      <Panel title="Past deliveries">
        <QueryBoundary
          isLoading={deliveries.isLoading}
          error={deliveries.error}
          isEmpty={(deliveries.data ?? []).length === 0}
          onRetry={() => void deliveries.refetch()}
          empty={
            <EmptyState
              icon={<History className="size-5" />}
              title="No completed deliveries yet"
              body="Finished jobs move here with the exact fee credited to your wallet."
            />
          }
        >
          <DataTable columns={["Order", "Store", "Delivered", "Distance", "You earned", "Status"]}>
            {(deliveries.data ?? []).map((d) => (
              <tr key={d.id}>
                <td className="py-3 pr-4 font-semibold">{d.orders?.order_number ?? "—"}</td>
                <td className="py-3 pr-4">{d.stores?.name ?? "—"}</td>
                <td className="py-3 pr-4 text-muted-foreground">
                  {d.delivered_at ? formatDate(d.delivered_at) : "—"}
                </td>
                <td className="py-3 pr-4">
                  {d.distance_meters ? `${(d.distance_meters / 1000).toFixed(1)} km` : "—"}
                </td>
                <td className="py-3 pr-4 font-semibold">{formatNaira(d.rider_amount)}</td>
                <td className="py-3 pr-4">
                  <Pill tone={TONE[d.status]}>{d.status.replace(/_/g, " ")}</Pill>
                </td>
              </tr>
            ))}
          </DataTable>
        </QueryBoundary>
      </Panel>
    </RiderPage>
  );
}
