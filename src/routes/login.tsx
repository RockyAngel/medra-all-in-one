import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AuthLayout } from "@/components/medra/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { ROLE_HOME, useAuth, type AppRole } from "@/lib/auth";

function safeNext(value: unknown): string | undefined {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) return undefined;
  return value;
}

export const Route = createFileRoute("/login")({
  validateSearch: (s: Record<string, unknown>) => {
    const next = safeNext(s['next']);
    return next ? { next } : {};
  },
  head: () => ({
    meta: [
      { title: "Log in to Medra" },
      {
        name: "description",
        content:
          "Log in to your Medra account to shop, track deliveries, manage your store or start riding.",
      },
      { property: "og:title", content: "Log in to Medra" },
      {
        property: "og:description",
        content: "Access your Medra customer, rider, vendor or admin account.",
      },
    ],
  }),
  component: LoginPage,
});

const ROLE_PRIORITY: AppRole[] = ["super_admin", "admin", "seller", "rider", "customer"];

function LoginPage() {
  const navigate = useNavigate();
  const { next } = Route.useSearch();
  const { session, roles, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (loading || !session) return;
    if (next) {
      window.location.replace(next);
      return;
    }
    const primary = ROLE_PRIORITY.find((r) => roles.includes(r)) ?? "customer";
    void navigate({ to: ROLE_HOME[primary] as "/", replace: true });
  }, [loading, session, roles, navigate, next]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Welcome back to Medra");
  }

  async function handleGoogle() {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: next ? `${window.location.origin}${next}` : window.location.origin,
    });
    if (result.error) {
      toast.error("Google sign-in failed. Please try again.");
    }
  }

  return (
    <AuthLayout
      heading="Welcome back to Medra"
      blurb="Pick up right where you left off — your cart, orders and rewards are waiting."
      highlights={[
        "Secure payments and buyer protection",
        "Live delivery tracking",
        "24/7 customer support",
      ]}
    >
      <h1 className="text-2xl font-extrabold">Log in</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        New to Medra?{" "}
        <Link to="/signup" className="font-semibold text-primary hover:underline">
          Create an account
        </Link>
      </p>

      <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-1.5">
          <Label htmlFor="identifier" className="text-sm font-semibold">
            Email address
          </Label>
          <Input
            id="identifier"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="ada@email.com"
            className="h-11 rounded-xl"
            autoComplete="username"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password" className="text-sm font-semibold">
            Password
          </Label>
          <Input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="h-11 rounded-xl"
            autoComplete="current-password"
          />
        </div>

        <div className="flex items-center justify-between text-sm">
          <label className="flex items-center gap-2 text-muted-foreground">
            <input type="checkbox" className="accent-primary" defaultChecked /> Remember me
          </label>
          <Link
            to="/forgot-password"
            className="font-semibold text-primary hover:underline"
          >
            Forgot password?
          </Link>

        </div>

        <Button
          type="submit"
          disabled={submitting}
          className="w-full rounded-xl py-6 text-base font-bold"
        >
          {submitting ? <Loader2 className="size-4 animate-spin" /> : "Log in"}
        </Button>

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="h-px flex-1 bg-border" /> or continue with
          <span className="h-px flex-1 bg-border" />
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={() => void handleGoogle()}
          className="h-11 w-full rounded-xl font-semibold"
        >
          Google
        </Button>
      </form>
    </AuthLayout>
  );
}
