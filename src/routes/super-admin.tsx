import { createFileRoute } from "@tanstack/react-router";
import { Banknote, KeyRound, ScrollText, ShieldCheck, Users } from "lucide-react";
import { DashboardShell, Panel, StatCard } from "@/components/medra/DashboardShell";
import { DonutChart, LineChart } from "@/components/medra/Charts";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/super-admin")({
  head: () => ({
    meta: [
      { title: "Super Admin Console — Medra" },
      {
        name: "description",
        content:
          "Medra super admin console: manage administrators, roles, permissions, audit trails and global platform revenue.",
      },
      { property: "og:title", content: "Super Admin Console — Medra" },
      {
        property: "og:description",
        content: "Global control over administrators, roles, permissions and audit trails on Medra.",
      },
    ],
  }),
  component: SuperAdminDashboard,
});

const groups = [
  { items: [{ label: "Global Overview", to: "/super-admin" }, { label: "Commission engine", to: "/super-admin/commission" }, { label: "Admin console", to: "/admin" }] },
  {
    title: "Governance",
    items: [
      { label: "Administrators", to: "/super-admin/admins" },
      { label: "Roles & Permissions", to: "/super-admin/permissions" },
      { label: "Audit Trails", to: "/super-admin/audit" },
    ],
  },
  {
    title: "Platform",
    items: [
      { label: "Categories", to: "/super-admin/categories" },
      { label: "Feature Flags", to: "/super-admin/features" },
      { label: "Notifications", to: "/notifications" },
    ],
  },
];

const activity = [
  { who: "Amaka N.", what: "Approved payout batch #2291", role: "Finance Admin", when: "12m ago" },
  { who: "Tobi K.", what: "Suspended store: QuickBuy Mart", role: "Ops Admin", when: "48m ago" },
  { who: "Zainab M.", what: "Updated commission to 12% (Groceries)", role: "Super Admin", when: "2h ago" },
  { who: "Daniel U.", what: "Granted refunds permission to Support L2", role: "Super Admin", when: "4h ago" },
  { who: "System", what: "Rotated payment gateway credentials", role: "Automation", when: "9h ago" },
];

const admins = [
  { role: "Super Admin", count: 3, scope: "Full platform control" },
  { role: "Ops Admin", count: 6, scope: "Orders, riders, stores" },
  { role: "Finance Admin", count: 3, scope: "Payouts, commissions" },
  { role: "Support L2", count: 2, scope: "Tickets, refunds" },
];

function SuperAdminDashboard() {
  return (
    <DashboardShell
      groups={groups}
      title="Super admin console"
      subtitle="Global platform governance"
      topRight={
        <>
          <span className="rounded-full bg-grape/15 px-3 py-1.5 text-xs font-bold text-grape">
            Elevated session
          </span>
          <Button size="sm" className="rounded-full">
            Create administrator
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Global revenue"
          value="₦248.5M"
          delta="+16.4% YoY"
          tone="leaf"
          icon={<Banknote className="size-4" />}
        />
        <StatCard
          label="Platform users"
          value="1.42M"
          delta="+62,410 this quarter"
          tone="sky"
          icon={<Users className="size-4" />}
        />
        <StatCard
          label="Administrators"
          value="14"
          delta="4 roles configured"
          deltaTone="neutral"
          tone="grape"
          icon={<ShieldCheck className="size-4" />}
        />
        <StatCard
          label="Audit events (24h)"
          value="3,182"
          delta="2 flagged for review"
          deltaTone="down"
          tone="amber"
          icon={<ScrollText className="size-4" />}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Panel
          title="Global revenue trend"
          className="xl:col-span-2"
          action={<span className="text-xs font-semibold text-muted-foreground">12 months</span>}
        >
          <LineChart
            points={[96, 108, 121, 118, 140, 156, 171, 165, 190, 208, 226, 248]}
            stroke="var(--leaf)"
          />
        </Panel>
        <Panel title="Order status overview">
          <DonutChart
            segments={[
              { label: "Delivered", value: 71, color: "var(--leaf)" },
              { label: "In transit", value: 16, color: "var(--sky)" },
              { label: "Pending", value: 9, color: "var(--amber)" },
              { label: "Refunded", value: 4, color: "var(--grape)" },
            ]}
          />
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Panel
          title="Recent admin activity"
          className="xl:col-span-2"
          action={<span className="cursor-pointer text-xs font-bold text-primary">Full audit trail</span>}
        >
          <ul className="divide-y divide-border">
            {activity.map((a) => (
              <li key={a.what} className="flex items-start gap-3 py-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-muted text-xs font-bold">
                  {a.who.slice(0, 2).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{a.what}</p>
                  <p className="text-xs text-muted-foreground">
                    {a.who} · {a.role}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">{a.when}</span>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="Roles & permissions">
          <ul className="space-y-3">
            {admins.map((a) => (
              <li key={a.role} className="rounded-xl border border-border p-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold">{a.role}</p>
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                    {a.count} users
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{a.scope}</p>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex items-start gap-3 rounded-xl bg-muted p-3">
            <KeyRound className="mt-0.5 size-4 text-grape" />
            <p className="text-xs text-muted-foreground">
              Permission changes require two-person approval and are written to the audit trail.
            </p>
          </div>
        </Panel>
      </div>
    </DashboardShell>
  );
}
