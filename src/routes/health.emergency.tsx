import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AlertTriangle, Loader2, Search, Siren, Truck } from "lucide-react";
import { toast } from "sonner";
import { CustomerFooter, CustomerHeader, StoredImage } from "@/components/medra/CustomerChrome";
import { EmptyState, QueryBoundary } from "@/components/medra/States";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { ORDER_STATUS_LABEL, formatDate, formatNaira, getOrCreateCart } from "@/lib/medra";
import { workflowError } from "@/lib/workflow";
import {
  useEmergencyEligibility,
  useEmergencyFeature,
  useEmergencyProducts,
} from "@/lib/health";

export const Route = createFileRoute("/health/emergency")({
  head: () => ({
    meta: [
      { title: "Emergency pharmacy delivery — Medra" },
      {
        name: "description",
        content:
          "Order urgent medicines from verified Medra pharmacies with priority dispatch, live eligibility checks and real-time delivery tracking.",
      },
      { property: "og:title", content: "Emergency pharmacy delivery — Medra" },
      {
        property: "og:description",
        content: "Priority pharmacy delivery from verified Medra pharmacies.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: EmergencyPage,
});

function EmergencyPage() {
  const { user, session } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const feature = useEmergencyFeature();
  const products = useEmergencyProducts(search);
  const eligibility = useEmergencyEligibility(selected);

  const activeOrders = useQuery({
    queryKey: ["emergency-orders", user?.id],
    enabled: !!user,
    refetchInterval: 20000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select(
          "id, order_number, status, total, created_at, deliveries(status, picked_up_at, delivered_at)",
        )
        .eq("customer_id", user!.id)
        .eq("is_emergency", true)
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data ?? [];
    },
  });

  const addToCart = useMutation({
    mutationFn: async (productId: string) => {
      if (!user) throw new Error("Log in to start a priority order");
      const product = (products.data ?? []).find((p) => p.id === productId);
      if (!product) throw new Error("This item is no longer available");
      const check = await supabase.rpc("emergency_eligibility", { _product_id: productId });
      if (check.error) throw check.error;
      const result = (check.data ?? {}) as { eligible?: boolean; reasons?: string[] };
      if (result.eligible !== true) {
        throw new Error(result.reasons?.[0] ?? "This item is not available for priority delivery");
      }
      const cartId = await getOrCreateCart(user.id);
      const existing = await supabase
        .from("cart_items")
        .select("id, quantity")
        .eq("cart_id", cartId)
        .eq("product_id", productId)
        .maybeSingle();
      if (existing.data) {
        const { error } = await supabase
          .from("cart_items")
          .update({ quantity: existing.data.quantity + 1 })
          .eq("id", existing.data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("cart_items").insert({
          cart_id: cartId,
          product_id: productId,
          quantity: 1,
          seller_id: product.seller_id,
          store_id: product.store_id,
        });
        if (error) throw error;
      }
      return product.prescription_required;
    },
    onSuccess: (needsRx) => {
      void queryClient.invalidateQueries({ queryKey: ["cart"] });
      void queryClient.invalidateQueries({ queryKey: ["cart-count"] });
      void queryClient.invalidateQueries({ queryKey: ["cart-prescription-status"] });
      if (needsRx) {
        toast.info("This medicine needs an approved prescription before checkout");
        void navigate({ to: "/health/prescriptions" });
        return;
      }
      toast.success("Added — turn on priority delivery at checkout");
      void navigate({ to: "/checkout" });
    },
    onError: (e) => toast.error(workflowError(e)),
  });

  return (
    <div className="min-h-screen bg-background">
      <CustomerHeader />
      <main className="mx-auto max-w-6xl px-5 py-8">
        <p className="flex items-center gap-2 text-sm font-semibold text-destructive">
          <Siren className="size-4" /> Priority pharmacy
        </p>
        <h1 className="mt-1 text-2xl font-extrabold">Emergency pharmacy delivery</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Urgent medicines from verified pharmacies that are open now, dispatched ahead of standard
          orders. Eligibility and stock are checked live before you pay.
        </p>

        {feature.data === false && (
          <div className="mt-6 flex items-start gap-3 rounded-2xl border border-amber/40 bg-amber/10 p-4 text-sm">
            <AlertTriangle className="mt-0.5 size-4 text-amber" />
            <p>
              Priority pharmacy delivery is currently switched off by the Medra team. You can still
              order these medicines with standard delivery.
            </p>
          </div>
        )}

        <div className="mt-6 flex max-w-md items-center gap-2 rounded-full border border-border px-4">
          <Search className="size-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search urgent medicines"
            className="h-11 border-0 px-0 shadow-none focus-visible:ring-0"
          />
        </div>

        <section className="mt-6">
          <QueryBoundary
            isLoading={products.isLoading}
            error={products.error}
            isEmpty={(products.data ?? []).length === 0}
            onRetry={() => void products.refetch()}
            empty={
              <EmptyState
                icon={<Siren className="size-5" />}
                title="No priority items available right now"
                body="No verified pharmacy currently has emergency-eligible stock matching your search."
                action={
                  <Button asChild variant="outline" className="rounded-full font-bold">
                    <Link to="/catalog">Browse the catalog</Link>
                  </Button>
                }
              />
            }
          >
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {(products.data ?? []).map((p) => {
                const active = selected === p.id;
                return (
                  <li key={p.id} className="surface-card flex flex-col p-4">
                    <StoredImage
                      path={p.image_path}
                      alt={p.name}
                      className="h-36 w-full rounded-xl"
                    />
                    <p className="mt-3 font-bold">{p.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {[p.generic_name, p.strength].filter(Boolean).join(" · ") || "Medication"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {p.stores?.name}
                      {p.stores?.city ? ` · ${p.stores.city}` : ""}
                    </p>
                    <p className="mt-2 text-lg font-extrabold text-grape">
                      {formatNaira(p.price)}
                    </p>
                    <p className="text-xs text-muted-foreground">{p.stock_quantity} in stock</p>
                    {p.prescription_required && (
                      <p className="mt-2 rounded-lg bg-amber/15 px-2 py-1 text-[11px] font-bold text-amber">
                        Prescription required
                      </p>
                    )}

                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-full font-bold"
                        onClick={() => setSelected(active ? null : p.id)}
                      >
                        {active ? "Hide check" : "Check eligibility"}
                      </Button>
                      <Button
                        size="sm"
                        className="rounded-full font-bold"
                        disabled={addToCart.isPending || !session}
                        onClick={() => addToCart.mutate(p.id)}
                      >
                        {addToCart.isPending ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          "Order now"
                        )}
                      </Button>
                    </div>
                    {!session && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        <Link to="/login" className="font-semibold text-primary hover:underline">
                          Log in
                        </Link>{" "}
                        to place a priority order.
                      </p>
                    )}

                    {active && (
                      <div className="mt-3 rounded-xl border border-dashed border-border p-3 text-xs">
                        {eligibility.isLoading ? (
                          <span className="text-muted-foreground">Checking live eligibility…</span>
                        ) : eligibility.error ? (
                          <span className="text-destructive">
                            Could not check eligibility right now.
                          </span>
                        ) : eligibility.data?.eligible ? (
                          <span className="font-semibold text-leaf">
                            Eligible for priority delivery — a rider is available now.
                          </span>
                        ) : (
                          <ul className="space-y-1 text-muted-foreground">
                            {(eligibility.data?.reasons ?? ["Not eligible right now."]).map(
                              (reason) => (
                                <li key={reason}>• {reason}</li>
                              ),
                            )}
                          </ul>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </QueryBoundary>
        </section>

        {session && (activeOrders.data ?? []).length > 0 && (
          <section className="mt-10">
            <h2 className="flex items-center gap-2 font-bold">
              <Truck className="size-4 text-sky" /> Your priority orders
            </h2>
            <ul className="mt-3 space-y-3">
              {(activeOrders.data ?? []).map((order) => {
                const delivery = Array.isArray(order.deliveries)
                  ? order.deliveries[0]
                  : order.deliveries;
                return (
                  <li key={order.id} className="surface-card flex flex-wrap items-center justify-between gap-3 p-4">
                    <div>
                      <p className="font-bold">{order.order_number}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(order.created_at)} · {formatNaira(order.total)}
                      </p>
                      <p className="mt-1 text-xs">
                        <span className="font-semibold">
                          {ORDER_STATUS_LABEL[order.status] ?? order.status.replace(/_/g, " ")}
                        </span>
                        {delivery?.status ? ` · delivery ${delivery.status.replace(/_/g, " ")}` : ""}
                      </p>
                    </div>
                    <Button asChild size="sm" variant="outline" className="rounded-full font-bold">
                      <Link to="/orders/$orderId" params={{ orderId: order.id }}>
                        Track order
                      </Link>
                    </Button>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </main>
      <CustomerFooter />
    </div>
  );
}
