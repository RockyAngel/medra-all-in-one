import { createFileRoute } from "@tanstack/react-router";
import { Wallet } from "lucide-react";
import { Panel, StatCard } from "@/components/medra/DashboardShell";
import { DataTable, Pill, RiderPage } from "@/components/medra/RoleDashboard";
import { EmptyState, QueryBoundary } from "@/components/medra/States";
import { PAYOUT_STATUS_TONE, statusLabel, useMyBalance, useMyLedger } from "@/lib/dashboard";
import { formatDate, formatNaira } from "@/lib/medra";
import { useRiderOverview } from "@/lib/ops";

export const Route = createFileRoute("/rider_/earnings")({
  head: () => ({
    meta: [
      { title: "Earnings — Medra rider" },
      {
        name: "description",
        content:
          "Track today's delivery earnings, lifetime totals and every ledger entry credited to your Medra rider account.",
      },
      { property: "og:title", content: "Earnings — Medra rider" },
      { property: "og:description", content: "Rider earnings straight from the settlement ledger." },
    ],
  }),
  component: RiderEarningsPage,
});

function RiderEarningsPage() {
  const balance = useMyBalance();
  const ledger = useMyLedger();
  const overview = useRiderOverview();

  return (
    <RiderPage title="Earnings" subtitle="Delivery fees are split with the platform on every job">
      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Today" value={formatNaira(overview.data?.todayEarnings ?? 0)} tone="leaf" />
        <StatCard label="Available" value={formatNaira(balance.data?.available ?? 0)} tone="sky" />
        <StatCard label="Pending" value={formatNaira(balance.data?.pending ?? 0)} tone="amber" />
        <StatCard label="Lifetime" value={formatNaira(balance.data?.lifetime ?? 0)} tone="grape" />
      </div>

      <Panel title="Earnings ledger">
        <QueryBoundary
          isLoading={ledger.isLoading}
          error={ledger.error}
          isEmpty={(ledger.data ?? []).length === 0}
          onRetry={() => void ledger.refetch()}
          empty={
            <EmptyState
              icon={<Wallet className="size-5" />}
              title="No earnings yet"
              body="Complete a delivery and your share of the fee lands here immediately."
            />
          }
        >
          <DataTable columns={["Date", "Kind", "Amount", "Share", "Payout"]}>
            {(ledger.data ?? []).map((entry) => (
              <tr key={entry.id}>
                <td className="py-3 pr-4 text-muted-foreground">{formatDate(entry.created_at)}</td>
                <td className="py-3 pr-4 font-semibold">{statusLabel(entry.kind)}</td>
                <td className="py-3 pr-4">{formatNaira(entry.amount)}</td>
                <td className="py-3 pr-4">{entry.percentage ? `${entry.percentage}%` : "—"}</td>
                <td className="py-3 pr-4">
                  <Pill tone={PAYOUT_STATUS_TONE[entry.payout_status]}>
                    {statusLabel(entry.payout_status)}
                  </Pill>
                </td>
              </tr>
            ))}
          </DataTable>
        </QueryBoundary>
      </Panel>
    </RiderPage>
  );
}
