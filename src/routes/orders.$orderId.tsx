import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, MapPin, Truck } from "lucide-react";
import { CustomerFooter, CustomerHeader } from "@/components/medra/CustomerChrome";
import { EmptyState, QueryBoundary } from "@/components/medra/States";
import { TrackingMap } from "@/components/medra/TrackingMap";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { ORDER_STATUS_LABEL, formatDate, formatNaira } from "@/lib/medra";

export const Route = createFileRoute("/orders/$orderId")({
  head: () => ({
    meta: [
      { title: "Order tracking — Medra" },
      { name: "description", content: "Follow your Medra order live: preparation, pickup, rider location and delivery." },
      { property: "og:title", content: "Order tracking — Medra" },
      { property: "og:description", content: "Live delivery tracking for your Medra order." },
    ],
  }),
  component: OrderDetailPage,
});

const TRACK_STEPS = ["preparing", "ready_for_pickup", "in_transit", "delivered"] as const;

function OrderDetailPage() {
  const { orderId } = Route.useParams();

  const order = useQuery({
    queryKey: ["order", orderId],
    refetchInterval: 20000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select(
          "id, order_number, status, is_emergency, subtotal, delivery_fee, points_discount, points_redeemed, total, created_at, order_items(id, product_name, quantity, unit_price), deliveries(status, rider_latitude, rider_longitude, picked_up_at, delivered_at), addresses(line1, city, state, recipient_name, latitude, longitude)",
        )
        .eq("id", orderId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const data = order.data;
  const delivery = Array.isArray(data?.deliveries) ? data?.deliveries[0] : data?.deliveries;
  const address = Array.isArray(data?.addresses) ? data?.addresses[0] : data?.addresses;
  const currentStep = data ? TRACK_STEPS.indexOf(data.status as (typeof TRACK_STEPS)[number]) : -1;

  return (
    <div className="min-h-screen bg-background">
      <CustomerHeader />
      <div className="mx-auto max-w-4xl px-5 py-8">
        <QueryBoundary
          isLoading={order.isLoading}
          error={order.error}
          isEmpty={!data}
          onRetry={() => void order.refetch()}
          empty={
            <EmptyState
              title="Order not found"
              body="This order either doesn't exist or belongs to another account."
              action={
                <Button asChild className="rounded-full px-6 font-bold">
                  <Link to="/orders">Back to orders</Link>
                </Button>
              }
            />
          }
        >
          {data && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h1 className="text-2xl font-extrabold">{data.order_number}</h1>
                  <p className="text-sm text-muted-foreground">Placed {formatDate(data.created_at)}</p>
                  {data.is_emergency && (
                    <span className="mt-2 inline-block rounded-full bg-destructive/15 px-3 py-1 text-xs font-bold text-destructive">
                      Priority pharmacy dispatch
                    </span>
                  )}
                </div>
                <span className="rounded-full bg-leaf/15 px-4 py-1.5 text-sm font-bold text-leaf">
                  {ORDER_STATUS_LABEL[data.status] ?? data.status}
                </span>
              </div>

              <section className="surface-card mt-6 p-5">
                <h2 className="flex items-center gap-2 font-bold">
                  <Truck className="size-4 text-sky" /> Delivery progress
                </h2>
                <ol className="mt-4 space-y-3">
                  {TRACK_STEPS.map((step, index) => {
                    const done = currentStep >= index;
                    return (
                      <li key={step} className="flex items-center gap-3">
                        <span
                          className={`grid size-7 place-items-center rounded-full text-xs font-bold ${
                            done ? "bg-leaf text-white" : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {done ? <CheckCircle2 className="size-4" /> : index + 1}
                        </span>
                        <span className={done ? "text-sm font-semibold" : "text-sm text-muted-foreground"}>
                          {ORDER_STATUS_LABEL[step]}
                        </span>
                      </li>
                    );
                  })}
                </ol>

                <div className="mt-4 rounded-xl border border-border p-4 text-sm">
                  <p className="flex items-center gap-2 font-semibold">
                    <MapPin className="size-4 text-amberish" /> Rider location
                  </p>
                  <div className="mt-3">
                    <TrackingMap
                      destination={{ lat: address?.latitude, lng: address?.longitude }}
                      rider={{ lat: delivery?.rider_latitude, lng: delivery?.rider_longitude }}
                      caption={
                        delivery?.rider_latitude && delivery?.rider_longitude
                          ? "Rider marker updates as new location pings arrive."
                          : "Your delivery address is shown. The rider marker appears once they start the trip."
                      }
                    />
                  </div>
                  {delivery?.rider_latitude && delivery?.rider_longitude ? (
                    <p className="mt-2 text-muted-foreground">
                      Last ping: {Number(delivery.rider_latitude).toFixed(4)},{" "}
                      {Number(delivery.rider_longitude).toFixed(4)} — updates automatically.
                    </p>
                  ) : (
                    <p className="mt-2 text-muted-foreground">
                      Live location appears here once a rider accepts and starts this delivery.
                    </p>
                  )}
                </div>

              </section>

              <div className="mt-6 grid gap-5 md:grid-cols-2">
                <section className="surface-card p-5">
                  <h2 className="font-bold">Items</h2>
                  <ul className="mt-3 space-y-2 text-sm">
                    {data.order_items?.map((item) => (
                      <li key={item.id} className="flex items-center justify-between gap-3">
                        <span>
                          {item.product_name} × {item.quantity}
                        </span>
                        <span className="font-semibold">
                          {formatNaira(Number(item.unit_price) * item.quantity)}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <dl className="mt-4 space-y-1.5 border-t border-border pt-3 text-sm">
                    <Row label="Subtotal" value={formatNaira(data.subtotal)} />
                    <Row label="Delivery" value={formatNaira(data.delivery_fee)} />
                    {Number(data.points_discount) > 0 && (
                      <Row
                        label={`Points (${data.points_redeemed})`}
                        value={`-${formatNaira(data.points_discount)}`}
                      />
                    )}
                    <Row label="Total" value={formatNaira(data.total)} bold />
                  </dl>
                </section>

                <section className="surface-card p-5">
                  <h2 className="font-bold">Delivery address</h2>
                  {address ? (
                    <p className="mt-2 text-sm text-muted-foreground">
                      <span className="block font-semibold text-foreground">
                        {address.recipient_name ?? "You"}
                      </span>
                      {[address.line1, address.city, address.state].filter(Boolean).join(", ")}
                    </p>
                  ) : (
                    <p className="mt-2 text-sm text-muted-foreground">No address on this order.</p>
                  )}
                </section>
              </div>
            </>
          )}
        </QueryBoundary>
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
