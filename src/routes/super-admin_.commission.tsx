import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Percent } from "lucide-react";
import { toast } from "sonner";
import { Panel } from "@/components/medra/DashboardShell";
import { DataTable, Pill, SuperAdminPage } from "@/components/medra/RoleDashboard";
import { EmptyState, QueryBoundary } from "@/components/medra/States";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { formatDate } from "@/lib/medra";
import { useAllCategories, useCommissionRules } from "@/lib/ops";

export const Route = createFileRoute("/super-admin_/commission")({
  head: () => ({
    meta: [
      { title: "Commission engine — Medra super admin" },
      {
        name: "description",
        content:
          "Set the platform commission Medra earns globally, per category or per vendor, with a versioned rule history.",
      },
      { property: "og:title", content: "Commission engine — Medra super admin" },
      { property: "og:description", content: "Platform commission configuration on Medra." },
    ],
  }),
  component: SuperAdminCommissionPage,
});

function SuperAdminCommissionPage() {
  const rules = useCommissionRules();
  const categories = useAllCategories();
  const queryClient = useQueryClient();
  const [scope, setScope] = useState("global");
  const [percent, setPercent] = useState("10");
  const [categoryId, setCategoryId] = useState("");

  const save = useMutation({
    mutationFn: async () => {
      const value = Number(percent);
      if (!Number.isFinite(value) || value < 0 || value > 100) {
        throw new Error("Enter a commission between 0 and 100 percent.");
      }
      if (scope === "category" && !categoryId) throw new Error("Pick a category for this rule.");
      const { error } = await supabase.rpc("set_commission_rule", {
        _scope: scope,
        _percent: value,
        ...(scope === "category" ? { _category_id: categoryId } : {}),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Commission rule saved");
      void queryClient.invalidateQueries({ queryKey: ["commission-rules"] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Could not save the rule"),
  });

  return (
    <SuperAdminPage title="Commission engine" subtitle="What Medra earns on every sale">
      <Panel title="Add or update a rule" className="mb-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="text-xs font-bold uppercase text-muted-foreground">Scope</label>
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value)}
              className="mt-1 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"
            >
              <option value="global">Platform wide</option>
              <option value="category">Category</option>
            </select>
          </div>
          {scope === "category" && (
            <div>
              <label className="text-xs font-bold uppercase text-muted-foreground">Category</label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="mt-1 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"
              >
                <option value="">Select…</option>
                {(categories.data ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="text-xs font-bold uppercase text-muted-foreground">Commission %</label>
            <Input
              type="number"
              min="0"
              max="100"
              step="0.5"
              value={percent}
              onChange={(e) => setPercent(e.target.value)}
              className="mt-1 h-11 rounded-xl"
            />
          </div>
        </div>
        <Button
          className="mt-3 rounded-xl font-bold"
          disabled={save.isPending}
          onClick={() => save.mutate()}
        >
          Save rule
        </Button>
      </Panel>

      <Panel title="Rule history">
        <QueryBoundary
          isLoading={rules.isLoading}
          error={rules.error}
          isEmpty={(rules.data ?? []).length === 0}
          onRetry={() => void rules.refetch()}
          empty={
            <EmptyState
              icon={<Percent className="size-5" />}
              title="No commission rules yet"
              body="Add a platform-wide rule to start earning commission on sales."
            />
          }
        >
          <DataTable columns={["Scope", "Target", "Percent", "Active", "Effective from"]}>
            {(rules.data ?? []).map((r) => (
              <tr key={r.id}>
                <td className="py-3 pr-4 font-semibold capitalize">{r.scope}</td>
                <td className="py-3 pr-4 text-muted-foreground">{r.categories?.name ?? "All"}</td>
                <td className="py-3 pr-4">{Number(r.percent)}%</td>
                <td className="py-3 pr-4">
                  <Pill tone={r.is_active ? "bg-leaf/15 text-leaf" : "bg-muted text-muted-foreground"}>
                    {r.is_active ? "Active" : "Superseded"}
                  </Pill>
                </td>
                <td className="py-3 pr-4 text-muted-foreground">{formatDate(r.effective_from)}</td>
              </tr>
            ))}
          </DataTable>
        </QueryBoundary>
      </Panel>
    </SuperAdminPage>
  );
}
