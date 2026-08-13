import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import type { NavGroup } from "@/components/medra/DashboardShell";

/* ---------------------------------- nav ---------------------------------- */

export const SELLER_NAV: NavGroup[] = [
  {
    items: [
      { label: "Overview", to: "/seller" },
      { label: "Orders", to: "/seller/orders" },
      { label: "Products", to: "/seller/products" },
      { label: "Inventory", to: "/seller/inventory" },
    ],
  },
  {
    title: "Finance",
    items: [
      { label: "Earnings", to: "/seller/earnings" },
      { label: "Transactions", to: "/seller/transactions" },
      { label: "Payouts", to: "/seller/payouts" },
    ],
  },
  {
    title: "Store",
    items: [
      { label: "Store profile", to: "/seller/store" },
      { label: "Reviews", to: "/seller/reviews" },
      { label: "Notifications", to: "/notifications" },
      { label: "Support", to: "/team" },
    ],
  },
];

export const RIDER_NAV: NavGroup[] = [
  {
    items: [
      { label: "Overview", to: "/rider" },
      { label: "Available deliveries", to: "/rider/available" },
      { label: "Active delivery", to: "/rider/active" },
      { label: "Delivery history", to: "/rider/history" },
    ],
  },
  {
    title: "Finance",
    items: [
      { label: "Earnings", to: "/rider/earnings" },
      { label: "Payouts", to: "/rider/payouts" },
    ],
  },
  {
    title: "Account",
    items: [
      { label: "Performance", to: "/rider/performance" },
      { label: "Notifications", to: "/notifications" },
      { label: "Support", to: "/team" },
    ],
  },
];

export const ADMIN_NAV: NavGroup[] = [
  {
    items: [
      { label: "Overview", to: "/admin" },
      { label: "Orders", to: "/admin/orders" },
      { label: "Deliveries", to: "/admin/deliveries" },
    ],
  },
  {
    title: "Approvals",
    items: [
      { label: "Seller approvals", to: "/admin/seller-approvals" },
      { label: "Rider approvals", to: "/admin/rider-approvals" },
    ],
  },
  {
    title: "Money",
    items: [
      { label: "Payments", to: "/admin/payments" },
      { label: "Refunds", to: "/admin/refunds" },
      { label: "Payouts", to: "/admin/payouts" },
    ],
  },
  {
    title: "Safety & support",
    items: [
      { label: "SOS incidents", to: "/admin/sos" },
      { label: "Late deliveries", to: "/admin/late-deliveries" },
      { label: "Support inbox", to: "/admin/support" },
    ],
  },
];

export const SUPER_ADMIN_NAV: NavGroup[] = [
  { items: [{ label: "Executive overview", to: "/super-admin" }] },
  {
    title: "Governance",
    items: [
      { label: "Administrators", to: "/super-admin/admins" },
      { label: "Roles & permissions", to: "/super-admin/permissions" },
      { label: "Audit logs", to: "/super-admin/audit" },
    ],
  },
  {
    title: "Platform",
    items: [
      { label: "Commission engine", to: "/super-admin/commission" },
      { label: "Categories", to: "/super-admin/categories" },
      { label: "Feature controls", to: "/super-admin/features" },
    ],
  },
  {
    title: "Operations",
    items: [
      { label: "Admin console", to: "/admin" },
      { label: "Notifications", to: "/notifications" },
    ],
  },
];

/* -------------------------------- finance -------------------------------- */

export type Balance = {
  pending: number;
  available: number;
  paid_out: number;
  lifetime: number;
  requested: number;
};

/** Ledger-derived balance for the signed-in seller or rider. */
export function useMyBalance() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["my-balance", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<Balance> => {
      const { data, error } = await supabase.rpc("my_balance");
      if (error) throw error;
      const row = (data as Balance[] | null)?.[0];
      return {
        pending: Number(row?.pending ?? 0),
        available: Number(row?.available ?? 0),
        paid_out: Number(row?.paid_out ?? 0),
        lifetime: Number(row?.lifetime ?? 0),
        requested: Number(row?.requested ?? 0),
      };
    },
  });
}

export function usePayoutAccounts() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["payout-accounts", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payout_accounts")
        .select("id, bank_name, account_name, account_number, status, is_default")
        .eq("user_id", user!.id)
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });
}

export function usePayoutRequests() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["payout-requests", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payout_requests")
        .select("id, amount, status, reference, review_note, created_at, paid_at")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useMyLedger() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["my-ledger", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ledger_entries")
        .select("id, kind, amount, percentage, rule, payout_status, created_at, order_id, delivery_id")
        .eq("beneficiary_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data;
    },
  });
}

export const PAYOUT_STATUS_TONE: Record<string, string> = {
  requested: "bg-amber/20 text-amber",
  under_review: "bg-sky/15 text-sky",
  approved: "bg-sky/15 text-sky",
  processing: "bg-sky/15 text-sky",
  paid: "bg-leaf/15 text-leaf",
  rejected: "bg-destructive/15 text-destructive",
  failed: "bg-destructive/15 text-destructive",
};

export const REFUND_STATUS_TONE: Record<string, string> = {
  requested: "bg-amber/20 text-amber",
  under_review: "bg-sky/15 text-sky",
  more_info_needed: "bg-amber/20 text-amber",
  approved: "bg-leaf/15 text-leaf",
  partially_approved: "bg-leaf/15 text-leaf",
  refunded: "bg-leaf/15 text-leaf",
  processing: "bg-sky/15 text-sky",
  escalated: "bg-grape/15 text-grape",
  rejected: "bg-destructive/15 text-destructive",
};

export function statusLabel(value: string) {
  return value.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}

export const INVENTORY_KINDS = [
  { value: "stock_added", label: "Stock added" },
  { value: "manual_adjustment", label: "Manual adjustment" },
  { value: "damage", label: "Damage" },
  { value: "expired", label: "Expired" },
  { value: "correction", label: "Correction" },
];

export const REFUND_REASONS = [
  "Wrong Item",
  "Missing Item",
  "Damaged Item",
  "Item Not As Described",
  "Order Never Arrived",
  "Incorrect Quantity",
  "Quality Issue",
  "Other",
];

export function stockStatus(stock: number, threshold: number) {
  if (stock <= 0) return { label: "Out of stock", tone: "bg-destructive/15 text-destructive" };
  if (stock <= threshold) return { label: "Low stock", tone: "bg-amber/20 text-amber" };
  return { label: "In stock", tone: "bg-leaf/15 text-leaf" };
}
