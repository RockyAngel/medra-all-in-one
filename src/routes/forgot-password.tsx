import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AuthLayout } from "@/components/medra/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: "Reset your Medra password" },
      {
        name: "description",
        content: "Forgotten your Medra password? Enter your email and we will send you a secure reset link.",
      },
      { property: "og:title", content: "Reset your Medra password" },
      { property: "og:description", content: "Get a secure password reset link for your Medra account." },
    ],
  }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setSent(true);
    toast.success("Reset link sent");
  }

  return (
    <AuthLayout
      heading="Forgot your password?"
      blurb="It happens. We'll email you a secure link so you can set a new one."
      highlights={["Links expire quickly for your safety", "Your orders and rewards stay intact"]}
    >
      <h1 className="text-2xl font-extrabold">Reset password</h1>
      {sent ? (
        <div className="mt-6 space-y-4">
          <p className="text-sm text-muted-foreground">
            If an account exists for <span className="font-semibold text-foreground">{email}</span>, a reset
            link is on its way. Check your inbox and spam folder.
          </p>
          <Button variant="outline" className="w-full rounded-xl font-bold" onClick={() => setSent(false)}>
            Send to a different email
          </Button>
          <Link to="/login" className="block text-center text-sm font-semibold text-primary hover:underline">
            Back to log in
          </Link>
        </div>
      ) : (
        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-sm font-semibold">
              Email address
            </Label>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ada@email.com"
              className="h-11 rounded-xl"
              autoComplete="email"
            />
          </div>
          <Button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl py-6 text-base font-bold"
          >
            {submitting ? <Loader2 className="size-4 animate-spin" /> : "Send reset link"}
          </Button>
          <Link to="/login" className="block text-center text-sm font-semibold text-primary hover:underline">
            Back to log in
          </Link>
        </form>
      )}
    </AuthLayout>
  );
}
