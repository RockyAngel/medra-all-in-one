import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { AuthLayout } from "@/components/medra/AuthLayout";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

type OAuthDetails = {
  client?: { name?: string | null } | null;
  redirect_url?: string | null;
  redirect_to?: string | null;
};

type OAuthApi = {
  getAuthorizationDetails: (
    id: string,
  ) => Promise<{ data: OAuthDetails | null; error: { message: string } | null }>;
  approveAuthorization: (
    id: string,
  ) => Promise<{ data: OAuthDetails | null; error: { message: string } | null }>;
  denyAuthorization: (
    id: string,
  ) => Promise<{ data: OAuthDetails | null; error: { message: string } | null }>;
};

function oauthApi(): OAuthApi {
  return (supabase.auth as unknown as { oauth: OAuthApi }).oauth;
}

export const Route = createFileRoute("/.lovable/oauth/consent")({
  // Browser-only: the Supabase session lives in localStorage, absent during SSR.
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id: typeof s['authorization_id'] === "string" ? s['authorization_id'] : "",
  }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("Missing authorization_id");
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      const next = location.pathname + location.searchStr;
      throw redirect({ to: "/login", search: { next } });
    }
  },
  loader: async ({ location }) => {
    const authorizationId = new URLSearchParams(location.search).get("authorization_id")!;
    const { data, error } = await oauthApi().getAuthorizationDetails(authorizationId);
    if (error) throw new Error(error.message);
    const immediate = data?.redirect_url ?? data?.redirect_to;
    if (immediate && !data?.client) throw redirect({ href: immediate });
    return data;
  },
  component: ConsentPage,
  errorComponent: ({ error }) => (
    <AuthLayout
      heading="Connect an app to Medra"
      blurb="Approve trusted assistants to act on your Medra account."
      highlights={["You stay in control", "Revoke access any time"]}
    >
      <h1 className="text-2xl font-extrabold">Authorization unavailable</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {String((error as Error)?.message ?? error)}
      </p>
    </AuthLayout>
  ),
});

function ConsentPage() {
  const details = Route.useLoaderData();
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const clientName = details?.client?.name ?? "this app";

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    const api = oauthApi();
    const { data, error: decisionError } = approve
      ? await api.approveAuthorization(authorization_id)
      : await api.denyAuthorization(authorization_id);
    if (decisionError) {
      setBusy(false);
      setError(decisionError.message);
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("No redirect was returned by the authorization server.");
      return;
    }
    window.location.href = target;
  }

  return (
    <AuthLayout
      heading="Connect an app to Medra"
      blurb="Approve trusted assistants to read your catalog, orders and rewards on your behalf."
      highlights={[
        "Acts only as you, under your permissions",
        "No access to payment credentials",
        "Revoke access any time",
      ]}
    >
      <div className="flex items-center gap-2 text-primary">
        <ShieldCheck className="size-5" />
        <span className="text-sm font-semibold">Authorization request</span>
      </div>
      <h1 className="mt-2 text-2xl font-extrabold">Connect {clientName} to your account</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {clientName} is asking to use Medra as you. It will be able to search products and read
        your orders, deliveries and rewards balance.
      </p>

      {error ? (
        <p role="alert" className="mt-4 rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <Button
          disabled={busy}
          onClick={() => void decide(true)}
          className="w-full rounded-xl py-6 text-base font-bold"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : "Approve"}
        </Button>
        <Button
          disabled={busy}
          variant="outline"
          onClick={() => void decide(false)}
          className="w-full rounded-xl py-6 text-base font-semibold"
        >
          Deny
        </Button>
      </div>
    </AuthLayout>
  );
}
