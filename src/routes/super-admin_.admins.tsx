import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Panel } from "@/components/medra/DashboardShell";
import { DataTable, Pill, SuperAdminPage } from "@/components/medra/RoleDashboard";
import { EmptyState, QueryBoundary } from "@/components/medra/States";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { formatDate } from "@/lib/medra";
import { useAdministrators } from "@/lib/ops";

export const Route = createFileRoute("/super-admin_/admins")({
  head: () => ({
    meta: [
      { title: "Administrators — Medra super admin" },
      {
        name: "description",
        content: "Grant or revoke Medra admin access and review who holds elevated platform roles.",
      },
      { property: "og:title", content: "Administrators — Medra super admin" },
      { property: "og:description", content: "Administrator governance for the Medra platform." },
    ],
  }),
  component: SuperAdminAdminsPage,
});

function SuperAdminAdminsPage() {
  const admins = useAdministrators();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");

  const results = useQuery({
    queryKey: ["admin-search", search],
    enabled: search.trim().length >= 3,
    queryFn: async () => {
      const term = search.trim();
      const { data, error } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, email")
        .or(`email.ilike.%${term}%,first_name.ilike.%${term}%,last_name.ilike.%${term}%`)
        .limit(10);
      if (error) throw error;
      return data ?? [];
    },
  });

  const setRole = useMutation({
    mutationFn: async (input: { userId: string; makeAdmin: boolean }) => {
      const { error } = await supabase.rpc("set_admin_role", {
        _user_id: input.userId,
        _make_admin: input.makeAdmin,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Administrator access updated");
      void queryClient.invalidateQueries({ queryKey: ["administrators"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-search"] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Could not update access"),
  });

  return (
    <SuperAdminPage title="Administrators" subtitle="Who holds elevated access on Medra">
      <Panel title="Grant admin access" className="mb-4">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search people by name or email (minimum 3 characters)"
          className="h-11 rounded-xl"
        />
        {search.trim().length >= 3 && (
          <div className="mt-3 space-y-2">
            {results.isLoading && <p className="text-sm text-muted-foreground">Searching…</p>}
            {(results.data ?? []).length === 0 && !results.isLoading && (
              <p className="text-sm text-muted-foreground">No matching accounts.</p>
            )}
            {(results.data ?? []).map((p) => (
              <div
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-3"
              >
                <div className="min-w-0">
                  <p className="truncate font-bold">
                    {[p.first_name, p.last_name].filter(Boolean).join(" ") || "Unnamed account"}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">{p.email}</p>
                </div>
                <Button
                  size="sm"
                  className="rounded-lg font-bold"
                  disabled={setRole.isPending}
                  onClick={() => setRole.mutate({ userId: p.id, makeAdmin: true })}
                >
                  Make admin
                </Button>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Panel title="Current administrators">
        <QueryBoundary
          isLoading={admins.isLoading}
          error={admins.error}
          isEmpty={(admins.data ?? []).length === 0}
          onRetry={() => void admins.refetch()}
          empty={
            <EmptyState
              icon={<ShieldCheck className="size-5" />}
              title="No administrators yet"
              body="Search for an account above to grant admin access."
            />
          }
        >
          <DataTable columns={["Person", "Email", "Role", "Granted", ""]}>
            {(admins.data ?? []).map((a) => (
              <tr key={a.id}>
                <td className="py-3 pr-4 font-semibold">
                  {[a.profile?.first_name, a.profile?.last_name].filter(Boolean).join(" ") || "—"}
                </td>
                <td className="py-3 pr-4 text-muted-foreground">{a.profile?.email ?? "—"}</td>
                <td className="py-3 pr-4">
                  <Pill tone={a.role === "super_admin" ? "bg-grape/15 text-grape" : "bg-sky/15 text-sky"}>
                    {a.role === "super_admin" ? "Super admin" : "Admin"}
                  </Pill>
                </td>
                <td className="py-3 pr-4 text-muted-foreground">{formatDate(a.created_at)}</td>
                <td className="py-3 pr-4">
                  {a.role === "admin" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-lg font-bold text-destructive"
                      disabled={setRole.isPending}
                      onClick={() => setRole.mutate({ userId: a.user_id, makeAdmin: false })}
                    >
                      Revoke
                    </Button>
                  ) : (
                    <span className="text-xs text-muted-foreground">Protected</span>
                  )}
                </td>
              </tr>
            ))}
          </DataTable>
        </QueryBoundary>
      </Panel>
    </SuperAdminPage>
  );
}
