import { createFileRoute } from "@tanstack/react-router";
import { Receipt } from "lucide-react";
import { Panel } from "@/components/medra/DashboardShell";
import { DataTable, Pill, SellerPage } from "@/components/medra/RoleDashboard";
import { EmptyState, QueryBoundary } from "@/components/medra/States";
import { PAYOUT_STATUS_TONE, statusLabel, useMyLedger } from "@/lib/dashboard";
import { formatDate, formatNaira } from "@/lib/medra";

export const Route = createFileRoute("/seller_/transactions")({
  head: () => ({
    meta: [
      { title: "Transactions — Medra seller" },
      {
        name: "description",
        content:
          "A dated record of every settlement transaction linked to your Medra orders and deliveries.",
      },
      { property: "og:title", content: "Transactions — Medra seller" },
      { property: "og:description", content: "Full transaction history for your Medra store." },
    ],
  }),
  component: SellerTransactionsPage,
});

function SellerTransactionsPage() {
  const ledger = useMyLedger();

  return (
    <SellerPage title="Transactions" subtitle="Immutable record of money movements on your account">
      <Panel title="All transactions">
        <QueryBoundary
          isLoading={ledger.isLoading}
          error={ledger.error}
          isEmpty={(ledger.data ?? []).length === 0}
          onRetry={() => void ledger.refetch()}
          empty={
            <EmptyState
              icon={<Receipt className="size-5" />}
              title="No transactions yet"
              body="Settlement records appear once your orders are completed and verified."
            />
          }
        >
          <DataTable columns={["Date", "Kind", "Amount", "Status", "Order", "Delivery"]}>
            {(ledger.data ?? []).map((entry) => (
              <tr key={entry.id}>
                <td className="py-3 pr-4 text-muted-foreground">{formatDate(entry.created_at)}</td>
                <td className="py-3 pr-4 font-semibold">{statusLabel(entry.kind)}</td>
                <td className="py-3 pr-4">{formatNaira(entry.amount)}</td>
                <td className="py-3 pr-4">
                  <Pill tone={PAYOUT_STATUS_TONE[entry.payout_status]}>
                    {statusLabel(entry.payout_status)}
                  </Pill>
                </td>
                <td className="py-3 pr-4 text-xs text-muted-foreground">
                  {entry.order_id ? entry.order_id.slice(0, 8) : "—"}
                </td>
                <td className="py-3 pr-4 text-xs text-muted-foreground">
                  {entry.delivery_id ? entry.delivery_id.slice(0, 8) : "—"}
                </td>
              </tr>
            ))}
          </DataTable>
        </QueryBoundary>
      </Panel>
    </SellerPage>
  );
}
