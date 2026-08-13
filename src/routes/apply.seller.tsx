import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { BadgeCheck, Clock, Loader2, Store, XCircle } from "lucide-react";
import { toast } from "sonner";
import { SiteFooter, SiteHeader } from "@/components/medra/SiteChrome";
import { LoadingState } from "@/components/medra/States";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useCategories } from "@/lib/hooks";
import { formatDate } from "@/lib/medra";
import { uploadDocuments, workflowError } from "@/lib/workflow";

export const Route = createFileRoute("/apply/seller")({
  head: () => ({
    meta: [
      { title: "Seller application — Medra" },
      {
        name: "description",
        content:
          "Apply to sell on Medra: tell us about your store, pick your category, upload your documents and track your approval status.",
      },
      { property: "og:title", content: "Seller application — Medra" },
      { property: "og:description", content: "Open your Medra store — apply and track approval." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SellerApplication,
});

function SellerApplication() {
  const { user, session, loading } = useAuth();
  const queryClient = useQueryClient();
  const categories = useCategories();
  const [files, setFiles] = useState<File[]>([]);
  const [form, setForm] = useState({
    store_name: "",
    category_id: "",
    description: "",
    city: "",
    address: "",
    contact_phone: "",
    business_reg_number: "",
  });

  const application = useQuery({
    queryKey: ["seller-application", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("seller_applications")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const submit = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Log in to apply");
      if (!form.store_name.trim()) throw new Error("Store name is required");
      if (!form.city.trim()) throw new Error("City is required");
      if (!form.contact_phone.trim()) throw new Error("Contact phone is required");
      const document_paths = files.length
        ? await uploadDocuments(files, `seller-applications/${user.id}`)
        : [];
      const { error } = await supabase.from("seller_applications").insert({
        user_id: user.id,
        store_name: form.store_name.trim(),
        category_id: form.category_id || null,
        description: form.description || null,
        city: form.city.trim(),
        address: form.address || null,
        contact_phone: form.contact_phone.trim(),
        business_reg_number: form.business_reg_number || null,
        document_paths,
        status: "submitted",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Application submitted — we'll review it shortly");
      void queryClient.invalidateQueries({ queryKey: ["seller-application"] });
    },
    onError: (e) => toast.error(workflowError(e)),
  });

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader accent="sky" />
      <main className="mx-auto max-w-3xl px-5 py-10">
        <p className="text-sm font-semibold text-sky">Sell on Medra</p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight">Seller application</h1>
        <p className="mt-2 text-muted-foreground">
          Tell us about your store. Our team verifies every seller before your store goes live.
        </p>

        {loading ? (
          <LoadingState />
        ) : !session ? (
          <div className="surface-card mt-8 p-6">
            <p className="font-bold">Create an account to apply</p>
            <p className="mt-1 text-sm text-muted-foreground">
              You need a Medra account so we can attach your application and store to it.
            </p>
            <div className="mt-4 flex gap-3">
              <Button asChild className="rounded-full px-6 font-bold">
                <Link to="/signup">Create account</Link>
              </Button>
              <Button asChild variant="outline" className="rounded-full px-6 font-bold">
                <Link to="/login">Log in</Link>
              </Button>
            </div>
          </div>
        ) : application.isLoading ? (
          <LoadingState />
        ) : application.data ? (
          <StatusCard
            status={application.data.status}
            note={application.data.review_note}
            submittedAt={application.data.created_at}
            title={application.data.store_name}
          />
        ) : (
          <form
            className="surface-card mt-8 grid gap-4 p-6 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              submit.mutate();
            }}
          >
            <Field label="Store name" value={form.store_name} onChange={(v) => setForm((f) => ({ ...f, store_name: v }))} />
            <div className="space-y-1.5">
              <Label htmlFor="category" className="text-sm font-semibold">
                Category
              </Label>
              <select
                id="category"
                value={form.category_id}
                onChange={(e) => setForm((f) => ({ ...f, category_id: e.target.value }))}
                className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
              >
                <option value="">Select a category</option>
                {categories.data?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <Field label="City" value={form.city} onChange={(v) => setForm((f) => ({ ...f, city: v }))} />
            <Field label="Contact phone" value={form.contact_phone} onChange={(v) => setForm((f) => ({ ...f, contact_phone: v }))} />
            <Field label="Business reg. number (optional)" value={form.business_reg_number} onChange={(v) => setForm((f) => ({ ...f, business_reg_number: v }))} />
            <Field label="Store address" value={form.address} onChange={(v) => setForm((f) => ({ ...f, address: v }))} />
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="description" className="text-sm font-semibold">
                What do you sell?
              </Label>
              <Textarea
                id="description"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                className="min-h-24 rounded-xl"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="docs" className="text-sm font-semibold">
                Verification documents
              </Label>
              <Input
                id="docs"
                type="file"
                multiple
                accept="image/*,application/pdf"
                onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
                className="rounded-xl"
              />
              <p className="text-xs text-muted-foreground">
                Business registration, pharmacy licence or ID — whatever applies to your store.
              </p>
            </div>
            <div className="sm:col-span-2">
              <Button
                type="submit"
                disabled={submit.isPending}
                className="w-full rounded-full py-6 font-bold"
              >
                {submit.isPending ? <Loader2 className="size-4 animate-spin" /> : "Submit application"}
              </Button>
            </div>
          </form>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}

export function StatusCard({
  status,
  note,
  submittedAt,
  title,
}: {
  status: string;
  note: string | null;
  submittedAt: string;
  title: string;
}) {
  const map: Record<string, { icon: typeof Clock; tone: string; label: string; body: string }> = {
    draft: { icon: Clock, tone: "bg-muted text-muted-foreground", label: "Draft", body: "Finish and submit your application." },
    submitted: { icon: Clock, tone: "bg-amber/20 text-amber", label: "Submitted", body: "Your application is queued for review by the Medra team." },
    under_review: { icon: Clock, tone: "bg-sky/15 text-sky", label: "Under review", body: "Our team is verifying your details and documents." },
    approved: { icon: BadgeCheck, tone: "bg-leaf/15 text-leaf", label: "Approved", body: "You're approved. Your dashboard is now available." },
    rejected: { icon: XCircle, tone: "bg-destructive/15 text-destructive", label: "Not approved", body: "Your application was not approved." },
  };
  const state = map[status] ?? map["submitted"]!;
  const Icon = state.icon;

  return (
    <div className="surface-card mt-8 p-6">
      <div className="flex items-center gap-3">
        <span className={`grid size-11 place-items-center rounded-xl ${state.tone}`}>
          <Icon className="size-5" />
        </span>
        <div>
          <p className="font-bold">{title}</p>
          <p className="text-sm text-muted-foreground">Submitted {formatDate(submittedAt)}</p>
        </div>
      </div>
      <p className={`mt-4 inline-flex rounded-full px-3 py-1 text-xs font-bold ${state.tone}`}>
        {state.label}
      </p>
      <p className="mt-3 text-sm text-muted-foreground">{state.body}</p>
      {note && (
        <p className="mt-3 rounded-xl border border-border p-3 text-sm">
          <span className="font-semibold">Note from the team: </span>
          {note}
        </p>
      )}
      <div className="mt-5 flex flex-wrap gap-3">
        <Button asChild variant="outline" className="rounded-full px-6 font-bold">
          <Link to="/">Back to marketplace</Link>
        </Button>
        <Button asChild variant="outline" className="rounded-full px-6 font-bold">
          <Link to="/team">Contact support</Link>
        </Button>
      </div>
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
  const id = label.toLowerCase().replace(/[^a-z]+/g, "-");
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-sm font-semibold">
        {label}
      </Label>
      <Input id={id} value={value} onChange={(e) => onChange(e.target.value)} className="h-11 rounded-xl" />
    </div>
  );
}

export const StoreIcon = Store;
