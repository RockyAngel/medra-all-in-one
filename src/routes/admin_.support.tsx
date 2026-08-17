import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { LifeBuoy, Send } from "lucide-react";
import { toast } from "sonner";
import { Panel } from "@/components/medra/DashboardShell";
import { AdminPage, FilterTabs, Pill } from "@/components/medra/RoleDashboard";
import { EmptyState, LoadingState, QueryBoundary } from "@/components/medra/States";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { formatDate } from "@/lib/medra";
import {
  SUPPORT_PRIORITY_TONE,
  SUPPORT_STATUS_LABELS,
  SUPPORT_STATUS_TONE,
  useSendSupportMessage,
  useSupportAdminAction,
  useSupportEvents,
  useSupportInbox,
  useSupportMessages,
} from "@/lib/support";

export const Route = createFileRoute("/admin_/support")({
  head: () => ({
    meta: [
      { title: "Support inbox — Medra admin" },
      {
        name: "description",
        content:
          "Work the Medra support inbox: reply to customers, vendors and riders, add internal notes and escalate SOS tickets.",
      },
      { property: "og:title", content: "Support inbox — Medra admin" },
      { property: "og:description", content: "Support ticket workspace for the Medra team." },
    ],
  }),
  component: AdminSupportPage,
});

const FILTERS = [
  { key: "open", label: "Open" },
  { key: "waiting_support", label: "Waiting on us" },
  { key: "waiting_user", label: "Waiting on user" },
  { key: "escalated", label: "Escalated" },
  { key: "sos", label: "SOS" },
  { key: "unassigned", label: "Unassigned" },
  { key: "all", label: "All" },
];

