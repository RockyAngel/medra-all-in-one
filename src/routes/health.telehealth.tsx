import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { CalendarClock, Loader2, Stethoscope } from "lucide-react";
import { toast } from "sonner";
import { CustomerFooter, CustomerHeader } from "@/components/medra/CustomerChrome";
import { EmptyState, QueryBoundary } from "@/components/medra/States";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { formatDate, formatNaira } from "@/lib/medra";
import { workflowError } from "@/lib/workflow";
import {
  useHealthProfessionals,
  useProfessionalSlots,
  useTelehealthServices,
} from "@/lib/health";

export const Route = createFileRoute("/health/telehealth")({
  head: () => ({
    meta: [
      { title: "Talk to a pharmacist or doctor — Medra" },
      {
        name: "description",
        content:
          "Book a paid call or chat with a verified Medra pharmacist or doctor, pick a real available slot and get confirmed instantly after payment.",
      },
      { property: "og:title", content: "Talk to a pharmacist or doctor — Medra" },
      {
        property: "og:description",
        content: "Book a telehealth consultation with a verified Medra health professional.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TelehealthPage,
});

function TelehealthPage() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const services = useTelehealthServices();
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [professionalId, setProfessionalId] = useState<string | null>(null);
  const [slotId, setSlotId] = useState<string | null>(null);
  const [note, setNote] = useState("");

  const service = useMemo(
    () => (services.data ?? []).find((s) => s.id === serviceId) ?? null,
    [services.data, serviceId],
  );
  const professionals = useHealthProfessionals(service?.professional_type);
  const slots = useProfessionalSlots(professionalId);
  const professional = (professionals.data ?? []).find((p) => p.id === professionalId) ?? null;

  const book = useMutation({
    mutationFn: async () => {
      if (!service || !professionalId) throw new Error("Pick a service and a professional");
      const booked = await supabase.rpc("book_consultation", {
        _service_id: service.id,
        _professional_id: professionalId,
        ...(slotId ? { _availability_id: slotId } : {}),
        ...(note.trim() ? { _note: note.trim() } : {}),
      });
      if (booked.error) throw booked.error;
      const payload = (booked.data ?? {}) as { consultation_id?: string; reference?: string };
      if (!payload.consultation_id) throw new Error("Booking failed, please try again");
      const paid = await supabase.rpc("confirm_consultation_payment", {
        _consultation_id: payload.consultation_id,
        _provider: "card",
        _reference: `MEDRA-TH-${payload.reference ?? payload.consultation_id}`,
      });
      if (paid.error) throw paid.error;
      return payload;
    },
    onSuccess: (payload) => {
      toast.success(`Appointment ${payload.reference ?? ""} confirmed`);
      setSlotId(null);
      setNote("");
      void queryClient.invalidateQueries({ queryKey: ["consultations"] });
      void queryClient.invalidateQueries({ queryKey: ["professional-slots"] });
      void navigate({ to: "/health/appointments" });
    },
    onError: (e) => toast.error(workflowError(e)),
  });

  return (
    <div className="min-h-screen bg-background">
      <CustomerHeader />
      <main className="mx-auto max-w-6xl px-5 py-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-leaf">Health</p>
            <h1 className="mt-1 text-2xl font-extrabold">Talk to a health professional</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Verified pharmacists and doctors, real availability, and a confirmed appointment as
              soon as payment goes through.
            </p>
          </div>
          <Button asChild variant="outline" className="rounded-full font-bold">
            <Link to="/health/appointments">My appointments</Link>
          </Button>
        </div>

        <section className="mt-8">
          <h2 className="font-bold">1. Choose a consultation</h2>
          <div className="mt-3">
            <QueryBoundary
              isLoading={services.isLoading}
              error={services.error}
              isEmpty={(services.data ?? []).length === 0}
              onRetry={() => void services.refetch()}
              empty={
                <EmptyState
                  icon={<Stethoscope className="size-5" />}
                  title="No consultation types available"
                  body="Telehealth pricing hasn't been published yet. Please check back soon."
                />
              }
            >
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {(services.data ?? []).map((s) => {
                  const active = s.id === serviceId;
                  return (
                    <button
                      key={s.id}
                      onClick={() => {
                        setServiceId(s.id);
                        setProfessionalId(null);
                        setSlotId(null);
                      }}
                      className={`surface-card p-4 text-left transition-colors ${
                        active ? "border-primary ring-2 ring-primary/30" : "hover:border-primary/50"
                      }`}
                    >
                      <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                        {s.professional_type === "doctor" ? "Doctor" : "Pharmacist"} ·{" "}
                        {s.mode === "call" ? "Call" : "Chat"}
                      </p>
                      <p className="mt-1 font-bold">{s.label}</p>
                      <p className="mt-2 text-lg font-extrabold text-grape">
                        {formatNaira(s.price)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {s.duration_minutes} minute session
                      </p>
                    </button>
                  );
                })}
              </div>
            </QueryBoundary>
          </div>
        </section>

        {service && (
          <section className="mt-8">
            <h2 className="font-bold">2. Choose a {service.professional_type}</h2>
            <div className="mt-3">
              <QueryBoundary
                isLoading={professionals.isLoading}
                error={professionals.error}
                isEmpty={(professionals.data ?? []).length === 0}
                onRetry={() => void professionals.refetch()}
                empty={
                  <EmptyState
                    icon={<Stethoscope className="size-5" />}
                    title={`No verified ${service.professional_type}s available`}
                    body="Nobody is accepting this consultation type right now. Try again a little later."
                  />
                }
              >
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {(professionals.data ?? [])
                    .filter(
                      (p) =>
                        p.consultation_modes.length === 0 ||
                        p.consultation_modes.includes(service.mode),
                    )
                    .map((p) => {
                      const active = p.id === professionalId;
                      return (
                        <button
                          key={p.id}
                          onClick={() => {
                            setProfessionalId(p.id);
                            setSlotId(null);
                          }}
                          className={`surface-card p-4 text-left transition-colors ${
                            active
                              ? "border-primary ring-2 ring-primary/30"
                              : "hover:border-primary/50"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-bold">{p.full_name}</p>
                            {p.is_available_now && (
                              <span className="rounded-full bg-leaf/15 px-2 py-0.5 text-[11px] font-bold text-leaf">
                                Available now
                              </span>
                            )}
                          </div>
                          {p.credentials && (
                            <p className="text-xs text-muted-foreground">{p.credentials}</p>
                          )}
                          {p.specialties.length > 0 && (
                            <p className="mt-2 text-xs text-muted-foreground">
                              {p.specialties.join(" · ")}
                            </p>
                          )}
                          {p.bio && <p className="mt-2 line-clamp-3 text-sm">{p.bio}</p>}
                        </button>
                      );
                    })}
                </div>
              </QueryBoundary>
            </div>
          </section>
        )}

        {service && professionalId && (
          <section className="mt-8 grid gap-6 lg:grid-cols-[1fr_320px]">
            <div>
              <h2 className="font-bold">3. Pick a time</h2>
              <div className="mt-3">
                <QueryBoundary
                  isLoading={slots.isLoading}
                  error={slots.error}
                  isEmpty={(slots.data ?? []).length === 0}
                  onRetry={() => void slots.refetch()}
                  empty={
                    <EmptyState
                      icon={<CalendarClock className="size-5" />}
                      title="No published slots"
                      body={
                        professional?.is_available_now
                          ? "This professional is online now — book an immediate session on the right."
                          : "This professional hasn't published availability yet. Pick someone else or check back soon."
                      }
                    />
                  }
                >
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {(slots.data ?? [])
                      .filter((slot) => slot.mode === "both" || slot.mode === service.mode)
                      .map((slot) => {
                        const active = slot.id === slotId;
                        return (
                          <button
                            key={slot.id}
                            onClick={() => setSlotId(active ? null : slot.id)}
                            className={`rounded-xl border p-3 text-left text-sm transition-colors ${
                              active
                                ? "border-primary bg-primary/5 font-bold"
                                : "border-border hover:border-primary/50"
                            }`}
                          >
                            {formatDate(slot.starts_at)}
                          </button>
                        );
                      })}
                  </div>
                </QueryBoundary>
              </div>
            </div>

            <aside className="surface-card h-fit p-4">
              <h2 className="font-bold">Confirm booking</h2>
              <dl className="mt-3 space-y-2 text-sm">
                <Row label="Consultation" value={service.label} />
                <Row label="Professional" value={professional?.full_name ?? "—"} />
                <Row
                  label="When"
                  value={
                    slotId
                      ? formatDate(
                          (slots.data ?? []).find((s) => s.id === slotId)?.starts_at ??
                            new Date().toISOString(),
                        )
                      : professional?.is_available_now
                        ? "As soon as possible"
                        : "Select a slot"
                  }
                />
                <div className="border-t border-border pt-2">
                  <Row label="Total" value={formatNaira(service.price)} bold />
                </div>
              </dl>
              <div className="mt-3 space-y-1.5">
                <Label htmlFor="th-note" className="text-sm font-semibold">
                  What would you like to discuss?
                </Label>
                <Textarea
                  id="th-note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="min-h-24 rounded-xl"
                />
              </div>
              {!session ? (
                <Button asChild className="mt-4 w-full rounded-full py-6 font-bold">
                  <Link to="/login">Log in to book</Link>
                </Button>
              ) : (
                <Button
                  disabled={
                    book.isPending || (!slotId && !professional?.is_available_now)
                  }
                  onClick={() => book.mutate()}
                  className="mt-4 w-full rounded-full py-6 font-bold"
                >
                  {book.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    `Pay ${formatNaira(service.price)} & confirm`
                  )}
                </Button>
              )}
              <p className="mt-2 text-xs text-muted-foreground">
                Card payment only. Your appointment is confirmed the moment payment succeeds.
              </p>
            </aside>
          </section>
        )}
      </main>
      <CustomerFooter />
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className={bold ? "font-bold" : "text-muted-foreground"}>{label}</dt>
      <dd className={`text-right ${bold ? "font-extrabold" : "font-semibold"}`}>{value}</dd>
    </div>
  );
}
