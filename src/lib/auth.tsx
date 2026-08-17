import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { useRouter } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "customer" | "seller" | "rider" | "admin" | "super_admin";

export const ROLE_HOME: Record<AppRole, string> = {
  customer: "/",
  seller: "/seller",
  rider: "/rider",
  admin: "/admin",
  super_admin: "/super-admin",
};

type AuthState = {
  loading: boolean;
  session: Session | null;
  user: User | null;
  roles: AppRole[];
  hasRole: (role: AppRole) => boolean;
  hasAnyRole: (roles: AppRole[]) => boolean;
  signOut: () => Promise<void>;
  refreshRoles: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const queryClient = useQueryClient();

  async function loadRoles(userId: string | undefined) {
    if (!userId) {
      setRoles([]);
      return;
    }
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    setRoles(((data ?? []) as { role: AppRole }[]).map((r) => r.role));
  }

  useEffect(() => {
    let active = true;
    // Once a real auth event has been handled, the initial getSession() result
    // is stale and must not overwrite the fresh session/roles.
    let handledEvent = false;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!active || handledEvent) return;
      setSession(data.session);
      await loadRoles(data.session?.user.id);
      if (!active || handledEvent) return;
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      handledEvent = true;
      setSession(nextSession);
      // Keep consumers in a loading state until roles are known, otherwise
      // post-login redirects run with an empty role list and land on "/".
      if (nextSession?.user.id) setLoading(true);
      void loadRoles(nextSession?.user.id)
        .then(() => {
          setLoading(false);
          router.invalidate();
          if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
        })
        .catch(() => setLoading(false));
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      loading,
      session,
      user: session?.user ?? null,
      roles,
      hasRole: (role) => roles.includes(role),
      hasAnyRole: (list) => list.some((r) => roles.includes(r)),
      signOut: async () => {
        await queryClient.cancelQueries();
        queryClient.clear();
        await supabase.auth.signOut();
        setSession(null);
        setRoles([]);
        void router.navigate({ to: "/login", replace: true });
      },
      refreshRoles: () => loadRoles(session?.user.id),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [loading, session, roles],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
