import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Bike, ShoppingBag, Store } from "lucide-react";
import { AuthLayout } from "@/components/medra/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

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
  { id: "vendor", label: "Vendor", sub: "Sell on Medra", Icon: Store },
];

function SignUpPage() {
  const [role, setRole] = useState("customer");

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

      <form
        className="mt-6 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="First name" placeholder="Ada" />
          <Field label="Last name" placeholder="Okoye" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Date of birth" type="date" />
          <Field label="Email address" type="email" placeholder="ada@email.com" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Phone number" placeholder="+234 800 000 0000" />
          <Field label="WhatsApp number" placeholder="+234 800 000 0000" />
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
                  role === id
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-muted",
                )}
              >
                <Icon
                  className={cn(
                    "size-5",
                    role === id ? "text-primary" : "text-muted-foreground",
                  )}
                />
                <p className="mt-2 text-sm font-bold">{label}</p>
                <p className="text-xs text-muted-foreground">{sub}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Password" type="password" placeholder="••••••••" />
          <Field label="Confirm password" type="password" placeholder="••••••••" />
        </div>

        <label className="flex items-start gap-2 text-sm text-muted-foreground">
          <input type="checkbox" className="mt-1 accent-primary" />
          <span>
            I agree to Medra's <span className="font-semibold text-primary">Terms</span> and{" "}
            <span className="font-semibold text-primary">Privacy Policy</span>.
          </span>
        </label>

        <Button type="submit" className="w-full rounded-xl py-6 text-base font-bold">
          Create account
        </Button>
      </form>
    </AuthLayout>
  );
}

function Field({
  label,
  type = "text",
  placeholder,
}: {
  label: string;
  type?: string;
  placeholder?: string;
}) {
  const id = label.toLowerCase().replace(/\s+/g, "-");
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-sm font-semibold">
        {label}
      </Label>
      <Input id={id} type={type} placeholder={placeholder} className="h-11 rounded-xl" />
    </div>
  );
}
