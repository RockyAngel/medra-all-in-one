import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Boxes,
  Building2,
  ClipboardCheck,
  CreditCard,
  Headphones,
  Megaphone,
  PlayCircle,
  ShieldCheck,
  Store,
  TrendingUp,
  Truck,
  Users,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import logo from "@/assets/medra-logo.png.asset.json";
import {
  DarkHighlights,
  FeatureStrip,
  SectionHeading,
  SiteFooter,
  SiteHeader,
  Steps,
} from "@/components/medra/SiteChrome";

export const Route = createFileRoute("/become-a-seller")({
  head: () => ({
    meta: [
      { title: "Sell on Medra — Grow your business with Medra" },
      {
        name: "description",
        content:
          "List your store on Medra to reach thousands of nearby customers, manage inventory and orders, and receive secure weekly payouts.",
      },
      { property: "og:title", content: "Sell on Medra — Grow your business" },
      {
        property: "og:description",
        content: "Reach more customers, boost sales and get paid securely as a Medra vendor.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BecomeASeller,
});

const perks = [
  {
    Icon: Users,
    title: "Wide Customer Reach",
    body: "Get discovered by thousands of shoppers near you.",
    tone: "bg-sky/15 text-sky",
  },
  {
    Icon: TrendingUp,
    title: "Boost Your Sales",
    body: "Promotions and deals that drive real orders.",
    tone: "bg-leaf/15 text-leaf",
  },
  {
    Icon: Boxes,
    title: "Easy Management",
    body: "Products, stock and orders in one dashboard.",
    tone: "bg-amber/20 text-amber",
  },
  {
    Icon: CreditCard,
    title: "Secure Payouts",
    body: "Reliable, on-time settlements every week.",
    tone: "bg-grape/15 text-grape",
  },
  {
    Icon: Truck,
    title: "Delivery Handled",
    body: "Our rider network delivers for you.",
    tone: "bg-destructive/15 text-destructive",
  },
];

const steps = [
  {
    Icon: ClipboardCheck,
    title: "Register Your Store",
    body: "Create a vendor account and submit your business details.",
    tone: "bg-leaf/15 text-leaf",
  },
  {
    Icon: BadgeCheck,
    title: "Get Verified",
    body: "We review and approve your store, usually within 48 hours.",
    tone: "bg-sky/15 text-sky",
  },
  {
    Icon: Store,
    title: "List Products",
    body: "Upload products, set prices and manage inventory.",
    tone: "bg-amber/20 text-amber",
  },
  {
    Icon: Wallet,
    title: "Sell & Get Paid",
    body: "Fulfil orders and receive secure weekly payouts.",
    tone: "bg-grape/15 text-grape",
  },
];

const tools = [
  { Icon: BarChart3, title: "Sales Analytics", body: "Track revenue, orders and best sellers." },
  { Icon: Megaphone, title: "Promotions", body: "Run discounts, coupons and flash deals." },
  { Icon: Boxes, title: "Inventory Alerts", body: "Low-stock warnings before you run out." },
  { Icon: Headphones, title: "Vendor Support", body: "Dedicated support for your store." },
  { Icon: ShieldCheck, title: "Fraud Protection", body: "Safe payments and dispute handling." },
];

const hero = [
  { Icon: Building2, title: "Any Business Size", body: "From small shops to big brands" },
  { Icon: Users, title: "1.4M+ Shoppers", body: "A ready customer base" },
  { Icon: Wallet, title: "Weekly Payouts", body: "Straight to your bank" },
  { Icon: Headphones, title: "24/7 Support", body: "We're always here to help" },
];

function BecomeASeller() {
  return (
    <div className="min-h-screen bg-background">
      <header className="hero-surface">
        <SiteHeader accent="sky" />
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-5 pb-20 pt-6 lg:grid-cols-2">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-sky px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-sky-foreground">
              <Store className="size-4" /> For vendors &amp; businesses
            </span>
            <h1 className="mt-5 text-4xl font-extrabold leading-[1.05] md:text-5xl">
              Grow your business
              <br />
              with <span className="text-leaf">Medra.</span>
            </h1>
            <p className="mt-4 max-w-md text-base text-ink-foreground/75">
              Reach thousands of customers, manage your store with ease and get paid securely —
              all from one powerful dashboard.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Button
                asChild
                className="rounded-full bg-sky px-6 py-6 text-base font-bold text-sky-foreground hover:bg-sky/90"
              >
                <Link to="/signup">
                  Start Selling <ArrowRight className="ml-1 size-4" />
                </Link>
              </Button>
              <Button
                variant="outline"
                className="rounded-full border-ink-foreground/25 bg-transparent px-6 py-6 text-base font-bold text-ink-foreground hover:bg-ink-foreground/10 hover:text-ink-foreground"
              >
                See How It Works <PlayCircle className="ml-1 size-4" />
              </Button>
            </div>
            <dl className="mt-10 grid grid-cols-2 gap-5 sm:grid-cols-4">
              {hero.map(({ Icon, title, body }) => (
                <div key={title} className="flex items-start gap-2">
                  <Icon className="mt-0.5 size-5 text-leaf" />
                  <div>
                    <dt className="text-sm font-semibold">{title}</dt>
                    <dd className="text-xs text-ink-foreground/65">{body}</dd>
                  </div>
                </div>
              ))}
            </dl>
          </div>
          <div className="relative justify-self-center">
            <img
              src={logo.url}
              alt="Sell on Medra"
              className="w-full max-w-md drop-shadow-2xl"
              loading="eager"
            />
            <div className="surface-card absolute -bottom-6 left-0 flex items-center gap-4 p-4">
              <span className="grid size-10 place-items-center rounded-full bg-sky text-sky-foreground">
                <BarChart3 className="size-5" />
              </span>
              <div>
                <p className="text-xs text-muted-foreground">This Month's Sales</p>
                <p className="text-2xl font-extrabold">₦256,780</p>
                <p className="text-xs text-leaf">+18.2% vs last month</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <FeatureStrip items={perks} />

      <div className="mx-auto max-w-7xl px-5">
        <SectionHeading>How Selling Works</SectionHeading>
        <Steps steps={steps} />

        <DarkHighlights title="Tools that grow your" accent="store" items={tools} />

        <section className="mb-14 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-sky/10 p-8">
          <div>
            <h2 className="text-2xl font-extrabold">Ready to open your Medra store?</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              No setup fees — you only pay a commission on completed orders.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button asChild className="rounded-full px-6 font-bold">
              <Link to="/signup">Create vendor account</Link>
            </Button>
            <Button asChild variant="outline" className="rounded-full px-6 font-bold">
              <Link to="/seller">Preview seller dashboard</Link>
            </Button>
          </div>
        </section>
      </div>

      <SiteFooter />
    </div>
  );
}
