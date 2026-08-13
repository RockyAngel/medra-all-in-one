import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { CustomerFooter, CustomerHeader } from "@/components/medra/CustomerChrome";
import { EmptyState, QueryBoundary } from "@/components/medra/States";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { formatDate } from "@/lib/medra";

export const Route = createFileRoute("/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications — Medra" },
      { name: "description", content: "Order updates, delivery alerts and reward news from Medra." },
      { property: "og:title", content: "Notifications — Medra" },
      { property: "og:description", content: "Stay on top of your Medra orders and rewards." },
    ],
  }),
  component: NotificationsPage,
});

function NotificationsPage() {
  const { user, session } = useAuth();
  const queryClient = useQueryClient();

  const notifications = useQuery({
    queryKey: ["notifications", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("id, title, body, link, read_at, created_at")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  const markAllRead = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("user_id", user!.id)
        .is("read_at", null);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
      void queryClient.invalidateQueries({ queryKey: ["unread-notifications"] });
    },
  });

  const unread = (notifications.data ?? []).filter((n) => !n.read_at).length;

  return (
    <div className="min-h-screen bg-background">
      <CustomerHeader />
      <div className="mx-auto max-w-3xl px-5 py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-extrabold">Notifications</h1>
          {unread > 0 && (
            <Button
              variant="outline"
              className="rounded-full font-bold"
              disabled={markAllRead.isPending}
              onClick={() => markAllRead.mutate()}
            >
              Mark all read
            </Button>
          )}
        </div>

        {!session ? (
          <div className="mt-6">
            <EmptyState
              title="Log in to see notifications"
              body="Order and delivery updates are sent to your Medra account."
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
              isLoading={notifications.isLoading}
              error={notifications.error}
              isEmpty={(notifications.data ?? []).length === 0}
              onRetry={() => void notifications.refetch()}
              empty={
                <EmptyState
                  icon={<Bell className="size-5" />}
                  title="No notifications yet"
                  body="Order confirmations, delivery updates and reward news will appear here."
                />
              }
            >
              <ul className="space-y-2">
                {notifications.data?.map((n) => (
                  <li
                    key={n.id}
                    className={`surface-card p-4 ${n.read_at ? "" : "border-primary/40 bg-primary/5"}`}
                  >
                    <p className="text-sm font-bold">{n.title}</p>
                    {n.body && <p className="mt-1 text-sm text-muted-foreground">{n.body}</p>}
                    <p className="mt-2 text-xs text-muted-foreground">{formatDate(n.created_at)}</p>
                  </li>
                ))}
              </ul>
            </QueryBoundary>
          </div>
        )}
      </div>
      <CustomerFooter />
    </div>
  );
}
