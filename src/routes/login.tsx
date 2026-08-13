import { createFileRoute, Link } from "@tanstack/react-router";
import { AuthLayout } from "@/components/medra/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/login")({
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

function LoginPage() {
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

      <form
        className="mt-6 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="identifier" className="text-sm font-semibold">
            Email or phone number
          </Label>
          <Input
            id="identifier"
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
            placeholder="••••••••"
            className="h-11 rounded-xl"
            autoComplete="current-password"
          />
        </div>

        <div className="flex items-center justify-between text-sm">
          <label className="flex items-center gap-2 text-muted-foreground">
            <input type="checkbox" className="accent-primary" /> Remember me
          </label>
          <span className="cursor-pointer font-semibold text-primary hover:underline">
            Forgot password?
          </span>
        </div>

        <Button type="submit" className="w-full rounded-xl py-6 text-base font-bold">
          Log in
        </Button>

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="h-px flex-1 bg-border" /> or continue with
          <span className="h-px flex-1 bg-border" />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Button type="button" variant="outline" className="h-11 rounded-xl font-semibold">
            Google
          </Button>
          <Button type="button" variant="outline" className="h-11 rounded-xl font-semibold">
            Apple
          </Button>
        </div>
      </form>

      <div className="mt-8 grid gap-2 text-sm sm:grid-cols-4">
        {[
          { to: "/", label: "Customer" },
          { to: "/rider", label: "Rider" },
          { to: "/seller", label: "Vendor" },
          { to: "/admin", label: "Admin" },
        ].map((l) => (
          <Link
            key={l.to}
            to={l.to}
            className="rounded-lg border border-border px-3 py-2 text-center font-semibold hover:bg-muted"
          >
            {l.label}
          </Link>
        ))}
      </div>
    </AuthLayout>
  );
}
