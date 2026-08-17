import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AlertTriangle, CreditCard, Loader2, Siren, Wallet } from "lucide-react";
import { toast } from "sonner";
import { CustomerFooter, CustomerHeader } from "@/components/medra/CustomerChrome";
import { EmptyState, QueryBoundary } from "@/components/medra/States";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useWallet } from "@/lib/hooks";
import { useFeatureEnabled } from "@/lib/permissions";

import {
  POINTS_PER_NAIRA,
  POINT_VALUE_NAIRA,
  formatNaira,
} from "@/lib/medra";
import { quoteDeliveryFee, workflowError } from "@/lib/workflow";
import {
  PRESCRIPTION_STATUS,
  statusChip,
  useCartPrescriptionStatus,
  useEmergencyFeature,
  assertPrescriptionsClear,
} from "@/lib/health";
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
  const [priority, setPriority] = useState(false);
  const [note, setNote] = useState("");
  const prescriptionStatus = useCartPrescriptionStatus();
  const emergencyFeature = useEmergencyFeature();
  const paymentsEnabled = useFeatureEnabled("payments.provider.enabled").enabled;


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

  const deliveryCity = savedAddress.data?.city ?? address.city;
  const quote = useQuery({
    queryKey: ["delivery-quote", deliveryCity],
    enabled: !!deliveryCity,
    queryFn: () => quoteDeliveryFee(deliveryCity),
  });
  const deliveryFee = quote.data?.configured ? quote.data.fee : null;
  const total = Math.max(0, subtotal - discount) + (deliveryFee ?? 0);
  

  const rxRows = prescriptionStatus.data ?? [];
  const rxBlocking = rxRows.filter(
    (row) => row.requires_prescription && row.prescription_status !== "approved",
  );
  const priorityAvailable =
    emergencyFeature.data === true &&
    items.length > 0 &&
    items.every(
      (item) =>
        item.products?.emergency_eligible === true &&
        item.stores?.store_type === "pharmacy" &&
        item.stores?.accepts_emergency_orders === true &&
        item.stores?.is_open === true,
    );
  const usePriority = priority && priorityAvailable;

  const placeOrder = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Log in to place an order");
      if (items.length === 0) throw new Error("Your cart is empty");
      if (!paymentsEnabled) {
        throw new Error(
          "Payments are not available yet — no payment provider is connected, so this order cannot be placed.",
        );
      }

      if (rxBlocking.length > 0) {
        throw new Error("An approved prescription is required before you can check out");
      }
      // authoritative re-check immediately before payment
      await assertPrescriptionsClear();


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

      const placed = await supabase.rpc("place_order", {
        _address_id: addressId,
        _points_to_redeem: redeemed,
        _is_emergency: usePriority,
        ...(note.trim() ? { _customer_note: note.trim() } : {}),
      });
      if (placed.error) throw placed.error;
      const result = (placed.data ?? {}) as { order_id?: string; order_number?: string };
      if (!result.order_id) throw new Error("We could not create your order, please try again");

      const paid = await supabase.rpc("confirm_order_payment", {
        _order_id: result.order_id,
        _provider: "card",
        _reference: `MEDRA-${result.order_number ?? result.order_id}`,
      });
      if (paid.error) throw paid.error;

      return { id: result.order_id, order_number: result.order_number ?? "" };
    },
    onSuccess: (order) => {
      queryClient.clear();
      toast.success(`Order ${order.order_number} placed`);
      void navigate({ to: "/orders/$orderId", params: { orderId: order.id } });
    },
    onError: (e) => toast.error(workflowError(e)),
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
                      <p className="font-semibold">Card payment</p>
                      <p className="text-muted-foreground">
                        Medra collects payment up front and releases seller and rider earnings after
                        delivery is verified. Cash on delivery is not supported.
                      </p>
                    </div>
                    <div className="mt-3 space-y-1.5">
                      <Label htmlFor="order-note" className="text-sm font-semibold">
                        Note for the store or rider (optional)
                      </Label>
                      <Input
                        id="order-note"
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        className="h-11 rounded-xl"
                      />
                    </div>
                  </section>

                  {rxRows.some((row) => row.requires_prescription) && (
                    <section className="surface-card p-4">
                      <h2 className="font-bold">Prescription check</h2>
                      <ul className="mt-3 space-y-2 text-sm">
                        {rxRows
                          .filter((row) => row.requires_prescription)
                          .map((row) => {
                            const chip = statusChip(
                              PRESCRIPTION_STATUS,
                              row.prescription_status ?? "pending_review",
                            );
                            return (
                              <li
                                key={row.store_id}
                                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border p-3"
                              >
                                <span className="font-semibold">{row.store_name}</span>
                                <span
                                  className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${chip.tone}`}
                                >
                                  {row.prescription_status ? chip.label : "Not uploaded"}
                                </span>
                              </li>
                            );
                          })}
                      </ul>
                      {rxBlocking.length > 0 && (
                        <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber/40 bg-amber/10 p-3 text-sm">
                          <AlertTriangle className="mt-0.5 size-4 text-amber" />
                          <div>
                            <p className="font-semibold">Approved prescription needed</p>
                            <p className="text-muted-foreground">
                              Upload a prescription for each pharmacy above — the pharmacist must
                              approve it before this order can be placed.
                            </p>
                            <Button asChild size="sm" className="mt-2 rounded-full font-bold">
                              <Link to="/health/prescriptions">Manage prescriptions</Link>
                            </Button>
                          </div>
                        </div>
                      )}
                    </section>
                  )}

                  {priorityAvailable && (
                    <section className="surface-card p-4">
                      <h2 className="flex items-center gap-2 font-bold">
                        <Siren className="size-4 text-destructive" /> Priority pharmacy delivery
                      </h2>
                      <label className="mt-3 flex items-start gap-3 text-sm">
                        <input
                          type="checkbox"
                          checked={priority}
                          onChange={(e) => setPriority(e.target.checked)}
                          className="mt-1 size-4"
                        />
                        <span className="text-muted-foreground">
                          Dispatch this order ahead of standard deliveries. A priority surcharge set
                          by Medra is added to your delivery fee.
                        </span>
                      </label>
                    </section>
                  )}
                </div>

                <aside className="surface-card h-fit p-4">
                  <h2 className="font-bold">Order summary</h2>
                  <dl className="mt-3 space-y-2 text-sm">
                    <SumRow label={`Items (${items.length})`} value={formatNaira(subtotal)} />
                    <SumRow
                      label="Delivery"
                      value={
                        deliveryCity
                          ? quote.isLoading
                            ? "Calculating…"
                            : deliveryFee !== null
                              ? formatNaira(deliveryFee)
                              : "Unavailable"
                          : "Add an address"
                      }
                    />
                    {discount > 0 && (
                      <SumRow label={`Points (${redeemed})`} value={`-${formatNaira(discount)}`} />
                    )}
                    <div className="border-t border-border pt-2">
                      <SumRow
                        label="Total"
                        value={deliveryFee !== null ? formatNaira(total) : "—"}
                        bold
                      />
                    </div>
                  </dl>
                  <p className="mt-3 text-xs text-muted-foreground">
                    Reward points are earned from games, birthdays and rewards in your dashboard — not
                    from purchases. You can still spend points here.
                  </p>
                  {quote.data && !quote.data.configured && (
                    <p className="mt-3 text-xs text-destructive">{quote.data.reason}</p>
                  )}
                  {usePriority && (
                    <p className="mt-3 text-xs font-semibold text-destructive">
                      Priority pharmacy dispatch is on — a surcharge applies.
                    </p>
                  )}
                  {!paymentsEnabled && (
                    <p className="mt-4 rounded-2xl border border-destructive/30 bg-destructive/5 p-3 text-xs font-semibold text-destructive">
                      Card payments are not available yet. No payment provider is connected to this
                      environment, so orders cannot be paid for or placed. Nothing has been charged.
                    </p>
                  )}
                  <Button
                    disabled={placeOrder.isPending || rxBlocking.length > 0 || !paymentsEnabled}
                    onClick={() => placeOrder.mutate()}
                    className="mt-4 w-full rounded-full py-6 font-bold"
                  >
                    {placeOrder.isPending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : paymentsEnabled ? (
                      "Pay & place order"
                    ) : (
                      "Payments unavailable"
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
