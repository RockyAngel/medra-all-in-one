import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { KeyRound } from "lucide-react";
import { toast } from "sonner";
import { Panel } from "@/components/medra/DashboardShell";
import { Pill, SuperAdminPage } from "@/components/medra/RoleDashboard";
import { EmptyState, QueryBoundary } from "@/components/medra/States";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { ADMIN_PERMISSIONS } from "@/lib/permissions";
import { useAdminPermissions, useAdministrators, useRolePermissions } from "@/lib/ops";

export const Route = createFileRoute("/super-admin_/permissions")({
  head: () => ({
    meta: [
      { title: "Roles & permissions — Medra super admin" },
      {
        name: "description",
        content:
          "Control exactly which Medra admin can approve vendors, move money, handle refunds or work support.",
      },
      { property: "og:title", content: "Roles & permissions — Medra super admin" },
      { property: "og:description", content: "Fine-grained admin permissions on Medra." },
    ],
  }),
  component: SuperAdminPermissionsPage,
});

function SuperAdminPermissionsPage() {
  const admins = useAdministrators();
  const grants = useAdminPermissions();
  const rolePermissions = useRolePermissions();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);

  const staff = (admins.data ?? []).filter((a) => a.role === "admin");
  const activeUser = selected ?? staff[0]?.user_id ?? null;

  const granted = new Set(
    (grants.data ?? [])
      .filter((g) => g.user_id === activeUser && g.enabled)
      .map((g) => g.permission),
  );

  const toggle = useMutation({
    mutationFn: async (input: { permission: string; enabled: boolean }) => {
      if (!activeUser) throw new Error("Pick an administrator first.");
      const { error } = await supabase.rpc("set_admin_permission", {
        _user_id: activeUser,
        _permission: input.permission,
        _enabled: input.enabled,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Permission updated");
      void queryClient.invalidateQueries({ queryKey: ["admin-permissions"] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Could not update permission"),
  });

  return (
    <SuperAdminPage title="Roles & permissions" subtitle="Per-administrator capability control">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,280px)_minmax(0,1fr)]">
        <Panel title="Administrators">
          <QueryBoundary
            isLoading={admins.isLoading}
            error={admins.error}
            isEmpty={staff.length === 0}
            onRetry={() => void admins.refetch()}
            empty={
              <EmptyState
                icon={<KeyRound className="size-5" />}
                title="No administrators yet"
                body="Grant admin access first, then assign permissions here."
              />
            }
          >
            <div className="space-y-2">
              {staff.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setSelected(a.user_id)}
                  className={`w-full rounded-xl border p-3 text-left ${
                    activeUser === a.user_id ? "border-primary bg-primary/5" : "border-border hover:bg-muted"
                  }`}
                >
                  <p className="truncate font-bold">
                    {[a.profile?.first_name, a.profile?.last_name].filter(Boolean).join(" ") || "Administrator"}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{a.profile?.email ?? a.user_id}</p>
                </button>
              ))}
            </div>
          </QueryBoundary>
        </Panel>

        <div className="space-y-4">
          <Panel title="Permissions">
            {!activeUser ? (
              <p className="text-sm text-muted-foreground">Select an administrator to manage access.</p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {ADMIN_PERMISSIONS.map((p) => {
                  const on = granted.has(p.key);
                  return (
                    <div
                      key={p.key}
                      className="flex items-center justify-between gap-3 rounded-xl border border-border p-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold">{p.label}</p>
                        <p className="truncate text-xs text-muted-foreground">{p.key}</p>
                      </div>
                      <Button
                        size="sm"
                        variant={on ? "default" : "outline"}
                        className="rounded-lg font-bold"
                        disabled={toggle.isPending}
                        onClick={() => toggle.mutate({ permission: p.key, enabled: !on })}
                      >
                        {on ? "Granted" : "Grant"}
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </Panel>

          <Panel title="Role baseline">
            <QueryBoundary
              isLoading={rolePermissions.isLoading}
              error={rolePermissions.error}
              isEmpty={(rolePermissions.data ?? []).length === 0}
              onRetry={() => void rolePermissions.refetch()}
              empty={
                <EmptyState
                  title="No role baselines configured"
                  body="Role-level defaults appear here once configured in the database."
                />
              }
            >
              <div className="flex flex-wrap gap-2">
                {(rolePermissions.data ?? []).map((r) => (
                  <Pill
                    key={r.id}
                    tone={r.enabled ? "bg-leaf/15 text-leaf" : "bg-muted text-muted-foreground"}
                  >
                    {r.role} · {r.permission}
                  </Pill>
                ))}
              </div>
            </QueryBoundary>
          </Panel>
        </div>
      </div>
    </SuperAdminPage>
  );
}
