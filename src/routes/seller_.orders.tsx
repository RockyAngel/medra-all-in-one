import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PackageSearch } from "lucide-react";
import { toast } from "sonner";
import { Panel } from "@/components/medra/DashboardShell";
import { DataTable, FilterTabs, Pill, SellerPage } from "@/components/medra/RoleDashboard";
import { EmptyState, QueryBoundary } from "@/components/medra/States";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { formatDate, formatNaira } from "@/lib/medra";
import { useSellerFulfillments } from "@/lib/ops";
import { FULFILLMENT_LABELS, workflowError } from "@/lib/workflow";

export const Route = createFileRoute("/seller_/orders")({
  head: () => ({
    meta: [
      { title: "Store orders — Medra seller" },
      {
        name: "description",
        content:
          "Accept, prepare and hand over customer orders for your Medra store, with live fulfilment status.",
      },
      { property: "og:title", content: "Store orders — Medra seller" },
      { property: "og:description", content: "Manage incoming Medra orders for your store." },
    ],
  }),
  component: SellerOrdersPage,
});

const FILTERS = [
  { key: "seller_reviewing", label: "Needs response" },
  { key: "accepted", label: "Accepted" },
  { key: "preparing", label: "Preparing" },
  { key: "ready_for_pickup", label: "Ready" },
  { key: "all", label: "All" },
];

const TONE: Record<string, string> = {
  seller_reviewing: "bg-amber/20 text-amber",
  accepted: "bg-sky/15 text-sky",
  preparing: "bg-sky/15 text-sky",
  ready_for_pickup: "bg-leaf/15 text-leaf",
  picked_up: "bg-leaf/15 text-leaf",
  delivered: "bg-leaf/15 text-leaf",
  completed: "bg-leaf/15 text-leaf",
  rejected: "bg-destructive/15 text-destructive",
  cancelled: "bg-destructive/15 text-destructive",
};

function SellerOrdersPage() {
  const [filter, setFilter] = useState("seller_reviewing");
  const orders = useSellerFulfillments(filter);
  const queryClient = useQueryClient();

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["seller-fulfillments"] });
    void queryClient.invalidateQueries({ queryKey: ["seller-overview"] });
  };

  const respond = useMutation({
    mutationFn: async ({ id, accept }: { id: string; accept: boolean }) => {
      const { error } = await supabase.rpc("seller_respond_to_order", {
        _fulfillment_id: id,
        _accept: accept,
        _reason: accept ? "" : "Out Of Stock",
        _note: "",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Order updated");
      invalidate();
    },
    onError: (e) => toast.error(workflowError(e)),
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "preparing" | "ready_for_pickup" }) => {
      const { error } = await supabase.rpc("seller_set_fulfillment_status", {
        _fulfillment_id: id,
        _status: status,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Fulfilment status updated");
      invalidate();
    },
    onError: (e) => toast.error(workflowError(e)),
  });

  const busy = respond.isPending || setStatus.isPending;

  return (
    <SellerPage title="Orders" subtitle="Every order routed to your store">
      <FilterTabs options={FILTERS} value={filter} onChange={setFilter} />
      <Panel title="Fulfilments">
        <QueryBoundary
          isLoading={orders.isLoading}
          error={orders.error}
          isEmpty={(orders.data ?? []).length === 0}
          onRetry={() => void orders.refetch()}
          empty={
            <EmptyState
              icon={<PackageSearch className="size-5" />}
              title="No orders in this queue"
              body="Paid customer orders for your products appear here for you to accept and prepare."
            />
          }
        >
          <DataTable columns={["Order", "Placed", "Items total", "You earn", "Status", "Actions"]}>
            {(orders.data ?? []).map((row) => (
              <tr key={row.id} className="align-middle">
                <td className="py-3 pr-4 font-semibold">
                  {row.orders?.order_number ?? "—"}
                  {row.is_emergency && <span className="ml-2 text-xs font-bold text-destructive">Emergency</span>}
                </td>
                <td className="py-3 pr-4 text-muted-foreground">{formatDate(row.created_at)}</td>
                <td className="py-3 pr-4">{formatNaira(row.items_subtotal)}</td>
                <td className="py-3 pr-4 font-semibold">{formatNaira(row.seller_amount)}</td>
                <td className="py-3 pr-4">
                  <Pill tone={TONE[row.status]}>{FULFILLMENT_LABELS[row.status] ?? row.status}</Pill>
                </td>
                <td className="py-3 pr-4">
                  <div className="flex flex-wrap gap-2">
                    {row.status === "seller_reviewing" && (
                      <>
                        <Button
                          size="sm"
                          className="rounded-full font-bold"
                          disabled={busy}
                          onClick={() => respond.mutate({ id: row.id, accept: true })}
                        >
                          Accept
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="rounded-full font-bold text-destructive"
                          disabled={busy}
                          onClick={() => respond.mutate({ id: row.id, accept: false })}
                        >
                          Reject
                        </Button>
                      </>
                    )}
                    {row.status === "accepted" && (
                      <Button
                        size="sm"
                        className="rounded-full font-bold"
                        disabled={busy}
                        onClick={() => setStatus.mutate({ id: row.id, status: "preparing" })}
                      >
                        Start preparing
                      </Button>
                    )}
                    {row.status === "preparing" && (
                      <Button
                        size="sm"
                        className="rounded-full font-bold"
                        disabled={busy}
                        onClick={() => setStatus.mutate({ id: row.id, status: "ready_for_pickup" })}
                      >
                        Mark ready
                      </Button>
                    )}
                    {row.rejection_reason && (
                      <span className="text-xs text-muted-foreground">{row.rejection_reason}</span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </DataTable>
        </QueryBoundary>
      </Panel>
    </SellerPage>
  );
}
