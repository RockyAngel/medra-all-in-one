
/**
 * Fixed demo accounts. Gated behind the `demo.login.enabled` feature flag so a
 * super admin can switch every demo account off from the feature marketplace
 * before launch.
 */
export const DEMO_PASSWORD = "medra-demo-2026";

export const DEMO_ROLES = [
  "customer",
  "seller",
  "rider",
  "admin",
  "super_admin",
] as const;

export type DemoRole = (typeof DEMO_ROLES)[number];

export const DEMO_ACCOUNTS: Record<
  DemoRole,
  { email: string; label: string; first: string; last: string; home: string; blurb: string }
> = {
  customer: {
    email: "demo.customer@medra.test",
    label: "Customer",
    first: "Demo",
    last: "Customer",
    home: "/",
    blurb: "Browse the marketplace, cart, wallet, rewards and order tracking.",
  },
  seller: {
    email: "demo.vendor@medra.test",
    label: "Vendor",
    first: "Demo",
    last: "Vendor",
    home: "/seller",
    blurb: "Products, inventory, orders, earnings and payout requests.",
  },
  rider: {
    email: "demo.rider@medra.test",
    label: "Rider",
    first: "Demo",
    last: "Rider",
    home: "/rider",
    blurb: "Offers, active delivery, verification codes, SOS and wallet.",
  },
  admin: {
    email: "demo.admin@medra.test",
    label: "Admin",
    first: "Demo",
    last: "Admin",
    home: "/admin",
    blurb: "Approvals, payments, refunds, payouts, deliveries and support inbox.",
  },
  super_admin: {
    email: "demo.superadmin@medra.test",
    label: "Super admin",
    first: "Demo",
    last: "Super Admin",
    home: "/super-admin",
    blurb: "Governance, permissions, commission engine and feature marketplace.",
  },
};

export function isDemoRole(value: string): value is DemoRole {
  return (DEMO_ROLES as readonly string[]).includes(value);
}

/**
 * Demo accounts are shared and include admin access, so they are only allowed on
 * local development and preview hosts — never on the live published site.
 */
export function isDemoHost(host: string) {
  const name = host.split(":")[0]?.toLowerCase() ?? "";
  if (name === "localhost" || name === "127.0.0.1" || name.endsWith(".local")) return true;
  return name.includes("-preview--") || name.endsWith("-dev.lovable.app");
}

