import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Package } from "lucide-react";
import { CustomerFooter, CustomerHeader } from "@/components/medra/CustomerChrome";
import { EmptyState, QueryBoundary } from "@/components/medra/States";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { ORDER_STATUS_LABEL, formatDate, formatNaira } from "@/lib/medra";

export const Route = createFileRoute("/orders")({
  head: () => ({
    meta: [
      { title: "My orders — Medra" },
      { name: "description", content: "Track every Medra order, from preparation to doorstep delivery." },
      { property: "og:title", content: "My orders — Medra" },
      { property: "og:description", content: "See order history and live delivery progress on Medra." },
    ],
  }),
  component: OrdersPage,
});

function OrdersPage() {
  const { user, session } = useAuth();

  const orders = useQuery({
    queryKey: ["orders", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, order_number, status, total, created_at")
        .eq("customer_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <CustomerHeader />
      <div className="mx-auto max-w-4xl px-5 py-8">
        <h1 className="text-2xl font-extrabold">My orders</h1>

        {!session ? (
          <div className="mt-6">
            <EmptyState
              title="Log in to see your orders"
              body="Your order history and live tracking live inside your Medra account."
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
              isLoading={orders.isLoading}
              error={orders.error}
              isEmpty={(orders.data ?? []).length === 0}
              onRetry={() => void orders.refetch()}
              empty={
                <EmptyState
                  icon={<Package className="size-5" />}
                  title="No orders yet"
                  body="Once you place your first Medra order it will appear here with live tracking."
                  action={
                    <Button asChild className="rounded-full px-6 font-bold">
                      <Link to="/catalog">Start shopping</Link>
                    </Button>
                  }
                />
              }
            >
              <ul className="space-y-3">
                {orders.data?.map((o) => (
                  <li key={o.id}>
                    <Link
                      to="/orders/$orderId"
                      params={{ orderId: o.id }}
                      className="lift-hover surface-card flex flex-wrap items-center justify-between gap-3 p-4"
                    >
                      <div>
                        <p className="font-bold">{o.order_number}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(o.created_at)}</p>
                      </div>
                      <span className="rounded-full bg-muted px-3 py-1 text-xs font-bold">
                        {ORDER_STATUS_LABEL[o.status] ?? o.status}
                      </span>
                      <p className="font-extrabold text-grape">{formatNaira(o.total)}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            </QueryBoundary>
          </div>
        )}
      </div>
      <CustomerFooter />
    </div>
  );
}
