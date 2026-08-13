import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

/** Every admin permission the platform recognises. Enforced in the database. */
export const ADMIN_PERMISSIONS = [
  { key: "orders.view", label: "View orders" },
  { key: "orders.manage", label: "Manage orders" },
  { key: "sellers.view", label: "View sellers" },
  { key: "sellers.approve", label: "Approve sellers" },
  { key: "riders.view", label: "View riders" },
  { key: "riders.approve", label: "Approve riders" },
  { key: "payments.view", label: "View payments" },
  { key: "refunds.manage", label: "Manage refunds" },
  { key: "payouts.manage", label: "Manage payouts" },
  { key: "disputes.manage", label: "Manage disputes" },
  { key: "sos.view", label: "View SOS incidents" },
  { key: "sos.manage", label: "Manage SOS incidents" },
  { key: "support.view", label: "View support inbox" },
  { key: "support.respond", label: "Respond to support" },
  { key: "reviews.moderate", label: "Moderate reviews" },
  { key: "reports.view", label: "View reports" },
  { key: "categories.manage", label: "Manage categories" },
] as const;

export type PermissionKey = (typeof ADMIN_PERMISSIONS)[number]["key"];

/** Asks the database whether the signed-in staff member holds a permission. */
export function usePermission(permission: PermissionKey) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["permission", user?.id, permission],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("has_permission", {
        _user_id: user!.id,
        _permission: permission,
      });
      if (error) throw error;
      return data === true;
    },
  });
}

export function useFeatureFlags() {
  return useQuery({
    queryKey: ["feature-flags"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("feature_flags")
        .select("key, label, description, enabled")
        .order("label");
      if (error) throw error;
      return data;
    },
  });
}

export function useFeatureEnabled(key: string) {
  const flags = useFeatureFlags();
  return {
    ...flags,
    enabled: flags.data?.find((f) => f.key === key)?.enabled ?? false,
  };
}
