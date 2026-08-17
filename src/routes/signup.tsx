import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Bike, Loader2, ShoppingBag, Store } from "lucide-react";
import { toast } from "sonner";
import { AuthLayout } from "@/components/medra/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { ROLE_HOME, type AppRole } from "@/lib/auth";

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "Create your Medra account" },
      {
        name: "description",
        content:
          "Sign up on Medra as a customer, rider or vendor and start shopping, delivering or selling today.",
      },
      { property: "og:title", content: "Create your Medra account" },
      {
        property: "og:description",
        content: "Join Medra as a customer, rider or vendor in a few minutes.",
      },
    ],
  }),
  component: SignUpPage,
});

const roles = [
  { id: "customer", label: "Customer", sub: "Shop & order", Icon: ShoppingBag },
  { id: "rider", label: "Rider", sub: "Deliver & earn", Icon: Bike },
  { id: "seller", label: "Vendor", sub: "Sell on Medra", Icon: Store },
] as const;

function SignUpPage() {
  const navigate = useNavigate();
  const [role, setRole] = useState<AppRole>("customer");
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    date_of_birth: "",
    email: "",
    phone: "",
    whatsapp: "",
    password: "",
    confirm: "",
  });

  function update(key: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((prev) => ({ ...prev, [key]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.password.length < 6) {
      toast.error("Use a password with at least 6 characters.");
      return;
    }

    if (form.password !== form.confirm) {
      toast.error("Passwords do not match.");
      return;
    }
    setSubmitting(true);
    const { data, error } = await supabase.auth.signUp({
      email: form.email.trim(),
      password: form.password,
      options: {
        emailRedirectTo: window.location.origin,
        data: {
          first_name: form.first_name,
          last_name: form.last_name,
          phone: form.phone,
          whatsapp: form.whatsapp,
          date_of_birth: form.date_of_birth || null,
          requested_role: role,
        },
      },
    });

    if (error) {
      setSubmitting(false);
      toast.error(error.message);
      return;
    }

    const userId = data.user?.id;
    if (userId && data.session) {
      await supabase
        .from("profiles")
        .upsert({
          id: userId,
          first_name: form.first_name,
          last_name: form.last_name,
          phone: form.phone,
          whatsapp: form.whatsapp,
          date_of_birth: form.date_of_birth || null,
        });
      await supabase.from("user_roles").insert({ user_id: userId, role });
      await supabase.from("wallets").insert({ user_id: userId });
    }

    setSubmitting(false);

    if (!data.session) {
      toast.success("Check your inbox to confirm your email, then log in.");
      void navigate({ to: "/login" });
      return;
    }

    toast.success("Welcome to Medra!");
    void navigate({ to: ROLE_HOME[role] as "/", replace: true });
  }

  return (
    <AuthLayout
      heading="Join the Medra community"
      blurb="One account for shopping, delivering and selling. Create yours in under two minutes."
      highlights={[
        "Shop thousands of verified local stores",
        "Track every delivery in real time",
        "Earn rewards on every order",
      ]}
    >
      <h1 className="text-2xl font-extrabold">Create your account</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Already with us?{" "}
        <Link to="/login" className="font-semibold text-primary hover:underline">
          Log in
        </Link>
      </p>

      <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="First name" placeholder="Ada" required value={form.first_name} onChange={update("first_name")} />
          <Field label="Last name" placeholder="Okoye" required value={form.last_name} onChange={update("last_name")} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Date of birth" type="date" value={form.date_of_birth} onChange={update("date_of_birth")} />
          <Field
            label="Email address"
            type="email"
            required
            placeholder="ada@email.com"
            value={form.email}
            onChange={update("email")}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Phone number" placeholder="+234 800 000 0000" value={form.phone} onChange={update("phone")} />
          <Field label="WhatsApp number" placeholder="+234 800 000 0000" value={form.whatsapp} onChange={update("whatsapp")} />
        </div>

        <div>
          <Label className="text-sm font-semibold">I am signing up as</Label>
          <div className="mt-2 grid gap-3 sm:grid-cols-3">
            {roles.map(({ id, label, sub, Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setRole(id)}
                className={cn(
                  "rounded-xl border p-3 text-left transition-colors",
                  role === id ? "border-primary bg-primary/5" : "border-border hover:bg-muted",
                )}
              >
                <Icon
                  className={cn("size-5", role === id ? "text-primary" : "text-muted-foreground")}
                />
                <p className="mt-2 text-sm font-bold">{label}</p>
                <p className="text-xs text-muted-foreground">{sub}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Password"
            type="password"
            required
            placeholder="••••••••"
            value={form.password}
            onChange={update("password")}
          />
          <Field
            label="Confirm password"
            type="password"
            required
            placeholder="••••••••"
            value={form.confirm}
            onChange={update("confirm")}
          />
        </div>

        <label className="flex items-start gap-2 text-sm text-muted-foreground">
          <input type="checkbox" required className="mt-1 accent-primary" />
          <span>
            I agree to Medra's <span className="font-semibold text-primary">Terms</span> and{" "}
            <span className="font-semibold text-primary">Privacy Policy</span>.
          </span>
        </label>

        <Button
          type="submit"
          disabled={submitting}
          className="w-full rounded-xl py-6 text-base font-bold"
        >
          {submitting ? <Loader2 className="size-4 animate-spin" /> : "Create account"}
        </Button>
      </form>
    </AuthLayout>
  );
}

function Field({
  label,
  type = "text",
  placeholder,
  value,
  onChange,
  required,
}: {
  label: string;
  type?: string;
  placeholder?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  required?: boolean;
}) {
  const id = label.toLowerCase().replace(/\s+/g, "-");
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-sm font-semibold">
        {label}
      </Label>
      <Input
        id={id}
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        required={required}
        className="h-11 rounded-xl"
      />
    </div>
  );
}
