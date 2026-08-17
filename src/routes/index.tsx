import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowRight,
  Bell,
  Heart,
  MapPin,
  Search,
  ShieldCheck,
  ShoppingCart,
  Truck,
  Award,
  Headphones,
  UtensilsCrossed,
  Pill,
  ShoppingBasket,
  Shirt,
  Smartphone,
  Home,
  Sparkles,
  Car,
  PawPrint,
  LayoutGrid,
} from "lucide-react";
import { Logo } from "@/components/medra/Logo";
import logo from "@/assets/medra-logo.png.asset.json";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Medra — Everything you need, all in one place" },
      {
        name: "description",
        content:
          "Shop groceries, pharmacy, restaurants, fashion and electronics from trusted local businesses on Medra, with fast and reliable delivery.",
      },
      { property: "og:title", content: "Medra — Everything you need, all in one place" },
      {
        property: "og:description",
        content:
          "Shop from trusted local businesses and get it delivered fast, safe and reliable.",
      },
    ],
  }),
  component: CustomerHome,
});

const categories = [
  { label: "Restaurants", slug: "restaurants", Icon: UtensilsCrossed, tone: "bg-sky/15 text-sky" },
  { label: "Pharmacies", slug: "pharmacy-health", Icon: Pill, tone: "bg-leaf/15 text-leaf" },
  { label: "Groceries", slug: "groceries", Icon: ShoppingBasket, tone: "bg-amber/20 text-amber" },
  { label: "Fashion", slug: "fashion", Icon: Shirt, tone: "bg-grape/15 text-grape" },
  { label: "Electronics", slug: "electronics", Icon: Smartphone, tone: "bg-sky/15 text-sky" },
  { label: "Home & Living", slug: "home-living", Icon: Home, tone: "bg-amber/20 text-amber" },
  { label: "Beauty", slug: "beauty", Icon: Sparkles, tone: "bg-grape/15 text-grape" },
  { label: "Automotive", slug: "automotive", Icon: Car, tone: "bg-destructive/15 text-destructive" },
  { label: "Pets", slug: "pets", Icon: PawPrint, tone: "bg-leaf/15 text-leaf" },
  { label: "All Categories", slug: undefined, Icon: LayoutGrid, tone: "bg-muted text-muted-foreground" },
];

const trust = [
  { Icon: ShieldCheck, title: "Secure Payments", sub: "100% Safe & Secure" },
  { Icon: Truck, title: "Fast Delivery", sub: "On-time, Every time" },
  { Icon: Award, title: "Trusted Sellers", sub: "Verified & Reliable" },
  { Icon: Headphones, title: "24/7 Support", sub: "We're here for you" },
];

const promos = [
  {
    kicker: "Special Offers",
    title: "Up to 50% Off",
    body: "Shop deals from top stores near you.",
    cta: "Shop Deals",
    className: "bg-grape text-grape-foreground",
  },
  {
    kicker: "Pharmacy",
    title: "At Your Doorstep",
    body: "Order medicines and health essentials with ease.",
    cta: "Order Now",
    className: "bg-leaf text-leaf-foreground",
  },
  {
    kicker: "Fast Delivery",
    title: "You Can Count On",
    body: "Real-time tracking and on-time deliveries.",
    cta: "Track Order",
    className: "bg-amber text-amber-foreground",
  },
];

const picks = [
  { name: "Smart Watch Series 8", price: "₦45,000" },
  { name: "Everyday Runner Sneakers", price: "₦28,900" },
  { name: "Signature Eau de Parfum", price: "₦18,500" },
];

const topCategories = [
  { label: "Food & Restaurants", count: "1,240 stores" },
  { label: "Pharmacy & Health", count: "480 stores" },
  { label: "Groceries", count: "960 stores" },
  { label: "Fashion", count: "1,780 stores" },
  { label: "Electronics", count: "640 stores" },
  { label: "Home & Living", count: "520 stores" },
];

