import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ClipboardCheck } from "lucide-react";
import { toast } from "sonner";
import { Panel } from "@/components/medra/DashboardShell";
import { AdminPage, FilterTabs, Pill } from "@/components/medra/RoleDashboard";
import { EmptyState, QueryBoundary } from "@/components/medra/States";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { formatDate, formatNaira } from "@/lib/medra";
import { statusLabel } from "@/lib/dashboard";
import { useDeliveryApprovals } from "@/lib/ops";
import { workflowError } from "@/lib/workflow";

export const Route = createFileRoute("/admin_/delivery-approvals")({
  head: () => ({
    meta: [
      { title: "Delivery approvals — Medra admin" },
      {
        name: "description",
        content:
          "Approve or reject each completed rider delivery before Medra releases the rider's delivery earnings for payout.",
      },
      { property: "og:title", content: "Delivery approvals — Medra admin" },
      {
        property: "og:description",
        content: "Review completed deliveries before rider earnings become payable.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminDeliveryApprovalsPage,
});

const FILTERS = [
  { key: "pending", label: "Awaiting review" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
  { key: "all", label: "All" },
];

const TONE: Record<string, string> = {
  pending: "bg-amber/20 text-amber",
  approved: "bg-leaf/15 text-leaf",
  rejected: "bg-destructive/15 text-destructive",
};

function AdminDeliveryApprovalsPage() {
  const [filter, setFilter] = useState("pending");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const approvals = useDeliveryApprovals(filter);
  const queryClient = useQueryClient();

  const review = useMutation({
    mutationFn: async ({ id, approve }: { id: string; approve: boolean }) => {
      const note = (notes[id] ?? "").trim();
      if (!approve && !note) throw new Error("Add a reason before rejecting a delivery");
      const { error } = await supabase.rpc("admin_review_delivery_payout", {
        _delivery_id: id,
        _approve: approve,
        ...(note ? { _note: note } : {}),
      });
      if (error) throw error;
    },
    onSuccess: (_r, variables) => {
      toast.success(variables.approve ? "Delivery approved for payout" : "Delivery earnings withheld");
      setNotes({});
      void queryClient.invalidateQueries({ queryKey: ["admin-delivery-approvals"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-deliveries"] });
    },
    onError: (e) => toast.error(workflowError(e)),
  });

  const rows = approvals.data ?? [];
  const heldValue = rows
    .filter((d) => d.payout_approval === "pending")
    .reduce((sum, d) => sum + Number(d.rider_amount ?? 0), 0);

  return (
    <AdminPage
      title="Delivery approvals"
      subtitle="Approve a rider's completed delivery before their earnings are released"
    >
      <Panel title="Rider earnings on hold" className="mb-4">
        <p className="text-3xl font-extrabold">{formatNaira(heldValue)}</p>
        <p className="text-sm text-muted-foreground">
          Held until approved. Approving makes the amount available for a payout request; rejecting
          withholds it.
        </p>
      </Panel>

      <FilterTabs options={FILTERS} value={filter} onChange={setFilter} />

      <QueryBoundary
        isLoading={approvals.isLoading}
        error={approvals.error}
        isEmpty={rows.length === 0}
        onRetry={() => void approvals.refetch()}
        empty={
          <EmptyState
            icon={<ClipboardCheck className="size-5" />}
            title="Nothing to review"
            body="Deliveries appear here as soon as a rider verifies a delivery code with the customer."
          />
        }
      >
        <div className="space-y-4">
          {rows.map((d) => (
            <Panel
              key={d.id}
              title={d.orders?.order_number ?? "Delivery"}
              action={
                <Pill tone={TONE[d.payout_approval]}>{statusLabel(d.payout_approval)}</Pill>
              }
            >
              <div className="grid gap-3 text-sm sm:grid-cols-3">
                <div>
                  <p className="font-semibold">Store</p>
                  <p className="text-muted-foreground">
                    {d.stores?.name ?? "—"}
                    {d.stores?.city ? ` · ${d.stores.city}` : ""}
                  </p>
                </div>
                <div>
                  <p className="font-semibold">Rider earnings</p>
                  <p className="text-muted-foreground">
                    {formatNaira(d.rider_amount ?? 0)} of {formatNaira(d.fee_total ?? 0)}
                    {d.rider_percent ? ` · ${d.rider_percent}%` : ""}
                    {d.is_peak ? " · peak" : ""}
                  </p>
                </div>
                <div>
                  <p className="font-semibold">Platform share</p>
                  <p className="text-muted-foreground">
                    {formatNaira(d.platform_amount ?? 0)}
                    {d.platform_percent ? ` · ${d.platform_percent}%` : ""}
                  </p>
                </div>
                <div>
                  <p className="font-semibold">Pickup verified</p>
                  <p className="text-muted-foreground">
                    {d.pickup_verified_at ? formatDate(d.pickup_verified_at) : "—"}
                  </p>
                </div>
                <div>
                  <p className="font-semibold">Delivered</p>
                  <p className="text-muted-foreground">
                    {d.delivered_at ? formatDate(d.delivered_at) : "—"}
                  </p>
                </div>
                <div>
                  <p className="font-semibold">Distance</p>
                  <p className="text-muted-foreground">
                    {d.distance_meters ? `${(d.distance_meters / 1000).toFixed(1)} km` : "—"}
                  </p>
                </div>
              </div>

              {d.payout_approval === "pending" ? (
                <div className="mt-4 space-y-2">
                  <Textarea
                    value={notes[d.id] ?? ""}
                    placeholder="Review note (required when rejecting)"
                    onChange={(e) => setNotes((prev) => ({ ...prev, [d.id]: e.target.value }))}
                    className="rounded-xl"
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      className="rounded-full font-bold"
                      disabled={review.isPending}
                      onClick={() => review.mutate({ id: d.id, approve: true })}
                    >
                      Approve payout
                    </Button>
                    <Button
                      variant="destructive"
                      className="rounded-full font-bold"
                      disabled={review.isPending}
                      onClick={() => review.mutate({ id: d.id, approve: false })}
                    >
                      Reject
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="mt-4 text-sm text-muted-foreground">
                  Reviewed {d.payout_reviewed_at ? formatDate(d.payout_reviewed_at) : "—"}
                  {d.payout_review_note ? ` · ${d.payout_review_note}` : ""}
                </p>
              )}
            </Panel>
          ))}
        </div>
      </QueryBoundary>
    </AdminPage>
  );
}
