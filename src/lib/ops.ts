/**
 * Data hooks for the operational dashboards (seller, rider, admin, super admin).
 * Every read here goes straight to the database through RLS — no demo data.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useMyStore } from "@/lib/hooks";

/* ------------------------------- seller ---------------------------------- */

export function useSellerFulfillments(status?: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["seller-fulfillments", user?.id, status ?? "all"],
    enabled: !!user,
    queryFn: async () => {
      let query = supabase
        .from("order_fulfillments")
        .select(
          "id, status, items_subtotal, seller_amount, platform_amount, is_emergency, customer_note, rejection_reason, rejection_note, created_at, order_id, orders(order_number, status, total, created_at)",
        )
        .eq("seller_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(100);
      if (status && status !== "all") query = query.eq("status", status as "pending");
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useSellerProducts() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["seller-products", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select(
          "id, name, status, price, seller_price, stock_quantity, low_stock_threshold, reserved_quantity, sku, image_path, is_medication, prescription_required, created_at",
        )
        .eq("seller_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useInventoryMovements() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["inventory-movements", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_movements")
        .select("id, kind, quantity_delta, resulting_stock, reason, created_at, products(name)")
        .eq("seller_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useInventoryBatches() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["inventory-batches", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_batches")
        .select("id, batch_number, quantity, expiry_date, received_at, note, products(name)")
        .eq("seller_id", user!.id)
        .order("expiry_date", { ascending: true })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useStoreReviews() {
  const store = useMyStore();
  const storeId = store.data?.id;
  const query = useQuery({
    queryKey: ["store-reviews", storeId],
    enabled: !!storeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reviews")
        .select("id, rating, comment, status, seller_response, responded_at, created_at, products(name)")
        .eq("store_id", storeId!)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });
  return { ...query, store };
}

/* -------------------------------- rider ---------------------------------- */

export function useRiderProfile() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["rider-profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rider_profiles")
        .select(
          "user_id, is_online, is_available, is_suspended, status, vehicle_type, vehicle_plate, service_city, active_assignments, max_assignments, location_updated_at",
        )
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useRiderOffers() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["rider-offers", user?.id],
    enabled: !!user,
    refetchInterval: 20_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("delivery_offers")
        .select(
          "id, status, expires_at, pickup_distance_km, created_at, delivery_id, deliveries(id, fee_total, rider_amount, is_peak, is_priority, distance_meters, status, stores(name, city, address))",
        )
        .eq("rider_id", user!.id)
        .eq("status", "offered")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
  });
}

const RIDER_ACTIVE_STATUSES = [
  "assigned",
  "en_route_to_seller",
  "arrived_at_seller",
  "picked_up",
  "out_for_delivery",
  "arrived_at_customer",
  "delivery_verification",
];

export function useRiderDeliveries(kind: "active" | "history") {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["rider-deliveries", user?.id, kind],
    enabled: !!user,
    queryFn: async () => {
      let query = supabase
        .from("deliveries")
        .select(
          "id, status, milestone, fee_total, rider_amount, is_peak, is_priority, distance_meters, assigned_at, picked_up_at, delivered_at, eta_at, expected_delivery_at, failure_reason, created_at, order_id, orders(order_number, address_snapshot, total), stores(name, city, address, pickup_notes)",
        )
        .eq("rider_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(100);
      query =
        kind === "active"
          ? query.in("status", RIDER_ACTIVE_STATUSES)
          : query.in("status", ["delivered", "completed", "cancelled", "delivery_failed", "failed"]);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });
}

/* -------------------------------- admin ---------------------------------- */

export function useAdminOrders(status: string) {
  return useQuery({
    queryKey: ["admin-orders", status],
    queryFn: async () => {
      let query = supabase
        .from("orders")
        .select(
          "id, order_number, status, payment_status, total, subtotal, delivery_fee, is_emergency, created_at, customer_id",
        )
        .order("created_at", { ascending: false })
        .limit(100);
      if (status !== "all") query = query.eq("status", status as "paid");
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useAdminDeliveries() {
  return useQuery({
    queryKey: ["admin-deliveries"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deliveries")
        .select(
          "id, status, milestone, rider_id, fee_total, rider_amount, platform_amount, is_peak, is_priority, assigned_at, delivered_at, expected_delivery_at, created_at, orders(order_number), stores(name, city)",
        )
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useSellerApplications(status: string) {
  return useQuery({
    queryKey: ["seller-applications", status],
    queryFn: async () => {
      let query = supabase
        .from("seller_applications")
        .select(
          "id, store_name, store_type, city, address, contact_phone, business_reg_number, description, status, review_note, reviewed_at, created_at, document_paths",
        )
        .neq("store_type", "pharmacy")
        .order("created_at", { ascending: false })
        .limit(100);
      if (status !== "all") query = query.eq("status", status as "submitted");
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useRiderApplications(status: string) {
  return useQuery({
    queryKey: ["rider-applications", status],
    queryFn: async () => {
      let query = supabase
        .from("rider_applications")
        .select(
          "id, full_name, phone, city, vehicle_type, vehicle_plate, has_smartphone, emergency_contact_name, emergency_contact_phone, status, review_note, reviewed_at, created_at, document_paths",
        )
        .order("created_at", { ascending: false })
        .limit(100);
      if (status !== "all") query = query.eq("status", status as "submitted");
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useAdminPayments() {
  return useQuery({
    queryKey: ["admin-payments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("id, provider, provider_reference, amount, status, created_at, orders(order_number, status)")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useAdminRefunds(status: string) {
  return useQuery({
    queryKey: ["admin-refunds", status],
    queryFn: async () => {
      let query = supabase
        .from("refund_requests")
        .select(
          "id, scope, amount_requested, amount_approved, reason, details, destination, status, decision_note, reviewed_at, created_at, orders(order_number)",
        )
        .order("created_at", { ascending: false })
        .limit(100);
      if (status !== "all") query = query.eq("status", status);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useAdminPayouts(status: string) {
  return useQuery({
    queryKey: ["admin-payouts", status],
    queryFn: async () => {
      let query = supabase
        .from("payout_requests")
        .select("id, role, amount, status, reference, review_note, reviewed_at, paid_at, created_at, user_id")
        .order("created_at", { ascending: false })
        .limit(100);
      if (status !== "all") query = query.eq("status", status);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useSosIncidents() {
  return useQuery({
    queryKey: ["sos-incidents"],
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sos_incidents")
        .select("id, kind, note, status, latitude, longitude, acknowledged_at, created_at, rider_id, delivery_id")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useLateDeliveries() {
  return useQuery({
    queryKey: ["late-deliveries"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("late_delivery_events")
        .select(
          "id, delay_minutes, status, admin_note, expected_at, detected_at, created_at, orders(order_number), deliveries(status)",
        )
        .order("detected_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });
}

/* ----------------------------- super admin ------------------------------- */

export function useAdministrators() {
  return useQuery({
    queryKey: ["administrators"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("id, user_id, role, created_at")
        .in("role", ["admin", "super_admin"])
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      const rows = data ?? [];
      if (rows.length === 0) return [];
      const profiles = await supabase
        .from("profiles")
        .select("id, first_name, last_name, email")
        .in("id", [...new Set(rows.map((r) => r.user_id))]);
      if (profiles.error) throw profiles.error;
      const byId = new Map((profiles.data ?? []).map((p) => [p.id, p]));
      return rows.map((r) => ({ ...r, profile: byId.get(r.user_id) ?? null }));
    },
  });
}


export function useRolePermissions() {
  return useQuery({
    queryKey: ["role-permissions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("role_permissions")
        .select("id, role, permission, enabled")
        .order("role");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useAdminPermissions() {
  return useQuery({
    queryKey: ["admin-permissions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_permissions")
        .select("id, user_id, permission, enabled, created_at")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useAuditLogs(entity: string) {
  return useQuery({
    queryKey: ["audit-logs", entity],
    queryFn: async () => {
      let query = supabase
        .from("audit_logs")
        .select("id, action, entity, entity_id, actor_id, actor_role, reason, metadata, created_at")
        .order("created_at", { ascending: false })
        .limit(200);
      if (entity !== "all") query = query.eq("entity", entity);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCommissionRules() {
  return useQuery({
    queryKey: ["commission-rules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("commission_rules")
        .select("id, scope, percent, category_id, seller_id, is_active, effective_from, created_at, categories(name)")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useAllCategories() {
  return useQuery({
    queryKey: ["all-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("id, name, slug, icon, sort_order, is_active, parent_id")
        .order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });
}

/* ------------------------------ overviews -------------------------------- */

export function useSellerOverview() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["seller-overview", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [fulfillments, products, ledger] = await Promise.all([
        supabase
          .from("order_fulfillments")
          .select("id, status, items_subtotal, seller_amount, created_at")
          .eq("seller_id", user!.id)
          .limit(500),
        supabase
          .from("products")
          .select("id, status, stock_quantity, low_stock_threshold")
          .eq("seller_id", user!.id)
          .limit(500),
        supabase
          .from("ledger_entries")
          .select("amount, kind, payout_status")
          .eq("beneficiary_id", user!.id)
          .limit(1000),
      ]);
      if (fulfillments.error) throw fulfillments.error;
      if (products.error) throw products.error;
      if (ledger.error) throw ledger.error;
      const rows = fulfillments.data ?? [];
      const items = products.data ?? [];
      return {
        orders: rows.length,
        needsAction: rows.filter((r) => r.status === "seller_reviewing").length,
        preparing: rows.filter((r) => ["accepted", "preparing", "ready_for_pickup"].includes(r.status))
          .length,
        earnings: (ledger.data ?? [])
          .filter((l) => l.kind === "seller_product_earning")
          .reduce((sum, l) => sum + Number(l.amount ?? 0), 0),
        activeProducts: items.filter((p) => p.status === "active").length,
        lowStock: items.filter(
          (p) => Number(p.stock_quantity ?? 0) <= Number(p.low_stock_threshold ?? 0),
        ).length,
      };
    },
  });
}

export function useRiderOverview() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["rider-overview", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [deliveries, ledger] = await Promise.all([
        supabase
          .from("deliveries")
          .select("id, status, delivered_at, rider_amount, created_at")
          .eq("rider_id", user!.id)
          .limit(500),
        supabase
          .from("ledger_entries")
          .select("amount, kind, payout_status")
          .eq("beneficiary_id", user!.id)
          .limit(1000),
      ]);
      if (deliveries.error) throw deliveries.error;
      if (ledger.error) throw ledger.error;
      const rows = deliveries.data ?? [];
      const today = new Date().toDateString();
      return {
        completed: rows.filter((r) => ["delivered", "completed"].includes(r.status)).length,
        active: rows.filter((r) => RIDER_ACTIVE_STATUSES.includes(r.status)).length,
        failed: rows.filter((r) => ["cancelled", "delivery_failed", "failed"].includes(r.status)).length,
        todayEarnings: rows
          .filter((r) => r.delivered_at && new Date(r.delivered_at).toDateString() === today)
          .reduce((sum, r) => sum + Number(r.rider_amount ?? 0), 0),
        lifetime: (ledger.data ?? [])
          .filter((l) => l.kind === "rider_delivery_earning")
          .reduce((sum, l) => sum + Number(l.amount ?? 0), 0),
      };
    },
  });
}

export function useAdminOverview() {
  return useQuery({
    queryKey: ["admin-overview"],
    queryFn: async () => {
      const count = async (
        table:
          | "orders"
          | "stores"
          | "deliveries"
          | "seller_applications"
          | "rider_applications"
          | "refund_requests"
          | "payout_requests"
          | "sos_incidents"
          | "support_tickets",
      ) => {
        const { count: value, error } = await supabase
          .from(table)
          .select("id", { count: "exact", head: true });
        if (error) throw error;
        return value ?? 0;
      };

      const [orders, stores, deliveries, sellerApps, riderApps, refunds, payouts, sos, tickets] =
        await Promise.all([
          count("orders"),
          count("stores"),
          count("deliveries"),
          count("seller_applications"),
          count("rider_applications"),
          count("refund_requests"),
          count("payout_requests"),
          count("sos_incidents"),
          count("support_tickets"),
        ]);
      const revenue = await supabase.from("orders").select("total, status").limit(1000);
      if (revenue.error) throw revenue.error;
      return {
        orders,
        stores,
        deliveries,
        sellerApps,
        riderApps,
        refunds,
        payouts,
        sos,
        tickets,
        gmv: (revenue.data ?? [])
          .filter((o) => !["pending_payment", "payment_failed", "cancelled"].includes(o.status))
          .reduce((sum, o) => sum + Number(o.total ?? 0), 0),
      };
    },
  });
}