function CustomerHome() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  return (
    <div className="min-h-screen bg-background">
      <header className="hero-surface">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-4 px-5 py-4">
          <Logo tone="dark" size={44} />
          <nav className="hidden items-center gap-5 text-sm font-semibold text-ink-foreground/85 xl:flex">
            <Link to="/catalog" search={{}} className="rounded-lg bg-ink-foreground/10 px-3 py-2">Categories</Link>
            <Link to="/catalog" search={{ q: "deal" }} className="hover:text-ink-foreground">Deals</Link>
            <Link to="/stores" className="hover:text-ink-foreground">Stores</Link>
            <Link to="/catalog" search={{ category: "pharmacy-health" }} className="hover:text-ink-foreground">Pharmacies</Link>
            <Link to="/become-a-rider" className="text-leaf hover:underline">
              Become a Rider
            </Link>
            <Link to="/become-a-seller" className="text-sky hover:underline">
              Become a Seller
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
            <Link to="/favorites" aria-label="Saved items"><Heart className="size-5 text-ink-foreground/80" /></Link>
            <Link to="/notifications" className="relative" aria-label="Notifications">
              <Bell className="size-5 text-ink-foreground/80" />
            </Link>
            <Link to="/cart" className="relative" aria-label="Cart">
              <ShoppingCart className="size-5 text-ink-foreground/80" />
            </Link>
            <Link
              to="/login"
              className="rounded-lg border border-ink-foreground/25 px-3 py-1.5 text-sm font-semibold"
            >
              Log in
            </Link>
          </div>
        </div>

        <div className="mx-auto max-w-3xl px-5 pb-6">
          <form onSubmit={(event) => { event.preventDefault(); void navigate({ to: "/catalog", search: { q: query.trim() || undefined } }); }} className="flex items-center gap-3 rounded-full bg-card px-4 py-2 shadow-lg">
            <Search className="size-4 text-muted-foreground" />
            <input
              className="w-full bg-transparent py-1.5 text-sm outline-none placeholder:text-muted-foreground"
              placeholder="Search for products, stores and more..."
              aria-label="Search Medra"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <Button type="submit" size="sm" className="rounded-full bg-sky text-sky-foreground hover:bg-sky/90">
              <Search className="size-4" />
            </Button>
          </form>
        </div>

        <div className="mx-auto grid max-w-7xl items-center gap-8 px-5 pb-14 lg:grid-cols-2">
          <div>
            <h1 className="text-4xl font-extrabold leading-[1.08] md:text-5xl">
              Everything you need,
              <br />
              all in <span className="text-leaf">one place.</span>
            </h1>
            <p className="mt-4 max-w-md text-base text-ink-foreground/75">
              Shop from trusted local businesses and get it delivered fast, safe and reliable.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Button asChild className="rounded-full bg-sky px-6 text-sky-foreground hover:bg-sky/90">
                <Link to="/catalog" search={{}}>Shop Now <ArrowRight className="ml-1 size-4" /></Link>
              </Button>
              <Button asChild
                variant="outline"
                className="rounded-full border-ink-foreground/25 bg-transparent px-6 text-ink-foreground hover:bg-ink-foreground/10 hover:text-ink-foreground"
              >
                <Link to="/orders"><MapPin className="mr-1 size-4" /> Track My Order</Link>
              </Button>
            </div>
            <dl className="mt-10 grid grid-cols-2 gap-5 sm:grid-cols-4">
              {trust.map(({ Icon, title, sub }) => (
                <div key={title} className="flex items-start gap-2">
                  <Icon className="mt-0.5 size-5 text-leaf" />
                  <div>
                    <dt className="text-sm font-semibold">{title}</dt>
                    <dd className="text-xs text-ink-foreground/65">{sub}</dd>
                  </div>
                </div>
              ))}
            </dl>
          </div>
          <div className="justify-self-center">
            <img
              src={logo.url}
              alt="Medra all-in-one marketplace mark"
              className="w-full max-w-md drop-shadow-2xl"
              loading="eager"
            />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-5">
        <div className="surface-card -mt-8 grid grid-cols-3 gap-2 p-4 sm:grid-cols-5 lg:grid-cols-10">
          {categories.map(({ label, slug, Icon, tone }) => (
            <Link
              key={label}
              to="/catalog"
              search={slug ? { category: slug } : {}}
              className="flex flex-col items-center gap-2 rounded-xl p-2 text-center transition-colors hover:bg-muted"
            >
              <span className={`grid size-12 place-items-center rounded-full ${tone}`}>
                <Icon className="size-5" />
              </span>
              <span className="text-xs font-semibold">{label}</span>
            </Link>
          ))}
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-4">
          {promos.map((p) => (
            <article key={p.title} className={`lift-hover rounded-xl p-5 ${p.className}`}>
              <p className="text-sm font-semibold opacity-85">{p.kicker}</p>
              <h3 className="mt-1 text-xl font-extrabold">{p.title}</h3>
              <p className="mt-2 text-sm opacity-85">{p.body}</p>
              <Link to={p.cta === "Track Order" ? "/orders" : "/catalog"} search={p.cta === "Order Now" ? { category: "pharmacy-health" } : {}} className="mt-5 inline-flex items-center gap-1 rounded-full bg-card px-4 py-2 text-sm font-semibold text-foreground">
                {p.cta} <ArrowRight className="size-4" />
              </Link>
            </article>
          ))}
          <section className="surface-card p-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold">Today's Picks</h3>
              <Link to="/catalog" search={{}} className="text-sm font-semibold text-sky">View All</Link>
            </div>
            <ul className="mt-3 space-y-3">
              {picks.map((item) => (
                <li key={item.name} className="flex items-center gap-3">
                  <span className="size-12 shrink-0 rounded-lg bg-muted" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{item.name}</p>
                    <p className="text-sm font-bold text-grape">{item.price}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <section className="mt-10">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-extrabold">Top Categories</h2>
            <Link to="/catalog" search={{}} className="text-sm font-semibold text-sky">View All</Link>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {topCategories.map((c) => (
              <Link key={c.label} to="/catalog" search={{ q: c.label }} className="lift-hover surface-card p-4">
                <div className="mb-3 h-24 rounded-lg bg-gradient-to-br from-muted to-accent" />
                <h3 className="text-sm font-bold">{c.label}</h3>
                <p className="text-xs text-muted-foreground">{c.count}</p>
              </Link>
            ))}
          </div>
        </section>

        <section className="my-12 grid gap-4 md:grid-cols-4">
          {[
            { label: "Customer app", to: "/login", body: "Shop, pay, track and earn rewards." },
            { label: "Become a Rider", to: "/become-a-rider", body: "Flexible hours, weekly payouts." },
            { label: "Become a Seller", to: "/become-a-seller", body: "Reach more customers, grow sales." },
            { label: "Medra Team", to: "/team", body: "Admin & support portal sign-in." },
          ].map((l) => (
            <Link key={l.to} to={l.to} className="lift-hover surface-card block p-5">
              <p className="text-sm font-bold">{l.label}</p>

              <p className="mt-1 text-sm text-muted-foreground">{l.body}</p>
              <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-primary">
                Open <ArrowRight className="size-4" />
              </span>
            </Link>
          ))}
        </section>
      </div>

      <footer className="hero-surface">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-10">
          <Logo tone="dark" size={40} />
          <p className="text-sm text-ink-foreground/70">
            © {new Date().getFullYear()} Medra. Shop Better. Live Better.
          </p>
        </div>
      </footer>
    </div>
  );
}
