import { createFileRoute, Link } from "@tanstack/react-router";
import { Banknote, Package, ShoppingBag } from "lucide-react";
import { Panel, StatCard } from "@/components/medra/DashboardShell";
import { DataTable, Pill, SellerPage } from "@/components/medra/RoleDashboard";
import { EmptyState, QueryBoundary } from "@/components/medra/States";
import { Button } from "@/components/ui/button";
import { useMyBalance, statusLabel } from "@/lib/dashboard";
import { useSellerFulfillments, useSellerOverview } from "@/lib/ops";
import { formatDate, formatNaira } from "@/lib/medra";

export const Route = createFileRoute("/seller")({
  head: () => ({
    meta: [
      { title: "Seller Dashboard — Medra" },
      {
        name: "description",
        content:
          "Medra seller dashboard: track sales, manage products and inventory, fulfil orders and monitor payouts.",
      },
      { property: "og:title", content: "Seller Dashboard — Medra" },
      {
        property: "og:description",
        content: "Manage your store, products, orders, promotions and earnings on Medra.",
      },
    ],
  }),
  component: SellerDashboard,
});

function SellerDashboard() {
  const overview = useSellerOverview();
  const balance = useMyBalance();
  const recent = useSellerFulfillments();
  const stats = overview.data;

  return (
    <SellerPage
      title="Store overview"
      subtitle="Live figures from your Medra store"
      topRight={
        <>
          <Button asChild size="sm" variant="outline" className="rounded-full">
            <Link to="/seller/store">Store profile</Link>
          </Button>
          <Button asChild size="sm" className="rounded-full">
            <Link to="/seller/products">Add product</Link>
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label="Product earnings"
          value={formatNaira(stats?.earnings ?? 0)}
          tone="leaf"
          icon={<Banknote className="size-4" />}
        />
        <StatCard
          label="Orders received"
          value={String(stats?.orders ?? 0)}
          tone="sky"
          icon={<ShoppingBag className="size-4" />}
        />
        <StatCard label="Needs your response" value={String(stats?.needsAction ?? 0)} tone="amber" />
        <StatCard label="In preparation" value={String(stats?.preparing ?? 0)} tone="grape" />
        <StatCard
          label="Low stock items"
          value={String(stats?.lowStock ?? 0)}
          tone="sky"
          icon={<Package className="size-4" />}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Panel title="Recent orders" className="xl:col-span-2">
          <QueryBoundary
            isLoading={recent.isLoading}
            error={recent.error}
            isEmpty={(recent.data ?? []).length === 0}
            onRetry={() => void recent.refetch()}
            empty={
              <EmptyState
                icon={<ShoppingBag className="size-5" />}
                title="No orders yet"
                body="When a customer buys from your store, the order appears here for you to accept and prepare."
              />
            }
          >
            <DataTable columns={["Order", "Status", "Your share", "Placed"]}>
              {(recent.data ?? []).slice(0, 8).map((row) => (
                <tr key={row.id}>
                  <td className="py-3 pr-4 font-semibold">
                    {row.orders?.order_number ?? row.order_id.slice(0, 8)}
                  </td>
                  <td className="py-3 pr-4">
                    <Pill>{statusLabel(row.status)}</Pill>
                  </td>
                  <td className="py-3 pr-4 font-semibold">{formatNaira(row.seller_amount)}</td>
                  <td className="py-3 pr-4 text-muted-foreground">{formatDate(row.created_at)}</td>
                </tr>
              ))}
            </DataTable>
            <div className="mt-4">
              <Button asChild size="sm" variant="outline" className="rounded-full">
                <Link to="/seller/orders">Open order queue</Link>
              </Button>
            </div>
          </QueryBoundary>
        </Panel>

        <Panel title="Settlement">
          <QueryBoundary
            isLoading={balance.isLoading}
            error={balance.error}
            onRetry={() => void balance.refetch()}
          >
            <dl className="space-y-3 text-sm">
              <Row label="Available" value={formatNaira(balance.data?.available ?? 0)} />
              <Row label="Pending settlement" value={formatNaira(balance.data?.pending ?? 0)} />
              <Row label="Requested" value={formatNaira(balance.data?.requested ?? 0)} />
              <Row label="Lifetime" value={formatNaira(balance.data?.lifetime ?? 0)} />
            </dl>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button asChild size="sm" className="rounded-full">
                <Link to="/seller/payouts">Request payout</Link>
              </Button>
              <Button asChild size="sm" variant="outline" className="rounded-full">
                <Link to="/seller/earnings">View ledger</Link>
              </Button>
            </div>
          </QueryBoundary>
        </Panel>
      </div>
    </SellerPage>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-bold">{value}</dd>
    </div>
  );
}
