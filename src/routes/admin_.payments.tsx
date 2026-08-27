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

/** Bank transfers customers submitted, awaiting staff confirmation. */
function TransferQueue() {
  const [status, setStatus] = useState("submitted");
  const queue = useTransferQueue(status);
  const review = useReviewTransfer();
  const [notes, setNotes] = useState<Record<string, string>>({});

  const act = async (id: string, approve: boolean) => {
    try {
      await review.mutateAsync({ id, approve, ...(notes[id] ? { note: notes[id] } : {}) });
      toast.success(approve ? "Transfer confirmed — order released" : "Transfer rejected");
    } catch (error) {
      toast.error(workflowError(error));
    }
  };

  const openProof = async (path: string) => {
    try {
      const url = await applicationDocumentSignedUrl(path);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (error) {
      toast.error(workflowError(error));
    }
  };

  const rows = queue.data ?? [];

  return (
    <Panel
      title="Bank transfers to confirm"
      className="mb-4"
      action={
        <div className="flex gap-2">
          {["submitted", "approved", "rejected", "all"].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setStatus(value)}
              className={`rounded-full px-3 py-1 text-xs font-bold capitalize ${
                status === value ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}
            >
              {value}
            </button>
          ))}
        </div>
      }
    >
      <QueryBoundary
        isLoading={queue.isLoading}
        error={queue.error}
        isEmpty={rows.length === 0}
        onRetry={() => void queue.refetch()}
        empty={
          <EmptyState
            icon={<CreditCard className="size-5" />}
            title="Nothing to confirm"
            body="Customer bank transfers appear here as soon as they are submitted."
          />
        }
      >
        <ul className="space-y-3">
          {rows.map((row) => (
            <li key={row.id} className="rounded-xl border border-border p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <Link
                    to="/orders/$orderId"
                    params={{ orderId: row.order_id }}
                    className="font-bold hover:underline"
                  >
                    {row.orders?.order_number ?? "Order"}
                  </Link>
                  <p className="text-sm text-muted-foreground">
                    {formatNaira(row.amount)} · ref{" "}
                    <span className="font-mono text-xs">{row.bank_reference}</span>
                    {row.sender_name ? ` · from ${row.sender_name}` : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">{formatDate(row.created_at)}</p>
                </div>
                <Pill tone={TONE[row.status === "submitted" ? "pending" : row.status]}>
                  {statusLabel(row.status)}
                </Pill>
              </div>
              {row.proof_path && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void openProof(row.proof_path!)}
                  className="mt-3 rounded-full font-bold"
                >
                  View proof
                </Button>
              )}
              {row.status === "submitted" ? (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Input
                    value={notes[row.id] ?? ""}
                    onChange={(event) =>
                      setNotes((current) => ({ ...current, [row.id]: event.target.value }))
                    }
                    placeholder="Review note (optional)"
                    className="h-10 max-w-xs rounded-xl"
                  />
                  <Button
                    size="sm"
                    disabled={review.isPending}
                    onClick={() => void act(row.id, true)}
                    className="rounded-full font-bold"
                  >
                    Confirm payment
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={review.isPending}
                    onClick={() => void act(row.id, false)}
                    className="rounded-full font-bold"
                  >
                    Reject
                  </Button>
                </div>
              ) : (
                row.review_note && (
                  <p className="mt-2 text-sm text-muted-foreground">{row.review_note}</p>
                )
              )}
            </li>
          ))}
        </ul>
      </QueryBoundary>
    </Panel>
  );
}
