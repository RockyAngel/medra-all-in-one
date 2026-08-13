import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { jsonResult, supabaseForUser, toolError, unauthenticated } from "../supabase";

export default defineTool({
  name: "list_my_orders",
  title: "List my Medra orders",
  description:
    "List the signed-in customer's Medra orders, newest first, with status and totals.",
  inputSchema: {
    limit: z.number().int().min(1).max(50).optional().describe("Maximum orders (default 10)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("orders")
      .select(
        "id, order_number, status, payment_status, subtotal, delivery_fee, total, currency, is_emergency, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(limit ?? 10);

    if (error) return toolError(error.message);
    return jsonResult({ count: data?.length ?? 0, orders: data ?? [] });
  },
});
