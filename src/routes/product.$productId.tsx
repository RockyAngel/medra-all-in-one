import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { FileText, Heart, Minus, Plus, ShieldCheck, Store, Truck } from "lucide-react";
import { toast } from "sonner";
import { CustomerFooter, CustomerHeader, StoredImage } from "@/components/medra/CustomerChrome";
import { EmptyState, QueryBoundary } from "@/components/medra/States";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { formatNaira, getOrCreateCart } from "@/lib/medra";

export const Route = createFileRoute("/product/$productId")({
  head: () => ({
    meta: [
      { title: "Product details — Medra" },
      { name: "description", content: "View product details, stock and store information on Medra." },
      { property: "og:title", content: "Product details — Medra" },
      { property: "og:description", content: "View product details and add it to your Medra cart." },
    ],
  }),
  component: ProductPage,
});

function ProductPage() {
  const { productId } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [qty, setQty] = useState(1);

  const product = useQuery({
    queryKey: ["product", productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select(
          "id, name, description, price, image_path, stock_quantity, seller_id, store_id, prescription_required, is_medication, generic_name, brand_name, strength, nafdac_number, emergency_eligible, stores(name, slug, city, rating_average)",
        )
        .eq("id", productId)
        .eq("status", "active")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const addToCart = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("not-signed-in");
      const p = product.data!;
      const cartId = await getOrCreateCart(user.id);
      const existing = await supabase
        .from("cart_items")
        .select("id, quantity")
        .eq("cart_id", cartId)
        .eq("product_id", p.id)
        .maybeSingle();
      if (existing.data) {
        const { error } = await supabase
          .from("cart_items")
          .update({ quantity: existing.data.quantity + qty })
          .eq("id", existing.data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("cart_items").insert({
          cart_id: cartId,
          product_id: p.id,
          quantity: qty,
          seller_id: p.seller_id,
          store_id: p.store_id,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Added to cart");
      void queryClient.invalidateQueries({ queryKey: ["cart-count"] });
      void queryClient.invalidateQueries({ queryKey: ["cart"] });
    },
    onError: (e: Error) => {
      if (e.message === "not-signed-in") {
        toast.error("Log in to start a cart");
        void navigate({ to: "/login" });
        return;
      }
      toast.error(e.message);
    },
  });

  const saveItem = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("not-signed-in");
      const { error } = await supabase
        .from("favorites")
        .insert({ user_id: user.id, product_id: productId });
      if (error && !error.message.includes("duplicate")) throw error;
    },
    onSuccess: () => toast.success("Saved to your list"),
    onError: (e: Error) =>
      toast.error(e.message === "not-signed-in" ? "Log in to save items" : e.message),
  });

  return (
    <div className="min-h-screen bg-background">
      <CustomerHeader />
      <div className="mx-auto max-w-7xl px-5 py-8">
        <QueryBoundary
          isLoading={product.isLoading}
          error={product.error}
          isEmpty={!product.data}
          onRetry={() => void product.refetch()}
          empty={
            <EmptyState
              title="Product not available"
              body="This product may have been removed or is no longer active."
              action={
                <Button asChild variant="outline" className="rounded-full font-bold">
                  <Link to="/catalog">Keep browsing</Link>
                </Button>
              }
            />
          }
        >
          {product.data && (
            <div className="grid gap-8 lg:grid-cols-2">
              <StoredImage
                path={product.data.image_path}
                alt={product.data.name}
                className="h-80 w-full rounded-2xl"
              />
              <div>
                <h1 className="text-3xl font-extrabold">{product.data.name}</h1>
                {product.data.stores && (
                  <Link
                    to="/store/$storeSlug"
                    params={{ storeSlug: product.data.stores.slug }}
                    className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-sky hover:underline"
                  >
                    <Store className="size-4" /> {product.data.stores.name}
                    {product.data.stores.city ? ` · ${product.data.stores.city}` : ""}
                  </Link>
                )}
                <p className="mt-4 text-3xl font-extrabold text-grape">
                  {formatNaira(product.data.price)}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {product.data.stock_quantity > 0
                    ? `${product.data.stock_quantity} in stock`
                    : "Currently out of stock"}
                </p>
                {product.data.prescription_required && (
                  <div className="mt-4 flex items-start gap-2 rounded-2xl border border-amber/40 bg-amber/10 p-3 text-sm">
                    <FileText className="mt-0.5 size-4 text-amber" />
                    <div>
                      <p className="font-bold">Prescription required</p>
                      <p className="text-muted-foreground">
                        Add this item to your cart, then upload a prescription for this pharmacy.
                        Checkout unlocks once a pharmacist approves it.
                      </p>
                      <Link
                        to="/health/prescriptions"
                        className="mt-1 inline-block font-semibold text-primary hover:underline"
                      >
                        Manage prescriptions
                      </Link>
                    </div>
                  </div>
                )}
                {product.data.is_medication && (
                  <dl className="mt-4 grid gap-2 rounded-2xl border border-border p-3 text-sm sm:grid-cols-2">
                    {product.data.generic_name && (
                      <MedRow label="Generic name" value={product.data.generic_name} />
                    )}
                    {product.data.brand_name && (
                      <MedRow label="Brand" value={product.data.brand_name} />
                    )}
                    {product.data.strength && (
                      <MedRow label="Strength" value={product.data.strength} />
                    )}
                    {product.data.nafdac_number && (
                      <MedRow label="NAFDAC no." value={product.data.nafdac_number} />
                    )}
                  </dl>
                )}
                {product.data.description && (
                  <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                    {product.data.description}
                  </p>
                )}

                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-3 rounded-full border border-border px-3 py-1.5">
                    <button
                      aria-label="Decrease quantity"
                      onClick={() => setQty((q) => Math.max(1, q - 1))}
                      className="text-muted-foreground"
                    >
                      <Minus className="size-4" />
                    </button>
                    <span className="w-6 text-center text-sm font-bold">{qty}</span>
                    <button
                      aria-label="Increase quantity"
                      onClick={() =>
                        setQty((q) => Math.min(product.data!.stock_quantity || 1, q + 1))
                      }
                      className="text-muted-foreground"
                    >
                      <Plus className="size-4" />
                    </button>
                  </div>
                  <Button
                    disabled={product.data.stock_quantity < 1 || addToCart.isPending}
                    onClick={() => addToCart.mutate()}
                    className="rounded-full px-6 font-bold"
                  >
                    Add to cart
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => saveItem.mutate()}
                    className="rounded-full font-bold"
                  >
                    <Heart className="mr-1 size-4" /> Save
                  </Button>
                </div>

                <ul className="mt-8 grid gap-3 sm:grid-cols-2">
                  <li className="flex items-center gap-2 text-sm text-muted-foreground">
                    <ShieldCheck className="size-4 text-leaf" /> Buyer protection on every order
                  </li>
                  <li className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Truck className="size-4 text-sky" /> Live delivery tracking
                  </li>
                  {product.data.emergency_eligible && (
                    <li className="flex items-center gap-2 text-sm text-muted-foreground">
                      <ShieldCheck className="size-4 text-destructive" /> Eligible for priority
                      pharmacy delivery
                    </li>
                  )}
                </ul>
              </div>
            </div>
          )}
        </QueryBoundary>
      </div>
      <CustomerFooter />
    </div>
  );
}

function MedRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="font-semibold">{value}</dd>
    </div>
  );
}
