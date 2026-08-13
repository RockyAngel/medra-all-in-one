import { createFileRoute } from "@tanstack/react-router";
import { Banknote, Package, ShoppingBag, Star, Users } from "lucide-react";
import { DashboardShell, Panel, StatCard } from "@/components/medra/DashboardShell";
import { BarChart, LineChart } from "@/components/medra/Charts";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/seller")({
  head: () => ({
    meta: [
      { title: "Seller Dashboard — Medra" },
      {
        name: "description",
        content:
          "Medra seller dashboard: track sales, manage products and inventory, fulfil orders and monitor payouts.",
      },
      { property: "og:title", content: "Seller Dashboard — Medra" },
      {
        property: "og:description",
        content: "Manage your store, products, orders, promotions and earnings on Medra.",
      },
    ],
  }),
  component: SellerDashboard,
});

const groups = [
  {
    items: [
      { label: "Overview", active: true },
      { label: "Orders", badge: 12 },
      { label: "Products" },
      { label: "Inventory" },
      { label: "Promotions" },
    ],
  },
  {
    title: "Finance",
    items: [{ label: "Earnings" }, { label: "Payouts" }, { label: "Invoices" }],
  },
  { title: "Store", items: [{ label: "Store Profile" }, { label: "Reviews" }, { label: "Settings" }] },
];

const orders = [
  { id: "#MD-77120", customer: "Chidi A.", total: "₦12,400", status: "Processing" },
  { id: "#MD-77118", customer: "Halima B.", total: "₦4,850", status: "Out for delivery" },
  { id: "#MD-77113", customer: "Femi O.", total: "₦21,900", status: "Delivered" },
  { id: "#MD-77109", customer: "Ngozi E.", total: "₦7,300", status: "Delivered" },
  { id: "#MD-77104", customer: "Musa I.", total: "₦2,150", status: "Cancelled" },
];

const products = [
  { name: "Paracetamol 500mg (24s)", sold: 412, stock: 180 },
  { name: "Vitamin C 1000mg", sold: 388, stock: 96 },
  { name: "Blood Pressure Monitor", sold: 154, stock: 22 },
  { name: "First Aid Kit", sold: 121, stock: 8 },
];

const statusTone: Record<string, string> = {
  Processing: "bg-amber/20 text-amber",
  "Out for delivery": "bg-sky/15 text-sky",
  Delivered: "bg-leaf/15 text-leaf",
  Cancelled: "bg-destructive/15 text-destructive",
};

function SellerDashboard() {
  return (
    <DashboardShell
      groups={groups}
      title="Dee Pharmacy"
      subtitle="Verified vendor · Ikeja, Lagos"
      topRight={
        <>
          <Button size="sm" variant="outline" className="rounded-full">
            View store
          </Button>
          <Button size="sm" className="rounded-full">
            Add product
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label="Total sales"
          value="₦256,780"
          delta="+18.2% this month"
          tone="leaf"
          icon={<Banknote className="size-4" />}
        />
        <StatCard
          label="Total orders"
          value="1,284"
          delta="+96 this week"
          tone="sky"
          icon={<ShoppingBag className="size-4" />}
        />
        <StatCard
          label="Customers"
          value="842"
          delta="+34 new"
          tone="grape"
          icon={<Users className="size-4" />}
        />
        <StatCard
          label="Store rating"
          value="4.8"
          delta="312 reviews"
          deltaTone="neutral"
          tone="amber"
          icon={<Star className="size-4" />}
        />
        <StatCard
          label="Low stock items"
          value="6"
          delta="Restock needed"
          deltaTone="down"
          tone="sky"
          icon={<Package className="size-4" />}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Panel
          title="Sales overview"
          className="xl:col-span-2"
          action={<span className="text-xs font-semibold text-muted-foreground">Last 7 months</span>}
        >
          <LineChart points={[120, 168, 142, 210, 188, 246, 257]} stroke="var(--grape)" />
        </Panel>
        <Panel title="Orders per day">
          <BarChart
            data={[
              { label: "Mon", value: 32 },
              { label: "Tue", value: 44 },
              { label: "Wed", value: 38 },
              { label: "Thu", value: 51 },
              { label: "Fri", value: 62 },
              { label: "Sat", value: 74 },
              { label: "Sun", value: 41 },
            ]}
            tone="bg-sky"
          />
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Panel
          title="Recent orders"
          className="xl:col-span-2"
          action={<span className="cursor-pointer text-xs font-bold text-primary">View all</span>}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="pb-2 font-semibold">Order</th>
                  <th className="pb-2 font-semibold">Customer</th>
                  <th className="pb-2 font-semibold">Total</th>
                  <th className="pb-2 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td className="py-3 font-semibold">{o.id}</td>
                    <td className="py-3 text-muted-foreground">{o.customer}</td>
                    <td className="py-3 font-semibold">{o.total}</td>
                    <td className="py-3">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-bold ${statusTone[o.status]}`}
                      >
                        {o.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title="Top products">
          <ul className="space-y-3">
            {products.map((p) => (
              <li key={p.name} className="flex items-center gap-3">
                <span className="size-10 shrink-0 rounded-lg bg-muted" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{p.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {p.sold} sold · {p.stock} in stock
                  </p>
                </div>
                {p.stock < 25 && (
                  <span className="rounded-full bg-amber/20 px-2 py-1 text-[10px] font-bold text-amber">
                    Low
                  </span>
                )}
              </li>
            ))}
          </ul>
          <div className="mt-4 rounded-xl bg-muted p-3 text-xs text-muted-foreground">
            Next payout: <span className="font-bold text-foreground">₦184,220</span> on Friday.
          </div>
        </Panel>
      </div>
    </DashboardShell>
  );
}
