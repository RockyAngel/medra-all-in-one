import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Boxes, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Panel } from "@/components/medra/DashboardShell";
import { DataTable, Pill, SellerPage } from "@/components/medra/RoleDashboard";
import { EmptyState, QueryBoundary } from "@/components/medra/States";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useCategories, useMyStore } from "@/lib/hooks";
import { formatNaira, imageUrl } from "@/lib/medra";
import { stockStatus } from "@/lib/dashboard";
import { useSellerProducts } from "@/lib/ops";
import { customerPriceFromSellerPrice, workflowError } from "@/lib/workflow";

export const Route = createFileRoute("/seller_/products")({
  head: () => ({
    meta: [
      { title: "Products — Medra seller" },
      {
        name: "description",
        content:
          "Create, edit and retire the products you sell on Medra, with images, stock levels and customer pricing.",
      },
      { property: "og:title", content: "Products — Medra seller" },
      { property: "og:description", content: "Manage your Medra product catalogue." },
    ],
  }),
  component: SellerProductsPage,
});

type Draft = {
  id?: string;
  name: string;
  description: string;
  seller_price: string;
  stock_quantity: string;
  low_stock_threshold: string;
  sku: string;
  category_id: string;
};

const EMPTY: Draft = {
  name: "",
  description: "",
  seller_price: "",
  stock_quantity: "0",
  low_stock_threshold: "5",
  sku: "",
  category_id: "",
};

