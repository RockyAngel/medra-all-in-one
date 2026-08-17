import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ScrollText } from "lucide-react";
import { Panel } from "@/components/medra/DashboardShell";
import { DataTable, FilterTabs, Pill, SuperAdminPage } from "@/components/medra/RoleDashboard";
import { EmptyState, QueryBoundary } from "@/components/medra/States";
import { formatDate } from "@/lib/medra";
import { useAuditLogs } from "@/lib/ops";

export const Route = createFileRoute("/super-admin_/audit")({
  head: () => ({
    meta: [
      { title: "Audit logs — Medra super admin" },
      {
        name: "description",
        content:
          "Immutable record of every privileged action on Medra: approvals, money movement, roles and platform settings.",
      },
      { property: "og:title", content: "Audit logs — Medra super admin" },
      { property: "og:description", content: "Platform audit trail for Medra governance." },
    ],
  }),
  component: SuperAdminAuditPage,
});

const FILTERS = [
  { key: "all", label: "All" },
  { key: "payout_requests", label: "Payouts" },
  { key: "refund_requests", label: "Refunds" },
  { key: "seller_applications", label: "Vendor applications" },
  { key: "rider_applications", label: "Rider applications" },
  { key: "prescriptions", label: "Prescriptions" },
  { key: "user_roles", label: "Roles" },
  { key: "feature_flags", label: "Features" },
  { key: "staff_shifts", label: "Shifts" },
];

function SuperAdminAuditPage() {
  const [filter, setFilter] = useState("all");
  const logs = useAuditLogs(filter);

  return (
    <SuperAdminPage title="Audit logs" subtitle="Every privileged action, in order">
      <FilterTabs options={FILTERS} value={filter} onChange={setFilter} />
      <Panel title="Recent activity">
        <QueryBoundary
          isLoading={logs.isLoading}
          error={logs.error}
          isEmpty={(logs.data ?? []).length === 0}
          onRetry={() => void logs.refetch()}
          empty={
            <EmptyState
              icon={<ScrollText className="size-5" />}
              title="No audit records in this view"
              body="Privileged actions are written here automatically and cannot be edited or deleted."
            />
          }
        >
          <DataTable columns={["When", "Action", "Entity", "Actor role", "Reason"]}>
            {(logs.data ?? []).map((l) => (
              <tr key={l.id}>
                <td className="py-3 pr-4 text-muted-foreground">{formatDate(l.created_at)}</td>
                <td className="py-3 pr-4 font-semibold">{l.action}</td>
                <td className="py-3 pr-4 text-muted-foreground">{l.entity ?? "—"}</td>
                <td className="py-3 pr-4">
                  <Pill tone="bg-sky/15 text-sky">{l.actor_role ?? "system"}</Pill>
                </td>
                <td className="py-3 pr-4 text-muted-foreground">{l.reason ?? "—"}</td>
              </tr>
            ))}
          </DataTable>
        </QueryBoundary>
      </Panel>
    </SuperAdminPage>
  );
}