function AdminSupportPage() {
  const [filter, setFilter] = useState("open");
  const [activeId, setActiveId] = useState<string | null>(null);

  const inbox = useSupportInbox({
    ...(filter === "sos" ? { sosOnly: true } : {}),
    ...(filter === "unassigned" ? { assigned: "unassigned" } : {}),
    ...(filter !== "all" && filter !== "sos" && filter !== "unassigned" ? { status: filter } : {}),
    pageSize: 30,
  });

  const rows = inbox.data?.rows ?? [];
  const active = rows.find((t) => t.id === activeId) ?? null;

  return (
    <AdminPage title="Support inbox" subtitle="Every ticket raised by customers, vendors and riders">
      <FilterTabs
        options={FILTERS}
        value={filter}
        onChange={(key) => {
          setFilter(key);
          setActiveId(null);
        }}
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <Panel title={`Tickets (${inbox.data?.count ?? 0})`}>
          <QueryBoundary
            isLoading={inbox.isLoading}
            error={inbox.error}
            isEmpty={rows.length === 0}
            onRetry={() => void inbox.refetch()}
            empty={
              <EmptyState
                icon={<LifeBuoy className="size-5" />}
                title="No tickets in this view"
                body="Tickets arrive here the moment someone asks for help in the app."
              />
            }
          >
            <div className="space-y-2">
              {rows.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setActiveId(t.id)}
                  className={`w-full rounded-xl border p-3 text-left transition-colors ${
                    activeId === t.id ? "border-primary bg-primary/5" : "border-border hover:bg-muted"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="min-w-0 truncate font-bold">{t.subject}</p>
                    {t.is_sos ? (
                      <Pill tone="bg-destructive/15 text-destructive">SOS</Pill>
                    ) : (
                      <Pill tone={SUPPORT_PRIORITY_TONE[t.priority]}>{t.priority}</Pill>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t.reference} · {t.category} · {formatDate(t.last_activity_at)}
                  </p>
                  <div className="mt-2">
                    <Pill tone={SUPPORT_STATUS_TONE[t.status]}>
                      {SUPPORT_STATUS_LABELS[t.status] ?? t.status}
                    </Pill>
                  </div>
                </button>
              ))}
            </div>
          </QueryBoundary>
        </Panel>

        {active ? (
          <TicketWorkspace
            ticketId={active.id}
            subject={active.subject}
            status={active.status}
            assigned={!!active.assigned_to}
          />
        ) : (
          <Panel title="Ticket">
            <EmptyState
              icon={<LifeBuoy className="size-5" />}
              title="Pick a ticket"
              body="Select a ticket on the left to read the conversation and reply."
            />
          </Panel>
        )}
      </div>
    </AdminPage>
  );
}

function TicketWorkspace({
  ticketId,
  subject,
  status,
  assigned,
}: {
  ticketId: string;
  subject: string;
  status: string;
  assigned: boolean;
}) {
  const messages = useSupportMessages(ticketId);
  const events = useSupportEvents(ticketId);
  const send = useSendSupportMessage();
  const action = useSupportAdminAction();
  const [body, setBody] = useState("");
  const [internal, setInternal] = useState(false);

  function reply() {
    if (!body.trim()) return;
    send.mutate(
      { ticketId, body: body.trim(), internal },
      {
        onSuccess: () => {
          setBody("");
          toast.success(internal ? "Internal note added" : "Reply sent");
        },
        onError: (e: unknown) =>
          toast.error(e instanceof Error ? e.message : "Could not send that message"),
      },
    );
  }

  function runAction(name: string, value?: string) {
    action.mutate(
      { ticketId, action: name, ...(value ? { value } : {}) },
      {
        onSuccess: () => toast.success("Ticket updated"),
        onError: (e: unknown) =>
          toast.error(e instanceof Error ? e.message : "Could not update the ticket"),
      },
    );
  }

  return (
    <div className="space-y-4">
      <Panel title={subject}>
        <div className="mb-3 flex flex-wrap gap-2">
          {!assigned && (
            <Button size="sm" className="rounded-lg font-bold" onClick={() => runAction("assign_self")}>
              Assign to me
            </Button>
          )}
          <Button size="sm" variant="outline" className="rounded-lg font-bold" onClick={() => runAction("escalate")}>
            Escalate
          </Button>
          <Button size="sm" variant="outline" className="rounded-lg font-bold" onClick={() => runAction("resolve")}>
            Resolve
          </Button>
          <Button size="sm" variant="outline" className="rounded-lg font-bold" onClick={() => runAction("close")}>
            Close
          </Button>
          <Pill tone={SUPPORT_STATUS_TONE[status]}>{SUPPORT_STATUS_LABELS[status] ?? status}</Pill>
        </div>

        {messages.isLoading ? (
          <LoadingState label="Loading conversation…" />
        ) : (messages.data ?? []).length === 0 ? (
          <EmptyState title="No messages yet" body="Send the first reply to start the conversation." />
        ) : (
          <div className="max-h-[420px] space-y-3 overflow-y-auto pr-1">
            {(messages.data ?? []).map((m) => (
              <div
                key={m.id}
                className={`rounded-xl border p-3 text-sm ${
                  m.is_internal ? "border-amber/40 bg-amber/10" : "border-border"
                }`}
              >
                <div className="mb-1 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span className="font-bold capitalize">{m.sender_role ?? "user"}</span>
                  <span>
                    {m.is_internal ? "Internal note · " : ""}
                    {formatDate(m.created_at)}
                  </span>
                </div>
                <p className="whitespace-pre-wrap">{m.deleted_at ? "Message removed" : m.body}</p>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 space-y-2">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={internal ? "Internal note — not visible to the user" : "Reply to the user"}
            className="rounded-lg"
          />
          <div className="flex items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                className="accent-primary"
                checked={internal}
                onChange={(e) => setInternal(e.target.checked)}
              />
              Internal note
            </label>
            <Button
              className="rounded-lg font-bold"
              disabled={send.isPending || !body.trim()}
              onClick={reply}
            >
              <Send className="mr-2 size-4" /> Send
            </Button>
          </div>
        </div>
      </Panel>

      <Panel title="Activity">
        {(events.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No status changes recorded yet.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {(events.data ?? []).map((e) => (
              <li key={e.id} className="flex items-start justify-between gap-3">
                <span>
                  <span className="font-semibold capitalize">{e.action.replace(/_/g, " ")}</span>
                  {e.to_value ? ` → ${e.to_value}` : ""}
                  {e.reason ? ` · ${e.reason}` : ""}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">{formatDate(e.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
