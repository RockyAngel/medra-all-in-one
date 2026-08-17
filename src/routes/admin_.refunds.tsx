import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Panel } from "@/components/medra/DashboardShell";
import { AdminPage, DataTable, FilterTabs, Pill } from "@/components/medra/RoleDashboard";
import { EmptyState, QueryBoundary } from "@/components/medra/States";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { formatDate, formatNaira } from "@/lib/medra";
import { REFUND_STATUS_TONE, statusLabel } from "@/lib/dashboard";
import { useAdminRefunds } from "@/lib/ops";

export const Route = createFileRoute("/admin_/refunds")({
  head: () => ({
    meta: [
      { title: "Refunds — Medra admin" },
      {
        name: "description",
        content:
          "Review Medra refund requests, approve full or partial amounts and record the decision trail.",
      },
      { property: "og:title", content: "Refunds — Medra admin" },
      { property: "og:description", content: "Refund review queue for the Medra platform." },
    ],
  }),
  component: AdminRefundsPage,
});

const FILTERS = [
  { key: "requested", label: "New" },
  { key: "under_review", label: "Under review" },
  { key: "more_info_needed", label: "Waiting on customer" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
  { key: "all", label: "All" },
];

function AdminRefundsPage() {
  const [filter, setFilter] = useState("requested");
  const refunds = useAdminRefunds(filter);
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <AdminPage title="Refunds" subtitle="Customer refund requests and decisions">
      <FilterTabs options={FILTERS} value={filter} onChange={setFilter} />
      <Panel title="Refund requests">
        <QueryBoundary
          isLoading={refunds.isLoading}
          error={refunds.error}
          isEmpty={(refunds.data ?? []).length === 0}
          onRetry={() => void refunds.refetch()}
          empty={
            <EmptyState
              icon={<RotateCcw className="size-5" />}
              title="No refund requests in this view"
              body="Requests arrive here when a customer disputes an order or delivery."
            />
          }
        >
          <div className="space-y-3">
            {(refunds.data ?? []).map((r) => (
              <div key={r.id} className="rounded-xl border border-border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold">
                      {r.orders?.order_number ?? "Order"} · {formatNaira(r.amount_requested)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {statusLabel(r.scope ?? "order")} · {r.reason ?? "No reason given"} ·{" "}
                      {formatDate(r.created_at)}
                    </p>
                    {r.details && <p className="mt-1 text-sm">{r.details}</p>}
                    {r.decision_note && (
                      <p className="mt-1 text-sm text-muted-foreground">Note: {r.decision_note}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Pill tone={REFUND_STATUS_TONE[r.status]}>{statusLabel(r.status)}</Pill>
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-lg font-bold"
                      onClick={() => setOpenId(openId === r.id ? null : r.id)}
                    >
                      {openId === r.id ? "Close" : "Review"}
                    </Button>
                  </div>
                </div>
                {openId === r.id && (
                  <ReviewForm
                    refundId={r.id}
                    requested={Number(r.amount_requested ?? 0)}
                    onDone={() => setOpenId(null)}
                  />
                )}
              </div>
            ))}
          </div>
        </QueryBoundary>
      </Panel>
    </AdminPage>
  );
}

function ReviewForm({
  refundId,
  requested,
  onDone,
}: {
  refundId: string;
  requested: number;
  onDone: () => void;
}) {
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState(String(requested));
  const [note, setNote] = useState("");
  const [destination, setDestination] = useState("original");

  const review = useMutation({
    mutationFn: async (status: string) => {
      if (status !== "approved" && note.trim().length < 4) {
        throw new Error("Add a short note explaining the decision.");
      }
      const { error } = await supabase.rpc("admin_review_refund", {
        _refund_id: refundId,
        _status: status,
        _amount: Number(amount || 0),
        _note: note.trim(),
        _destination: destination,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Refund decision recorded");
      void queryClient.invalidateQueries({ queryKey: ["admin-refunds"] });
      onDone();
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Could not save decision"),
  });

  return (
    <div className="mt-4 space-y-3 border-t border-border pt-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="text-xs font-bold uppercase text-muted-foreground">Approved amount</label>
          <Input
            type="number"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="mt-1 h-10 rounded-lg"
          />
        </div>
        <div>
          <label className="text-xs font-bold uppercase text-muted-foreground">Destination</label>
          <select
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
          >
            <option value="original">Original payment method</option>
            <option value="wallet">Medra wallet</option>
          </select>
        </div>
      </div>
      <Textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Decision note (required when rejecting or requesting more information)"
        className="rounded-lg"
      />
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          className="rounded-lg font-bold"
          disabled={review.isPending}
          onClick={() => review.mutate("approved")}
        >
          Approve
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="rounded-lg font-bold"
          disabled={review.isPending}
          onClick={() => review.mutate("more_info_needed")}
        >
          Request more info
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="rounded-lg font-bold text-destructive"
          disabled={review.isPending}
          onClick={() => review.mutate("rejected")}
        >
          Reject
        </Button>
      </div>
    </div>
  );
}
