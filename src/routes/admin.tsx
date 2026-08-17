import { createFileRoute, Link } from "@tanstack/react-router";
import { Banknote, LifeBuoy, ShieldAlert, ShoppingBag, Users } from "lucide-react";
import { DashboardShell, Panel, StatCard } from "@/components/medra/DashboardShell";
import { BarChart, DonutChart } from "@/components/medra/Charts";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin Dashboard — Medra" },
      {
        name: "description",
        content:
          "Medra admin console: approve stores and riders, monitor orders, revenue, refunds, safety and support queues.",
      },
      { property: "og:title", content: "Admin Dashboard — Medra" },
      {
        property: "og:description",
        content: "Operations, approvals, payments and support management for the Medra platform.",
      },
    ],
  }),
  component: AdminDashboard,
});

const groups = [
  {
    items: [
      { label: "Overview", to: "/admin" },
      { label: "Orders", to: "/admin/orders" },
      { label: "Deliveries", to: "/admin/deliveries" },
      { label: "Pharmacy onboarding", to: "/admin/pharmacy-applications" },
    ],
  },
  {
    title: "Operations",
    items: [
      { label: "Payments", to: "/admin/payments" },
      { label: "Refunds", to: "/admin/refunds" },
      { label: "Payouts", to: "/admin/payouts" },
      { label: "Support inbox", to: "/admin/support" },
      { label: "Safety reports", to: "/admin/sos" },
    ],
  },
];

const approvals = [
  { name: "Bloom Beauty Store", type: "Store", city: "Lekki", when: "2h ago" },
  { name: "Ade Samuel", type: "Rider", city: "Yaba", when: "3h ago" },
  { name: "GreenLeaf Grocery", type: "Store", city: "Surulere", when: "5h ago" },
  { name: "Ifeanyi Obi", type: "Rider", city: "Ikeja", when: "8h ago" },
];

const stores = [
  { name: "Dee Pharmacy", revenue: "₦2.4M", orders: 1284 },
  { name: "FreshMart Grocery", revenue: "₦1.9M", orders: 1102 },
  { name: "Spice Kitchen", revenue: "₦1.4M", orders: 964 },
  { name: "UrbanFit Fashion", revenue: "₦1.1M", orders: 712 },
];

const system = [
  { label: "Payments gateway", state: "Operational" },
  { label: "Delivery tracking", state: "Operational" },
  { label: "Notifications", state: "Degraded" },
  { label: "Search service", state: "Operational" },
];

function AdminDashboard() {
  return (
    <DashboardShell
      groups={groups}
      title="Platform overview"
      subtitle="Medra operations · Nigeria"
      topRight={
        <>
          <Button size="sm" variant="outline" className="rounded-full">
            Export report
          </Button>
          <Button asChild size="sm" className="rounded-full"><Link to="/admin/pharmacy-applications">Review queue</Link></Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total users"
          value="124,568"
          delta="+3,241 this month"
          tone="sky"
          icon={<Users className="size-4" />}
        />
        <StatCard
          label="Orders"
          value="18,746"
          delta="+8.6% week over week"
          tone="grape"
          icon={<ShoppingBag className="size-4" />}
        />
        <StatCard
          label="Revenue"
          value="₦48.6M"
          delta="+12.1% this month"
          tone="leaf"
          icon={<Banknote className="size-4" />}
        />
        <StatCard
          label="Open tickets"
          value="24"
          delta="3 safety escalations"
          deltaTone="down"
          tone="amber"
          icon={<LifeBuoy className="size-4" />}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Panel
          title="Orders by week"
          className="xl:col-span-2"
          action={<span className="text-xs font-semibold text-muted-foreground">Last 8 weeks</span>}
        >
          <BarChart
            data={[
              { label: "W1", value: 1420 },
              { label: "W2", value: 1680 },
              { label: "W3", value: 1590 },
              { label: "W4", value: 2010 },
              { label: "W5", value: 2240 },
              { label: "W6", value: 2180 },
              { label: "W7", value: 2560 },
              { label: "W8", value: 2740 },
            ]}
            tone="bg-grape"
          />
        </Panel>
        <Panel title="Order status split">
          <DonutChart
            segments={[
              { label: "Delivered", value: 74, color: "var(--leaf)" },
              { label: "In transit", value: 14, color: "var(--sky)" },
              { label: "Pending", value: 8, color: "var(--amber)" },
              { label: "Cancelled", value: 4, color: "var(--destructive)" },
            ]}
          />
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Panel
          title="Pending approvals"
          action={<span className="text-xs font-bold text-amber">27 pending</span>}
        >
          <ul className="space-y-3">
            {approvals.map((a) => (
              <li key={a.name} className="rounded-xl border border-border p-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold">{a.name}</p>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                    {a.type}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {a.city} · {a.when}
                </p>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" className="h-8 flex-1 rounded-lg text-xs">
                    Approve
                  </Button>
                  <Button size="sm" variant="outline" className="h-8 flex-1 rounded-lg text-xs">
                    Reject
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="Top performing stores">
          <ul className="divide-y divide-border">
            {stores.map((s, i) => (
              <li key={s.name} className="flex items-center gap-3 py-3">
                <span className="grid size-8 place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{s.name}</p>
                  <p className="text-xs text-muted-foreground">{s.orders} orders</p>
                </div>
                <span className="text-sm font-bold">{s.revenue}</span>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="System status">
          <ul className="space-y-3">
            {system.map((s) => (
              <li key={s.label} className="flex items-center justify-between">
                <span className="text-sm font-medium">{s.label}</span>
                <span
                  className={
                    s.state === "Operational"
                      ? "rounded-full bg-leaf/15 px-3 py-1 text-xs font-bold text-leaf"
                      : "rounded-full bg-amber/20 px-3 py-1 text-xs font-bold text-amber"
                  }
                >
                  {s.state}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-5 flex items-start gap-3 rounded-xl bg-destructive/10 p-3">
            <ShieldAlert className="mt-0.5 size-4 text-destructive" />
            <p className="text-xs text-destructive">
              3 safety reports awaiting review — SLA breach in 2 hours.
            </p>
          </div>
        </Panel>
      </div>
    </DashboardShell>
  );
}
