import { createFileRoute } from "@tanstack/react-router";
import { CreditCard } from "lucide-react";
import { Panel } from "@/components/medra/DashboardShell";
import { AdminPage, DataTable, Pill } from "@/components/medra/RoleDashboard";
import { EmptyState, QueryBoundary } from "@/components/medra/States";
import { formatDate, formatNaira } from "@/lib/medra";
import { statusLabel } from "@/lib/dashboard";
import { useAdminPayments } from "@/lib/ops";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { applicationDocumentSignedUrl, workflowError } from "@/lib/workflow";
import { bankAccountConfigured, useBankAccount, useReviewTransfer, useTransferQueue } from "@/lib/transfers";
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";

export const Route = createFileRoute("/admin_/payments")({
  head: () => ({
    meta: [
      { title: "Payments — Medra admin" },
      {
        name: "description",
        content:
          "Reconcile every Medra payment against its order, provider reference and settlement status.",
      },
      { property: "og:title", content: "Payments — Medra admin" },
      { property: "og:description", content: "Payment reconciliation for the Medra platform." },
    ],
  }),
  component: AdminPaymentsPage,
});

const TONE: Record<string, string> = {
  succeeded: "bg-leaf/15 text-leaf",
  paid: "bg-leaf/15 text-leaf",
  failed: "bg-destructive/15 text-destructive",
  refunded: "bg-grape/15 text-grape",
  pending: "bg-amber/20 text-amber",
};

function AdminPaymentsPage() {
  const payments = useAdminPayments();
  const account = useBankAccount();
  const configured = bankAccountConfigured(account.data);

  const total = (payments.data ?? [])
    .filter((p) => p.status === "succeeded" || p.status === "paid")
    .reduce((sum, p) => sum + Number(p.amount ?? 0), 0);

  return (
    <AdminPage title="Payments" subtitle="Every payment attempt recorded by the platform">
      {!account.isLoading && !configured && (
        <div className="mb-4 rounded-xl border border-amber/40 bg-amber/10 p-4 text-sm">
          <p className="font-bold">No settlement bank account is published yet.</p>
          <p className="text-muted-foreground">
            Checkout is blocked until a super admin publishes the bank details, so this ledger stays
            empty by design.
          </p>
        </div>
      )}

      <TransferQueue />


      <Panel title="Settled value" className="mb-4">
        <p className="text-3xl font-extrabold">{formatNaira(total)}</p>
        <p className="text-sm text-muted-foreground">
          Across {(payments.data ?? []).length} recorded payment attempts.
        </p>
      </Panel>

      <Panel title="Payment attempts">
        <QueryBoundary
          isLoading={payments.isLoading}
          error={payments.error}
          isEmpty={(payments.data ?? []).length === 0}
          onRetry={() => void payments.refetch()}
          empty={
            <EmptyState
              icon={<CreditCard className="size-5" />}
              title="No payments recorded"
              body="Payments appear here once a provider is connected and customers check out."
            />
          }
        >
          <DataTable columns={["Order", "Provider", "Reference", "Amount", "Status", "Order status", "Date"]}>
            {(payments.data ?? []).map((p) => (
              <tr key={p.id}>
                <td className="py-3 pr-4 font-semibold">{p.orders?.order_number ?? "—"}</td>
                <td className="py-3 pr-4 capitalize">{p.provider ?? "—"}</td>
                <td className="py-3 pr-4 font-mono text-xs text-muted-foreground">
                  {p.provider_reference ?? "—"}
                </td>
                <td className="py-3 pr-4">{formatNaira(p.amount)}</td>
                <td className="py-3 pr-4">
                  <Pill tone={TONE[p.status]}>{statusLabel(p.status)}</Pill>
                </td>
                <td className="py-3 pr-4 text-muted-foreground">
                  {p.orders?.status ? statusLabel(p.orders.status) : "—"}
                </td>
                <td className="py-3 pr-4 text-muted-foreground">{formatDate(p.created_at)}</td>
              </tr>
            ))}
          </DataTable>
        </QueryBoundary>
      </Panel>
    </AdminPage>
  );
}
