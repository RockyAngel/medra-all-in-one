import type { ReactNode } from "react";
import { DashboardShell } from "./DashboardShell";
import { RequireRole } from "./RequireRole";
import { ADMIN_NAV, RIDER_NAV, SELLER_NAV, SUPER_ADMIN_NAV } from "@/lib/dashboard";
import { cn } from "@/lib/utils";

type PageProps = {
  title: string;
  subtitle?: string;
  topRight?: ReactNode;
  children: ReactNode;
};

export function SellerPage({ title, subtitle, topRight, children }: PageProps) {
  return (
    <RequireRole roles={["seller"]}>
      <DashboardShell
        groups={SELLER_NAV}
        title={title}
        {...(subtitle === undefined ? {} : { subtitle })}
        {...(topRight === undefined ? {} : { topRight })}
      >
        {children}
      </DashboardShell>
    </RequireRole>
  );
}

export function RiderPage({ title, subtitle, topRight, children }: PageProps) {
  return (
    <RequireRole roles={["rider"]}>
      <DashboardShell
        dark
        groups={RIDER_NAV}
        title={title}
        {...(subtitle === undefined ? {} : { subtitle })}
        {...(topRight === undefined ? {} : { topRight })}
      >
        {children}
      </DashboardShell>
    </RequireRole>
  );
}

export function AdminPage({ title, subtitle, topRight, children }: PageProps) {
  return (
    <RequireRole roles={["admin", "super_admin"]}>
      <DashboardShell
        groups={ADMIN_NAV}
        title={title}
        {...(subtitle === undefined ? {} : { subtitle })}
        {...(topRight === undefined ? {} : { topRight })}
      >
        {children}
      </DashboardShell>
    </RequireRole>
  );
}

export function SuperAdminPage({ title, subtitle, topRight, children }: PageProps) {
  return (
    <RequireRole roles={["super_admin"]}>
      <DashboardShell
        dark
        groups={SUPER_ADMIN_NAV}
        title={title}
        {...(subtitle === undefined ? {} : { subtitle })}
        {...(topRight === undefined ? {} : { topRight })}
      >
        {children}
      </DashboardShell>
    </RequireRole>
  );
}

/** Compact table used across the operational dashboards. */
export function DataTable({
  columns,
  children,
  className,
}: {
  columns: string[];
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
            {columns.map((c) => (
              <th key={c} className="pb-2 pr-4 font-semibold">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">{children}</tbody>
      </table>
    </div>
  );
}

export function Pill({ tone, children }: { tone?: string; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-1 text-xs font-bold",
        tone ?? "bg-muted text-muted-foreground",
      )}
    >
      {children}
    </span>
  );
}
