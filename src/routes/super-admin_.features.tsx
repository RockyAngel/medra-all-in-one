import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ToggleLeft } from "lucide-react";
import { toast } from "sonner";
import { Panel } from "@/components/medra/DashboardShell";
import { FilterTabs, Pill, SuperAdminPage } from "@/components/medra/RoleDashboard";
import { EmptyState, QueryBoundary } from "@/components/medra/States";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/medra";
import { useFeatureMarketplace, useSetFeatureState } from "@/lib/platform";

export const Route = createFileRoute("/super-admin_/features")({
  head: () => ({
    meta: [
      { title: "Feature marketplace — Medra super admin" },
      {
        name: "description",
        content:
          "Turn any part of Medra on, off or into beta — marketplace, healthcare, logistics, money, support and community.",
      },
      { property: "og:title", content: "Feature marketplace — Medra super admin" },
      { property: "og:description", content: "Enable, beta-test or disable any Medra capability." },
    ],
  }),
  component: SuperAdminFeaturesPage,
});

const STATES = [
  { key: "enabled", label: "Enabled", tone: "bg-leaf/15 text-leaf" },
  { key: "beta", label: "Beta", tone: "bg-amber/20 text-amber" },
  { key: "disabled", label: "Disabled", tone: "bg-destructive/15 text-destructive" },
];

function SuperAdminFeaturesPage() {
  const features = useFeatureMarketplace();
  const setState = useSetFeatureState();
  const [category, setCategory] = useState("all");

  const categories = [...new Set((features.data ?? []).map((f) => f.category ?? "platform"))].sort();
  const filters = [{ key: "all", label: "All" }].concat(
    categories.map((c) => ({ key: c, label: c.replace(/^./, (x) => x.toUpperCase()) })),
  );
  const rows = (features.data ?? []).filter(
    (f) => category === "all" || (f.category ?? "platform") === category,
  );

  function change(key: string, next: string) {
    setState.mutate(
      { key, state: next },
      {
        onSuccess: () => toast.success(`${key} → ${next}`),
        onError: (e: unknown) =>
          toast.error(e instanceof Error ? e.message : "Could not change this feature"),
      },
    );
  }

  return (
    <SuperAdminPage
      title="Feature marketplace"
      subtitle="Every capability built on Medra, switchable without a release"
    >
      <FilterTabs options={filters} value={category} onChange={setCategory} />
      <Panel title={`Features (${rows.length})`}>
        <QueryBoundary
          isLoading={features.isLoading}
          error={features.error}
          isEmpty={rows.length === 0}
          onRetry={() => void features.refetch()}
          empty={
            <EmptyState
              icon={<ToggleLeft className="size-5" />}
              title="No features in this group"
              body="Features are registered as capabilities ship."
            />
          }
        >
          <div className="space-y-3">
            {rows.map((f) => {
              const current = f.state ?? (f.enabled ? "enabled" : "disabled");
              const tone = STATES.find((s) => s.key === current)?.tone;
              return (
                <div key={f.key} className="rounded-xl border border-border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-bold">{f.label}</p>
                        <Pill tone={tone}>{current}</Pill>
                        <Pill>{f.category ?? "platform"}</Pill>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{f.description ?? f.key}</p>
                      <p className="mt-1 font-mono text-xs text-muted-foreground">
                        {f.key}
                        {f.updated_at ? ` · updated ${formatDate(f.updated_at)}` : ""}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {STATES.map((s) => (
                        <Button
                          key={s.key}
                          size="sm"
                          variant={current === s.key ? "default" : "outline"}
                          className="rounded-lg font-bold"
                          disabled={setState.isPending || current === s.key}
                          onClick={() => change(f.key, s.key)}
                        >
                          {s.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </QueryBoundary>
      </Panel>
    </SuperAdminPage>
  );
}
