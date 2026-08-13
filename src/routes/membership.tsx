import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, Crown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { CustomerFooter, CustomerHeader } from "@/components/medra/CustomerChrome";
import { EmptyState, QueryBoundary } from "@/components/medra/States";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { formatNaira } from "@/lib/medra";
import {
  SUBSCRIPTION_STATUS_TONE,
  labelFor,
  useCancelMembership,
  useMembershipPlans,
  useMyMembershipInvoices,
  useMySubscriptions,
  useStartMembership,
} from "@/lib/growth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/membership")({
  head: () => ({
    meta: [
      { title: "Medra membership — plans, benefits and trials" },
      {
        name: "description",
        content:
          "Compare Medra membership plans, start an eligible free trial and manage your subscription, billing history and benefits.",
      },
      { property: "og:title", content: "Medra membership — plans, benefits and trials" },
      { property: "og:description", content: "Real membership plans with configurable benefits, trials and verified billing." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MembershipPage,
});

function MembershipPage() {
  const { session } = useAuth();
  const plans = useMembershipPlans();
  const subscriptions = useMySubscriptions();
  const invoices = useMyMembershipInvoices();
  const start = useStartMembership();
  const cancel = useCancelMembership();

  const live = (subscriptions.data ?? []).filter((s) =>
    ["trialing", "active", "past_due", "grace_period", "paused"].includes(s.status),
  );

  return (
    <div className="min-h-screen bg-background">
      <CustomerHeader />
      <div className="mx-auto max-w-5xl px-5 py-8">
        <h1 className="text-2xl font-extrabold">Membership</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every benefit below is a real entitlement checked by our backend. Paid plans only activate after your payment is
          verified by the payment provider.
        </p>

        {session && live.length > 0 && (
          <section className="mt-6 space-y-3">
            {live.map((sub) => (
              <div key={sub.id} className="rounded-2xl border border-border bg-card p-5">
                <div className="flex flex-wrap items-center gap-3">
                  <Crown className="size-5 text-amber" />
                  <p className="font-bold">{sub.membership_plans?.name ?? "Membership"}</p>
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-1 text-xs font-bold",
                      SUBSCRIPTION_STATUS_TONE[sub.status] ?? "bg-muted text-muted-foreground",
                    )}
                  >
                    {labelFor(sub.status)}
                  </span>
                  <span className="text-xs text-muted-foreground">Ref {sub.reference}</span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {sub.status === "trialing" && sub.trial_end
                    ? `Trial ends ${new Date(sub.trial_end).toLocaleDateString()}`
                    : sub.current_period_end
                      ? `${sub.cancel_at_period_end ? "Access ends" : "Renews"} ${new Date(sub.current_period_end).toLocaleDateString()}`
                      : "Awaiting payment verification"}
                  {" · "}
                  {formatNaira(Number(sub.price_paid))} {labelFor(sub.billing_period)}
                </p>
                {(sub.benefits_snapshot ?? []).length > 0 && (
                  <ul className="mt-3 grid gap-1.5 text-sm sm:grid-cols-2">
                    {(sub.benefits_snapshot ?? []).map((benefit) => (
                      <li key={benefit} className="flex items-start gap-2">
                        <Check className="mt-0.5 size-4 text-leaf" /> {benefit}
                      </li>
                    ))}
                  </ul>
                )}
                {!sub.cancel_at_period_end && (
                  <Button
                    variant="outline"
                    className="mt-4 rounded-full font-bold"
                    disabled={cancel.isPending}
                    onClick={() =>
                      cancel.mutate(
                        { id: sub.id },
                        {
                          onSuccess: (res) =>
                            toast.success(
                              res.cancel_at_period_end
                                ? "Cancelled — access continues until the end of your billing period."
                                : "Membership cancelled.",
                            ),
                          onError: (e: Error) => toast.error(e.message),
                        },
                      )
                    }
                  >
                    Cancel membership
                  </Button>
                )}
              </div>
            ))}
          </section>
        )}

        <section className="mt-8">
          <h2 className="font-bold">Plans</h2>
          <div className="mt-3">
            <QueryBoundary
              isLoading={plans.isLoading}
              error={plans.error}
              isEmpty={(plans.data ?? []).length === 0}
              onRetry={() => void plans.refetch()}
              empty={
                <EmptyState
                  title="No membership plans yet"
                  body="Plans appear here as soon as they are published by the Medra team."
                />
              }
            >
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {(plans.data ?? []).map((plan) => {
                  const mine = live.find((s) => s.plan_id === plan.id);
                  return (
                    <div key={plan.id} className="flex flex-col rounded-2xl border border-border bg-card p-5">
                      <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                        {labelFor(plan.audience)}
                      </p>
                      <p className="mt-1 text-lg font-extrabold">{plan.name}</p>
                      <p className="mt-1 text-2xl font-extrabold">
                        {formatNaira(Number(plan.price))}
                        <span className="text-sm font-semibold text-muted-foreground">
                          {" "}
                          / {labelFor(plan.billing_period).toLowerCase()}
                        </span>
                      </p>
                      {plan.trial_days > 0 && (
                        <p className="mt-1 text-xs font-bold text-leaf">{plan.trial_days}-day free trial</p>
                      )}
                      {plan.description && <p className="mt-2 text-sm text-muted-foreground">{plan.description}</p>}
                      <ul className="mt-3 flex-1 space-y-1.5 text-sm">
                        {(plan.benefits ?? []).map((benefit) => (
                          <li key={benefit} className="flex items-start gap-2">
                            <Check className="mt-0.5 size-4 text-leaf" /> {benefit}
                          </li>
                        ))}
                      </ul>
                      {!session ? (
                        <Button asChild className="mt-4 rounded-full font-bold">
                          <Link to="/login">Log in to join</Link>
                        </Button>
                      ) : mine ? (
                        <Button disabled className="mt-4 rounded-full font-bold">
                          Current plan
                        </Button>
                      ) : (
                        <Button
                          className="mt-4 rounded-full font-bold"
                          disabled={start.isPending}
                          onClick={() =>
                            start.mutate(plan.id, {
                              onSuccess: (res) =>
                                res.payment_required
                                  ? toast.success(
                                      `Invoice ${res.invoice_reference} created. Your membership activates once payment is verified.`,
                                    )
                                  : toast.success("Trial started — your benefits are active now."),
                              onError: (e: Error) => toast.error(e.message),
                            })
                          }
                        >
                          {start.isPending ? <Loader2 className="size-4 animate-spin" /> : "Choose plan"}
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </QueryBoundary>
          </div>
        </section>

        {session && (
          <section className="mt-10">
            <h2 className="font-bold">Membership billing</h2>
            <div className="mt-3">
              <QueryBoundary
                isLoading={invoices.isLoading}
                error={invoices.error}
                isEmpty={(invoices.data ?? []).length === 0}
                onRetry={() => void invoices.refetch()}
                empty={<EmptyState title="No membership charges yet" body="Verified membership payments appear here." />}
              >
                <div className="divide-y divide-border rounded-2xl border border-border bg-card">
                  {(invoices.data ?? []).map((inv) => (
                    <div key={inv.id} className="flex flex-wrap items-center justify-between gap-2 p-4 text-sm">
                      <span className="font-semibold">{inv.reference}</span>
                      <span>{formatNaira(Number(inv.amount))}</span>
                      <span className="text-muted-foreground">{labelFor(inv.status)}</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(inv.requested_at).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                </div>
              </QueryBoundary>
            </div>
          </section>
        )}
      </div>
      <CustomerFooter />
    </div>
  );
}