function SellerProductsPage() {
  const products = useSellerProducts();
  const categories = useCategories();
  const store = useMyStore();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [file, setFile] = useState<File | null>(null);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["seller-products"] });
    void queryClient.invalidateQueries({ queryKey: ["seller-overview"] });
  };

  const save = useMutation({
    mutationFn: async (values: Draft) => {
      if (!store.data) throw new Error("Create your store profile before adding products");
      if (!values.name.trim()) throw new Error("Give the product a name");
      const sellerPrice = Number(values.seller_price);
      if (!Number.isFinite(sellerPrice) || sellerPrice <= 0) throw new Error("Enter a valid price");

      let imagePath: string | null = null;
      if (file) {
        const ext = file.name.split(".").pop() ?? "jpg";
        const path = `${store.data.id}/${crypto.randomUUID()}.${ext}`;
        const upload = await supabase.storage.from("product-images").upload(path, file);
        if (upload.error) throw upload.error;
        imagePath = path;
      }

      const payload = {
        store_id: store.data.id,
        seller_id: store.data.owner_id,
        name: values.name.trim(),
        description: values.description.trim() || null,
        seller_price: sellerPrice,
        stock_quantity: Number(values.stock_quantity) || 0,
        low_stock_threshold: Number(values.low_stock_threshold) || 0,
        sku: values.sku.trim() || null,
        category_id: values.category_id || null,
        ...(imagePath ? { image_path: imagePath } : {}),
      };

      if (values.id) {
        const { error } = await supabase.from("products").update(payload).eq("id", values.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("products").insert({ ...payload, status: "active" });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Product saved");
      setDraft(null);
      setFile(null);
      invalidate();
    },
    onError: (e) => toast.error(workflowError(e)),
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "active" | "archived" }) => {
      const { error } = await supabase.from("products").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Product updated");
      invalidate();
    },
    onError: (e) => toast.error(workflowError(e)),
  });

  return (
    <SellerPage
      title="Products"
      subtitle="Sellers set the amount they receive; customers pay a 10% platform markup"
      topRight={
        <Button className="rounded-full font-bold" onClick={() => setDraft({ ...EMPTY })}>
          <Plus className="mr-1 size-4" /> New product
        </Button>
      }
    >
      {draft && (
        <Panel title={draft.id ? "Edit product" : "New product"} className="mb-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name">
              <Input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                className="rounded-xl"
              />
            </Field>
            <Field label="SKU">
              <Input
                value={draft.sku}
                onChange={(e) => setDraft({ ...draft, sku: e.target.value })}
                className="rounded-xl"
              />
            </Field>
            <Field label="Your price (₦)">
              <Input
                inputMode="decimal"
                value={draft.seller_price}
                onChange={(e) => setDraft({ ...draft, seller_price: e.target.value })}
                className="rounded-xl"
              />
              {Number(draft.seller_price) > 0 && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Customer pays {formatNaira(customerPriceFromSellerPrice(Number(draft.seller_price)))}
                </p>
              )}
            </Field>
            <Field label="Category">
              <select
                value={draft.category_id}
                onChange={(e) => setDraft({ ...draft, category_id: e.target.value })}
                className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
              >
                <option value="">Uncategorised</option>
                {(categories.data ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Stock quantity">
              <Input
                inputMode="numeric"
                value={draft.stock_quantity}
                onChange={(e) => setDraft({ ...draft, stock_quantity: e.target.value })}
                className="rounded-xl"
              />
            </Field>
            <Field label="Low stock alert at">
              <Input
                inputMode="numeric"
                value={draft.low_stock_threshold}
                onChange={(e) => setDraft({ ...draft, low_stock_threshold: e.target.value })}
                className="rounded-xl"
              />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Description">
                <Textarea
                  value={draft.description}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                  className="min-h-20 rounded-xl"
                />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="Product image">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  className="text-sm"
                />
              </Field>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Button
              className="rounded-full font-bold"
              disabled={save.isPending}
              onClick={() => save.mutate(draft)}
            >
              {save.isPending ? <Loader2 className="size-4 animate-spin" /> : "Save product"}
            </Button>
            <Button
              variant="outline"
              className="rounded-full font-bold"
              onClick={() => {
                setDraft(null);
                setFile(null);
              }}
            >
              Cancel
            </Button>
          </div>
        </Panel>
      )}

      <Panel title="Your catalogue">
        <QueryBoundary
          isLoading={products.isLoading || store.isLoading}
          error={products.error ?? store.error}
          isEmpty={(products.data ?? []).length === 0}
          onRetry={() => void products.refetch()}
          empty={
            <EmptyState
              icon={<Boxes className="size-5" />}
              title="No products yet"
              body="Add your first product to start selling on Medra."
            />
          }
        >
          <DataTable columns={["Product", "Customer price", "Stock", "Status", "Actions"]}>
            {(products.data ?? []).map((p) => {
              const stock = stockStatus(
                Number(p.stock_quantity ?? 0),
                Number(p.low_stock_threshold ?? 0),
              );
              return (
                <tr key={p.id}>
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-3">
                      {p.image_path ? (
                        <img
                          src={imageUrl(p.image_path)}
                          alt={p.name}
                          loading="lazy"
                          className="size-10 rounded-xl object-cover"
                        />
                      ) : (
                        <span className="grid size-10 place-items-center rounded-xl bg-muted text-xs">—</span>
                      )}
                      <div>
                        <p className="font-semibold">{p.name}</p>
                        <p className="text-xs text-muted-foreground">{p.sku ?? "No SKU"}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 pr-4">{formatNaira(p.price)}</td>
                  <td className="py-3 pr-4">
                    <Pill tone={stock.tone}>
                      {p.stock_quantity} · {stock.label}
                    </Pill>
                  </td>
                  <td className="py-3 pr-4 capitalize">{p.status.replace(/_/g, " ")}</td>
                  <td className="py-3 pr-4">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-full font-bold"
                        onClick={() =>
                          setDraft({
                            id: p.id,
                            name: p.name,
                            description: "",
                            seller_price: String(p.seller_price ?? ""),
                            stock_quantity: String(p.stock_quantity ?? 0),
                            low_stock_threshold: String(p.low_stock_threshold ?? 0),
                            sku: p.sku ?? "",
                            category_id: "",
                          })
                        }
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="rounded-full font-bold"
                        disabled={setStatus.isPending}
                        onClick={() =>
                          setStatus.mutate({
                            id: p.id,
                            status: p.status === "archived" ? "active" : "archived",
                          })
                        }
                      >
                        {p.status === "archived" ? "Restore" : "Archive"}
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </DataTable>
        </QueryBoundary>
      </Panel>
    </SellerPage>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-semibold">{label}</span>
      {children}
    </label>
  );
}
