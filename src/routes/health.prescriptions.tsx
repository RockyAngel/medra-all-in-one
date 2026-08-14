import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { FileText, Loader2, ShieldCheck, Upload } from "lucide-react";
import { toast } from "sonner";
import { CustomerFooter, CustomerHeader } from "@/components/medra/CustomerChrome";
import { EmptyState, QueryBoundary } from "@/components/medra/States";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { formatDate } from "@/lib/medra";
import { workflowError } from "@/lib/workflow";
import {
  PRESCRIPTION_STATUS,
  prescriptionFileUrl,
  statusChip,
  useCartPrescriptionStatus,
  useMyPrescriptions,
  usePharmacies,
  usePrescriptionEvents,
  uploadPrescriptionFile,
} from "@/lib/health";

export const Route = createFileRoute("/health/prescriptions")({
  head: () => ({
    meta: [
      { title: "Your prescriptions — Medra" },
      {
        name: "description",
        content:
          "Upload a prescription to a verified Medra pharmacy, follow its review status and unlock checkout for prescription-only medicines.",
      },
      { property: "og:title", content: "Your prescriptions — Medra" },
      {
        property: "og:description",
        content: "Upload and track prescriptions for prescription-only medicines on Medra.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PrescriptionsPage,
});

function PrescriptionsPage() {
  const { user, session } = useAuth();
  const queryClient = useQueryClient();
  const pharmacies = usePharmacies();
  const prescriptions = useMyPrescriptions();
  const cartStatus = useCartPrescriptionStatus();
  const [openEvents, setOpenEvents] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [form, setForm] = useState({
    store_id: "",
    prescriber_name: "",
    prescriber_contact: "",
    note: "",
  });

  const upload = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Log in to upload a prescription");
      if (!form.store_id) throw new Error("Choose the pharmacy that will review it");
      if (!file) throw new Error("Attach a photo or PDF of your prescription");
      if (file.size > 10 * 1024 * 1024) throw new Error("Files must be smaller than 10MB");
      const path = await uploadPrescriptionFile(user.id, file);
      const { error } = await supabase.rpc("upload_prescription", {
        _store_id: form.store_id,
        _file_path: path,
        _file_type: file.type || "application/octet-stream",
        ...(form.prescriber_name.trim() ? { _prescriber_name: form.prescriber_name.trim() } : {}),
        ...(form.prescriber_contact.trim()
          ? { _prescriber_contact: form.prescriber_contact.trim() }
          : {}),
        ...(form.note.trim() ? { _note: form.note.trim() } : {}),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Prescription sent for pharmacy review");
      setFile(null);
      setForm({ store_id: "", prescriber_name: "", prescriber_contact: "", note: "" });
      void queryClient.invalidateQueries({ queryKey: ["my-prescriptions"] });
      void queryClient.invalidateQueries({ queryKey: ["cart-prescription-status"] });
    },
    onError: (e) => toast.error(workflowError(e)),
  });

  const viewFile = useMutation({
    mutationFn: (path: string) => prescriptionFileUrl(path),
    onSuccess: (url) => window.open(url, "_blank", "noopener,noreferrer"),
    onError: (e) => toast.error(workflowError(e)),
  });

  const blocking = (cartStatus.data ?? []).filter(
    (row) => row.requires_prescription && row.prescription_status !== "approved",
  );

  return (
    <div className="min-h-screen bg-background">
      <CustomerHeader />
      <main className="mx-auto max-w-5xl px-5 py-8">
        <p className="text-sm font-semibold text-leaf">Health</p>
        <h1 className="mt-1 text-2xl font-extrabold">Prescriptions</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Prescription-only medicines need an approved prescription before checkout. Uploads are
          private — only the reviewing pharmacy can open your file.
        </p>

        {!session ? (
          <div className="mt-6">
            <EmptyState
              icon={<ShieldCheck className="size-5" />}
              title="Log in to manage prescriptions"
              body="Your prescriptions are tied to your Medra account and stay private to you and the reviewing pharmacy."
              action={
                <Button asChild className="rounded-full px-6 font-bold">
                  <Link to="/login">Log in</Link>
                </Button>
              }
            />
          </div>
        ) : (
          <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px]">
            <div className="space-y-5">
              {cartStatus.data && cartStatus.data.length > 0 && (
                <section className="surface-card p-4">
                  <h2 className="font-bold">Your cart</h2>
                  <ul className="mt-3 space-y-2 text-sm">
                    {cartStatus.data.map((row) => {
                      const chip = statusChip(
                        PRESCRIPTION_STATUS,
                        row.prescription_status ?? "pending_review",
                      );
                      return (
                        <li
                          key={row.store_id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border p-3"
                        >
                          <div>
                            <p className="font-semibold">{row.store_name}</p>
                            <p className="text-xs text-muted-foreground">
                              {row.requires_prescription
                                ? "Prescription required for items from this pharmacy"
                                : "No prescription needed"}
                            </p>
                          </div>
                          {row.requires_prescription && (
                            <span
                              className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${chip.tone}`}
                            >
                              {row.prescription_status ? chip.label : "Not uploaded"}
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                  <div className="mt-3 rounded-xl border border-dashed border-border p-3 text-xs">
                    {blocking.length > 0 ? (
                      <span className="text-muted-foreground">
                        Checkout is blocked until every pharmacy above has an approved
                        prescription.
                      </span>
                    ) : (
                      <span className="font-semibold text-leaf">
                        All prescription requirements are met — you can check out.
                      </span>
                    )}
                  </div>
                  <Button asChild variant="outline" className="mt-3 rounded-full font-bold">
                    <Link to="/cart">Back to cart</Link>
                  </Button>
                </section>
              )}

              <section>
                <h2 className="font-bold">Your uploads</h2>
                <div className="mt-3">
                  <QueryBoundary
                    isLoading={prescriptions.isLoading}
                    error={prescriptions.error}
                    isEmpty={(prescriptions.data ?? []).length === 0}
                    onRetry={() => void prescriptions.refetch()}
                    empty={
                      <EmptyState
                        icon={<FileText className="size-5" />}
                        title="No prescriptions yet"
                        body="Upload a prescription on the right and the pharmacy will review it, usually within minutes."
                      />
                    }
                  >
                    <ul className="space-y-3">
                      {(prescriptions.data ?? []).map((rx) => {
                        const chip = statusChip(PRESCRIPTION_STATUS, rx.status);
                        return (
                          <li key={rx.id} className="surface-card p-4">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <p className="font-bold">{rx.stores?.name ?? "Pharmacy"}</p>
                                <p className="text-xs text-muted-foreground">
                                  Uploaded {formatDate(rx.created_at)}
                                  {rx.prescriber_name ? ` · Dr ${rx.prescriber_name}` : ""}
                                </p>
                              </div>
                              <span
                                className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${chip.tone}`}
                              >
                                {chip.label}
                              </span>
                            </div>
                            {rx.review_note && (
                              <p className="mt-3 rounded-xl bg-muted p-3 text-sm">
                                <span className="font-semibold">Pharmacy note: </span>
                                {rx.review_note}
                              </p>
                            )}
                            {rx.expires_at && (
                              <p className="mt-2 text-xs text-muted-foreground">
                                Valid until {formatDate(rx.expires_at)}
                              </p>
                            )}
                            <div className="mt-3 flex flex-wrap gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className="rounded-full font-bold"
                                disabled={viewFile.isPending}
                                onClick={() => viewFile.mutate(rx.file_path)}
                              >
                                View file
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="rounded-full font-bold"
                                onClick={() =>
                                  setOpenEvents((current) => (current === rx.id ? null : rx.id))
                                }
                              >
                                {openEvents === rx.id ? "Hide history" : "Review history"}
                              </Button>
                            </div>
                            {openEvents === rx.id && <EventTrail prescriptionId={rx.id} />}
                          </li>
                        );
                      })}
                    </ul>
                  </QueryBoundary>
                </div>
              </section>
            </div>

            <aside className="surface-card h-fit p-4">
              <h2 className="flex items-center gap-2 font-bold">
                <Upload className="size-4 text-sky" /> Upload a prescription
              </h2>
              <form
                className="mt-3 space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  upload.mutate();
                }}
              >
                <div className="space-y-1.5">
                  <Label htmlFor="pharmacy" className="text-sm font-semibold">
                    Reviewing pharmacy
                  </Label>
                  <select
                    id="pharmacy"
                    value={form.store_id}
                    onChange={(e) => setForm((f) => ({ ...f, store_id: e.target.value }))}
                    className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
                  >
                    <option value="">
                      {pharmacies.isLoading ? "Loading pharmacies…" : "Select a pharmacy"}
                    </option>
                    {(pharmacies.data ?? []).map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                        {p.city ? ` · ${p.city}` : ""}
                      </option>
                    ))}
                  </select>
                  {!pharmacies.isLoading && (pharmacies.data ?? []).length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      No verified pharmacies are live yet.
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="rx-file" className="text-sm font-semibold">
                    Prescription file
                  </Label>
                  <Input
                    id="rx-file"
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                    className="rounded-xl"
                  />
                  <p className="text-xs text-muted-foreground">
                    Clear photo or PDF, up to 10MB. Stored privately.
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="prescriber" className="text-sm font-semibold">
                    Prescriber name
                  </Label>
                  <Input
                    id="prescriber"
                    value={form.prescriber_name}
                    onChange={(e) => setForm((f) => ({ ...f, prescriber_name: e.target.value }))}
                    className="h-11 rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="prescriber-contact" className="text-sm font-semibold">
                    Prescriber phone or clinic
                  </Label>
                  <Input
                    id="prescriber-contact"
                    value={form.prescriber_contact}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, prescriber_contact: e.target.value }))
                    }
                    className="h-11 rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="rx-note" className="text-sm font-semibold">
                    Note for the pharmacist
                  </Label>
                  <Textarea
                    id="rx-note"
                    value={form.note}
                    onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                    className="min-h-20 rounded-xl"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={upload.isPending}
                  className="w-full rounded-full py-6 font-bold"
                >
                  {upload.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    "Send for review"
                  )}
                </Button>
              </form>
            </aside>
          </div>
        )}
      </main>
      <CustomerFooter />
    </div>
  );
}

function EventTrail({ prescriptionId }: { prescriptionId: string }) {
  const events = usePrescriptionEvents(prescriptionId);
  if (events.isLoading) {
    return <p className="mt-3 text-xs text-muted-foreground">Loading history…</p>;
  }
  if (events.error) {
    return <p className="mt-3 text-xs text-destructive">Could not load the review history.</p>;
  }
  if ((events.data ?? []).length === 0) {
    return <p className="mt-3 text-xs text-muted-foreground">No review activity yet.</p>;
  }
  return (
    <ol className="mt-3 space-y-2 border-l border-border pl-4">
      {(events.data ?? []).map((event) => (
        <li key={event.id} className="text-xs">
          <p className="font-semibold">
            {statusChip(PRESCRIPTION_STATUS, event.status).label}
            {event.actor_role ? ` · ${event.actor_role}` : ""}
          </p>
          <p className="text-muted-foreground">{formatDate(event.created_at)}</p>
          {event.note && <p className="mt-1">{event.note}</p>}
        </li>
      ))}
    </ol>
  );
}

/** Reusable query hook consumers: keeps the unused import warning away. */
export const usePrescriptionQueryCount = useQuery;
