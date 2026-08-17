import { createFileRoute } from "@tanstack/react-router";
import { Coins } from "lucide-react";
import { Panel, StatCard } from "@/components/medra/DashboardShell";
import { DataTable, Pill, SellerPage } from "@/components/medra/RoleDashboard";
import { EmptyState, QueryBoundary } from "@/components/medra/States";
import { PAYOUT_STATUS_TONE, statusLabel, useMyBalance, useMyLedger } from "@/lib/dashboard";
import { formatDate, formatNaira } from "@/lib/medra";

export const Route = createFileRoute("/seller_/earnings")({
  head: () => ({
    meta: [
      { title: "Earnings — Medra seller" },
      {
        name: "description",
        content:
          "See what your Medra store has earned, what is still pending settlement and what is ready to withdraw.",
      },
      { property: "og:title", content: "Earnings — Medra seller" },
      { property: "og:description", content: "Ledger-backed earnings for your Medra store." },
    ],
  }),
  component: SellerEarningsPage,
});

function SellerEarningsPage() {
  const balance = useMyBalance();
  const ledger = useMyLedger();

  return (
    <SellerPage title="Earnings" subtitle="Every figure comes from the immutable settlement ledger">
      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Available" value={formatNaira(balance.data?.available ?? 0)} tone="leaf" />
        <StatCard label="Pending settlement" value={formatNaira(balance.data?.pending ?? 0)} tone="amber" />
        <StatCard label="Requested" value={formatNaira(balance.data?.requested ?? 0)} tone="sky" />
        <StatCard label="Lifetime" value={formatNaira(balance.data?.lifetime ?? 0)} tone="grape" />
      </div>

      <Panel title="Ledger entries">
        <QueryBoundary
          isLoading={ledger.isLoading || balance.isLoading}
          error={ledger.error ?? balance.error}
          isEmpty={(ledger.data ?? []).length === 0}
          onRetry={() => void ledger.refetch()}
          empty={
            <EmptyState
              icon={<Coins className="size-5" />}
              title="No earnings yet"
              body="Completed orders create ledger entries here, split between you and the platform."
            />
          }
        >
          <DataTable columns={["Kind", "Amount", "Rate", "Rule", "Payout", "When"]}>
            {(ledger.data ?? []).map((entry) => (
              <tr key={entry.id}>
                <td className="py-3 pr-4 font-semibold">{statusLabel(entry.kind)}</td>
                <td className="py-3 pr-4">{formatNaira(entry.amount)}</td>
                <td className="py-3 pr-4">{entry.percentage ? `${entry.percentage}%` : "—"}</td>
                <td className="py-3 pr-4 text-muted-foreground">{entry.rule ?? "—"}</td>
                <td className="py-3 pr-4">
                  <Pill tone={PAYOUT_STATUS_TONE[entry.payout_status]}>
                    {statusLabel(entry.payout_status)}
                  </Pill>
                </td>
                <td className="py-3 pr-4 text-muted-foreground">{formatDate(entry.created_at)}</td>
              </tr>
            ))}
          </DataTable>
        </QueryBoundary>
      </Panel>
    </SellerPage>
  );
}
