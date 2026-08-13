import { supabase } from "@/integrations/supabase/client";

export const POINTS_PER_NAIRA = 0.01; // 1 point per ₦100 spent
export const POINT_VALUE_NAIRA = 1; // 1 point redeems for ₦1
export const DELIVERY_FEE = 800;

export function formatNaira(value: number | string | null | undefined) {
  const amount = Number(value ?? 0);
  return `₦${amount.toLocaleString("en-NG", { maximumFractionDigits: 2 })}`;
}

export function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-NG", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export const ORDER_STATUS_LABEL: Record<string, string> = {
  pending_payment: "Awaiting payment",
  paid: "Paid",
  preparing: "Being prepared",
  ready_for_pickup: "Ready for pickup",
  in_transit: "On the way",
  delivered: "Delivered",
  cancelled: "Cancelled",
  refunded: "Refunded",
};

const signedUrlCache = new Map<string, string>();

export async function imageUrl(path: string | null | undefined) {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  const cached = signedUrlCache.get(path);
  if (cached) return cached;
  const { data } = await supabase.storage.from("product-images").createSignedUrl(path, 60 * 60);
  if (data?.signedUrl) {
    signedUrlCache.set(path, data.signedUrl);
    return data.signedUrl;
  }
  return null;
}

export async function getOrCreateCart(userId: string) {
  const existing = await supabase.from("carts").select("id").eq("user_id", userId).maybeSingle();
  if (existing.data) return existing.data.id;
  const created = await supabase.from("carts").insert({ user_id: userId }).select("id").single();
  if (created.error) throw created.error;
  return created.data.id;
}

export async function getOrCreateWallet(userId: string) {
  const existing = await supabase
    .from("wallets")
    .select("id, points_balance")
    .eq("user_id", userId)
    .maybeSingle();
  if (existing.data) return existing.data;
  const created = await supabase
    .from("wallets")
    .insert({ user_id: userId })
    .select("id, points_balance")
    .single();
  if (created.error) throw created.error;
  return created.data;
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
