import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Bell, Heart, MapPin, ShoppingCart } from "lucide-react";
import { Logo } from "./Logo";

const navLinks = ["Home", "Categories", "Stores", "Pharmacies", "Deals", "Gift Cards"];

export function SiteHeader({ accent = "leaf" }: { accent?: "leaf" | "sky" }) {
  return (
    <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-4 px-5 py-4">
      <Logo tone="dark" size={44} />
      <nav className="hidden items-center gap-5 text-sm font-semibold text-ink-foreground/85 xl:flex">
        {navLinks.map((l) => (
          <span key={l} className="cursor-pointer hover:text-ink-foreground">
            {l}
          </span>
        ))}
        <Link
          to="/become-a-seller"
          className={accent === "sky" ? "text-sky hover:underline" : "text-leaf hover:underline"}
        >
          Become a Seller / Rider
        </Link>
      </nav>
      <div className="ml-auto flex items-center gap-4 text-ink-foreground">
        <span className="hidden items-center gap-2 text-sm md:flex">
          <MapPin className="size-4 text-ink-foreground/70" />
          <span className="leading-tight">
            <span className="block text-[11px] text-ink-foreground/60">Deliver to</span>
            Lagos, Nigeria
          </span>
        </span>
        <Heart className="size-5 cursor-pointer text-ink-foreground/80" />
        <span className="relative cursor-pointer">
          <Bell className="size-5 text-ink-foreground/80" />
          <span className="absolute -right-2 -top-2 grid size-4 place-items-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
            3
          </span>
        </span>
        <span className="relative cursor-pointer">
          <ShoppingCart className="size-5 text-ink-foreground/80" />
          <span className="absolute -right-2 -top-2 grid size-4 place-items-center rounded-full bg-leaf text-[10px] font-bold text-leaf-foreground">
            2
          </span>
        </span>
        <Link
          to="/login"
          className="rounded-lg border border-ink-foreground/25 px-3 py-1.5 text-sm font-semibold"
        >
          Sign In
        </Link>
      </div>
    </div>
  );
}

export function SiteFooter() {
  return (
    <footer className="hero-surface">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-10">
        <Logo tone="dark" size={40} />
        <nav className="flex flex-wrap gap-5 text-sm text-ink-foreground/75">
          <Link to="/" className="hover:text-ink-foreground">
            Marketplace
          </Link>
          <Link to="/become-a-rider" className="hover:text-ink-foreground">
            Become a Rider
          </Link>
          <Link to="/become-a-seller" className="hover:text-ink-foreground">
            Become a Seller
          </Link>
          <Link to="/team" className="hover:text-ink-foreground">
            Medra Team
          </Link>
        </nav>
        <p className="text-sm text-ink-foreground/70">
          © {new Date().getFullYear()} Medra. Shop Better. Live Better.
        </p>
      </div>
    </footer>
  );
}

export function FeatureStrip({
  items,
}: {
  items: { Icon: React.ComponentType<{ className?: string }>; title: string; body: string; tone: string }[];
}) {
  return (
    <div className="mx-auto max-w-7xl px-5">
      <div className="surface-card -mt-10 grid gap-5 p-6 sm:grid-cols-2 lg:grid-cols-5 lg:divide-x lg:divide-border">
        {items.map(({ Icon, title, body, tone }) => (
          <div key={title} className="flex items-start gap-3 lg:px-4">
            <span className={`grid size-11 shrink-0 place-items-center rounded-full ${tone}`}>
              <Icon className="size-5" />
            </span>
            <div>
              <p className="text-sm font-bold">{title}</p>
              <p className="mt-1 text-xs text-muted-foreground">{body}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <div className="my-10 flex items-center justify-center gap-4">
      <span className="h-px w-10 bg-leaf" />
      <h2 className="text-2xl font-extrabold md:text-3xl">{children}</h2>
      <span className="h-px w-10 bg-sky" />
    </div>
  );
}

export function Steps({
  steps,
}: {
  steps: { Icon: React.ComponentType<{ className?: string }>; title: string; body: string; tone: string }[];
}) {
  return (
    <ol className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {steps.map((s, i) => (
        <li key={s.title} className="surface-card lift-hover p-5">
          <div className="flex items-center gap-3">
            <span className={`grid size-11 place-items-center rounded-xl ${s.tone}`}>
              <s.Icon className="size-5" />
            </span>
            <span className="grid size-6 place-items-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
              {i + 1}
            </span>
            <p className="text-sm font-bold">{s.title}</p>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">{s.body}</p>
        </li>
      ))}
    </ol>
  );
}

export function DarkHighlights({
  title,
  accent,
  items,
}: {
  title: string;
  accent: string;
  items: { Icon: React.ComponentType<{ className?: string }>; title: string; body: string }[];
}) {
  return (
    <section className="hero-surface my-12 rounded-2xl px-6 py-8">
      <div className="grid gap-6 lg:grid-cols-5">
        <h2 className="text-2xl font-extrabold leading-tight">
          {title} <span className="text-leaf">{accent}</span>
        </h2>
        {items.map(({ Icon, title: t, body }) => (
          <div key={t} className="flex items-start gap-3">
            <Icon className="mt-0.5 size-5 shrink-0 text-leaf" />
            <div>
              <p className="text-sm font-bold">{t}</p>
              <p className="mt-1 text-xs text-ink-foreground/70">{body}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
