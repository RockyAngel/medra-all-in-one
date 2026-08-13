import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { jsonResult, supabaseForUser, toolError, unauthenticated } from "../supabase";

export default defineTool({
  name: "get_order_status",
  title: "Get my Medra order status",
  description:
    "Fetch one of the signed-in customer's orders with its items and delivery progress. Accepts an order id or order number.",
  inputSchema: {
    order: z.string().trim().min(1).describe("Order id (uuid) or human order number."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ order }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const supabase = supabaseForUser(ctx);
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(order);

    const query = supabase
      .from("orders")
      .select(
        "id, order_number, status, payment_status, subtotal, delivery_fee, total, currency, created_at, completed_at, order_items(product_name, quantity, unit_price, variant_label)",
      );

    const { data, error } = await (isUuid
      ? query.eq("id", order)
      : query.eq("order_number", order)
    ).maybeSingle();

    if (error) return toolError(error.message);
    if (!data) return toolError("No order found for that id or number on your account.");

    const { data: deliveries, error: deliveryError } = await supabase
      .from("deliveries")
      .select("id, status, assigned_at, picked_up_at, delivered_at, attempt_number")
      .eq("order_id", data.id);

    if (deliveryError) return toolError(deliveryError.message);
    return jsonResult({ order: data, deliveries: deliveries ?? [] });
  },
});
