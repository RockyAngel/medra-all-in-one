import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Palette } from "lucide-react";
import { toast } from "sonner";
import { CustomerFooter, CustomerHeader } from "@/components/medra/CustomerChrome";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import {
  APPEARANCE_COST,
  MODES,
  THEMES,
  applyAppearance,
  useAppearance,
  usePurchaseAppearance,
} from "@/lib/platform";

export const Route = createFileRoute("/appearance")({
  head: () => ({
    meta: [
      { title: "Themes & appearance — Medra" },
      {
        name: "description",
        content:
          "Spend 200 Medra reward points to change your app theme and light or dark appearance across every dashboard.",
      },
      { property: "og:title", content: "Themes & appearance — Medra" },
      {
        property: "og:description",
        content: "Personalise how Medra looks using your reward points.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AppearancePage,
});

function AppearancePage() {
  const { session, loading } = useAuth();
  const appearance = useAppearance();
  const purchase = usePurchaseAppearance();
  const [theme, setTheme] = useState<string>("medra");
  const [mode, setMode] = useState<string>("system");

  useEffect(() => {
    if (appearance.data) {
      setTheme(appearance.data.theme ?? "medra");
      setMode(appearance.data.mode ?? "system");
    }
  }, [appearance.data]);

  const current = appearance.data;
  const dirty = !!current && (current.theme !== theme || current.mode !== mode);
  const firstTime = !current;

  function save() {
    purchase.mutate(
      { theme, mode },
      {
        onSuccess: (result) => {
          applyAppearance(theme, mode);
          toast.success(
            result
              ? `Appearance updated — ${result.points_balance} points left`
              : "Appearance updated",
          );
        },
        onError: (e: unknown) =>
          toast.error(e instanceof Error ? e.message : "Could not change your appearance"),
      },
    );
  }

  if (!loading && !session) {
    return (
      <>
        <CustomerHeader />
        <main className="mx-auto max-w-3xl px-5 py-20 text-center">
          <h1 className="text-3xl font-extrabold">Themes & appearance</h1>
          <p className="mt-3 text-muted-foreground">
            Sign in to spend reward points on a new look for your Medra app.
          </p>
          <Button asChild className="mt-6 rounded-xl px-8 py-6 font-bold">
            <Link to="/login">Sign in</Link>
          </Button>
        </main>
        <CustomerFooter />
      </>
    );
  }

  return (
    <>
      <CustomerHeader />
      <main className="mx-auto max-w-4xl px-5 py-10">
        <div className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-2xl bg-primary/10 text-primary">
            <Palette className="size-5" />
          </span>
          <div>
            <h1 className="text-2xl font-extrabold sm:text-3xl">Themes & appearance</h1>
            <p className="text-sm text-muted-foreground">
              Every change costs {APPEARANCE_COST} reward points and applies everywhere you sign in.
            </p>
          </div>
        </div>

        <section className="mt-8">
          <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Theme</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {THEMES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTheme(t.id)}
                className={`rounded-2xl border p-4 text-left ${
                  theme === t.id ? "border-primary ring-2 ring-primary/30" : "border-border"
                }`}
              >
                <span className="block size-8 rounded-full" style={{ background: t.swatch }} />
                <span className="mt-3 block font-bold">{t.label}</span>
                {current?.theme === t.id && (
                  <span className="mt-1 block text-xs text-muted-foreground">Current</span>
                )}
              </button>
            ))}
          </div>
        </section>

        <section className="mt-8">
          <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Appearance</h2>
          <div className="mt-3 flex flex-wrap gap-3">
            {MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setMode(m.id)}
                className={`rounded-xl border px-4 py-2 text-sm font-bold ${
                  mode === m.id ? "border-primary bg-primary/10 text-primary" : "border-border"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </section>

        <div className="mt-10 flex flex-wrap items-center gap-4 rounded-2xl border border-border p-5">
          <div className="min-w-0 flex-1">
            <p className="font-bold">
              {firstTime ? "Set your first look" : dirty ? "Apply this look" : "Nothing to change"}
            </p>
            <p className="text-sm text-muted-foreground">
              {APPEARANCE_COST} points are deducted from your rewards wallet each time you save a change.{" "}
              <Link to="/wallet" className="font-semibold text-primary hover:underline">
                View your points
              </Link>
            </p>
          </div>
          <Button
            className="rounded-xl px-6 py-6 font-bold"
            disabled={purchase.isPending || appearance.isLoading || (!dirty && !firstTime)}
            onClick={save}
          >
            {purchase.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              `Save for ${APPEARANCE_COST} points`
            )}
          </Button>
        </div>
      </main>
      <CustomerFooter />
    </>
  );
}
