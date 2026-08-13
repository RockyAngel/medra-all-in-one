import { createFileRoute } from "@tanstack/react-router";
import { Bike, Clock, MapPin, Navigation, Package, Star, Wallet } from "lucide-react";
import { DashboardShell, Panel, StatCard } from "@/components/medra/DashboardShell";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/rider")({
  head: () => ({
    meta: [
      { title: "Rider Dashboard — Medra" },
      {
        name: "description",
        content:
          "Medra rider dashboard: accept delivery requests, follow live navigation, and track daily earnings.",
      },
      { property: "og:title", content: "Rider Dashboard — Medra" },
      {
        property: "og:description",
        content: "Accept jobs, navigate deliveries and manage your rider earnings on Medra.",
      },
    ],
  }),
  component: RiderDashboard,
});

const groups = [
  {
    items: [
      { label: "Dashboard", active: true },
      { label: "Delivery Requests", badge: 4 },
      { label: "Active Delivery" },
      { label: "History" },
      { label: "Earnings" },
      { label: "Schedule" },
    ],
  },
  {
    title: "Account",
    items: [{ label: "Vehicle & Documents" }, { label: "Support" }, { label: "Settings" }],
  },
];

const requests = [
  { id: "MD-90211", from: "Dee Pharmacy, Ikeja", to: "12 Allen Ave", pay: "₦1,850", km: "3.2 km" },
  { id: "MD-90214", from: "FreshMart Grocery", to: "7 Opebi Road", pay: "₦2,400", km: "5.1 km" },
  { id: "MD-90219", from: "Spice Kitchen", to: "44 Awolowo Way", pay: "₦1,200", km: "1.9 km" },
];

const schedule = [
  { time: "08:00 – 12:00", label: "Morning shift", state: "Completed" },
  { time: "12:00 – 16:00", label: "Afternoon shift", state: "Active" },
  { time: "16:00 – 21:00", label: "Evening shift", state: "Upcoming" },
];

function RiderDashboard() {
  return (
    <DashboardShell
      dark
      groups={groups}
      title="Good afternoon, Tunde"
      subtitle="You're online · Ikeja zone"
      topRight={
        <>
          <span className="flex items-center gap-2 rounded-full bg-leaf/15 px-3 py-1.5 text-xs font-bold text-leaf">
            <span className="size-2 rounded-full bg-leaf" /> Online
          </span>
          <Button size="sm" variant="outline" className="rounded-full">
            Go offline
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Today's earnings"
          value="₦18,750"
          delta="+12.4% vs yesterday"
          tone="leaf"
          icon={<Wallet className="size-4" />}
        />
        <StatCard
          label="Deliveries completed"
          value="14"
          delta="2 in progress"
          deltaTone="neutral"
          tone="sky"
          icon={<Package className="size-4" />}
        />
        <StatCard
          label="Online time"
          value="6h 20m"
          delta="Target 8h"
          deltaTone="neutral"
          tone="amber"
          icon={<Clock className="size-4" />}
        />
        <StatCard
          label="Rider rating"
          value="4.9"
          delta="Top 5% in Lagos"
          tone="grape"
          icon={<Star className="size-4" />}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Panel
          title="Current delivery"
          className="xl:col-span-2"
          action={
            <span className="rounded-full bg-sky/15 px-3 py-1 text-xs font-bold text-sky">
              In transit
            </span>
          }
        >
          <div className="relative h-56 overflow-hidden rounded-xl bg-gradient-to-br from-muted to-accent">
            <div className="absolute inset-0 opacity-60 [background-image:linear-gradient(var(--border)_1px,transparent_1px),linear-gradient(90deg,var(--border)_1px,transparent_1px)] [background-size:32px_32px]" />
            <span className="absolute left-10 top-10 grid size-9 place-items-center rounded-full bg-leaf text-leaf-foreground">
              <MapPin className="size-4" />
            </span>
            <span className="absolute bottom-12 right-14 grid size-9 place-items-center rounded-full bg-grape text-grape-foreground">
              <Navigation className="size-4" />
            </span>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold">Order #MD-90188 · FreshMart → 15 Toyin St</p>
              <p className="text-xs text-muted-foreground">
                2.4 km away · ETA 9 mins · Customer: Chidi A.
              </p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="rounded-full">
                Call customer
              </Button>
              <Button size="sm" className="rounded-full bg-leaf text-leaf-foreground hover:bg-leaf/90">
                Mark delivered
              </Button>
            </div>
          </div>
        </Panel>

        <Panel title="New requests" action={<span className="text-xs font-bold text-amber">4 waiting</span>}>
          <ul className="space-y-3">
            {requests.map((r) => (
              <li key={r.id} className="rounded-xl border border-border p-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold">{r.pay}</p>
                  <span className="text-xs text-muted-foreground">{r.km}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {r.from} → {r.to}
                </p>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" className="h-8 flex-1 rounded-lg text-xs">
                    Accept
                  </Button>
                  <Button size="sm" variant="outline" className="h-8 flex-1 rounded-lg text-xs">
                    Decline
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Panel title="Today's schedule" className="xl:col-span-2">
          <ul className="divide-y divide-border">
            {schedule.map((s) => (
              <li key={s.time} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-semibold">{s.label}</p>
                  <p className="text-xs text-muted-foreground">{s.time}</p>
                </div>
                <span
                  className={
                    s.state === "Active"
                      ? "rounded-full bg-leaf/15 px-3 py-1 text-xs font-bold text-leaf"
                      : s.state === "Completed"
                        ? "rounded-full bg-muted px-3 py-1 text-xs font-bold text-muted-foreground"
                        : "rounded-full bg-sky/15 px-3 py-1 text-xs font-bold text-sky"
                  }
                >
                  {s.state}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="Delivery summary">
          <div className="space-y-3">
            {[
              { label: "Completed", value: 142, tone: "bg-leaf", pct: "92%" },
              { label: "Cancelled", value: 7, tone: "bg-destructive", pct: "5%" },
              { label: "Returned", value: 4, tone: "bg-amber", pct: "3%" },
            ].map((row) => (
              <div key={row.label}>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold">{row.label}</span>
                  <span className="text-muted-foreground">
                    {row.value} · {row.pct}
                  </span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                  <div className={`h-full ${row.tone}`} style={{ width: row.pct }} />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-5 flex items-center gap-3 rounded-xl bg-muted p-3">
            <Bike className="size-5 text-sky" />
            <p className="text-xs text-muted-foreground">
              Weekly bonus unlocked at 160 deliveries — 18 to go.
            </p>
          </div>
        </Panel>
      </div>
    </DashboardShell>
  );
}
