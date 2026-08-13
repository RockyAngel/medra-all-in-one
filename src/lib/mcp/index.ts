import { auth, defineMcp } from "@lovable.dev/mcp-js";
import searchProducts from "./tools/search-products";
import getProduct from "./tools/get-product";
import listMyOrders from "./tools/list-my-orders";
import getOrderStatus from "./tools/get-order-status";
import myRewardsWallet from "./tools/my-rewards-wallet";

// The OAuth issuer must be the direct Supabase host; the project ref is the only
// value that survives publish unchanged, and Vite inlines it at build time.
const projectRef = import.meta.env['VITE_SUPABASE_PROJECT_ID'] ?? "project-ref-unset";

export default defineMcp({
  name: "medra-your-local-life-delivered",
  title: "Medra: Your Local Life, Delivered.",
  version: "0.1.0",
  instructions:
    "Tools for Medra, an all-in-one marketplace and delivery platform. Use `search_products` and `get_product` to explore the catalog, `list_my_orders` and `get_order_status` to check the signed-in customer's orders and deliveries, and `my_rewards_wallet` for their rewards points. All tools act as the signed-in Medra user.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [searchProducts, getProduct, listMyOrders, getOrderStatus, myRewardsWallet],
});
