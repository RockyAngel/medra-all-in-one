import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, Banknote, LifeBuoy, ShoppingBag, Store } from "lucide-react";
import { Panel, StatCard } from "@/components/medra/DashboardShell";
import { AdminPage, DataTable, Pill } from "@/components/medra/RoleDashboard";
import { EmptyState, QueryBoundary } from "@/components/medra/States";
import { Button } from "@/components/ui/button";
import { statusLabel } from "@/lib/dashboard";
import { useAdminOrders, useAdminOverview } from "@/lib/ops";
import { formatDate, formatNaira } from "@/lib/medra";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin Dashboard — Medra" },
      {
        name: "description",
        content:
          "Medra admin dashboard: monitor orders and deliveries, review approvals, refunds, payouts and safety reports.",
      },
      { property: "og:title", content: "Admin Dashboard — Medra" },
      {
        property: "og:description",
        content: "Operational controls for orders, approvals, payments and safety on Medra.",
      },
    ],
  }),
  component: AdminDashboard,
});

function AdminDashboard() {
  const overview = useAdminOverview();
  const orders = useAdminOrders("all");
  const stats = overview.data;

  return (
    <AdminPage
      title="Platform overview"
      subtitle="Every figure is read live from the platform database"
      topRight={
        <Button asChild size="sm" className="rounded-full">
          <Link to="/admin/pharmacy-applications">Review queue</Link>
        </Button>
      }
    >
      <QueryBoundary
        isLoading={overview.isLoading}
        error={overview.error}
        onRetry={() => void overview.refetch()}
      >
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Gross order value"
            value={formatNaira(stats?.gmv ?? 0)}
            tone="leaf"
            icon={<Banknote className="size-4" />}
          />
          <StatCard
            label="Orders"
            value={String(stats?.orders ?? 0)}
            tone="grape"
            icon={<ShoppingBag className="size-4" />}
          />
          <StatCard
            label="Stores"
            value={String(stats?.stores ?? 0)}
            tone="sky"
            icon={<Store className="size-4" />}
          />
          <StatCard
            label="Support tickets"
            value={String(stats?.tickets ?? 0)}
            tone="amber"
            icon={<LifeBuoy className="size-4" />}
          />
        </div>

        <div className="grid gap-4 xl:grid-cols-3">
          <Panel title="Queues needing attention">
            <ul className="space-y-2 text-sm">
              <QueueRow label="Seller applications" count={stats?.sellerApps ?? 0} to="/admin/seller-approvals" />
              <QueueRow label="Rider applications" count={stats?.riderApps ?? 0} to="/admin/rider-approvals" />
              <QueueRow label="Refund requests" count={stats?.refunds ?? 0} to="/admin/refunds" />
              <QueueRow label="Payout requests" count={stats?.payouts ?? 0} to="/admin/payouts" />
            </ul>
          </Panel>

          <Panel title="Safety & logistics">
            <ul className="space-y-2 text-sm">
              <QueueRow label="SOS incidents" count={stats?.sos ?? 0} to="/admin/sos" />
              <QueueRow label="Deliveries" count={stats?.deliveries ?? 0} to="/admin/deliveries" />
            </ul>
            {(stats?.sos ?? 0) > 0 && (
              <p className="mt-4 flex items-center gap-2 rounded-xl bg-destructive/10 p-3 text-xs font-semibold text-destructive">
                <AlertTriangle className="size-4" /> Safety reports are open — review them first.
              </p>
            )}
          </Panel>

          <Panel title="Support">
            <p className="text-sm text-muted-foreground">
              Handle customer, seller and rider conversations from the shared support inbox.
            </p>
            <Button asChild size="sm" className="mt-4 rounded-full">
              <Link to="/admin/support">Open support inbox</Link>
            </Button>
          </Panel>
        </div>

        <Panel title="Latest orders">
          <QueryBoundary
            isLoading={orders.isLoading}
            error={orders.error}
            isEmpty={(orders.data ?? []).length === 0}
            onRetry={() => void orders.refetch()}
            empty={
              <EmptyState
                icon={<ShoppingBag className="size-5" />}
                title="No orders yet"
                body="Orders placed by customers will show up here as soon as checkout completes."
              />
            }
          >
            <DataTable columns={["Order", "Status", "Payment", "Total", "Placed"]}>
              {(orders.data ?? []).slice(0, 10).map((row) => (
                <tr key={row.id}>
                  <td className="py-3 pr-4 font-semibold">{row.order_number}</td>
                  <td className="py-3 pr-4">
                    <Pill>{statusLabel(row.status)}</Pill>
                  </td>
                  <td className="py-3 pr-4 text-muted-foreground">{statusLabel(row.payment_status ?? "—")}</td>
                  <td className="py-3 pr-4 font-semibold">{formatNaira(row.total)}</td>
                  <td className="py-3 pr-4 text-muted-foreground">{formatDate(row.created_at)}</td>
                </tr>
              ))}
            </DataTable>
            <div className="mt-4">
              <Button asChild size="sm" variant="outline" className="rounded-full">
                <Link to="/admin/orders">Open order monitoring</Link>
              </Button>
            </div>
          </QueryBoundary>
        </Panel>
      </QueryBoundary>
    </AdminPage>
  );
}

function QueueRow({ label, count, to }: { label: string; count: number; to: string }) {
  return (
    <li className="flex items-center justify-between gap-3 border-b border-border pb-2 last:border-0">
      <Link to={to} className="font-semibold hover:text-primary">
        {label}
      </Link>
      <Pill tone={count > 0 ? "bg-amber/20 text-amber" : undefined}>{count}</Pill>
    </li>
  );
}
