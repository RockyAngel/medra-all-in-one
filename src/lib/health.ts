import { useQuery } from "@tanstack/react-query";
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
  const { error } = await supabase.storage.from("prescriptions").upload(path, file, {
    contentType: file.type || undefined,
    upsert: false,
  });
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
