import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Activity,
  BadgeCheck,
  Banknote,
  Gauge,
  Headphones,
  LifeBuoy,
  Lock,
  MonitorCheck,
  ScrollText,
  ShieldAlert,
  ShieldCheck,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  FeatureStrip,
  SectionHeading,
  SiteFooter,
  SiteHeader,
} from "@/components/medra/SiteChrome";

export const Route = createFileRoute("/team")({
  head: () => ({
    meta: [
      { title: "Medra Team — Admin & Support Portal" },
      {
        name: "description",
        content:
          "Secure sign-in portal for the Medra admin and support team: monitor operations, prevent fraud, resolve disputes and support customers, riders and vendors.",
      },
      { property: "og:title", content: "Medra Team — Admin & Support Portal" },
      {
        property: "og:description",
        content: "Behind every great experience is a great team. Sign in to the Medra team portal.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TeamPortal,
});

const responsibilities = [
  {
    Icon: MonitorCheck,
    title: "Monitor Operations",
    body: "Keep orders, riders and stores running smoothly.",
    tone: "bg-sky/15 text-sky",
  },
  {
    Icon: ShieldAlert,
    title: "Prevent Fraud",
    body: "Detect and act on suspicious activity fast.",
    tone: "bg-destructive/15 text-destructive",
  },
  {
    Icon: Headphones,
    title: "Support Users",
    body: "Resolve tickets for customers, riders and vendors.",
    tone: "bg-leaf/15 text-leaf",
  },
  {
    Icon: Banknote,
    title: "Payments & Refunds",
    body: "Handle payouts, commissions and disputes.",
    tone: "bg-amber/20 text-amber",
  },
  {
    Icon: BadgeCheck,
    title: "Verify & Approve",
    body: "Review store and rider applications.",
    tone: "bg-grape/15 text-grape",
  },
];

const access = [
  {
    Icon: Gauge,
    title: "Admin Console",
    body: "Day-to-day operations: orders, approvals, stores, riders and support queues.",
    to: "/admin" as const,
    cta: "Open admin console",
  },
  {
    Icon: ShieldCheck,
    title: "Super Admin Console",
    body: "Governance: administrators, roles, permissions, audit trails and platform revenue.",
    to: "/super-admin" as const,
    cta: "Open super admin",
  },
];

const security = [
  { Icon: Lock, title: "Single sign-on", body: "Team accounts are provisioned by Medra only." },
  { Icon: ScrollText, title: "Full audit trail", body: "Every action is logged and reviewable." },
  { Icon: Users, title: "Least privilege", body: "Roles grant only what each job needs." },
  { Icon: Activity, title: "Live monitoring", body: "Anomalies are flagged in real time." },
];

function TeamPortal() {
  return (
    <div className="min-h-screen bg-background">
      <header className="hero-surface">
        <SiteHeader accent="sky" />
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-5 pb-20 pt-6 lg:grid-cols-2">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-grape px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-grape-foreground">
              <ShieldCheck className="size-4" /> Medra team access
            </span>
            <h1 className="mt-5 text-4xl font-extrabold leading-[1.05] md:text-5xl">
              Behind every great
              <br />
              experience is a
              <br />
              <span className="text-leaf">great team.</span>
            </h1>
            <p className="mt-4 max-w-md text-base text-ink-foreground/75">
              The Medra admin and support team keeps the platform safe, fair and fast for
              millions of customers, riders and vendors.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Button
                asChild
                className="rounded-full bg-leaf px-6 py-6 text-base font-bold text-leaf-foreground hover:bg-leaf/90"
              >
                <Link to="/login">
                  Sign in to team portal <ArrowRight className="ml-1 size-4" />
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="rounded-full border-ink-foreground/25 bg-transparent px-6 py-6 text-base font-bold text-ink-foreground hover:bg-ink-foreground/10 hover:text-ink-foreground"
              >
                <Link to="/">
                  <LifeBuoy className="mr-1 size-4" /> Contact support
                </Link>
              </Button>
            </div>
            <p className="mt-5 text-xs text-ink-foreground/60">
              Team accounts are issued internally. Access attempts are logged.
            </p>
          </div>

          <div className="surface-card p-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <p className="text-sm font-bold">Admin dashboard preview</p>
              <span className="rounded-full bg-leaf/15 px-2 py-0.5 text-[10px] font-bold text-leaf">
                Live
              </span>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-3">
              {[
                { label: "Users", value: "124,568" },
                { label: "Orders", value: "18,746" },
                { label: "Revenue", value: "₦48.6M" },
              ].map((s) => (
                <div key={s.label} className="rounded-xl bg-muted p-3">
                  <p className="text-[11px] text-muted-foreground">{s.label}</p>
                  <p className="text-base font-extrabold">{s.value}</p>
                </div>
              ))}
            </div>
            <div className="mt-3 space-y-2">
              {[
                "3 stores awaiting approval",
                "5 rider verifications pending",
                "2 refund disputes escalated",
              ].map((row) => (
                <div
                  key={row}
                  className="flex items-center justify-between rounded-xl border border-border px-3 py-2 text-xs"
                >
                  <span>{row}</span>
                  <span className="font-bold text-primary">Review</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </header>

      <FeatureStrip items={responsibilities} />

      <div className="mx-auto max-w-7xl px-5">
        <SectionHeading>Choose your console</SectionHeading>
        <div className="grid gap-4 md:grid-cols-2">
          {access.map(({ Icon, title, body, to, cta }) => (
            <article key={title} className="surface-card lift-hover p-6">
              <span className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary">
                <Icon className="size-5" />
              </span>
              <h3 className="mt-4 text-lg font-extrabold">{title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{body}</p>
              <Button asChild variant="outline" className="mt-5 rounded-full font-bold">
                <Link to={to}>
                  {cta} <ArrowRight className="ml-1 size-4" />
                </Link>
              </Button>
            </article>
          ))}
        </div>

        <section className="hero-surface my-12 rounded-2xl px-6 py-8">
          <div className="grid gap-6 lg:grid-cols-5">
            <h2 className="text-2xl font-extrabold leading-tight">
              Security &amp; <span className="text-leaf">accountability</span>
            </h2>
            {security.map(({ Icon, title, body }) => (
              <div key={title} className="flex items-start gap-3">
                <Icon className="mt-0.5 size-5 shrink-0 text-leaf" />
                <div>
                  <p className="text-sm font-bold">{title}</p>
                  <p className="mt-1 text-xs text-ink-foreground/70">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <SiteFooter />
    </div>
  );
}
