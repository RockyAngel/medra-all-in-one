import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Banknote } from "lucide-react";
import { toast } from "sonner";
import { Panel } from "@/components/medra/DashboardShell";
import { AdminPage, FilterTabs, Pill } from "@/components/medra/RoleDashboard";
import { EmptyState, QueryBoundary } from "@/components/medra/States";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { formatDate, formatNaira } from "@/lib/medra";
import { PAYOUT_STATUS_TONE, statusLabel } from "@/lib/dashboard";
import { useAdminPayouts } from "@/lib/ops";

export const Route = createFileRoute("/admin_/payouts")({
  head: () => ({
    meta: [
      { title: "Payouts — Medra admin" },
      {
        name: "description",
        content:
          "Approve, reject or settle vendor and rider payout requests with a full review trail on Medra.",
      },
      { property: "og:title", content: "Payouts — Medra admin" },
      { property: "og:description", content: "Vendor and rider payout review queue on Medra." },
    ],
  }),
  component: AdminPayoutsPage,
});

const FILTERS = [
  { key: "requested", label: "New" },
  { key: "under_review", label: "Under review" },
  { key: "approved", label: "Approved" },
  { key: "processing", label: "Processing" },
  { key: "paid", label: "Paid" },
  { key: "rejected", label: "Rejected" },
  { key: "all", label: "All" },
];

function AdminPayoutsPage() {
  const [filter, setFilter] = useState("requested");
  const payouts = useAdminPayouts(filter);
  const [openId, setOpenId] = useState<string | null>(null);

  const pendingValue = (payouts.data ?? [])
    .filter((p) => p.status === "requested" || p.status === "under_review" || p.status === "approved")
    .reduce((sum, p) => sum + Number(p.amount ?? 0), 0);

  return (
    <AdminPage title="Payouts" subtitle="Withdrawal requests from vendors and riders">
      <Panel title="Awaiting settlement" className="mb-4">
        <p className="text-3xl font-extrabold">{formatNaira(pendingValue)}</p>
        <p className="text-sm text-muted-foreground">Value of requests not yet paid in this view.</p>
      </Panel>

      <FilterTabs options={FILTERS} value={filter} onChange={setFilter} />

      <Panel title="Payout requests">
        <QueryBoundary
          isLoading={payouts.isLoading}
          error={payouts.error}
          isEmpty={(payouts.data ?? []).length === 0}
          onRetry={() => void payouts.refetch()}
          empty={
            <EmptyState
              icon={<Banknote className="size-5" />}
              title="No payout requests in this view"
              body="Vendors and riders can request payouts once their ledger balance clears."
            />
          }
        >
          <div className="space-y-3">
            {(payouts.data ?? []).map((p) => (
              <div key={p.id} className="rounded-xl border border-border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold">
                      {formatNaira(p.amount)} · {statusLabel(p.role ?? "seller")}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Requested {formatDate(p.created_at)}
                      {p.reference ? ` · Ref ${p.reference}` : ""}
                      {p.paid_at ? ` · Paid ${formatDate(p.paid_at)}` : ""}
                    </p>
                    {p.review_note && (
                      <p className="mt-1 text-sm text-muted-foreground">Note: {p.review_note}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Pill tone={PAYOUT_STATUS_TONE[p.status]}>{statusLabel(p.status)}</Pill>
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-lg font-bold"
                      onClick={() => setOpenId(openId === p.id ? null : p.id)}
                    >
                      {openId === p.id ? "Close" : "Review"}
                    </Button>
                  </div>
                </div>
                {openId === p.id && <PayoutForm payoutId={p.id} onDone={() => setOpenId(null)} />}
              </div>
            ))}
          </div>
        </QueryBoundary>
      </Panel>
    </AdminPage>
  );
}

function PayoutForm({ payoutId, onDone }: { payoutId: string; onDone: () => void }) {
  const queryClient = useQueryClient();
  const [note, setNote] = useState("");
  const [reference, setReference] = useState("");

  const review = useMutation({
    mutationFn: async (status: string) => {
      if ((status === "rejected" || status === "under_review") && note.trim().length < 4) {
        throw new Error("Add a short note for this decision.");
      }
      if (status === "paid" && reference.trim().length < 3) {
        throw new Error("Add the bank transfer reference before marking this as paid.");
      }
      const { error } = await supabase.rpc("admin_review_payout", {
        _payout_id: payoutId,
        _status: status,
        _note: note.trim(),
        ...(reference.trim() ? { _reference: reference.trim() } : {}),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Payout updated");
      void queryClient.invalidateQueries({ queryKey: ["admin-payouts"] });
      onDone();
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Could not update payout"),
  });

  return (
    <div className="mt-4 space-y-3 border-t border-border pt-4">
      <Input
        value={reference}
        onChange={(e) => setReference(e.target.value)}
        placeholder="Bank transfer reference (required to mark as paid)"
        className="h-10 rounded-lg"
      />
      <Textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Review note"
        className="rounded-lg"
      />
      <div className="flex flex-wrap gap-2">
        <Button size="sm" className="rounded-lg font-bold" disabled={review.isPending} onClick={() => review.mutate("approved")}>
          Approve
        </Button>
        <Button size="sm" variant="outline" className="rounded-lg font-bold" disabled={review.isPending} onClick={() => review.mutate("processing")}>
          Mark processing
        </Button>
        <Button size="sm" variant="outline" className="rounded-lg font-bold" disabled={review.isPending} onClick={() => review.mutate("paid")}>
          Mark paid
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
