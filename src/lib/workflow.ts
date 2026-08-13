import { supabase } from "@/integrations/supabase/client";

/** Full order lifecycle labels — the DB is the single source of truth for status. */
export const ORDER_STATUS_LABELS: Record<string, string> = {
  pending_payment: "Payment pending",
  payment_failed: "Payment failed",
  paid: "Paid",
  confirmed: "Order confirmed",
  seller_reviewing: "Seller reviewing",
  accepted_by_seller: "Accepted by seller",
  preparing: "Preparing",
  ready_for_pickup: "Ready for pickup",
  rider_assignment: "Finding a rider",
  rider_assigned: "Rider assigned",
  rider_en_route_to_seller: "Rider heading to store",
  rider_arrived_at_seller: "Rider at store",
  picked_up: "Picked up",
  out_for_delivery: "Out for delivery",
  in_transit: "Out for delivery",
  rider_arrived_at_customer: "Rider has arrived",
  delivery_verification: "Delivery verification",
  delivered: "Delivered",
  completed: "Completed",
  seller_rejected: "Rejected by seller",
  cancelled: "Cancelled",
  refund_pending: "Refund pending",
  refunded: "Refunded",
  delivery_failed: "Delivery failed",
  disputed: "Disputed",
};

export const FULFILLMENT_LABELS: Record<string, string> = {
  pending: "Awaiting payment",
  seller_reviewing: "Needs your review",
  accepted: "Accepted",
  rejected: "Rejected",
  preparing: "Preparing",
  ready_for_pickup: "Ready for pickup",
  picked_up: "Picked up by rider",
  delivered: "Delivered",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const ACTIVE_ORDER_STATUSES = [
  "pending_payment",
  "paid",
  "confirmed",
  "seller_reviewing",
  "accepted_by_seller",
  "preparing",
  "ready_for_pickup",
  "rider_assignment",
  "rider_assigned",
  "rider_en_route_to_seller",
  "rider_arrived_at_seller",
  "picked_up",
  "out_for_delivery",
  "in_transit",
  "rider_arrived_at_customer",
  "delivery_verification",
];

export const CLOSED_ORDER_STATUSES = ["delivered", "completed"];
export const CANCELLED_ORDER_STATUSES = [
  "cancelled",
  "seller_rejected",
  "payment_failed",
  "refund_pending",
  "refunded",
  "delivery_failed",
  "disputed",
];

export const REJECTION_REASONS = [
  { value: "item_unavailable", label: "Item unavailable" },
  { value: "unable_to_fulfil", label: "Store unable to fulfil" },
  { value: "inventory_issue", label: "Inventory issue" },
  { value: "closing_emergency", label: "Closing / emergency" },
  { value: "other", label: "Other" },
];

export const SUPPORT_CATEGORIES = [
  { value: "order", label: "Order or delivery issue" },
  { value: "payment", label: "Payment, refund or wallet" },
  { value: "seller", label: "Selling on Medra" },
  { value: "rider", label: "Riding with Medra" },
  { value: "safety", label: "Safety or trust concern" },
  { value: "account", label: "Account and access" },
  { value: "other", label: "Something else" },
];

export const SOS_KINDS = [
  { value: "accident", label: "Accident" },
  { value: "medical", label: "Medical emergency" },
  { value: "unsafe_area", label: "Dangerous situation" },
  { value: "vehicle", label: "Vehicle emergency" },
  { value: "other", label: "Other serious safety issue" },
];

export type DeliveryQuote =
  | { configured: true; fee: number; is_peak: boolean; zone: string; rider_percent: number; platform_percent: number; rider_amount: number; platform_amount: number; rule: string }
  | { configured: false; reason: string };

export async function quoteDeliveryFee(city: string | null | undefined): Promise<DeliveryQuote> {
  const { data, error } = await supabase.rpc("quote_delivery_fee", { _city: city ?? "" });
  if (error) throw error;
  return data as unknown as DeliveryQuote;
}

/** Friendly text for the errors the workflow functions raise. */
export function workflowError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (message.startsWith("DELIVERY_UNAVAILABLE:")) return message.replace("DELIVERY_UNAVAILABLE:", "").trim();
  if (message.startsWith("OUT_OF_STOCK:")) return message.replace("OUT_OF_STOCK:", "").trim();
  if (message.startsWith("PRODUCT_UNAVAILABLE:")) return message.replace("PRODUCT_UNAVAILABLE:", "").trim();
  if (message.startsWith("INVALID_CODE:")) return message.replace("INVALID_CODE:", "").trim();
  return message;
}

/** Seller pricing rule: sellers enter what they want to receive; customers pay +10%. */
export const PLATFORM_MARKUP_PERCENT = 10;

export function customerPriceFromSellerPrice(sellerPrice: number) {
  return Math.round(sellerPrice * (1 + PLATFORM_MARKUP_PERCENT / 100) * 100) / 100;
}

export async function uploadDocuments(files: File[], folder: string) {
  const paths: string[] = [];
  for (const file of files) {
    const ext = file.name.split(".").pop() ?? "bin";
    const path = `${folder}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("product-images").upload(path, file);
    if (error) throw error;
    paths.push(path);
  }
  return paths;
}
