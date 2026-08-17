import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Layers, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Panel } from "@/components/medra/DashboardShell";
import { DataTable, Pill, SellerPage } from "@/components/medra/RoleDashboard";
import { EmptyState, QueryBoundary } from "@/components/medra/States";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { INVENTORY_KINDS, statusLabel, stockStatus } from "@/lib/dashboard";
import { formatDate } from "@/lib/medra";
import { useInventoryBatches, useInventoryMovements, useSellerProducts } from "@/lib/ops";
import { workflowError } from "@/lib/workflow";

export const Route = createFileRoute("/seller_/inventory")({
  head: () => ({
    meta: [
      { title: "Inventory — Medra seller" },
      {
        name: "description",
        content:
          "Adjust stock levels, review every inventory movement and monitor expiring batches for your Medra store.",
      },
      { property: "og:title", content: "Inventory — Medra seller" },
      { property: "og:description", content: "Stock control and batch expiry tracking on Medra." },
    ],
  }),
  component: SellerInventoryPage,
});

function SellerInventoryPage() {
  const products = useSellerProducts();
  const movements = useInventoryMovements();
  const batches = useInventoryBatches();
  const queryClient = useQueryClient();
  const [edits, setEdits] = useState<Record<string, { stock: string; kind: string; reason: string }>>({});

  const adjust = useMutation({
    mutationFn: async (productId: string) => {
      const edit = edits[productId];
      if (!edit || edit.stock === "") throw new Error("Enter the new stock count");
      const { error } = await supabase.rpc("seller_adjust_stock", {
        _product_id: productId,
        _new_stock: Number(edit.stock),
        _kind: edit.kind || "manual_adjustment",
        _reason: edit.reason || "",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Stock updated");
      setEdits({});
      void queryClient.invalidateQueries({ queryKey: ["seller-products"] });
      void queryClient.invalidateQueries({ queryKey: ["inventory-movements"] });
      void queryClient.invalidateQueries({ queryKey: ["seller-overview"] });
    },
    onError: (e) => toast.error(workflowError(e)),
  });

  return (
    <SellerPage title="Inventory" subtitle="Stock levels, adjustments and batch expiry">
      <Panel title="Stock levels" className="mb-4">
        <QueryBoundary
          isLoading={products.isLoading}
          error={products.error}
          isEmpty={(products.data ?? []).length === 0}
          onRetry={() => void products.refetch()}
          empty={
            <EmptyState
              icon={<Layers className="size-5" />}
              title="No products to track"
              body="Add products to your catalogue and their stock will be tracked here."
            />
          }
        >
          <DataTable columns={["Product", "On hand", "Reserved", "Status", "Adjust to", "Reason", ""]}>
            {(products.data ?? []).map((p) => {
              const stock = stockStatus(
                Number(p.stock_quantity ?? 0),
                Number(p.low_stock_threshold ?? 0),
              );
              const edit = edits[p.id] ?? { stock: "", kind: "manual_adjustment", reason: "" };
              return (
                <tr key={p.id}>
                  <td className="py-3 pr-4 font-semibold">{p.name}</td>
                  <td className="py-3 pr-4">{p.stock_quantity}</td>
                  <td className="py-3 pr-4">{p.reserved_quantity ?? 0}</td>
                  <td className="py-3 pr-4">
                    <Pill tone={stock.tone}>{stock.label}</Pill>
                  </td>
                  <td className="py-3 pr-4">
                    <div className="flex gap-2">
                      <Input
                        inputMode="numeric"
                        value={edit.stock}
                        placeholder="0"
                        onChange={(e) =>
                          setEdits((prev) => ({ ...prev, [p.id]: { ...edit, stock: e.target.value } }))
                        }
                        className="h-9 w-20 rounded-xl"
                      />
                      <select
                        value={edit.kind}
                        onChange={(e) =>
                          setEdits((prev) => ({ ...prev, [p.id]: { ...edit, kind: e.target.value } }))
                        }
                        className="h-9 rounded-xl border border-border bg-background px-2 text-xs"
                      >
                        {INVENTORY_KINDS.map((k) => (
                          <option key={k.value} value={k.value}>
                            {k.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </td>
                  <td className="py-3 pr-4">
                    <Input
                      value={edit.reason}
                      placeholder="Optional note"
                      onChange={(e) =>
                        setEdits((prev) => ({ ...prev, [p.id]: { ...edit, reason: e.target.value } }))
                      }
                      className="h-9 rounded-xl"
                    />
                  </td>
                  <td className="py-3 pr-4">
                    <Button
                      size="sm"
                      className="rounded-full font-bold"
                      disabled={adjust.isPending}
                      onClick={() => adjust.mutate(p.id)}
                    >
                      {adjust.isPending ? <Loader2 className="size-4 animate-spin" /> : "Save"}
                    </Button>
                  </td>
                </tr>
              );
            })}
          </DataTable>
        </QueryBoundary>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Recent movements">
          <QueryBoundary
            isLoading={movements.isLoading}
            error={movements.error}
            isEmpty={(movements.data ?? []).length === 0}
            onRetry={() => void movements.refetch()}
            empty={
              <EmptyState
                icon={<Layers className="size-5" />}
                title="No movements yet"
                body="Stock adjustments and order deductions are logged here."
              />
            }
          >
            <DataTable columns={["Product", "Change", "Result", "Kind", "When"]}>
              {(movements.data ?? []).map((m) => (
                <tr key={m.id}>
                  <td className="py-3 pr-4 font-semibold">{m.products?.name ?? "—"}</td>
                  <td className="py-3 pr-4">{m.quantity_delta > 0 ? `+${m.quantity_delta}` : m.quantity_delta}</td>
                  <td className="py-3 pr-4">{m.resulting_stock}</td>
                  <td className="py-3 pr-4">{statusLabel(m.kind)}</td>
                  <td className="py-3 pr-4 text-muted-foreground">{formatDate(m.created_at)}</td>
                </tr>
              ))}
            </DataTable>
          </QueryBoundary>
        </Panel>

        <Panel title="Batch expiry">
          <QueryBoundary
            isLoading={batches.isLoading}
            error={batches.error}
            isEmpty={(batches.data ?? []).length === 0}
            onRetry={() => void batches.refetch()}
            empty={
              <EmptyState
                icon={<Layers className="size-5" />}
                title="No batches recorded"
                body="Medication batches with expiry dates appear here once recorded."
              />
            }
          >
            <DataTable columns={["Product", "Batch", "Qty", "Expires"]}>
              {(batches.data ?? []).map((b) => (
                <tr key={b.id}>
                  <td className="py-3 pr-4 font-semibold">{b.products?.name ?? "—"}</td>
                  <td className="py-3 pr-4">{b.batch_number}</td>
                  <td className="py-3 pr-4">{b.quantity}</td>
                  <td className="py-3 pr-4">{b.expiry_date ?? "—"}</td>
                </tr>
              ))}
            </DataTable>
          </QueryBoundary>
        </Panel>
      </div>
    </SellerPage>
  );
}
