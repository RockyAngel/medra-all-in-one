import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Crown } from "lucide-react";
import { toast } from "sonner";
import { Panel } from "@/components/medra/DashboardShell";
import { DataTable, Pill, SuperAdminPage } from "@/components/medra/RoleDashboard";
import { EmptyState, QueryBoundary } from "@/components/medra/States";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { formatNaira } from "@/lib/medra";

export const Route = createFileRoute("/super-admin_/memberships")({
  head: () => ({
    meta: [
      { title: "Membership plans — Medra super admin" },
      {
        name: "description",
        content:
          "Create and retire Medra membership tiers for customers, vendors and riders, with pricing, trials and benefits.",
      },
      { property: "og:title", content: "Membership plans — Medra super admin" },
      { property: "og:description", content: "Membership tier configuration on Medra." },
    ],
  }),
  component: SuperAdminMembershipsPage,
});

const AUDIENCES = ["customer", "seller", "rider"] as const;

function usePlans() {
  return useQuery({
    queryKey: ["admin-membership-plans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("membership_plans")
        .select("*")
        .order("audience")
        .order("display_order");
      if (error) throw error;
      return data;
    },
  });
}

function SuperAdminMembershipsPage() {
  const plans = usePlans();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    name: "",
    audience: "customer" as (typeof AUDIENCES)[number],
    price: "5000",
    period: "monthly",
    trialDays: "2",
    description: "",
    benefits: "",
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin-membership-plans"] });
    void queryClient.invalidateQueries({ queryKey: ["membership-plans"] });
  };

  const create = useMutation({
    mutationFn: async () => {
      const name = form.name.trim();
      if (name.length < 2) throw new Error("Give the plan a name.");
      const price = Number(form.price);
      if (!Number.isFinite(price) || price < 0) throw new Error("Enter a valid price.");
      const benefits = form.benefits
        .split("\n")
        .map((b) => b.trim())
        .filter(Boolean);
      const { error } = await supabase.from("membership_plans").insert({
        name,
        audience: form.audience,
        price,
        billing_period: form.period,
        trial_days: Number(form.trialDays) || 0,
        description: form.description.trim() || null,
        benefits,
        display_order: (plans.data ?? []).filter((p) => p.audience === form.audience).length + 1,
        is_active: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Plan published");
      setForm({ ...form, name: "", description: "", benefits: "" });
      invalidate();
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Could not publish the plan"),
  });

  const archive = useMutation({
    mutationFn: async (input: { id: string; active: boolean }) => {
      const { error } = await supabase.rpc("archive_membership_plan", {
        _plan_id: input.id,
      });
      if (error) {
        const { error: fallback } = await supabase
          .from("membership_plans")
          .update({ is_active: input.active })
          .eq("id", input.id);
        if (fallback) throw fallback;
      }
    },
    onSuccess: () => {
      toast.success("Plan updated");
      invalidate();
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Could not update the plan"),
  });

  return (
    <SuperAdminPage title="Membership plans" subtitle="Tiers customers, vendors and riders can subscribe to">
      <Panel title="Publish a plan" className="mb-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label className="text-xs font-bold uppercase text-muted-foreground">Plan name</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Medra Plus"
              className="h-11 rounded-xl"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-bold uppercase text-muted-foreground">Audience</Label>
            <select
              value={form.audience}
              onChange={(e) => setForm({ ...form, audience: e.target.value as (typeof AUDIENCES)[number] })}
              className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"
            >
              {AUDIENCES.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-bold uppercase text-muted-foreground">Price (₦)</Label>
            <Input
              type="number"
              min="0"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
              className="h-11 rounded-xl"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-bold uppercase text-muted-foreground">Billing period</Label>
            <select
              value={form.period}
              onChange={(e) => setForm({ ...form, period: e.target.value })}
              className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"
            >
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="yearly">Yearly</option>
            </select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-bold uppercase text-muted-foreground">Free trial (days)</Label>
            <Input
              type="number"
              min="0"
              value={form.trialDays}
              onChange={(e) => setForm({ ...form, trialDays: e.target.value })}
              className="h-11 rounded-xl"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-bold uppercase text-muted-foreground">Description</Label>
            <Input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Free delivery on every order"
              className="h-11 rounded-xl"
            />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label className="text-xs font-bold uppercase text-muted-foreground">
              Benefits (one per line)
            </Label>
            <Textarea
              value={form.benefits}
              onChange={(e) => setForm({ ...form, benefits: e.target.value })}
              rows={4}
              className="rounded-xl"
            />
          </div>
        </div>
        <Button className="mt-3 rounded-xl font-bold" disabled={create.isPending} onClick={() => create.mutate()}>
          Publish plan
        </Button>
      </Panel>

      <Panel title="Plans">
        <QueryBoundary
          isLoading={plans.isLoading}
          error={plans.error}
          isEmpty={(plans.data ?? []).length === 0}
          onRetry={() => void plans.refetch()}
          empty={
            <EmptyState
              icon={<Crown className="size-5" />}
              title="No membership plans yet"
              body="Publish at least one plan so the membership page has something to sell."
            />
          }
        >
          <DataTable columns={["Plan", "Audience", "Price", "Period", "Trial", "Status", ""]}>
            {(plans.data ?? []).map((p) => (
              <tr key={p.id}>
                <td className="py-3 pr-4 font-semibold">
                  {p.name}
                  {p.description ? (
                    <span className="block text-xs font-normal text-muted-foreground">{p.description}</span>
                  ) : null}
                </td>
                <td className="py-3 pr-4 capitalize text-muted-foreground">{p.audience}</td>
                <td className="py-3 pr-4">{formatNaira(Number(p.price))}</td>
                <td className="py-3 pr-4 capitalize text-muted-foreground">{p.billing_period}</td>
                <td className="py-3 pr-4 text-muted-foreground">{p.trial_days} days</td>
                <td className="py-3 pr-4">
                  <Pill tone={p.is_active ? "bg-leaf/15 text-leaf" : "bg-muted text-muted-foreground"}>
                    {p.is_active ? "Live" : "Archived"}
                  </Pill>
                </td>
                <td className="py-3 pr-4">
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-lg font-bold"
                    disabled={archive.isPending}
                    onClick={() => archive.mutate({ id: p.id, active: !p.is_active })}
                  >
                    {p.is_active ? "Archive" : "Restore"}
                  </Button>
                </td>
              </tr>
            ))}
          </DataTable>
        </QueryBoundary>
      </Panel>
    </SuperAdminPage>
  );
}
