import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { Bell, Heart, ImageIcon, MapPin, Package, Search, ShoppingCart, User } from "lucide-react";
import { Logo } from "./Logo";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useCartCount, useUnreadNotifications } from "@/lib/hooks";
import { formatNaira, imageUrl } from "@/lib/medra";
import { cn } from "@/lib/utils";

export function CustomerHeader({
  children,
  initialQuery = "",
}: {
  children?: ReactNode;
  initialQuery?: string;
}) {
  const navigate = useNavigate();
  const { session, roles } = useAuth();
  const [q, setQ] = useState(initialQuery);
  const staffDashboard = roles.includes("super_admin")
    ? "/super-admin"
    : roles.includes("admin")
      ? "/admin"
      : roles.includes("seller")
        ? "/seller"
        : roles.includes("rider")
          ? "/rider"
          : null;
  const cartCount = useCartCount();
  const unread = useUnreadNotifications();

  return (
    <header className="hero-surface">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-4 px-5 py-4">
        <Logo tone="dark" size={44} />

        <nav className="hidden items-center gap-5 text-sm font-semibold text-ink-foreground/85 xl:flex">
          <Link to="/catalog" className="rounded-lg bg-ink-foreground/10 px-3 py-2">
            Browse
          </Link>
          <Link to="/stores" className="hover:text-ink-foreground">
            Stores
          </Link>
          <Link to="/orders" className="hover:text-ink-foreground">
            My orders
          </Link>
          <Link to="/wallet" className="hover:text-ink-foreground">
            Rewards
          </Link>
          <Link to="/membership" className="hover:text-ink-foreground">
            Membership
          </Link>
          <Link to="/health/telehealth" className="hover:text-ink-foreground">
            Health
          </Link>
          <Link to="/community" className="hover:text-ink-foreground">
            Community
          </Link>
          <Link to="/appearance" className="hover:text-ink-foreground">
            Themes
          </Link>
          <Link to="/support" search={{ ticket: undefined }} className="hover:text-ink-foreground">
            Support
          </Link>

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
          <Link to="/favorites" aria-label="Saved items">
            <Heart className="size-5 text-ink-foreground/80" />
          </Link>
          <Link to="/notifications" className="relative" aria-label="Notifications">
            <Bell className="size-5 text-ink-foreground/80" />
            {!!unread.data && (
              <span className="absolute -right-2 -top-2 grid size-4 place-items-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
                {unread.data}
              </span>
            )}
          </Link>
          <Link to="/cart" className="relative" aria-label="Cart">
            <ShoppingCart className="size-5 text-ink-foreground/80" />
            {!!cartCount.data && (
              <span className="absolute -right-2 -top-2 grid size-4 place-items-center rounded-full bg-leaf text-[10px] font-bold text-leaf-foreground">
                {cartCount.data}
              </span>
            )}
          </Link>
          {session && staffDashboard && (
            <Link
              to={staffDashboard}
              className="hidden rounded-lg bg-ink-foreground/15 px-3 py-1.5 text-sm font-semibold sm:block"
            >
              My dashboard
            </Link>
          )}
          {session ? (
            <Link
              to="/account"
              className="flex items-center gap-2 rounded-lg border border-ink-foreground/25 px-3 py-1.5 text-sm font-semibold"
            >
              <User className="size-4" /> Account
            </Link>
          ) : (
            <Link
              to="/login"
              className="rounded-lg border border-ink-foreground/25 px-3 py-1.5 text-sm font-semibold"
            >
              Log in
            </Link>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-5 pb-6">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void navigate({ to: "/catalog", search: { q: q.trim() || undefined } });
          }}
          className="flex items-center gap-3 rounded-full bg-card px-4 py-2 shadow-lg"
        >
          <Search className="size-4 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-full bg-transparent py-1.5 text-sm outline-none placeholder:text-muted-foreground"
            placeholder="Search for products, stores and more..."
            aria-label="Search Medra"
          />
          <Button
            type="submit"
            size="sm"
            className="rounded-full bg-sky text-sky-foreground hover:bg-sky/90"
          >
            <Search className="size-4" />
          </Button>
        </form>
      </div>

      {children}
    </header>
  );
}

export function CustomerFooter() {
  return (
    <footer className="hero-surface mt-12">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-10">
        <Logo tone="dark" size={40} />
        <nav className="flex flex-wrap gap-5 text-sm font-semibold text-ink-foreground/80">
          <Link to="/catalog" className="hover:text-ink-foreground">
            Browse
          </Link>
          <Link to="/stores" className="hover:text-ink-foreground">
            Stores
          </Link>
          <Link to="/health/emergency" className="hover:text-ink-foreground">
            Emergency pharmacy
          </Link>
          <Link to="/health/prescriptions" className="hover:text-ink-foreground">
            Prescriptions
          </Link>
          <Link to="/become-a-rider" className="hover:text-ink-foreground">
            Become a Rider
          </Link>
          <Link to="/become-a-seller" className="hover:text-ink-foreground">
            Become a Seller
          </Link>
        </nav>
        <p className="text-sm text-ink-foreground/70">
          © {new Date().getFullYear()} Medra. Shop Better. Live Better.
        </p>
      </div>
    </footer>
  );
}

export function StoredImage({
  path,
  alt,
  className,
}: {
  path: string | null | undefined;
  alt: string;
  className?: string;
}) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void imageUrl(path).then((u) => {
      if (active) setUrl(u);
    });
    return () => {
      active = false;
    };
  }, [path]);

  if (!url) {
    return (
      <span
        className={cn(
          "grid place-items-center rounded-lg bg-muted text-muted-foreground",
          className,
        )}
      >
        <ImageIcon className="size-5" />
      </span>
    );
  }
  return <img src={url} alt={alt} loading="lazy" className={cn("object-cover", className)} />;
}

export type CatalogProduct = {
  id: string;
  name: string;
  price: number;
  image_path: string | null;
  stock_quantity: number;
  stores?: { name: string; slug: string } | null;
};

export function ProductCard({ product }: { product: CatalogProduct }) {
  return (
    <Link
      to="/product/$productId"
      params={{ productId: product.id }}
      className="lift-hover surface-card block overflow-hidden p-3"
    >
      <StoredImage
        path={product.image_path}
        alt={product.name}
        className="mb-3 h-32 w-full rounded-lg"
      />
      <p className="truncate text-sm font-semibold">{product.name}</p>
      {product.stores?.name && (
        <p className="truncate text-xs text-muted-foreground">{product.stores.name}</p>
      )}
      <div className="mt-1 flex items-center justify-between">
        <p className="text-sm font-bold text-grape">{formatNaira(product.price)}</p>
        <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <Package className="size-3" />
          {product.stock_quantity > 0 ? `${product.stock_quantity} left` : "Out of stock"}
        </span>
      </div>
    </Link>
  );
}
