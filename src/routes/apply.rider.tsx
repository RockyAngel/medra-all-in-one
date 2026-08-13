import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { SiteFooter, SiteHeader } from "@/components/medra/SiteChrome";
import { LoadingState } from "@/components/medra/States";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { uploadDocuments, workflowError } from "@/lib/workflow";
import { StatusCard } from "./apply.seller";

export const Route = createFileRoute("/apply/rider")({
  head: () => ({
    meta: [
      { title: "Rider application — Medra" },
      {
        name: "description",
        content:
          "Apply to ride with Medra: submit your details, vehicle information and documents, then track your application status.",
      },
      { property: "og:title", content: "Rider application — Medra" },
      { property: "og:description", content: "Start earning as a Medra rider — apply and track approval." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RiderApplication,
});

const VEHICLES = ["Motorcycle", "Bicycle", "Car", "Van", "On foot"];

function RiderApplication() {
  const { user, session, loading } = useAuth();
  const queryClient = useQueryClient();
  const [files, setFiles] = useState<File[]>([]);
  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    city: "",
    vehicle_type: "Motorcycle",
    vehicle_plate: "",
    emergency_contact_name: "",
    emergency_contact_phone: "",
  });

  const application = useQuery({
    queryKey: ["rider-application", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rider_applications")
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
      if (!form.full_name.trim()) throw new Error("Full name is required");
      if (!form.phone.trim()) throw new Error("Phone number is required");
      if (!form.city.trim()) throw new Error("City is required");
      if (files.length === 0) throw new Error("Upload at least one document (ID or licence)");
      const document_paths = await uploadDocuments(files, `rider-applications/${user.id}`);
      const { error } = await supabase.from("rider_applications").insert({
        user_id: user.id,
        full_name: form.full_name.trim(),
        phone: form.phone.trim(),
        city: form.city.trim(),
        vehicle_type: form.vehicle_type,
        vehicle_plate: form.vehicle_plate || null,
        emergency_contact_name: form.emergency_contact_name || null,
        emergency_contact_phone: form.emergency_contact_phone || null,
        document_paths,
        status: "submitted",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Application submitted — we'll review it shortly");
      void queryClient.invalidateQueries({ queryKey: ["rider-application"] });
    },
    onError: (e) => toast.error(workflowError(e)),
  });

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-5 py-10">
        <p className="text-sm font-semibold text-leaf">Ride with Medra</p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight">Rider application</h1>
        <p className="mt-2 text-muted-foreground">
          Every Medra rider is verified before receiving deliveries. It usually takes 1–3 working days.
        </p>

        {loading ? (
          <LoadingState />
        ) : !session ? (
          <div className="surface-card mt-8 p-6">
            <p className="font-bold">Create an account to apply</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Your rider account keeps your deliveries, earnings and documents together.
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
            title={application.data.full_name}
          />
        ) : (
          <form
            className="surface-card mt-8 grid gap-4 p-6 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              submit.mutate();
            }}
          >
            <Field label="Full name" value={form.full_name} onChange={(v) => setForm((f) => ({ ...f, full_name: v }))} />
            <Field label="Phone number" value={form.phone} onChange={(v) => setForm((f) => ({ ...f, phone: v }))} />
            <Field label="City you'll ride in" value={form.city} onChange={(v) => setForm((f) => ({ ...f, city: v }))} />
            <div className="space-y-1.5">
              <Label htmlFor="vehicle" className="text-sm font-semibold">
                Vehicle type
              </Label>
              <select
                id="vehicle"
                value={form.vehicle_type}
                onChange={(e) => setForm((f) => ({ ...f, vehicle_type: e.target.value }))}
                className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
              >
                {VEHICLES.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <Field label="Plate number (if applicable)" value={form.vehicle_plate} onChange={(v) => setForm((f) => ({ ...f, vehicle_plate: v }))} />
            <Field label="Emergency contact name" value={form.emergency_contact_name} onChange={(v) => setForm((f) => ({ ...f, emergency_contact_name: v }))} />
            <Field label="Emergency contact phone" value={form.emergency_contact_phone} onChange={(v) => setForm((f) => ({ ...f, emergency_contact_phone: v }))} />
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="docs" className="text-sm font-semibold">
                Documents (ID, rider licence, vehicle papers)
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
                Your documents are private and only visible to the Medra verification team.
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
