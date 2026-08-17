import { createFileRoute, Link } from "@tanstack/react-router";
import { Bike, Package, Wallet } from "lucide-react";
import { Panel, StatCard } from "@/components/medra/DashboardShell";
import { DataTable, Pill, RiderPage } from "@/components/medra/RoleDashboard";
import { EmptyState, QueryBoundary } from "@/components/medra/States";
import { Button } from "@/components/ui/button";
import { statusLabel, useMyBalance } from "@/lib/dashboard";
import { useRiderDeliveries, useRiderOverview, useRiderProfile } from "@/lib/ops";
import { formatDate, formatNaira } from "@/lib/medra";

export const Route = createFileRoute("/rider")({
  head: () => ({
    meta: [
      { title: "Rider Dashboard — Medra" },
      {
        name: "description",
        content:
          "Medra rider dashboard: accept delivery requests, follow live navigation, and track daily earnings.",
      },
      { property: "og:title", content: "Rider Dashboard — Medra" },
      {
        property: "og:description",
        content: "Accept jobs, navigate deliveries and manage your rider earnings on Medra.",
      },
    ],
  }),
  component: RiderDashboard,
});

function RiderDashboard() {
  const profile = useRiderProfile();
  const overview = useRiderOverview();
  const active = useRiderDeliveries("active");
  const balance = useMyBalance();
  const stats = overview.data;

  const statusText = profile.isLoading
    ? "Loading your rider status…"
    : !profile.data
      ? "Rider profile not set up yet"
      : profile.data.is_suspended
        ? "Account suspended · contact support"
        : profile.data.is_online
          ? `You're online${profile.data.service_city ? ` · ${profile.data.service_city}` : ""}`
          : "You're offline";

  return (
    <RiderPage
      title="Rider dashboard"
      subtitle={statusText}
      topRight={
        <Button asChild size="sm" className="rounded-full">
          <Link to="/rider/$section" params={{ section: "performance" }}>Manage availability</Link>
        </Button>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Earned today"
          value={formatNaira(stats?.todayEarnings ?? 0)}
          tone="leaf"
          icon={<Wallet className="size-4" />}
        />
        <StatCard
          label="Active deliveries"
          value={String(stats?.active ?? 0)}
          tone="sky"
          icon={<Bike className="size-4" />}
        />
        <StatCard label="Completed" value={String(stats?.completed ?? 0)} tone="grape" />
        <StatCard label="Lifetime earnings" value={formatNaira(stats?.lifetime ?? 0)} tone="amber" />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Panel title="Active deliveries" className="xl:col-span-2">
          <QueryBoundary
            isLoading={active.isLoading}
            error={active.error}
            isEmpty={(active.data ?? []).length === 0}
            onRetry={() => void active.refetch()}
            empty={
              <EmptyState
                icon={<Package className="size-5" />}
                title="No active delivery"
                body="Go online and accept an offer from the delivery requests queue to start earning."
                action={
                  <Button asChild size="sm" className="rounded-full">
                    <Link to="/rider/$section" params={{ section: "available" }}>See delivery requests</Link>
                  </Button>
                }
              />
            }
          >
            <DataTable columns={["Order", "Pickup", "Status", "Your fee"]}>
              {(active.data ?? []).map((row) => (
                <tr key={row.id}>
                  <td className="py-3 pr-4 font-semibold">
                    {row.orders?.order_number ?? row.order_id.slice(0, 8)}
                  </td>
                  <td className="py-3 pr-4 text-muted-foreground">{row.stores?.name ?? "—"}</td>
                  <td className="py-3 pr-4">
                    <Pill>{statusLabel(row.status)}</Pill>
                  </td>
                  <td className="py-3 pr-4 font-semibold">{formatNaira(row.rider_amount)}</td>
                </tr>
              ))}
            </DataTable>
            <div className="mt-4">
              <Button asChild size="sm" variant="outline" className="rounded-full">
                <Link to="/rider/$section" params={{ section: "active" }}>Open active delivery</Link>
              </Button>
            </div>
          </QueryBoundary>
        </Panel>

        <Panel title="Wallet">
          <QueryBoundary
            isLoading={balance.isLoading}
            error={balance.error}
            onRetry={() => void balance.refetch()}
          >
            <dl className="space-y-3 text-sm">
              <Row label="Available" value={formatNaira(balance.data?.available ?? 0)} />
              <Row label="Pending" value={formatNaira(balance.data?.pending ?? 0)} />
              <Row label="Requested" value={formatNaira(balance.data?.requested ?? 0)} />
            </dl>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button asChild size="sm" className="rounded-full">
                <Link to="/rider/$section" params={{ section: "payouts" }}>Withdraw</Link>
              </Button>
              <Button asChild size="sm" variant="outline" className="rounded-full">
                <Link to="/rider/$section" params={{ section: "history" }}>Delivery history</Link>
              </Button>
            </div>
            {profile.data?.location_updated_at && (
              <p className="mt-4 text-xs text-muted-foreground">
                Location last shared {formatDate(profile.data.location_updated_at)}
              </p>
            )}
          </QueryBoundary>
        </Panel>
      </div>
    </RiderPage>
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
