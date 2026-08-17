import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

/* ---------------- labels ---------------- */

export const PRESCRIPTION_STATUS: Record<string, { label: string; tone: string }> = {
  pending_review: { label: "Pending review", tone: "bg-amber/20 text-amber" },
  more_info_needed: { label: "More info needed", tone: "bg-sky/15 text-sky" },
  approved: { label: "Approved", tone: "bg-leaf/15 text-leaf" },
  rejected: { label: "Rejected", tone: "bg-destructive/15 text-destructive" },
  expired: { label: "Expired", tone: "bg-muted text-muted-foreground" },
  fulfilled: { label: "Used on an order", tone: "bg-muted text-muted-foreground" },
};

export const CONSULTATION_STATUS: Record<string, { label: string; tone: string }> = {
  booked: { label: "Awaiting payment", tone: "bg-amber/20 text-amber" },
  confirmed: { label: "Confirmed", tone: "bg-leaf/15 text-leaf" },
  waiting: { label: "You're in the waiting room", tone: "bg-sky/15 text-sky" },
  in_progress: { label: "In progress", tone: "bg-sky/15 text-sky" },
  completed: { label: "Completed", tone: "bg-muted text-muted-foreground" },
  cancelled: { label: "Cancelled", tone: "bg-destructive/15 text-destructive" },
  no_show: { label: "Missed", tone: "bg-destructive/15 text-destructive" },
  refund_pending: { label: "Refund pending", tone: "bg-amber/20 text-amber" },
  refunded: { label: "Refunded", tone: "bg-muted text-muted-foreground" },
};

export function statusChip(map: Record<string, { label: string; tone: string }>, status: string) {
  return map[status] ?? { label: status.replace(/_/g, " "), tone: "bg-muted text-muted-foreground" };
}

/* ---------------- telehealth ---------------- */

