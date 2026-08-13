import { defineTool } from "@lovable.dev/mcp-js";
import { jsonResult, supabaseForUser, toolError, unauthenticated } from "../supabase";

export default defineTool({
  name: "my_rewards_wallet",
  title: "Get my Medra rewards balance",
  description:
    "Return the signed-in user's Medra rewards points balance and the most recent wallet transactions.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const supabase = supabaseForUser(ctx);

    const { data: wallet, error } = await supabase
      .from("wallets")
      .select("points_balance, updated_at")
      .maybeSingle();
    if (error) return toolError(error.message);

    const { data: transactions, error: txError } = await supabase
      .from("wallet_transactions")
      .select("id, points, reason, created_at")
      .order("created_at", { ascending: false })
      .limit(10);
    if (txError) return toolError(txError.message);

    return jsonResult({
      points_balance: wallet?.points_balance ?? 0,
      updated_at: wallet?.updated_at ?? null,
      recent_transactions: transactions ?? [],
    });
  },
});
