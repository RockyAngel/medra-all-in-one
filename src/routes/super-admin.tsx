import { createFileRoute, Link } from "@tanstack/react-router";
import { Banknote, ScrollText, ShieldCheck, ShoppingBag } from "lucide-react";
import { Panel, StatCard } from "@/components/medra/DashboardShell";
import { DataTable, Pill, SuperAdminPage } from "@/components/medra/RoleDashboard";
import { EmptyState, QueryBoundary } from "@/components/medra/States";
import { Button } from "@/components/ui/button";
import { statusLabel } from "@/lib/dashboard";
import { useAdminOverview, useAdministrators, useAuditLogs, useCommissionRules } from "@/lib/ops";
import { formatDate, formatNaira } from "@/lib/medra";

export const Route = createFileRoute("/super-admin")({
  head: () => ({
    meta: [
      { title: "Super Admin Console — Medra" },
      {
        name: "description",
        content:
          "Medra super admin console: platform governance, administrator roles, commission rules, feature flags and audit trails.",
      },
      { property: "og:title", content: "Super Admin Console — Medra" },
      {
        property: "og:description",
        content: "Govern administrators, permissions, commissions and audit trails on Medra.",
      },
    ],
  }),
  component: SuperAdminDashboard,
});

function SuperAdminDashboard() {
  const overview = useAdminOverview();
  const admins = useAdministrators();
  const audit = useAuditLogs("all");
  const commission = useCommissionRules();
  const stats = overview.data;

  return (
    <SuperAdminPage
      title="Super admin console"
      subtitle="Global platform governance · live data"
      topRight={
        <Button asChild size="sm" className="rounded-full">
          <Link to="/super-admin/admins">Manage administrators</Link>
        </Button>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Gross order value"
          value={formatNaira(stats?.gmv ?? 0)}
          tone="leaf"
          icon={<Banknote className="size-4" />}
        />
        <StatCard
          label="Orders"
          value={String(stats?.orders ?? 0)}
          tone="sky"
          icon={<ShoppingBag className="size-4" />}
        />
        <StatCard
          label="Administrators"
          value={String((admins.data ?? []).length)}
          tone="grape"
          icon={<ShieldCheck className="size-4" />}
        />
        <StatCard
          label="Audit events"
          value={String((audit.data ?? []).length)}
          tone="amber"
          icon={<ScrollText className="size-4" />}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Panel title="Administrators" className="xl:col-span-2">
          <QueryBoundary
            isLoading={admins.isLoading}
            error={admins.error}
            isEmpty={(admins.data ?? []).length === 0}
            onRetry={() => void admins.refetch()}
            empty={
              <EmptyState
                icon={<ShieldCheck className="size-5" />}
                title="No administrators recorded"
                body="Grant admin or super admin roles from the administrators screen."
              />
            }
          >
            <DataTable columns={["Person", "Role", "Granted"]}>
              {(admins.data ?? []).slice(0, 8).map((row) => (
                <tr key={row.id}>
                  <td className="py-3 pr-4 font-semibold">
                    {[row.profile?.first_name, row.profile?.last_name].filter(Boolean).join(" ") ||
                      row.profile?.email ||
                      row.user_id.slice(0, 8)}
                  </td>
                  <td className="py-3 pr-4">
                    <Pill>{statusLabel(row.role)}</Pill>
                  </td>
                  <td className="py-3 pr-4 text-muted-foreground">{formatDate(row.created_at)}</td>
                </tr>
              ))}
            </DataTable>
          </QueryBoundary>
        </Panel>

        <Panel title="Commission rules">
          <QueryBoundary
            isLoading={commission.isLoading}
            error={commission.error}
            isEmpty={(commission.data ?? []).length === 0}
            onRetry={() => void commission.refetch()}
            empty={
              <EmptyState
                title="No commission rules yet"
                body="Set the platform default and category overrides in the commission engine."
                action={
                  <Button asChild size="sm" className="rounded-full">
                    <Link to="/super-admin/commission">Open commission engine</Link>
                  </Button>
                }
              />
            }
          >
            <ul className="space-y-2 text-sm">
              {(commission.data ?? []).slice(0, 6).map((rule) => (
                <li key={rule.id} className="flex items-center justify-between gap-3 border-b border-border pb-2 last:border-0">
                  <span className="font-semibold">
                    {statusLabel(rule.scope)}
                    {rule.categories?.name ? ` · ${rule.categories.name}` : ""}
                  </span>
                  <Pill tone={rule.is_active ? "bg-leaf/15 text-leaf" : undefined}>{rule.percent}%</Pill>
                </li>
              ))}
            </ul>
          </QueryBoundary>
        </Panel>
      </div>

      <Panel title="Recent audit trail">
        <QueryBoundary
          isLoading={audit.isLoading}
          error={audit.error}
          isEmpty={(audit.data ?? []).length === 0}
          onRetry={() => void audit.refetch()}
          empty={
            <EmptyState
              icon={<ScrollText className="size-5" />}
              title="No audit events yet"
              body="Privileged actions such as approvals, payouts and role changes are recorded here."
            />
          }
        >
          <DataTable columns={["Action", "Entity", "Actor role", "Reason", "When"]}>
            {(audit.data ?? []).slice(0, 10).map((row) => (
              <tr key={row.id}>
                <td className="py-3 pr-4 font-semibold">{statusLabel(row.action)}</td>
                <td className="py-3 pr-4 text-muted-foreground">{row.entity}</td>
                <td className="py-3 pr-4">{row.actor_role ? statusLabel(row.actor_role) : "—"}</td>
                <td className="py-3 pr-4 text-muted-foreground">{row.reason ?? "—"}</td>
                <td className="py-3 pr-4 text-muted-foreground">{formatDate(row.created_at)}</td>
              </tr>
            ))}
          </DataTable>
          <div className="mt-4">
            <Button asChild size="sm" variant="outline" className="rounded-full">
              <Link to="/super-admin/audit">Open full audit trail</Link>
            </Button>
          </div>
        </QueryBoundary>
      </Panel>
    </SuperAdminPage>
  );
}
