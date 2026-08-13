import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { LogOut } from "lucide-react";
import { toast } from "sonner";
import { CustomerFooter, CustomerHeader } from "@/components/medra/CustomerChrome";
import { EmptyState, LoadingState } from "@/components/medra/States";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useProfile } from "@/lib/hooks";

export const Route = createFileRoute("/account")({
  head: () => ({
    meta: [
      { title: "My account — Medra" },
      { name: "description", content: "Manage your Medra profile details and saved delivery addresses." },
      { property: "og:title", content: "My account — Medra" },
      { property: "og:description", content: "Update your Medra profile and delivery addresses." },
    ],
  }),
  component: AccountPage,
});

function AccountPage() {
  const { user, session, roles } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const profile = useProfile();

  const [form, setForm] = useState({ first_name: "", last_name: "", phone: "", whatsapp: "" });

  useEffect(() => {
    if (profile.data) {
      setForm({
        first_name: profile.data.first_name ?? "",
        last_name: profile.data.last_name ?? "",
        phone: profile.data.phone ?? "",
        whatsapp: profile.data.whatsapp ?? "",
      });
    }
  }, [profile.data]);

  const addresses = useQuery({
    queryKey: ["addresses", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("addresses")
        .select("id, recipient_name, line1, city, state, is_default")
        .eq("user_id", user!.id)
        .order("is_default", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const saveProfile = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("profiles")
        .update(form)
        .eq("id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Profile updated");
      void queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    void navigate({ to: "/login", replace: true });
  }

  return (
    <div className="min-h-screen bg-background">
      <CustomerHeader />
      <div className="mx-auto max-w-3xl px-5 py-8">
        <h1 className="text-2xl font-extrabold">My account</h1>

        {!session ? (
          <div className="mt-6">
            <EmptyState
              title="Log in to manage your account"
              body="Profile details and delivery addresses live in your Medra account."
              action={
                <Button asChild className="rounded-full px-6 font-bold">
                  <Link to="/login">Log in</Link>
                </Button>
              }
            />
          </div>
        ) : (
          <>
            <section className="surface-card mt-6 p-5">
              <h2 className="font-bold">Profile</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {user?.email} · {roles.length > 0 ? roles.join(", ") : "customer"}
              </p>
              {profile.isLoading ? (
                <LoadingState />
              ) : (
                <form
                  className="mt-4 grid gap-3 sm:grid-cols-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    saveProfile.mutate();
                  }}
                >
                  <Field label="First name" value={form.first_name} onChange={(v) => setForm((f) => ({ ...f, first_name: v }))} />
                  <Field label="Last name" value={form.last_name} onChange={(v) => setForm((f) => ({ ...f, last_name: v }))} />
                  <Field label="Phone" value={form.phone} onChange={(v) => setForm((f) => ({ ...f, phone: v }))} />
                  <Field label="WhatsApp" value={form.whatsapp} onChange={(v) => setForm((f) => ({ ...f, whatsapp: v }))} />
                  <div className="sm:col-span-2">
                    <Button
                      type="submit"
                      disabled={saveProfile.isPending}
                      className="rounded-full px-6 font-bold"
                    >
                      Save changes
                    </Button>
                  </div>
                </form>
              )}
            </section>

            <section className="surface-card mt-6 p-5">
              <h2 className="font-bold">Delivery addresses</h2>
              {addresses.isLoading ? (
                <LoadingState />
              ) : (addresses.data ?? []).length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  No saved addresses yet — you can add one during checkout.
                </p>
              ) : (
                <ul className="mt-3 space-y-2 text-sm">
                  {addresses.data?.map((a) => (
                    <li key={a.id} className="rounded-xl border border-border p-3">
                      <p className="font-semibold">
                        {a.recipient_name ?? "You"}
                        {a.is_default && (
                          <span className="ml-2 rounded-full bg-leaf/15 px-2 py-0.5 text-xs font-bold text-leaf">
                            Default
                          </span>
                        )}
                      </p>
                      <p className="text-muted-foreground">
                        {[a.line1, a.city, a.state].filter(Boolean).join(", ")}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <Button
              variant="outline"
              onClick={() => void signOut()}
              className="mt-6 rounded-full font-bold"
            >
              <LogOut className="size-4" /> Sign out
            </Button>
          </>
        )}
      </div>
      <CustomerFooter />
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const id = label.toLowerCase().replace(/\s+/g, "-");
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-sm font-semibold">
        {label}
      </Label>
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 rounded-xl"
      />
    </div>
  );
}
