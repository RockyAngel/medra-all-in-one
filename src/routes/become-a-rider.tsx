import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Banknote,
  Bike,
  Clock,
  Gift,
  Headphones,
  MapPin,
  PlayCircle,
  ShieldCheck,
  ShieldPlus,
  Star,
  Smartphone,
  TrendingUp,
  Wallet,
  Bell,
  ClipboardCheck,
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

export const Route = createFileRoute("/become-a-rider")({
  head: () => ({
    meta: [
      { title: "Become a Medra Rider — Deliver more. Earn more." },
      {
        name: "description",
        content:
          "Join thousands of Medra riders earning on their own terms with flexible hours, weekly payouts, insurance cover and 24/7 support.",
      },
      { property: "og:title", content: "Become a Medra Rider — Deliver more. Earn more." },
      {
        property: "og:description",
        content: "Flexible hours, great earnings and weekly payouts for Medra riders.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BecomeARider,
});

const perks = [
  {
    Icon: Bike,
    title: "High Demand",
    body: "Plenty of orders every day, all day.",
    tone: "bg-leaf/15 text-leaf",
  },
  {
    Icon: Wallet,
    title: "Weekly Payouts",
    body: "Get paid weekly straight to your bank.",
    tone: "bg-sky/15 text-sky",
  },
  {
    Icon: TrendingUp,
    title: "Performance Bonuses",
    body: "Earn more with bonuses and incentives.",
    tone: "bg-amber/20 text-amber",
  },
  {
    Icon: ShieldPlus,
    title: "Insurance Coverage",
    body: "We've got you covered on every trip.",
    tone: "bg-grape/15 text-grape",
  },
  {
    Icon: Gift,
    title: "Referral Rewards",
    body: "Refer friends and earn exciting rewards.",
    tone: "bg-destructive/15 text-destructive",
  },
];

const steps = [
  {
    Icon: ClipboardCheck,
    title: "Sign Up",
    body: "Register and complete your verification.",
    tone: "bg-leaf/15 text-leaf",
  },
  {
    Icon: Smartphone,
    title: "Go Online",
    body: "Log in and go online to start receiving orders.",
    tone: "bg-sky/15 text-sky",
  },
  {
    Icon: Bike,
    title: "Deliver Orders",
    body: "Pick up and deliver orders safely and on time.",
    tone: "bg-amber/20 text-amber",
  },
  {
    Icon: Wallet,
    title: "Get Paid",
    body: "Earn great money and get paid weekly.",
    tone: "bg-grape/15 text-grape",
  },
];

const loves = [
  { Icon: MapPin, title: "Real-time Tracking", body: "Easy navigation and live order tracking." },
  { Icon: Bell, title: "Order Notifications", body: "Instant alerts for new orders." },
  { Icon: TrendingUp, title: "Earnings Overview", body: "Track your earnings and daily performance." },
  { Icon: Headphones, title: "In-App Support", body: "Chat with support anytime, anywhere." },
  { Icon: Star, title: "Rate & Grow", body: "Maintain good ratings and grow with us." },
];

const hero = [
  { Icon: Banknote, title: "Great Earnings", body: "Earn more with every delivery" },
  { Icon: Clock, title: "Flexible Hours", body: "Work when you want, as much as you want" },
  { Icon: ShieldCheck, title: "Safe & Secure", body: "Your safety is our priority" },
  { Icon: Headphones, title: "24/7 Support", body: "We're always here to help you" },
];

function BecomeARider() {
  return (
    <div className="min-h-screen bg-background">
      <header className="hero-surface">
        <SiteHeader />
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-5 pb-20 pt-6 lg:grid-cols-2">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-leaf px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-leaf-foreground">
              <Bike className="size-4" /> For riders &amp; drivers
            </span>
            <h1 className="mt-5 text-4xl font-extrabold leading-[1.05] md:text-5xl">
              Deliver more.
              <br />
              Earn more.
              <br />
              Be <span className="text-leaf">your own boss.</span>
            </h1>
            <p className="mt-4 max-w-md text-base text-ink-foreground/75">
              Join thousands of riders earning on their own terms. Flexible hours, great
              earnings, and 24/7 support.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Button
                asChild
                className="rounded-full bg-leaf px-6 py-6 text-base font-bold text-leaf-foreground hover:bg-leaf/90"
              >
                <Link to="/signup">
                  Join as a Rider <ArrowRight className="ml-1 size-4" />
                </Link>
              </Button>
              <Button
                variant="outline"
                className="rounded-full border-ink-foreground/25 bg-transparent px-6 py-6 text-base font-bold text-ink-foreground hover:bg-ink-foreground/10 hover:text-ink-foreground"
              >
                Learn More <PlayCircle className="ml-1 size-4" />
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
              alt="Medra rider community"
              className="w-full max-w-md drop-shadow-2xl"
              loading="eager"
            />
            <div className="surface-card absolute -bottom-6 right-0 flex items-center gap-4 p-4">
              <div>
                <p className="text-xs text-muted-foreground">Today's Earnings</p>
                <p className="text-2xl font-extrabold">₦18,750</p>
                <p className="text-xs text-muted-foreground">6 Deliveries Completed</p>
              </div>
              <span className="grid size-10 place-items-center rounded-full bg-leaf text-leaf-foreground">
                <TrendingUp className="size-5" />
              </span>
            </div>
          </div>
        </div>
      </header>

      <FeatureStrip items={perks} />

      <div className="mx-auto max-w-7xl px-5">
        <SectionHeading>How It Works</SectionHeading>
        <Steps steps={steps} />

        <DarkHighlights title="Why Riders Love" accent="Medra" items={loves} />

        <section className="mb-14 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-leaf/10 p-8">
          <div>
            <h2 className="text-2xl font-extrabold">Ready to start earning?</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Sign up as a rider today — verification usually takes less than 24 hours.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button asChild className="rounded-full px-6 font-bold">
              <Link to="/apply/rider">Apply to ride</Link>
            </Button>
            <Button asChild variant="outline" className="rounded-full px-6 font-bold">
              <Link to="/signup">Create rider account</Link>
            </Button>
          </div>
        </section>
      </div>

      <SiteFooter />
    </div>
  );
}
