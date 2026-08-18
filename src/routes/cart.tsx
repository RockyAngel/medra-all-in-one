import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { CustomerFooter, CustomerHeader, StoredImage } from "@/components/medra/CustomerChrome";
import { EmptyState, QueryBoundary } from "@/components/medra/States";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { DELIVERY_FEE, formatNaira } from "@/lib/medra";

export const Route = createFileRoute("/cart")({
  head: () => ({
    meta: [
      { title: "Your Medra cart" },
      { name: "description", content: "Review the items in your Medra cart before checking out." },
      { property: "og:title", content: "Your Medra cart" },
      { property: "og:description", content: "Review your Medra cart and continue to checkout." },
    ],
  }),
  component: CartPage,
});

export function useCartQuery() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["cart", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const cart = await supabase.from("carts").select("id").eq("user_id", user!.id).maybeSingle();
      if (!cart.data) return { cartId: null, items: [] };
      const { data, error } = await supabase
        .from("cart_items")
        .select(
          "id, quantity, product_id, seller_id, store_id, products(name, price, delivery_fee, image_path, stock_quantity, prescription_required, emergency_eligible, is_medication), stores(name, slug, store_type, accepts_emergency_orders, is_open)",
        )
        .eq("cart_id", cart.data.id)
        .order("created_at");
      if (error) throw error;
      return { cartId: cart.data.id, items: data ?? [] };
    },
  });
}

function CartPage() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const cart = useCartQuery();

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["cart"] });
    void queryClient.invalidateQueries({ queryKey: ["cart-count"] });
  };

  const setQuantity = useMutation({
    mutationFn: async ({ id, quantity }: { id: string; quantity: number }) => {
      if (quantity < 1) {
        const { error } = await supabase.from("cart_items").delete().eq("id", id);
        if (error) throw error;
        return;
      }
      const { error } = await supabase.from("cart_items").update({ quantity }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: refresh,
    onError: (e: Error) => toast.error(e.message),
  });

  const items = cart.data?.items ?? [];
  const subtotal = items.reduce(
    (sum, item) => sum + Number(item.products?.price ?? 0) * item.quantity,
    0,
  );
  const storeGroups = Array.from(
    items.reduce((map, item) => {
      const key = item.stores?.name ?? "Store";
      map.set(key, [...(map.get(key) ?? []), item]);
      return map;
    }, new Map<string, typeof items>()),
  );

  return (
    <div className="min-h-screen bg-background">
      <CustomerHeader />
      <div className="mx-auto max-w-5xl px-5 py-8">
        <h1 className="text-2xl font-extrabold">Your cart</h1>

        {!session ? (
          <div className="mt-6">
            <EmptyState
              icon={<ShoppingCart className="size-5" />}
              title="Log in to see your cart"
              body="Your cart is saved to your Medra account so it follows you across devices."
              action={
                <Button asChild className="rounded-full px-6 font-bold">
                  <Link to="/login">Log in</Link>
                </Button>
              }
            />
          </div>
        ) : (
          <div className="mt-6">
            <QueryBoundary
              isLoading={cart.isLoading}
              error={cart.error}
              isEmpty={items.length === 0}
              onRetry={() => void cart.refetch()}
              empty={
                <EmptyState
                  icon={<ShoppingCart className="size-5" />}
                  title="Your cart is empty"
                  body="Add products from any verified Medra store and they'll show up here."
                  action={
                    <Button asChild className="rounded-full px-6 font-bold">
                      <Link to="/catalog">Start shopping</Link>
                    </Button>
                  }
                />
              }
            >
              <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
                <div className="space-y-5">
                  {storeGroups.map(([storeName, group]) => (
                    <section key={storeName} className="surface-card p-4">
                      <h2 className="mb-3 text-sm font-bold text-muted-foreground">
                        Sold by {storeName}
                      </h2>
                      <ul className="space-y-4">
                        {group.map((item) => (
                          <li key={item.id} className="flex items-center gap-3">
                            <StoredImage
                              path={item.products?.image_path ?? null}
                              alt={item.products?.name ?? "Product"}
                              className="size-16 shrink-0 rounded-lg"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold">
                                {item.products?.name}
                              </p>
                              <p className="text-sm font-bold text-grape">
                                {formatNaira(item.products?.price ?? 0)}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 rounded-full border border-border px-2 py-1">
                              <button
                                aria-label="Decrease"
                                onClick={() =>
                                  setQuantity.mutate({ id: item.id, quantity: item.quantity - 1 })
                                }
                              >
                                <Minus className="size-4 text-muted-foreground" />
                              </button>
                              <span className="w-6 text-center text-sm font-bold">
                                {item.quantity}
                              </span>
                              <button
                                aria-label="Increase"
                                onClick={() =>
                                  setQuantity.mutate({ id: item.id, quantity: item.quantity + 1 })
                                }
                              >
                                <Plus className="size-4 text-muted-foreground" />
                              </button>
                            </div>
                            <button
                              aria-label="Remove item"
                              onClick={() => setQuantity.mutate({ id: item.id, quantity: 0 })}
                              className="text-muted-foreground hover:text-destructive"
                            >
                              <Trash2 className="size-4" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    </section>
                  ))}
                </div>

                <aside className="surface-card h-fit p-4">
                  <h2 className="font-bold">Order summary</h2>
                  <dl className="mt-3 space-y-2 text-sm">
                    <Row label="Subtotal" value={formatNaira(subtotal)} />
                    <Row label="Delivery" value={formatNaira(DELIVERY_FEE)} />
                    <div className="border-t border-border pt-2">
                      <Row label="Total" value={formatNaira(subtotal + DELIVERY_FEE)} bold />
                    </div>
                  </dl>
                  <Button asChild className="mt-4 w-full rounded-full py-6 font-bold">
                    <Link to="/checkout">Proceed to checkout</Link>
                  </Button>
                  <p className="mt-2 text-center text-xs text-muted-foreground">
                    Items from multiple stores are delivered together where possible.
                  </p>
                </aside>
              </div>
            </QueryBoundary>
          </div>
        )}
      </div>
      <CustomerFooter />
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <dt className={bold ? "font-bold" : "text-muted-foreground"}>{label}</dt>
      <dd className={bold ? "font-extrabold" : "font-semibold"}>{value}</dd>
    </div>
  );
}
