import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { CreditCard, Loader2, Wallet } from "lucide-react";
import { toast } from "sonner";
import { CustomerFooter, CustomerHeader } from "@/components/medra/CustomerChrome";
import { EmptyState, QueryBoundary } from "@/components/medra/States";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useWallet } from "@/lib/hooks";
import {
  DELIVERY_FEE,
  POINTS_PER_NAIRA,
  POINT_VALUE_NAIRA,
  formatNaira,
  getOrCreateWallet,
} from "@/lib/medra";
import { useCartQuery } from "./cart";

export const Route = createFileRoute("/checkout")({
  head: () => ({
    meta: [
      { title: "Checkout — Medra" },
      { name: "description", content: "Confirm your delivery address, redeem reward points and place your Medra order." },
      { property: "og:title", content: "Checkout — Medra" },
      { property: "og:description", content: "Confirm delivery details and place your Medra order." },
    ],
  }),
  component: CheckoutPage,
});

function CheckoutPage() {
  const { user, session } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const cart = useCartQuery();
  const wallet = useWallet();

  const [address, setAddress] = useState({
    recipient_name: "",
    phone: "",
    line1: "",
    city: "",
    state: "",
  });
  const [pointsToRedeem, setPointsToRedeem] = useState(0);

  const savedAddress = useQuery({
    queryKey: ["default-address", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("addresses")
        .select("*")
        .eq("user_id", user!.id)
        .order("is_default", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const items = cart.data?.items ?? [];
  const subtotal = items.reduce(
    (sum, item) => sum + Number(item.products?.price ?? 0) * item.quantity,
    0,
  );
  const availablePoints = wallet.data?.points_balance ?? 0;
  const maxRedeemable = Math.min(availablePoints, Math.floor(subtotal / POINT_VALUE_NAIRA));
  const redeemed = Math.max(0, Math.min(pointsToRedeem, maxRedeemable));
  const discount = redeemed * POINT_VALUE_NAIRA;
  const total = Math.max(0, subtotal - discount) + DELIVERY_FEE;
  const pointsEarned = Math.floor(total * POINTS_PER_NAIRA);

  const placeOrder = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Log in to place an order");
      if (items.length === 0) throw new Error("Your cart is empty");

      let addressId = savedAddress.data?.id ?? null;
      if (!addressId) {
        if (!address.line1 || !address.city) throw new Error("Add a delivery address first");
        const created = await supabase
          .from("addresses")
          .insert({ ...address, user_id: user.id, is_default: true })
          .select("id")
          .single();
        if (created.error) throw created.error;
        addressId = created.data.id;
      }

      const order = await supabase
        .from("orders")
        .insert({
          customer_id: user.id,
          address_id: addressId,
          subtotal,
          delivery_fee: DELIVERY_FEE,
          points_redeemed: redeemed,
          points_discount: discount,
          total,
          status: "preparing",
        })
        .select("id, order_number")
        .single();
      if (order.error) throw order.error;

      const orderItems = items.map((item) => ({
        order_id: order.data.id,
        product_id: item.product_id,
        product_name: item.products?.name ?? "Product",
        quantity: item.quantity,
        unit_price: Number(item.products?.price ?? 0),
        seller_id: item.seller_id,
        store_id: item.store_id,
      }));
      const insertedItems = await supabase.from("order_items").insert(orderItems);
      if (insertedItems.error) throw insertedItems.error;

      await supabase.from("deliveries").insert({ order_id: order.data.id, status: "pending" });
      await supabase.from("payments").insert({
        order_id: order.data.id,
        amount: total,
        provider: "pay_on_delivery",
        status: "pending",
      });

      const walletRow = await getOrCreateWallet(user.id);
      const nextBalance = walletRow.points_balance - redeemed + pointsEarned;
      await supabase.from("wallets").update({ points_balance: nextBalance }).eq("id", walletRow.id);
      if (redeemed > 0) {
        await supabase.from("wallet_transactions").insert({
          user_id: user.id,
          order_id: order.data.id,
          kind: "redeem",
          points: -redeemed,
          description: `Redeemed on order ${order.data.order_number}`,
        });
      }
      if (pointsEarned > 0) {
        await supabase.from("wallet_transactions").insert({
          user_id: user.id,
          order_id: order.data.id,
          kind: "earn",
          points: pointsEarned,
          description: `Earned on order ${order.data.order_number}`,
        });
      }

      await supabase.from("notifications").insert({
        user_id: user.id,
        title: `Order ${order.data.order_number} confirmed`,
        body: "Your order is being prepared. Track it live from your orders page.",
        link: `/orders/${order.data.id}`,
      });

      if (cart.data?.cartId) {
        await supabase.from("cart_items").delete().eq("cart_id", cart.data.cartId);
      }

      return order.data;
    },
    onSuccess: (order) => {
      queryClient.clear();
      toast.success(`Order ${order.order_number} placed`);
      void navigate({ to: "/orders/$orderId", params: { orderId: order.id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="min-h-screen bg-background">
      <CustomerHeader />
      <div className="mx-auto max-w-5xl px-5 py-8">
        <h1 className="text-2xl font-extrabold">Checkout</h1>

        {!session ? (
          <div className="mt-6">
            <EmptyState
              title="Log in to check out"
              body="You need a Medra account to place an order and track its delivery."
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
                  title="Nothing to check out"
                  body="Add items to your cart before checking out."
                  action={
                    <Button asChild className="rounded-full px-6 font-bold">
                      <Link to="/catalog">Browse products</Link>
                    </Button>
                  }
                />
              }
            >
              <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
                <div className="space-y-5">
                  <section className="surface-card p-4">
                    <h2 className="font-bold">Delivery address</h2>
                    {savedAddress.data ? (
                      <div className="mt-3 rounded-xl border border-border p-3 text-sm">
                        <p className="font-semibold">{savedAddress.data.recipient_name ?? "You"}</p>
                        <p className="text-muted-foreground">
                          {[savedAddress.data.line1, savedAddress.data.city, savedAddress.data.state]
                            .filter(Boolean)
                            .join(", ")}
                        </p>
                        <Link
                          to="/account"
                          className="mt-2 inline-block font-semibold text-primary hover:underline"
                        >
                          Manage addresses
                        </Link>
                      </div>
                    ) : (
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <AddrField label="Recipient name" value={address.recipient_name} onChange={(v) => setAddress((a) => ({ ...a, recipient_name: v }))} />
                        <AddrField label="Phone" value={address.phone} onChange={(v) => setAddress((a) => ({ ...a, phone: v }))} />
                        <AddrField label="Street address" value={address.line1} onChange={(v) => setAddress((a) => ({ ...a, line1: v }))} />
                        <AddrField label="City" value={address.city} onChange={(v) => setAddress((a) => ({ ...a, city: v }))} />
                        <AddrField label="State" value={address.state} onChange={(v) => setAddress((a) => ({ ...a, state: v }))} />
                      </div>
                    )}
                  </section>

                  <section className="surface-card p-4">
                    <h2 className="flex items-center gap-2 font-bold">
                      <Wallet className="size-4 text-leaf" /> Rewards wallet
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      You have {availablePoints.toLocaleString()} points. Every point is worth{" "}
                      {formatNaira(POINT_VALUE_NAIRA)} at checkout.
                    </p>
                    <div className="mt-3 flex items-end gap-3">
                      <div className="w-40">
                        <Label htmlFor="points" className="text-sm font-semibold">
                          Points to redeem
                        </Label>
                        <Input
                          id="points"
                          type="number"
                          min={0}
                          max={maxRedeemable}
                          value={pointsToRedeem}
                          onChange={(e) => setPointsToRedeem(Number(e.target.value))}
                          className="h-11 rounded-xl"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setPointsToRedeem(maxRedeemable)}
                        className="rounded-full font-bold"
                        disabled={maxRedeemable === 0}
                      >
                        Use max
                      </Button>
                    </div>
                  </section>

                  <section className="surface-card p-4">
                    <h2 className="flex items-center gap-2 font-bold">
                      <CreditCard className="size-4 text-sky" /> Payment
                    </h2>
                    <div className="mt-3 rounded-xl border border-primary bg-primary/5 p-3 text-sm">
                      <p className="font-semibold">Pay on delivery</p>
                      <p className="text-muted-foreground">
                        Pay the rider with cash or transfer when your order arrives.
                      </p>
                    </div>
                    <div className="mt-3 rounded-xl border border-dashed border-border p-3 text-sm text-muted-foreground">
                      Card payments become available once the platform's payment provider is
                      connected by the Medra team.
                    </div>
                  </section>
                </div>

                <aside className="surface-card h-fit p-4">
                  <h2 className="font-bold">Order summary</h2>
                  <dl className="mt-3 space-y-2 text-sm">
                    <SumRow label={`Items (${items.length})`} value={formatNaira(subtotal)} />
                    <SumRow label="Delivery" value={formatNaira(DELIVERY_FEE)} />
                    {discount > 0 && (
                      <SumRow label={`Points (${redeemed})`} value={`-${formatNaira(discount)}`} />
                    )}
                    <div className="border-t border-border pt-2">
                      <SumRow label="Total" value={formatNaira(total)} bold />
                    </div>
                  </dl>
                  <p className="mt-3 text-xs text-muted-foreground">
                    You'll earn {pointsEarned.toLocaleString()} reward points on this order.
                  </p>
                  <Button
                    disabled={placeOrder.isPending}
                    onClick={() => placeOrder.mutate()}
                    className="mt-4 w-full rounded-full py-6 font-bold"
                  >
                    {placeOrder.isPending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      "Place order"
                    )}
                  </Button>
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

function AddrField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const id = label.toLowerCase().replace(/\s+/g, "-");
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-sm font-semibold">
        {label}
      </Label>
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 rounded-xl"
      />
    </div>
  );
}

function SumRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <dt className={bold ? "font-bold" : "text-muted-foreground"}>{label}</dt>
      <dd className={bold ? "font-extrabold" : "font-semibold"}>{value}</dd>
    </div>
  );
}
