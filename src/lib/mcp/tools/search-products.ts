import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { jsonResult, supabaseForUser, toolError, unauthenticated } from "../supabase";

export default defineTool({
  name: "search_products",
  title: "Search Medra products",
  description:
    "Search the Medra marketplace catalog by keyword. Returns active products with price, stock and store.",
  inputSchema: {
    query: z.string().trim().min(1).describe("Keyword to match against product name or description."),
    limit: z.number().int().min(1).max(25).optional().describe("Maximum results (default 10)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ query, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const supabase = supabaseForUser(ctx);
    const pattern = `%${query.replace(/[%_]/g, "")}%`;
    const { data, error } = await supabase
      .from("products")
      .select(
        "id, name, description, price, stock_quantity, prescription_required, is_medication, store_id, stores(name, slug)",
      )
      .eq("status", "active")
      .or(`name.ilike.${pattern},description.ilike.${pattern}`)
      .order("name")
      .limit(limit ?? 10);

    if (error) return toolError(error.message);
    return jsonResult({ query, count: data?.length ?? 0, products: data ?? [] });
  },
});
