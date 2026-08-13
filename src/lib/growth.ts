import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

/* ------------------------------- membership ------------------------------- */

export type MembershipAudience = "customer" | "seller" | "rider";

export const SUBSCRIPTION_STATUS_TONE: Record<string, string> = {
  trialing: "bg-sky/15 text-sky",
  active: "bg-leaf/15 text-leaf",
  past_due: "bg-amber/20 text-amber",
  payment_failed: "bg-destructive/15 text-destructive",
  grace_period: "bg-amber/20 text-amber",
  paused: "bg-muted text-muted-foreground",
  cancelled: "bg-muted text-muted-foreground",
  expired: "bg-muted text-muted-foreground",
  suspended: "bg-destructive/15 text-destructive",
};

export const PROMOTION_STATUS_TONE: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  pending_approval: "bg-amber/20 text-amber",
  active: "bg-leaf/15 text-leaf",
  paused: "bg-sky/15 text-sky",
  ended: "bg-muted text-muted-foreground",
  rejected: "bg-destructive/15 text-destructive",
};

/** Plans the database is willing to show — only live, non-archived ones. */
export function useMembershipPlans(audience?: MembershipAudience) {
  return useQuery({
    queryKey: ["membership-plans", audience ?? "all"],
    queryFn: async () => {
      let query = supabase
        .from("membership_plans")
        .select(
          "id, name, audience, description, price, currency, billing_period, trial_days, benefits, max_members, display_order",
        )
        .order("display_order")
        .order("price");
      if (audience) query = query.eq("audience", audience);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}

export function useMySubscriptions() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["my-subscriptions", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscriptions")
        .select(
          "id, plan_id, audience, status, price_paid, currency, billing_period, benefits_snapshot, trial_end, current_period_end, next_billing_at, grace_until, cancel_at_period_end, expires_at, reference, created_at, membership_plans(name, price, audience)",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useMyMembershipInvoices() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["membership-invoices", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscription_invoices")
        .select("id, reference, amount, currency, status, provider, provider_status, requested_at, processed_at, failure_reason")
        .order("requested_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

/** Entitlements are resolved by the database from live subscriptions only. */
export function useMyEntitlements() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["my-entitlements", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("my_entitlements");
      if (error) throw error;
      return (data ?? {}) as Record<string, unknown>;
    },
  });
}

export function useStartMembership() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (planId: string) => {
      const { data, error } = await supabase.rpc("start_membership", { _plan_id: planId });
      if (error) throw error;
      return data as {
        status: string;
        subscription_id: string;
        payment_required: boolean;
        invoice_reference?: string;
        amount?: number;
        trial_end?: string;
      };
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["my-subscriptions"] });
      void queryClient.invalidateQueries({ queryKey: ["my-entitlements"] });
      void queryClient.invalidateQueries({ queryKey: ["membership-invoices"] });
    },
  });
}

export function useCancelMembership() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, immediate }: { id: string; immediate?: boolean }) => {
      const { data, error } = await supabase.rpc("cancel_membership", {
        _subscription_id: id,
        _immediate: immediate ?? false,
      });
      if (error) throw error;
      return data as { status: string; access_until: string | null; cancel_at_period_end: boolean };
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["my-subscriptions"] });
      void queryClient.invalidateQueries({ queryKey: ["my-entitlements"] });
    },
  });
}

/* -------------------------------- promotions ------------------------------- */

/** Live, publicly readable promotions. Row-level security does the filtering. */
export function usePublicPromotions() {
  return useQuery({
    queryKey: ["public-promotions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("promotions")
        .select(
          "id, name, description, kind, discount_value, max_discount, min_order, store_id, requires_membership, starts_at, ends_at, stores(name, slug)",
        )
        .order("priority")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useSellerPromotions(storeId?: string) {
  return useQuery({
    queryKey: ["seller-promotions", storeId],
    enabled: !!storeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("promotions")
        .select(
          "id, name, description, kind, discount_value, max_discount, min_order, quantity_limit, quantity_used, budget, budget_used, starts_at, ends_at, status, approval_note, created_at",
        )
        .eq("store_id", storeId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function usePromotionRedemptions(promotionIds: string[]) {
  return useQuery({
    queryKey: ["promotion-redemptions", promotionIds.join(",")],
    enabled: promotionIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("promotion_redemptions")
        .select("promotion_id, discount_amount, platform_funded, seller_funded")
        .in("promotion_id", promotionIds);
      if (error) throw error;
      return data;
    },
  });
}

export function useSetPromotionStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status, note }: { id: string; status: string; note?: string }) => {
      const { error } = await supabase.rpc("set_promotion_status", {
        _promotion_id: id,
        _status: status as never,
        ...(note === undefined ? {} : { _note: note }),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["seller-promotions"] });
      void queryClient.invalidateQueries({ queryKey: ["staff-promotions"] });
      void queryClient.invalidateQueries({ queryKey: ["public-promotions"] });
    },
  });
}

/* ---------------------------------- staff --------------------------------- */

export function useGrowthMetrics() {
  return useQuery({
    queryKey: ["growth-metrics"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("growth_metrics");
      if (error) throw error;
      return (data ?? {}) as Record<string, number | Record<string, number>>;
    },
  });
}

export function useStaffPromotions() {
  return useQuery({
    queryKey: ["staff-promotions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("promotions")
        .select(
          "id, name, kind, funding_source, discount_value, status, starts_at, ends_at, budget, budget_used, seller_id, stores(name)",
        )
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });
}

export function useCoupons() {
  return useQuery({
    queryKey: ["coupons"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coupons")
        .select(
          "id, code, description, discount_type, discount_value, funding_source, platform_funded_percent, min_order, max_discount, usage_limit, usage_count, per_user_limit, budget, budget_used, requires_membership, first_order_only, is_active, starts_at, ends_at, store_id",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useAllMembershipPlans() {
  return useQuery({
    queryKey: ["all-membership-plans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("membership_plans")
        .select(
          "id, name, audience, description, price, currency, billing_period, trial_days, benefits, entitlements, display_order, is_active, archived_at, max_members",
        )
        .order("audience")
        .order("display_order")
        .order("price");
      if (error) throw error;
      return data;
    },
  });
}

export function useSubscribers() {
  return useQuery({
    queryKey: ["subscribers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscriptions")
        .select("id, user_id, audience, status, price_paid, currency, current_period_end, created_at, membership_plans(name)")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });
}

/* -------------------------------- utilities ------------------------------- */

export const PROMOTION_KINDS = [
  { value: "percent_off", label: "Percentage off" },
  { value: "amount_off", label: "Fixed amount off" },
  { value: "product_discount", label: "Product discount" },
  { value: "store_discount", label: "Store-wide discount" },
  { value: "category_discount", label: "Category discount" },
  { value: "flash_deal", label: "Flash deal" },
] as const;

export const BILLING_PERIODS = [
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "yearly", label: "Yearly" },
] as const;

export function labelFor(value: string | null | undefined) {
  if (!value) return "—";
  return value.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}

export function discountLabel(kind: string, value: number) {
  const percentKinds = ["percent_off", "category_discount", "store_discount", "flash_deal", "member_discount"];
  return percentKinds.includes(kind) ? `${value}% off` : `₦${Number(value).toLocaleString()} off`;
}