export function useTelehealthServices() {
  return useQuery({
    queryKey: ["telehealth-services"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("telehealth_services")
        .select("id, key, label, professional_type, mode, price, duration_minutes")
        .eq("is_active", true)
        .order("price");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useHealthProfessionals(professionalType?: string) {
  return useQuery({
    queryKey: ["health-professionals", professionalType ?? "all"],
    queryFn: async () => {
      let query = supabase
        .from("health_professionals")
        .select(
          "id, full_name, professional_type, credentials, bio, specialties, consultation_modes, photo_path, is_available_now",
        )
        .eq("verification_status", "approved")
        .eq("is_active", true)
        .order("is_available_now", { ascending: false });
      if (professionalType) query = query.eq("professional_type", professionalType);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useProfessionalSlots(professionalId: string | null) {
  return useQuery({
    queryKey: ["professional-slots", professionalId],
    enabled: !!professionalId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("professional_availability")
        .select("id, starts_at, ends_at, mode, is_booked")
        .eq("professional_id", professionalId!)
        .eq("is_booked", false)
        .gt("starts_at", new Date().toISOString())
        .order("starts_at")
        .limit(40);
      if (error) throw error;
      return data ?? [];
    },
  });
}

const CONSULTATION_SELECT =
  "id, reference, mode, status, payment_status, price_charged, scheduled_at, created_at, customer_note, professional_note, cancel_reason, duration_minutes, health_professionals(id, full_name, professional_type, credentials), telehealth_services(label, duration_minutes)";

export function useMyConsultations() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["consultations", user?.id],
    enabled: !!user,
    refetchInterval: 30000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("consultations")
        .select(CONSULTATION_SELECT)
        .eq("customer_id", user!.id)
        .order("scheduled_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useConsultationMessages(consultationId: string | null) {
  return useQuery({
    queryKey: ["consultation-messages", consultationId],
    enabled: !!consultationId,
    refetchInterval: 10000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("consultation_messages")
        .select("id, body, sender_id, sender_role, created_at")
        .eq("consultation_id", consultationId!)
        .order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });
}

/* ---------------- pharmacies & prescriptions ---------------- */

export function usePharmacies() {
  return useQuery({
    queryKey: ["pharmacies"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stores")
        .select("id, name, slug, city, accepts_emergency_orders, is_open")
        .eq("store_type", "pharmacy")
        .eq("status", "approved")
        .eq("verification_status", "approved")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useMyPrescriptions() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["my-prescriptions", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prescriptions")
        .select(
          "id, status, file_path, file_type, prescriber_name, prescriber_contact, patient_note, review_note, reviewed_at, expires_at, created_at, store_id, stores(name, slug)",
        )
        .eq("customer_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function usePrescriptionEvents(prescriptionId: string | null) {
  return useQuery({
    queryKey: ["prescription-events", prescriptionId],
    enabled: !!prescriptionId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prescription_events")
        .select("id, status, note, actor_role, created_at")
        .eq("prescription_id", prescriptionId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Per-store prescription requirement for the signed-in customer's cart. */
export function useCartPrescriptionStatus() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["cart-prescription-status", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("cart_prescription_status");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export async function uploadPrescriptionFile(userId: string, file: File) {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from("prescriptions")
    .upload(path, file, file.type ? { contentType: file.type, upsert: false } : { upsert: false });
  if (error) throw error;
  return path;
}

export async function prescriptionFileUrl(path: string) {
  const { data, error } = await supabase.storage
    .from("prescriptions")
    .createSignedUrl(path, 60 * 10);
  if (error) throw error;
  return data.signedUrl;
}

/* ---------------- emergency pharmacy ---------------- */

export type EmergencyEligibility = {
  eligible: boolean;
  requires_prescription?: boolean;
  reasons: string[];
};

export function parseEligibility(value: unknown): EmergencyEligibility {
  const raw = (value ?? {}) as Record<string, unknown>;
  return {
    eligible: raw["eligible"] === true,
    requires_prescription: raw["requires_prescription"] === true,
    reasons: Array.isArray(raw["reasons"]) ? (raw["reasons"] as string[]) : [],
  };
}

export function useEmergencyProducts(search: string) {
  return useQuery({
    queryKey: ["emergency-products", search],
    refetchInterval: 30000,
    queryFn: async () => {
      let query = supabase
        .from("products")
        .select(
          "id, name, price, image_path, stock_quantity, seller_id, store_id, prescription_required, generic_name, strength, stores!inner(name, slug, city, store_type, accepts_emergency_orders, is_open, status, verification_status)",
        )
        .eq("emergency_eligible", true)
        .eq("status", "active")
        .gt("stock_quantity", 0)
        .eq("stores.store_type", "pharmacy")
        .eq("stores.accepts_emergency_orders", true)
        .eq("stores.is_open", true)
        .eq("stores.status", "approved")
        .eq("stores.verification_status", "approved")
        .order("name")
        .limit(48);
      if (search.trim()) query = query.ilike("name", `%${search.trim()}%`);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useEmergencyEligibility(productId: string | null) {
  return useQuery({
    queryKey: ["emergency-eligibility", productId],
    enabled: !!productId,
    refetchInterval: 20000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("emergency_eligibility", {
        _product_id: productId!,
      });
      if (error) throw error;
      return parseEligibility(data);
    },
  });
}

export function useEmergencyFeature() {
  return useQuery({
    queryKey: ["feature-flag", "emergency_pharmacy"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("feature_enabled", {
        _key: "emergency_pharmacy",
      });
      if (error) throw error;
      return data === true;
    },
  });
}

/* ---------------- live updates ---------------- */

/**
 * Subscribes to prescription, prescription-history and consultation changes and
 * refreshes the matching queries so review status updates land without a reload.
 */
export function useHealthRealtime() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!user) return;
    const invalidate = () => {
      void queryClient.invalidateQueries({ queryKey: ["my-prescriptions"] });
      void queryClient.invalidateQueries({ queryKey: ["pharmacy-prescriptions"] });
      void queryClient.invalidateQueries({ queryKey: ["prescription-events"] });
      void queryClient.invalidateQueries({ queryKey: ["cart-prescription-status"] });
      void queryClient.invalidateQueries({ queryKey: ["consultations"] });
      void queryClient.invalidateQueries({ queryKey: ["consultation-events"] });
    };
    const channel = supabase
      .channel(`health-live-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "prescriptions" }, invalidate)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "prescription_events" },
        invalidate,
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "consultations" }, invalidate)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "consultation_events" },
        invalidate,
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user, queryClient]);
}

/* ---------------- consultation lifecycle ---------------- */

export const CONSULTATION_EVENT_LABEL: Record<string, string> = {
  booked: "Appointment booked",
  payment_pending: "Awaiting payment",
  payment_paid: "Payment received",
  payment_refunded: "Payment refunded",
  payment_failed: "Payment failed",
  confirmed: "Confirmed by Medra",
  waiting: "You joined the waiting room",
  in_progress: "Consultation started",
  completed: "Consultation completed",
  cancelled: "Appointment cancelled",
  no_show: "Marked as missed",
  refund_pending: "Refund requested",
  refunded: "Refunded",
};

export function consultationEventLabel(status: string) {
  return CONSULTATION_EVENT_LABEL[status] ?? status.replace(/_/g, " ");
}

export function useConsultationEvents(consultationId: string | null) {
  return useQuery({
    queryKey: ["consultation-events", consultationId],
    enabled: !!consultationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("consultation_events")
        .select("id, status, note, actor_role, created_at")
        .eq("consultation_id", consultationId!)
        .order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });
}

/* ---------------- pharmacy dispatch queue ---------------- */

export function usePharmacyDispatchQueue(productId: string | null, quantity = 1) {
  return useQuery({
    queryKey: ["pharmacy-dispatch-queue", productId, quantity],
    enabled: !!productId,
    refetchInterval: 20000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("pharmacy_dispatch_queue", {
        _product_id: productId!,
        _quantity: quantity,
      });
      if (error) throw error;
      return data ?? [];
    },
  });
}

/* ---------------- review history export ---------------- */

type HistoryRow = {
  status: string;
  note: string | null;
  actor_role: string | null;
  created_at: string;
};

/** Builds a CSV of the immutable review trail and triggers a browser download. */
export function downloadReviewHistory(
  fileLabel: string,
  rows: HistoryRow[],
  meta: Record<string, string> = {},
) {
  const escape = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const lines: string[] = [];
  for (const [key, value] of Object.entries(meta)) lines.push([escape(key), escape(value)].join(","));
  if (lines.length) lines.push("");
  lines.push(["Recorded at", "Status", "Actor role", "Note"].map(escape).join(","));
  for (const row of rows) {
    lines.push(
      [row.created_at, row.status, row.actor_role ?? "", row.note ?? ""].map(escape).join(","),
    );
  }
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${fileLabel}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

/* ---------------- checkout re-verification ---------------- */

/** Re-asks the database for prescription requirements immediately before paying. */
export async function assertPrescriptionsClear() {
  const { data, error } = await supabase.rpc("cart_prescription_status");
  if (error) throw error;
  const blocking = (data ?? []).filter(
    (row) => row.requires_prescription && row.prescription_status !== "approved",
  );
  if (blocking.length > 0) {
    throw new Error(
      "A pharmacist still needs to approve a prescription for one of your pharmacies before this order can be paid",
    );
  }
}

/* ---------------- admin: pharmacy onboarding ---------------- */

export function usePharmacyApplications(status: string) {
  return useQuery({
    queryKey: ["pharmacy-applications", status],
    queryFn: async () => {
      let query = supabase
        .from("seller_applications")
        .select(
          "id, store_name, pharmacy_name, city, address, contact_phone, business_reg_number, description, status, review_note, reviewed_at, created_at, store_id, store_type, pharmacy_license_number, pharmacy_license_expiry, responsible_pharmacist_name, responsible_pharmacist_license, responsible_pharmacist_phone, operating_hours, document_paths",
        )
        .eq("store_type", "pharmacy")
        .order("created_at", { ascending: false })
        .limit(100);
      if (status !== "all") query = query.eq("status", status as "submitted");
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });
}

export async function applicationDocumentUrl(path: string) {
  const { data, error } = await supabase.storage
    .from("applications")
    .createSignedUrl(path, 60 * 10);
  if (error) throw error;
  return data.signedUrl;
}
