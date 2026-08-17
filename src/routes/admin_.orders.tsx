import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ShoppingBag } from "lucide-react";
import { Panel } from "@/components/medra/DashboardShell";
import { AdminPage, DataTable, FilterTabs, Pill } from "@/components/medra/RoleDashboard";
import { EmptyState, QueryBoundary } from "@/components/medra/States";
import { formatDate, formatNaira, ORDER_STATUS_LABEL } from "@/lib/medra";
import { useAdminOrders } from "@/lib/ops";

export const Route = createFileRoute("/admin_/orders")({
  head: () => ({
    meta: [
      { title: "Order monitoring — Medra admin" },
      {
        name: "description",
        content:
          "Monitor every Medra order across payment, fulfilment and delivery, and spot stalled or emergency orders early.",
      },
      { property: "og:title", content: "Order monitoring — Medra admin" },
      { property: "og:description", content: "Platform-wide order monitoring on Medra." },
    ],
  }),
  component: AdminOrdersPage,
});

const FILTERS = [
  { key: "all", label: "All" },
  { key: "paid", label: "Paid" },
  { key: "preparing", label: "Preparing" },
  { key: "out_for_delivery", label: "Out for delivery" },
  { key: "completed", label: "Completed" },
  { key: "disputed", label: "Disputed" },
];

const TONE: Record<string, string> = {
  completed: "bg-leaf/15 text-leaf",
  delivered: "bg-leaf/15 text-leaf",
  cancelled: "bg-destructive/15 text-destructive",
  disputed: "bg-destructive/15 text-destructive",
  payment_failed: "bg-destructive/15 text-destructive",
  pending_payment: "bg-amber/20 text-amber",
};

function AdminOrdersPage() {
  const [filter, setFilter] = useState("all");
  const orders = useAdminOrders(filter);

  return (
    <AdminPage title="Orders" subtitle="Every order on the platform, newest first">
      <FilterTabs options={FILTERS} value={filter} onChange={setFilter} />
      <Panel title="Orders">
        <QueryBoundary
          isLoading={orders.isLoading}
          error={orders.error}
          isEmpty={(orders.data ?? []).length === 0}
          onRetry={() => void orders.refetch()}
          empty={
            <EmptyState
              icon={<ShoppingBag className="size-5" />}
              title="No orders in this view"
              body="Orders appear here in real time as customers check out."
            />
          }
        >
          <DataTable columns={["Order", "Placed", "Total", "Payment", "Status", "Flags"]}>
            {(orders.data ?? []).map((o) => (
              <tr key={o.id}>
                <td className="py-3 pr-4 font-semibold">{o.order_number}</td>
                <td className="py-3 pr-4 text-muted-foreground">{formatDate(o.created_at)}</td>
                <td className="py-3 pr-4">{formatNaira(o.total)}</td>
                <td className="py-3 pr-4 capitalize">{(o.payment_status ?? "—").replace(/_/g, " ")}</td>
                <td className="py-3 pr-4">
                  <Pill tone={TONE[o.status]}>{ORDER_STATUS_LABEL[o.status] ?? o.status.replace(/_/g, " ")}</Pill>
                </td>
                <td className="py-3 pr-4">
                  {o.is_emergency ? <Pill tone="bg-destructive/15 text-destructive">Emergency</Pill> : "—"}
                </td>
              </tr>
            ))}
          </DataTable>
        </QueryBoundary>
      </Panel>
    </AdminPage>
  );
}
