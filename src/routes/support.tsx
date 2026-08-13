import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Loader2, MessageCircle, Paperclip, Send, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { CustomerFooter, CustomerHeader } from "@/components/medra/CustomerChrome";
import { EmptyState, QueryBoundary } from "@/components/medra/States";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { formatDate } from "@/lib/medra";
import {
  SUPPORT_PRIORITY_TONE,
  SUPPORT_STATUS_LABELS,
  SUPPORT_STATUS_TONE,
  signedAttachmentUrl,
  uploadSupportAttachment,
  useMarkSupportRead,
  useMySupportTickets,
  useSendSupportMessage,
  useSupportMessages,
} from "@/lib/support";

export const Route = createFileRoute("/support")({
  validateSearch: (search: Record<string, unknown>) => ({
    ticket: typeof search["ticket"] === "string" ? (search["ticket"] as string) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Support — Medra" },
      {
        name: "description",
        content: "Message the Medra support team about orders, deliveries, payments and refunds.",
      },
      { property: "og:title", content: "Support — Medra" },
      { property: "og:description", content: "Get help with your Medra orders, deliveries and payments." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SupportPage,
});

function SupportPage() {
  const { session, user } = useAuth();
  const { ticket: ticketId } = Route.useSearch();
  const navigate = useNavigate();

  const tickets = useMySupportTickets();
  const markRead = useMarkSupportRead();

  const active = (tickets.data ?? []).find((t) => t.id === ticketId) ?? tickets.data?.[0] ?? null;

  useEffect(() => {
    if (active?.id) markRead.mutate(active.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.id]);

  return (
    <div className="min-h-screen bg-background">
      <CustomerHeader />
      <div className="mx-auto max-w-6xl px-5 py-8">
        <h1 className="text-2xl font-extrabold">Support</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every conversation here is handled by the Medra support team and kept with your account.
        </p>

        {!session ? (
          <div className="mt-6">
            <EmptyState
              title="Log in to reach support"
              body="Support conversations are linked to your account so we can see the right order or delivery."
              action={
                <Button asChild className="rounded-full px-6 font-bold">
                  <Link to="/login">Log in</Link>
                </Button>
              }
            />
          </div>
        ) : (
          <div className="mt-6 grid gap-4 lg:grid-cols-[20rem_1fr]">
            <div className="surface-card p-3">
              <QueryBoundary
                isLoading={tickets.isLoading}
                error={tickets.error}
                isEmpty={(tickets.data ?? []).length === 0}
                onRetry={() => void tickets.refetch()}
                empty={
                  <EmptyState
                    icon={<MessageCircle className="size-5" />}
                    title="No support requests yet"
                    body="Use the support button in the corner of any page to start a conversation."
                  />
                }
              >
                <ul className="space-y-1.5">
                  {tickets.data?.map((t) => {
                    const selected = t.id === active?.id;
                    return (
                      <li key={t.id}>
                        <button
                          onClick={() => void navigate({ to: "/support", search: { ticket: t.id } })}
                          aria-current={selected}
                          className={`w-full rounded-xl border px-3 py-2 text-left transition ${
                            selected ? "border-primary bg-primary/10" : "border-border hover:bg-muted"
                          }`}
                        >
                          <p className="truncate text-sm font-bold">{t.subject}</p>
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">{t.reference}</p>
                          <span className="mt-2 flex flex-wrap gap-1.5">
                            <span
                              className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${SUPPORT_STATUS_TONE[t.status] ?? "bg-muted text-muted-foreground"}`}
                            >
                              {SUPPORT_STATUS_LABELS[t.status] ?? t.status}
                            </span>
                            {t.is_sos && (
                              <span className="flex items-center gap-1 rounded-full bg-destructive px-2 py-0.5 text-[11px] font-bold text-destructive-foreground">
                                <ShieldAlert className="size-3" /> SOS
                              </span>
                            )}
                            {(t.priority === "high" || t.priority === "urgent" || t.priority === "critical") && (
                              <span
                                className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${SUPPORT_PRIORITY_TONE[t.priority]}`}
                              >
                                {t.priority}
                              </span>
                            )}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </QueryBoundary>
            </div>

            {active ? (
              <SupportThread
                ticketId={active.id}
                subject={active.subject}
                status={active.status}
                userId={user?.id ?? ""}
              />
            ) : (
              <div className="surface-card p-6">
                <EmptyState
                  title="Nothing selected"
                  body="Pick a request on the left, or start a new one from the support button."
                />
              </div>
            )}
          </div>
        )}
      </div>
      <CustomerFooter />
    </div>
  );
}

function SupportThread({
  ticketId,
  subject,
  status,
  userId,
}: {
  ticketId: string;
  subject: string;
  status: string;
  userId: string;
}) {
  const messages = useSupportMessages(ticketId);
  const send = useSendSupportMessage();
  const [body, setBody] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const closed = status === "closed";

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.data?.length]);

  async function submit() {
    if (!body.trim() && !file) return;
    setUploading(true);
    try {
      const attachment = file ? await uploadSupportAttachment(userId, file) : undefined;
      await send.mutateAsync({
        ticketId,
        body: body.trim() || (attachment ? attachment.name : ""),
        ...(attachment ? { attachment } : {}),
      });
      setBody("");
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
    } catch (error) {
      toast.error("Message not sent", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setUploading(false);
    }
  }

  const busy = uploading || send.isPending;

  return (
    <div className="surface-card flex min-h-[28rem] flex-col p-4">
      <div className="flex flex-wrap items-center gap-2 border-b border-border pb-3">
        <h2 className="text-sm font-extrabold">{subject}</h2>
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${SUPPORT_STATUS_TONE[status] ?? "bg-muted text-muted-foreground"}`}
        >
          {SUPPORT_STATUS_LABELS[status] ?? status}
        </span>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto py-4">
        <QueryBoundary
          isLoading={messages.isLoading}
          error={messages.error}
          isEmpty={(messages.data ?? []).length === 0}
          onRetry={() => void messages.refetch()}
          empty={<EmptyState title="No messages yet" body="Send the first message below." />}
        >
          <ul className="space-y-3">
            {messages.data?.map((m) => {
              const mine = m.sender_id === userId;
              return (
                <li key={m.id} className={mine ? "flex justify-end" : "flex justify-start"}>
                  <div
                    className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                      mine ? "bg-primary text-primary-foreground" : "bg-muted"
                    }`}
                  >
                    {!mine && (
                      <p className="text-[11px] font-bold uppercase tracking-wide opacity-70">
                        {m.sender_role === "customer" ? "You" : "Medra support"}
                      </p>
                    )}
                    <p className="whitespace-pre-wrap break-words">
                      {m.deleted_at ? "This message was removed." : m.body}
                    </p>
                    {m.attachment_path && !m.deleted_at && (
                      <button
                        onClick={async () => {
                          try {
                            const url = await signedAttachmentUrl(m.attachment_path!);
                            window.open(url, "_blank", "noopener");
                          } catch {
                            toast.error("That attachment could not be opened.");
                          }
                        }}
                        className="mt-1 flex items-center gap-1 text-xs font-bold underline"
                      >
                        <Paperclip className="size-3" /> {m.attachment_name ?? "Attachment"}
                      </button>
                    )}
                    <p className="mt-1 text-[11px] opacity-70">{formatDate(m.created_at)}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </QueryBoundary>
        <div ref={bottomRef} />
      </div>

      {closed ? (
        <p className="rounded-xl bg-muted p-3 text-sm text-muted-foreground">
          This request is closed. Start a new request from the support button if you still need help.
        </p>
      ) : (
        <div className="space-y-2 border-t border-border pt-3">
          <label htmlFor="support-reply" className="sr-only">
            Message support
          </label>
          <Textarea
            id="support-reply"
            rows={2}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write a message…"
          />
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif,application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="max-w-[14rem] text-xs"
              aria-label="Attach a file (images or PDF, up to 10MB)"
            />
            {file && <span className="truncate text-xs text-muted-foreground">{file.name}</span>}
            <Button
              onClick={() => void submit()}
              disabled={busy || (!body.trim() && !file)}
              className="ml-auto rounded-full font-bold"
            >
              {busy ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" /> Sending…
                </>
              ) : (
                <>
                  <Send className="mr-2 size-4" /> Send
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
