import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { jsonResult, supabaseForUser, toolError, unauthenticated } from "../supabase";

export default defineTool({
  name: "get_product",
  title: "Get Medra product details",
  description:
    "Fetch full details for one Medra product by id, including medication metadata and the selling store.",
  inputSchema: { product_id: z.string().uuid().describe("Product id.") },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ product_id }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("products")
      .select(
        "id, name, description, price, stock_quantity, status, tags, prescription_required, is_medication, generic_name, brand_name, dosage_form, strength, pack_size, nafdac_number, manufacturer, store_id, stores(name, slug, city, area)",
      )
      .eq("id", product_id)
      .maybeSingle();

    if (error) return toolError(error.message);
    if (!data) return toolError("No product found with that id.");
    return jsonResult({ product: data });
  },
});
