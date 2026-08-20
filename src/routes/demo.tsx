import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Loader2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { CustomerFooter, CustomerHeader } from "@/components/medra/CustomerChrome";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { DEMO_ACCOUNTS, DEMO_PASSWORD, DEMO_ROLES, type DemoRole } from "@/lib/demo";
import { ensureDemoAccount } from "@/lib/demo.functions";

export const Route = createFileRoute("/demo")({
  head: () => ({
    meta: [
      { title: "Medra demo logins — test every role" },
      {
        name: "description",
        content:
          "Sign in instantly as a demo customer, vendor, rider, admin or super admin to test every Medra dashboard.",
      },
      { property: "og:title", content: "Medra demo logins — test every role" },
      {
        property: "og:description",
        content: "One-click demo accounts for each Medra role, controlled from the feature marketplace.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DemoPage,
});

function DemoPage() {
  const navigate = useNavigate();
  const prepare = useServerFn(ensureDemoAccount);
  const [busy, setBusy] = useState<DemoRole | null>(null);

  async function signInAs(role: DemoRole) {
    setBusy(role);
    try {
      const creds = await prepare({ data: { role } });
      await supabase.auth.signOut();
      if (creds.access_token && creds.refresh_token) {
        // Session minted server-side — avoids browsers that block the auth endpoint.
        const { error } = await supabase.auth.setSession({
          access_token: creds.access_token,
          refresh_token: creds.refresh_token,
        });
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: creds.email,
          password: creds.password,
        });
        if (error) throw new Error(error.message);
      }
      toast.success(`Signed in as the demo ${DEMO_ACCOUNTS[role].label.toLowerCase()}`);
      await navigate({ to: creds.home });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not start the demo session");
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <CustomerHeader />
      <main className="mx-auto max-w-5xl px-5 py-10">
        <h1 className="text-2xl font-extrabold sm:text-3xl">Demo logins</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Each button signs you into a fixed demo account so you can walk that role's screens. All demo
          accounts share the password{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{DEMO_PASSWORD}</code> and can
          also be used on the normal{" "}
          <Link to="/login" className="font-semibold text-primary hover:underline">
            log in
          </Link>{" "}
          page.
        </p>

        <div className="mt-5 flex items-start gap-3 rounded-2xl border border-amber/40 bg-amber/10 p-4 text-sm">
          <ShieldAlert className="mt-0.5 size-5 shrink-0 text-amber" />
          <p>
            These accounts are shared and include admin access. Switch{" "}
            <span className="font-semibold">Demo role logins</span> off in{" "}
            <Link to="/super-admin/features" className="font-semibold text-primary hover:underline">
              the feature marketplace
            </Link>{" "}
            before you launch to real customers.
          </p>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {DEMO_ROLES.map((role) => {
            const account = DEMO_ACCOUNTS[role];
            return (
              <div key={role} className="flex flex-col rounded-2xl border border-border p-5">
                <p className="text-lg font-extrabold">{account.label}</p>
                <p className="mt-1 flex-1 text-sm text-muted-foreground">{account.blurb}</p>
                <p className="mt-3 break-all font-mono text-xs text-muted-foreground">{account.email}</p>
                <Button
                  className="mt-4 rounded-xl py-5 font-bold"
                  disabled={busy !== null}
                  onClick={() => void signInAs(role)}
                >
                  {busy === role ? <Loader2 className="size-4 animate-spin" /> : `Enter as ${account.label}`}
                </Button>
              </div>
            );
          })}
        </div>
      </main>
      <CustomerFooter />
    </>
  );
}
