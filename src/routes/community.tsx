import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { MessagesSquare, Send } from "lucide-react";
import { toast } from "sonner";
import { CustomerFooter, CustomerHeader } from "@/components/medra/CustomerChrome";
import { EmptyState, QueryBoundary } from "@/components/medra/States";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/medra";
import { useAuth } from "@/lib/auth";
import {
  chatRoleLabel,
  useChannelMessages,
  useChatChannels,
  useModerateChatMessage,
  useSendChannelMessage,
  useSetChannelActive,
} from "@/lib/platform";

export const Route = createFileRoute("/community")({
  head: () => ({
    meta: [
      { title: "Medra Community Chat" },
      {
        name: "description",
        content:
          "Talk with the whole Medra community, or in your own room for customers, riders, vendors or admins. Moderated by Medra super admins.",
      },
      { property: "og:title", content: "Medra Community Chat" },
      {
        property: "og:description",
        content: "One community room for everyone, plus private rooms for each Medra role.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CommunityPage,
});

function CommunityPage() {
  const { session, roles, loading } = useAuth();
  const channels = useChatChannels();
  const [activeId, setActiveId] = useState<string | undefined>(undefined);
  const [draft, setDraft] = useState("");
  const messages = useChannelMessages(activeId);
  const send = useSendChannelMessage();
  const moderate = useModerateChatMessage();
  const setChannelActive = useSetChannelActive();
  const scroller = useRef<HTMLDivElement | null>(null);

  const isSuperAdmin = roles.includes("super_admin");

  const grouped = useMemo(() => {
    const rows = channels.data ?? [];
    return {
      community: rows.filter((c) => c.kind === "community"),
      role: rows.filter((c) => c.kind !== "community"),
    };
  }, [channels.data]);

  useEffect(() => {
    if (activeId) return;
    const first = grouped.community[0] ?? grouped.role[0];
    if (first) setActiveId(first.id);
  }, [activeId, grouped]);

  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.data]);

  const activeChannel = (channels.data ?? []).find((c) => c.id === activeId);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!activeId) return;
    send.mutate(
      { channelId: activeId, body: draft },
      {
        onSuccess: () => setDraft(""),
        onError: (err: unknown) =>
          toast.error(err instanceof Error ? err.message : "Message not sent"),
      },
    );
  }

  if (!loading && !session) {
    return (
      <>
        <CustomerHeader />
        <main className="mx-auto max-w-3xl px-5 py-20 text-center">
          <h1 className="text-3xl font-extrabold">Medra Community Chat</h1>
          <p className="mt-3 text-muted-foreground">
            Sign in to join the community room and your own role room.
          </p>
          <Button asChild className="mt-6 rounded-xl px-8 py-6 font-bold">
            <Link to="/login">Sign in to chat</Link>
          </Button>
        </main>
        <CustomerFooter />
      </>
    );
  }

  return (
    <>
      <CustomerHeader />
      <main className="mx-auto max-w-6xl px-5 py-8">
        <h1 className="text-2xl font-extrabold sm:text-3xl">Community chat</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          One room for everyone on Medra, plus a private room for your role. Super admins moderate every
          room.
        </p>

        <div className="mt-6 grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
          <aside className="space-y-5 rounded-2xl border border-border p-4">
            <ChannelGroup
              title="Community"
              channels={grouped.community}
              activeId={activeId}
              onSelect={setActiveId}
            />
            <ChannelGroup
              title="My rooms"
              channels={grouped.role}
              activeId={activeId}
              onSelect={setActiveId}
            />
            {channels.isLoading && <p className="text-sm text-muted-foreground">Loading rooms…</p>}
            {!channels.isLoading && (channels.data ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">No rooms are open to you yet.</p>
            )}
          </aside>

          <section className="flex min-h-[520px] flex-col rounded-2xl border border-border">
            <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
              <div className="min-w-0">
                <p className="font-bold">{activeChannel?.name ?? "Select a room"}</p>
                <p className="text-xs text-muted-foreground">
                  {activeChannel?.description ?? "Rooms you can access appear on the left."}
                </p>
              </div>
              {isSuperAdmin && activeChannel && (
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-lg font-bold"
                  disabled={setChannelActive.isPending}
                  onClick={() =>
                    setChannelActive.mutate(
                      { channelId: activeChannel.id, isActive: !activeChannel.is_active },
                      {
                        onSuccess: () =>
                          toast.success(activeChannel.is_active ? "Room closed" : "Room opened"),
                        onError: (err: unknown) =>
                          toast.error(err instanceof Error ? err.message : "Could not update the room"),
                      },
                    )
                  }
                >
                  {activeChannel.is_active ? "Close room" : "Open room"}
                </Button>
              )}
            </header>

            <div ref={scroller} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
              <QueryBoundary
                isLoading={messages.isLoading}
                error={messages.error}
                isEmpty={(messages.data ?? []).length === 0}
                onRetry={() => void messages.refetch()}
                empty={
                  <EmptyState
                    icon={<MessagesSquare className="size-5" />}
                    title="No messages yet"
                    body="Say hello — you'll be the first voice in this room."
                  />
                }
              >
                {(messages.data ?? []).map((m) => (
                  <div key={m.id} className="rounded-xl border border-border px-3 py-2">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span className="font-bold text-foreground">
                        {[m.sender?.first_name, m.sender?.last_name].filter(Boolean).join(" ") || "Member"}
                      </span>
                      <span className="rounded-full bg-muted px-2 py-0.5 font-semibold">
                        {chatRoleLabel(m.sender_role)}
                      </span>
                      <span>{formatDate(m.created_at)}</span>
                    </div>
                    <p className={`mt-1 text-sm ${m.is_hidden ? "italic text-muted-foreground" : ""}`}>
                      {m.is_hidden ? "Message removed by a moderator." : m.body}
                    </p>
                    {isSuperAdmin && (
                      <button
                        type="button"
                        className="mt-1 text-xs font-bold text-primary hover:underline"
                        disabled={moderate.isPending}
                        onClick={() =>
                          moderate.mutate(
                            { messageId: m.id, hidden: !m.is_hidden },
                            {
                              onError: (err: unknown) =>
                                toast.error(
                                  err instanceof Error ? err.message : "Could not moderate this message",
                                ),
                            },
                          )
                        }
                      >
                        {m.is_hidden ? "Restore message" : "Hide message"}
                      </button>
                    )}
                  </div>
                ))}
              </QueryBoundary>
            </div>

            <form onSubmit={submit} className="flex gap-2 border-t border-border px-4 py-3">
              <Input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={
                  activeChannel?.is_active === false ? "This room is closed" : "Write a message…"
                }
                disabled={!activeId || activeChannel?.is_active === false}
                className="h-11 rounded-xl"
              />
              <Button
                type="submit"
                disabled={!activeId || send.isPending || activeChannel?.is_active === false}
                className="h-11 rounded-xl px-5 font-bold"
              >
                <Send className="size-4" />
              </Button>
            </form>
          </section>
        </div>
      </main>
      <CustomerFooter />
    </>
  );
}

function ChannelGroup({
  title,
  channels,
  activeId,
  onSelect,
}: {
  title: string;
  channels: { id: string; name: string; description: string | null; is_active: boolean }[];
  activeId: string | undefined;
  onSelect: (id: string) => void;
}) {
  if (channels.length === 0) return null;
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{title}</p>
      <div className="mt-2 space-y-1">
        {channels.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => onSelect(c.id)}
            className={`w-full rounded-xl px-3 py-2 text-left text-sm font-semibold ${
              c.id === activeId ? "bg-primary text-primary-foreground" : "hover:bg-muted"
            }`}
          >
            {c.name}
            {!c.is_active && <span className="ml-1 text-xs font-normal">(closed)</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
