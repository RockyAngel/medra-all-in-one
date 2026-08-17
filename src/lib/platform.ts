import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

/* ------------------------------ community chat ---------------------------- */

export function useChatChannels() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["chat-channels", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chat_channels")
        .select("id, slug, name, description, kind, role, is_active")
        .order("kind")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useChannelMessages(channelId: string | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["chat-messages", channelId],
    enabled: !!channelId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chat_channel_messages")
        .select("id, sender_id, sender_role, body, is_hidden, created_at")
        .eq("channel_id", channelId!)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      const rows = (data ?? []).slice().reverse();
      const senders = [...new Set(rows.map((r) => r.sender_id))];
      if (senders.length === 0) return rows.map((r) => ({ ...r, sender: null }));
      const profiles = await supabase
        .from("profiles")
        .select("id, first_name, last_name")
        .in("id", senders);
      const byId = new Map((profiles.data ?? []).map((p) => [p.id, p]));
      return rows.map((r) => ({ ...r, sender: byId.get(r.sender_id) ?? null }));
    },
  });

  useEffect(() => {
    if (!channelId) return;
    const channel = supabase
      .channel(`chat:${channelId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "chat_channel_messages",
          filter: `channel_id=eq.${channelId}`,
        },
        () => {
          void queryClient.invalidateQueries({ queryKey: ["chat-messages", channelId] });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [channelId, queryClient]);

  return query;
}

export function useSendChannelMessage() {
  const queryClient = useQueryClient();
  const { user, roles } = useAuth();
  return useMutation({
    mutationFn: async (input: { channelId: string; body: string }) => {
      if (!user) throw new Error("Sign in to join the conversation.");
      const body = input.body.trim();
      if (!body) throw new Error("Write a message first.");
      const { error } = await supabase.from("chat_channel_messages").insert({
        channel_id: input.channelId,
        sender_id: user.id,
        sender_role: roles[0] ?? "customer",
        body,
      });
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["chat-messages", variables.channelId] });
    },
  });
}

export function useModerateChatMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { messageId: string; hidden: boolean }) => {
      const { error } = await supabase.rpc("set_chat_message_hidden", {
        _message_id: input.messageId,
        _hidden: input.hidden,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["chat-messages"] });
    },
  });
}

export function useSetChannelActive() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { channelId: string; isActive: boolean }) => {
      const { error } = await supabase
        .from("chat_channels")
        .update({ is_active: input.isActive })
        .eq("id", input.channelId);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["chat-channels"] });
    },
  });
}

/* ------------------------------- time clock ------------------------------- */

export const SHIFT_STATUS_TONE: Record<string, string> = {
  open: "bg-sky/15 text-sky",
  completed: "bg-leaf/15 text-leaf",
  late: "bg-amber/20 text-amber",
  missed: "bg-destructive/15 text-destructive",
  cancelled: "bg-destructive/15 text-destructive",
};

const SHIFT_COLUMNS =
  "id, user_id, clock_in_at, clock_out_at, status, note, adjusted_by, adjusted_at, created_at";

export function useMyShifts() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["my-shifts", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("staff_shifts")
        .select(SHIFT_COLUMNS)
        .eq("user_id", user!.id)
        .order("clock_in_at", { ascending: false })
        .limit(60);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useAllShifts(status: string) {
  return useQuery({
    queryKey: ["all-shifts", status],
    queryFn: async () => {
      let query = supabase
        .from("staff_shifts")
        .select(SHIFT_COLUMNS)
        .order("clock_in_at", { ascending: false })
        .limit(200);
      if (status !== "all") query = query.eq("status", status);
      const { data, error } = await query;
      if (error) throw error;
      const rows = data ?? [];
      if (rows.length === 0) return [];
      const profiles = await supabase
        .from("profiles")
        .select("id, first_name, last_name, email")
        .in("id", [...new Set(rows.map((r) => r.user_id))]);
      const byId = new Map((profiles.data ?? []).map((p) => [p.id, p]));
      return rows.map((r) => ({ ...r, profile: byId.get(r.user_id) ?? null }));
    },
  });
}

export function useTimeClock() {
  const queryClient = useQueryClient();
  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["my-shifts"] });
    void queryClient.invalidateQueries({ queryKey: ["all-shifts"] });
  };

  const clockIn = useMutation({
    mutationFn: async (note: string | undefined) => {
      const { error } = await supabase.rpc("clock_in", note ? { _note: note } : {});
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const clockOut = useMutation({
    mutationFn: async (note: string | undefined) => {
      const { error } = await supabase.rpc("clock_out", note ? { _note: note } : {});
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const adjust = useMutation({
    mutationFn: async (input: { shiftId: string; status: string; note?: string }) => {
      const { error } = await supabase.rpc("adjust_staff_shift", {
        _shift_id: input.shiftId,
        _status: input.status,
        ...(input.note ? { _note: input.note } : {}),
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { clockIn, clockOut, adjust };
}

/* ------------------------------- appearance ------------------------------- */

export const APPEARANCE_COST = 200;

export const THEMES = [
  { id: "medra", label: "Medra violet", swatch: "oklch(0.48 0.22 288)" },
  { id: "leaf", label: "Fresh leaf", swatch: "oklch(0.58 0.16 155)" },
  { id: "sky", label: "Ocean sky", swatch: "oklch(0.6 0.16 240)" },
  { id: "amber", label: "Warm amber", swatch: "oklch(0.72 0.16 70)" },
] as const;

export const MODES = [
  { id: "system", label: "Match device" },
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
] as const;

export function useAppearance() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["appearance", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appearance_preferences")
        .select("theme, mode, changes_purchased, updated_at")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function usePurchaseAppearance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { theme: string; mode: string }) => {
      const { data, error } = await supabase.rpc("purchase_appearance", {
        _theme: input.theme,
        _mode: input.mode,
      });
      if (error) throw error;
      return (data as { theme: string; mode: string; points_balance: number }[] | null)?.[0] ?? null;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["appearance"] });
      void queryClient.invalidateQueries({ queryKey: ["wallet"] });
    },
  });
}

/** Applies the stored theme + mode to the document. */
export function applyAppearance(theme: string | null | undefined, mode: string | null | undefined) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.dataset['theme'] = theme ?? "medra";
  const prefersDark =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;
  const dark = mode === "dark" || (mode !== "light" && prefersDark);
  root.classList.toggle("dark", dark);
}

/* --------------------------- feature marketplace -------------------------- */

export function useFeatureMarketplace() {
  return useQuery({
    queryKey: ["feature-marketplace"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("feature_flags")
        .select("key, label, description, enabled, state, category, updated_at")
        .order("category")
        .order("label");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useSetFeatureState() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { key: string; state: string }) => {
      const { error } = await supabase.rpc("set_feature_state", {
        _key: input.key,
        _state: input.state,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["feature-marketplace"] });
      void queryClient.invalidateQueries({ queryKey: ["feature-flags"] });
    },
  });
}
