import { Link, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { LogOut, Menu } from "lucide-react";
import { Logo } from "./Logo";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export type NavItem = { label: string; to?: string; badge?: string | number };
export type NavGroup = { title?: string; items: NavItem[] };

function NavLinks({ groups, onNavigate }: { groups: NavGroup[]; onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <>
      {groups.map((group, gi) => (
        <div key={gi} className="space-y-1">
          {group.title && (
            <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-widest text-sidebar-foreground/50">
              {group.title}
            </p>
          )}
          {group.items.map((item) => {
            const active = item.to === pathname;
            const className = cn(
              "flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              active
                ? "bg-sidebar-primary text-sidebar-primary-foreground"
                : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            );
            const inner = (
              <>
                <span>{item.label}</span>
                {item.badge !== undefined && (
                  <span className="rounded-full bg-sidebar-accent px-2 py-0.5 text-[11px] font-bold text-sidebar-accent-foreground">
                    {item.badge}
                  </span>
                )}
              </>
            );
            if (!item.to) {
              return (
                <div key={item.label} className={cn(className, "opacity-60")}>
                  {inner}
                </div>
              );
            }
            return (
              <Link
                key={item.label}
                to={item.to}
                onClick={onNavigate}
                className={className}
              >
                {inner}
              </Link>
            );
          })}
        </div>
      ))}
    </>
  );
}

export function DashboardShell({
  groups,
  title,
  subtitle,
  topRight,
  footer,
  children,
  dark = false,
}: {
  groups: NavGroup[];
  title: string;
  subtitle?: string;
  topRight?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  dark?: boolean;
}) {
  const { user, signOut } = useAuth();

  return (
    <div className={cn("min-h-screen", dark ? "dark bg-background" : "bg-background")}>
      <div className="flex min-h-screen">
        <aside className="hidden w-64 shrink-0 flex-col gap-6 bg-sidebar px-4 py-6 lg:flex">
          <Link to="/">
            <Logo tone="dark" size={40} />
          </Link>
          <nav className="flex flex-1 flex-col gap-6 overflow-y-auto">
            <NavLinks groups={groups} />
          </nav>
          {footer}
          <div className="border-t border-sidebar-accent pt-4">
            {user?.email && (
              <p className="truncate px-3 pb-2 text-xs text-sidebar-foreground/60">{user.email}</p>
            )}
            <button
              onClick={() => void signOut()}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            >
              <LogOut className="size-4" /> Sign out
            </button>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border bg-card px-5 py-4">
            <div className="flex min-w-0 items-center gap-3">
              <Sheet>
                <SheetTrigger className="grid size-9 shrink-0 place-items-center rounded-lg border border-border lg:hidden">
                  <Menu className="size-4" />
                </SheetTrigger>
                <SheetContent side="left" className="w-72 bg-sidebar p-4">
                  <SheetHeader>
                    <SheetTitle className="text-sidebar-foreground">Menu</SheetTitle>
                  </SheetHeader>
                  <nav className="mt-4 flex flex-col gap-6 overflow-y-auto">
                    <NavLinks groups={groups} />
                  </nav>
                  <button
                    onClick={() => void signOut()}
                    className="mt-6 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-sidebar-foreground/80"
                  >
                    <LogOut className="size-4" /> Sign out
                  </button>
                </SheetContent>
              </Sheet>
              <div className="min-w-0">
                <h1 className="truncate text-xl font-bold">{title}</h1>
                {subtitle && (
                  <p className="truncate text-sm text-muted-foreground">{subtitle}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">{topRight}</div>
          </header>
          <main className="flex-1 space-y-5 p-5">{children}</main>
          <footer className="border-t border-border px-5 py-4 text-xs text-muted-foreground">
            Medra platform ·{" "}
            <Link to="/" className="font-semibold text-primary hover:underline">
              Back to marketplace
            </Link>
          </footer>
        </div>
      </div>
    </div>
  );
}

export function StatCard({
  label,
  value,
  delta,
  deltaTone = "up",
  icon,
  tone = "sky",
}: {
  label: string;
  value: string;
  delta?: string;
  deltaTone?: "up" | "down" | "neutral";
  icon?: ReactNode;
  tone?: "leaf" | "sky" | "amber" | "grape";
}) {
  const toneBg = {
    leaf: "bg-leaf/15 text-leaf",
    sky: "bg-sky/15 text-sky",
    amber: "bg-amber/20 text-amber",
    grape: "bg-grape/15 text-grape",
  }[tone];

  return (
    <div className="surface-card p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        {icon && (
          <span className={cn("grid size-9 place-items-center rounded-xl", toneBg)}>
            {icon}
          </span>
        )}
      </div>
      <p className="mt-2 text-2xl font-extrabold tracking-tight">{value}</p>
      {delta && (
        <p
          className={cn(
            "mt-1 text-xs font-semibold",
            deltaTone === "up" && "text-leaf",
            deltaTone === "down" && "text-destructive",
            deltaTone === "neutral" && "text-muted-foreground",
          )}
        >
          {delta}
        </p>
      )}
    </div>
  );
}

export function Panel({
  title,
  action,
  children,
  className,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("surface-card p-4", className)}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-base font-bold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}
