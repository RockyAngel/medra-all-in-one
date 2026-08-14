import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { CalendarClock, Loader2, MessageCircle, Send } from "lucide-react";
import { toast } from "sonner";
import { CustomerFooter, CustomerHeader } from "@/components/medra/CustomerChrome";
import { EmptyState, QueryBoundary } from "@/components/medra/States";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { formatDate, formatNaira } from "@/lib/medra";
import { workflowError } from "@/lib/workflow";
import {
  CONSULTATION_STATUS,
  statusChip,
  useConsultationMessages,
  useMyConsultations,
} from "@/lib/health";

export const Route = createFileRoute("/health/appointments")({
  head: () => ({
    meta: [
      { title: "Your appointments — Medra" },
      {
        name: "description",
        content:
          "Track your Medra telehealth appointments: confirmation, waiting room, secure chat with your professional and completion.",
      },
      { property: "og:title", content: "Your appointments — Medra" },
      {
        property: "og:description",
        content: "Follow your Medra consultations from booking to completion.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AppointmentsPage,
});

function AppointmentsPage() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const consultations = useMyConsultations();
  const [openChat, setOpenChat] = useState<string | null>(null);

  const setStatus = useMutation({
    mutationFn: async ({
      id,
      status,
      reason,
    }: {
      id: string;
      status: "waiting" | "cancelled";
      reason?: string;
    }) => {
      const { error } = await supabase.rpc("set_consultation_status", {
        _consultation_id: id,
        _status: status,
        ...(reason ? { _reason: reason } : {}),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Appointment updated");
      void queryClient.invalidateQueries({ queryKey: ["consultations"] });
    },
    onError: (e) => toast.error(workflowError(e)),
  });

  return (
    <div className="min-h-screen bg-background">
      <CustomerHeader />
      <main className="mx-auto max-w-4xl px-5 py-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-leaf">Health</p>
            <h1 className="mt-1 text-2xl font-extrabold">Your appointments</h1>
          </div>
          <Button asChild className="rounded-full font-bold">
            <Link to="/health/telehealth">Book a consultation</Link>
          </Button>
        </div>

        {!session ? (
          <div className="mt-6">
            <EmptyState
              icon={<CalendarClock className="size-5" />}
              title="Log in to see your appointments"
              body="Consultations are private to your Medra account."
              action={
                <Button asChild className="rounded-full px-6 font-bold">
                  <Link to="/login">Log in</Link>
                </Button>
              }
            />
          </div>
        ) : (
          <div className="mt-6">
            <QueryBoundary
              isLoading={consultations.isLoading}
              error={consultations.error}
              isEmpty={(consultations.data ?? []).length === 0}
              onRetry={() => void consultations.refetch()}
              empty={
                <EmptyState
                  icon={<CalendarClock className="size-5" />}
                  title="No appointments yet"
                  body="Book a pharmacist or doctor consultation and it will appear here with its live status."
                  action={
                    <Button asChild className="rounded-full px-6 font-bold">
                      <Link to="/health/telehealth">Browse consultations</Link>
                    </Button>
                  }
                />
              }
            >
              <ul className="space-y-4">
                {(consultations.data ?? []).map((c) => {
                  const chip = statusChip(CONSULTATION_STATUS, c.status);
                  const chatOpen = openChat === c.id;
                  const canChat =
                    c.payment_status === "paid" &&
                    ["confirmed", "waiting", "in_progress", "completed"].includes(c.status);
                  const canAct = ["confirmed", "waiting", "booked"].includes(c.status);
                  return (
                    <li key={c.id} className="surface-card p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-bold">
                            {c.telehealth_services?.label ?? "Consultation"} ·{" "}
                            {c.health_professionals?.full_name ?? "Professional"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {c.reference} · {formatDate(c.scheduled_at)} ·{" "}
                            {c.mode === "call" ? "Call" : "Chat"} ·{" "}
                            {formatNaira(c.price_charged)}
                          </p>
                        </div>
                        <span
                          className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${chip.tone}`}
                        >
                          {chip.label}
                        </span>
                      </div>

                      {c.customer_note && (
                        <p className="mt-3 rounded-xl bg-muted p-3 text-sm">{c.customer_note}</p>
                      )}
                      {c.professional_note && (
                        <p className="mt-3 rounded-xl border border-border p-3 text-sm">
                          <span className="font-semibold">Professional's summary: </span>
                          {c.professional_note}
                        </p>
                      )}
                      {c.status === "completed" && c.duration_minutes && (
                        <p className="mt-2 text-xs text-muted-foreground">
                          Session lasted {c.duration_minutes} minutes.
                        </p>
                      )}
                      {c.cancel_reason && (
                        <p className="mt-2 text-xs text-destructive">{c.cancel_reason}</p>
                      )}

                      <div className="mt-4 flex flex-wrap gap-2">
                        {canChat && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="rounded-full font-bold"
                            onClick={() => setOpenChat(chatOpen ? null : c.id)}
                          >
                            <MessageCircle className="mr-1 size-4" />
                            {chatOpen ? "Hide messages" : "Messages"}
                          </Button>
                        )}
                        {canAct && c.status !== "waiting" && (
                          <Button
                            size="sm"
                            className="rounded-full font-bold"
                            disabled={setStatus.isPending}
                            onClick={() => setStatus.mutate({ id: c.id, status: "waiting" })}
                          >
                            I'm ready now
                          </Button>
                        )}
                        {canAct && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="rounded-full font-bold text-destructive"
                            disabled={setStatus.isPending}
                            onClick={() =>
                              setStatus.mutate({
                                id: c.id,
                                status: "cancelled",
                                reason: "Cancelled by customer",
                              })
                            }
                          >
                            Cancel
                          </Button>
                        )}
                      </div>

                      {chatOpen && <ConsultationChat consultationId={c.id} />}
                    </li>
                  );
                })}
              </ul>
            </QueryBoundary>
          </div>
        )}
      </main>
      <CustomerFooter />
    </div>
  );
}

function ConsultationChat({ consultationId }: { consultationId: string }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const messages = useConsultationMessages(consultationId);
  const [body, setBody] = useState("");

  const send = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Log in to send a message");
      if (!body.trim()) throw new Error("Type a message first");
      const { error } = await supabase.from("consultation_messages").insert({
        consultation_id: consultationId,
        sender_id: user.id,
        sender_role: "customer",
        body: body.trim().slice(0, 2000),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setBody("");
      void queryClient.invalidateQueries({ queryKey: ["consultation-messages", consultationId] });
    },
    onError: (e) => toast.error(workflowError(e)),
  });

  return (
    <div className="mt-4 rounded-xl border border-border p-3">
      {messages.isLoading ? (
        <p className="text-xs text-muted-foreground">Loading messages…</p>
      ) : messages.error ? (
        <p className="text-xs text-destructive">Could not load this conversation.</p>
      ) : (messages.data ?? []).length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No messages yet. Say hello — this thread is private to you and your professional.
        </p>
      ) : (
        <ul className="max-h-72 space-y-2 overflow-y-auto">
          {(messages.data ?? []).map((m) => {
            const mine = m.sender_id === user?.id;
            return (
              <li
                key={m.id}
                className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                  mine ? "ml-auto bg-primary/10" : "bg-muted"
                }`}
              >
                <p>{m.body}</p>
                <p className="mt-1 text-[10px] text-muted-foreground">{formatDate(m.created_at)}</p>
              </li>
            );
          })}
        </ul>
      )}
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          send.mutate();
        }}
      >
        <Input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write a message…"
          className="h-11 rounded-xl"
        />
        <Button
          type="submit"
          disabled={send.isPending}
          className="rounded-full px-4 font-bold"
          aria-label="Send message"
        >
          {send.isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        </Button>
      </form>
    </div>
  );
}
