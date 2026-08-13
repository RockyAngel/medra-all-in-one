import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Gift, Sparkles } from "lucide-react";
import { CustomerFooter, CustomerHeader } from "@/components/medra/CustomerChrome";
import { EmptyState, QueryBoundary } from "@/components/medra/States";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useWallet } from "@/lib/hooks";
import { POINT_VALUE_NAIRA, formatDate, formatNaira } from "@/lib/medra";

export const Route = createFileRoute("/wallet")({
  head: () => ({
    meta: [
      { title: "Rewards wallet — Medra" },
      { name: "description", content: "Track the reward points you earn on Medra orders and redeem them at checkout." },
      { property: "og:title", content: "Rewards wallet — Medra" },
      { property: "og:description", content: "Earn points on every Medra order and redeem them for real discounts." },
    ],
  }),
  component: WalletPage,
});

function WalletPage() {
  const { user, session } = useAuth();
  const wallet = useWallet();

  const transactions = useQuery({
    queryKey: ["wallet-transactions", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wallet_transactions")
        .select("id, kind, points, description, created_at")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  const points = wallet.data?.points_balance ?? 0;

  return (
    <div className="min-h-screen bg-background">
      <CustomerHeader />
      <div className="mx-auto max-w-3xl px-5 py-8">
        <h1 className="text-2xl font-extrabold">Rewards wallet</h1>

        {!session ? (
          <div className="mt-6">
            <EmptyState
              title="Log in to see your rewards"
              body="Points are tied to your Medra account and can be redeemed at checkout."
              action={
                <Button asChild className="rounded-full px-6 font-bold">
                  <Link to="/login">Log in</Link>
                </Button>
              }
            />
          </div>
        ) : (
          <>
            <div className="hero-surface mt-6 rounded-2xl p-6 text-white">
              <p className="flex items-center gap-2 text-sm font-semibold opacity-90">
                <Sparkles className="size-4" /> Points balance
              </p>
              {wallet.isLoading ? (
                <p className="mt-2 text-3xl font-extrabold opacity-60">—</p>
              ) : (
                <p className="mt-2 text-4xl font-extrabold">{points.toLocaleString()}</p>
              )}
              <p className="mt-1 text-sm opacity-90">
                Worth {formatNaira(points * POINT_VALUE_NAIRA)} off your next order.
              </p>
              <Button asChild className="mt-4 rounded-full bg-white px-6 font-bold text-ink hover:bg-white/90">
                <Link to="/catalog">Shop and earn</Link>
              </Button>
            </div>

            <section className="mt-8">
              <h2 className="font-bold">Points activity</h2>
              <div className="mt-3">
                <QueryBoundary
                  isLoading={transactions.isLoading}
                  error={transactions.error}
                  isEmpty={(transactions.data ?? []).length === 0}
                  onRetry={() => void transactions.refetch()}
                  empty={
                    <EmptyState
                      icon={<Gift className="size-5" />}
                      title="No points activity yet"
                      body="You earn points automatically on every completed Medra order."
                    />
                  }
                >
                  <ul className="space-y-2">
                    {transactions.data?.map((t) => (
                      <li
                        key={t.id}
                        className="surface-card flex items-center justify-between gap-3 p-4"
                      >
                        <div>
                          <p className="text-sm font-bold capitalize">{t.kind}</p>
                          <p className="text-xs text-muted-foreground">
                            {t.description ?? "—"} · {formatDate(t.created_at)}
                          </p>
                        </div>
                        <p
                          className={`font-extrabold ${t.points >= 0 ? "text-leaf" : "text-destructive"}`}
                        >
                          {t.points >= 0 ? "+" : ""}
                          {t.points.toLocaleString()}
                        </p>
                      </li>
                    ))}
                  </ul>
                </QueryBoundary>
              </div>
            </section>
          </>
        )}
      </div>
      <CustomerFooter />
    </div>
  );
}
