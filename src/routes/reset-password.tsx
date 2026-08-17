import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AuthLayout } from "@/components/medra/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Set a new Medra password" },
      {
        name: "description",
        content: "Choose a new password for your Medra account — at least six characters, your choice.",
      },
      { property: "og:title", content: "Set a new Medra password" },
      { property: "og:description", content: "Finish resetting your Medra password." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    void supabase.auth.getSession().then(({ data }) => {
      if (active && data.session) setReady(true);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("Use at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      toast.error("Both passwords must match.");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Password updated");
    void navigate({ to: "/login", replace: true });
  }

  return (
    <AuthLayout
      heading="Set a new password"
      blurb="Pick anything you'll remember — six characters or more is the only rule."
      highlights={["You choose your own password", "You'll be signed in straight after"]}
    >
      <h1 className="text-2xl font-extrabold">New password</h1>
      {!ready ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Open this page from the reset link in your email. If you arrived here directly, request a new link
          from the forgot password page.
        </p>
      ) : (
        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-sm font-semibold">
              New password
            </Label>
            <Input
              id="password"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-11 rounded-xl"
              autoComplete="new-password"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm" className="text-sm font-semibold">
              Confirm password
            </Label>
            <Input
              id="confirm"
              type="password"
              required
              minLength={6}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="h-11 rounded-xl"
              autoComplete="new-password"
            />
          </div>
          <Button type="submit" disabled={submitting} className="w-full rounded-xl py-6 text-base font-bold">
            {submitting ? <Loader2 className="size-4 animate-spin" /> : "Update password"}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
