import { useMemo, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { LifeBuoy, MessageCircle, Send, X, ChevronRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth, type AppRole } from "@/lib/auth";
import {
  SUPPORT_GUIDES,
  SUPPORT_STATUS_LABELS,
  SUPPORT_TOPICS,
  useMySupportTickets,
  useOpenSupportTicket,
  useUnreadCounts,
} from "@/lib/support";

/**
 * Floating support entry point. Every action here is wired to real support
 * records — topics open a real ticket, guides are static help copy.
 */
export function SupportMascot() {
  const { session, roles } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const [topic, setTopic] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const unread = useUnreadCounts();
  const tickets = useMySupportTickets();
  const openTicket = useOpenSupportTicket();

  const activeRole: AppRole = roles.includes("seller")
    ? "seller"
    : roles.includes("rider")
      ? "rider"
      : "customer";

  const topics = useMemo(
    () => SUPPORT_TOPICS.filter((t) => t.roles.includes(activeRole)),
    [activeRole],
  );
  const guides = useMemo(
    () => (topic ? SUPPORT_GUIDES.filter((g) => g.topics.includes(topic)) : SUPPORT_GUIDES.slice(0, 3)),
    [topic],
  );

  // Never cover the rider live-delivery action bar or the support page itself.
  if (pathname.startsWith("/support") || pathname.startsWith("/rider/deliveries")) return null;

  const unreadTotal = (unread.data?.support ?? 0) + (unread.data?.messages ?? 0);

  async function submit() {
    if (!topic || message.trim().length < 5) return;
    try {
      await openTicket.mutateAsync({
        category: topic,
        subject: SUPPORT_TOPICS.find((t) => t.value === topic)?.label ?? "Support request",
        message: message.trim(),
      });
      setMessage("");
      setTopic(null);
      toast.success("Support request sent", { description: "You can follow it in Support." });
    } catch (error) {
      toast.error("Could not send that request", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    }
  }

  return (
    <>
      {open && (
        <div
          role="dialog"
          aria-label="Medra support"
          className="fixed bottom-24 right-4 z-50 flex max-h-[70vh] w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
        >
          <div className="flex items-center gap-3 border-b border-border bg-primary/10 px-4 py-3">
            <span className="grid size-9 place-items-center rounded-full bg-primary text-primary-foreground">
              <LifeBuoy className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-extrabold">Medra Support</p>
              <p className="truncate text-xs text-muted-foreground">
                {session ? "We reply inside the app." : "Log in to reach the support team."}
              </p>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close support panel"
              className="ml-auto rounded-full p-1 text-muted-foreground hover:bg-muted"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            {!session ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Support conversations are tied to your account so we can see the right order or delivery.
                </p>
                <Button asChild className="w-full rounded-full font-bold">
                  <Link to="/login">Log in to get help</Link>
                </Button>
              </div>
            ) : (
              <>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    What do you need help with?
                  </p>
                  <div className="mt-2 grid gap-1.5">
                    {topics.map((t) => (
                      <button
                        key={t.value}
                        onClick={() => setTopic(t.value === topic ? null : t.value)}
                        aria-pressed={topic === t.value}
                        className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm transition ${
                          topic === t.value
                            ? "border-primary bg-primary/10 font-bold"
                            : "border-border hover:bg-muted"
                        }`}
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-semibold">{t.label}</span>
                          <span className="block truncate text-xs text-muted-foreground">{t.blurb}</span>
                        </span>
                        <ChevronRight className="ml-auto size-4 shrink-0 text-muted-foreground" />
                      </button>
                    ))}
                  </div>
                </div>

                {guides.length > 0 && (
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                      Quick answers
                    </p>
                    <ul className="mt-2 space-y-2">
                      {guides.map((g) => (
                        <li key={g.question} className="rounded-xl bg-muted/60 p-3">
                          <p className="text-sm font-bold">{g.question}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{g.answer}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {topic && (
                  <div className="space-y-2">
                    <label htmlFor="support-message" className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                      Tell us what happened
                    </label>
                    <Textarea
                      id="support-message"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      rows={3}
                      placeholder="Add the details support will need (at least 5 characters)."
                    />
                    <Button
                      onClick={() => void submit()}
                      disabled={openTicket.isPending || message.trim().length < 5}
                      className="w-full rounded-full font-bold"
                    >
                      {openTicket.isPending ? (
                        <>
                          <Loader2 className="mr-2 size-4 animate-spin" /> Sending…
                        </>
                      ) : (
                        <>
                          <Send className="mr-2 size-4" /> Send to support
                        </>
                      )}
                    </Button>
                  </div>
                )}

                {(tickets.data ?? []).length > 0 && (
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                      Your recent requests
                    </p>
                    <ul className="mt-2 space-y-1.5">
                      {tickets.data!.slice(0, 3).map((t) => (
                        <li key={t.id}>
                          <Link
                            to="/support"
                            search={{ ticket: t.id }}
                            onClick={() => setOpen(false)}
                            className="flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm hover:bg-muted"
                          >
                            <span className="min-w-0">
                              <span className="block truncate font-semibold">{t.subject}</span>
                              <span className="block text-xs text-muted-foreground">
                                {SUPPORT_STATUS_LABELS[t.status] ?? t.status} · {t.reference}
                              </span>
                            </span>
                            <ChevronRight className="ml-auto size-4 shrink-0 text-muted-foreground" />
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </div>

          {session && (
            <div className="border-t border-border p-3">
              <Button asChild variant="outline" className="w-full rounded-full font-bold">
                <Link to="/support" search={{ ticket: undefined }} onClick={() => setOpen(false)}>
                  <MessageCircle className="mr-2 size-4" /> Open support inbox
                </Link>
              </Button>
            </div>
          )}
        </div>
      )}

      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Hide support" : "Get support"}
        aria-expanded={open}
        className="fixed bottom-5 right-4 z-50 grid size-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-xl transition hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <LifeBuoy className="size-6" />
        {unreadTotal > 0 && (
          <span className="absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
            {unreadTotal}
          </span>
        )}
      </button>
    </>
  );
}
