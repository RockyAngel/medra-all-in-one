import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, type AppRole } from "@/lib/auth";

/* --------------------------------- labels --------------------------------- */

export const SUPPORT_STATUS_LABELS: Record<string, string> = {
  open: "Open",
  waiting_support: "Waiting for support",
  waiting_user: "Waiting for you",
  assigned: "Assigned",
  escalated: "Escalated",
  resolved: "Resolved",
  closed: "Closed",
  reopened: "Reopened",
};

export const SUPPORT_STATUS_TONE: Record<string, string> = {
  open: "bg-sky/15 text-sky",
  waiting_support: "bg-amber/20 text-amber",
  waiting_user: "bg-primary/15 text-primary",
  assigned: "bg-sky/15 text-sky",
  escalated: "bg-destructive/15 text-destructive",
  resolved: "bg-leaf/15 text-leaf",
  closed: "bg-muted text-muted-foreground",
  reopened: "bg-amber/20 text-amber",
};

export const SUPPORT_PRIORITY_TONE: Record<string, string> = {
  low: "bg-muted text-muted-foreground",
  normal: "bg-muted text-muted-foreground",
  high: "bg-amber/20 text-amber",
  urgent: "bg-destructive/15 text-destructive",
  critical: "bg-destructive text-destructive-foreground",
};

export type SupportTopic = {
  value: string;
  label: string;
  blurb: string;
  roles: AppRole[];
};

/** Mascot topics. Only topics relevant to the signed-in role are offered. */
export const SUPPORT_TOPICS: SupportTopic[] = [
  { value: "question", label: "Ask a question", blurb: "General question about Medra.", roles: ["customer", "seller", "rider"] },
  { value: "order", label: "Order help", blurb: "Something about an order you placed.", roles: ["customer"] },
  { value: "delivery", label: "Delivery help", blurb: "Pickup, tracking or a delivery problem.", roles: ["customer", "rider"] },
  { value: "payment", label: "Payment help", blurb: "A payment that failed or looks wrong.", roles: ["customer", "seller", "rider"] },
  { value: "refund", label: "Refund help", blurb: "A refund request or its status.", roles: ["customer"] },
  { value: "account", label: "Account help", blurb: "Login, profile or security questions.", roles: ["customer", "seller", "rider"] },
  { value: "seller", label: "Seller help", blurb: "Store, products, orders or payouts.", roles: ["seller"] },
  { value: "rider", label: "Rider help", blurb: "Offers, deliveries, earnings or payouts.", roles: ["rider"] },
  { value: "pharmacy", label: "Pharmacy help", blurb: "Prescription review or medication orders.", roles: ["customer", "seller"] },
  { value: "telehealth", label: "Telehealth help", blurb: "Consultations and bookings.", roles: ["customer"] },
  { value: "speak_to_support", label: "Speak to support", blurb: "Start a conversation with the support team.", roles: ["customer", "seller", "rider"] },
];

/** Self-serve answers. Nothing here invents order, money or ETA information. */
export const SUPPORT_GUIDES: { question: string; answer: string; topics: string[] }[] = [
  {
    question: "Where is my order?",
    answer:
      "Open Orders and pick the order you want. The tracking page shows the live status recorded by the platform, and the rider's location once a rider has picked it up.",
    topics: ["order", "delivery", "question"],
  },
  {
    question: "How do I request a refund?",
    answer:
      "Open the order, choose Request refund, pick the items and reason, and submit. Support reviews the request — refunds are only completed once the payment provider confirms them.",
    topics: ["refund", "payment"],
  },
  {
    question: "How do I become a seller?",
    answer: "Open Become a seller and complete the application. Pharmacies also upload licensing documents. Support reviews every application before a store can sell.",
    topics: ["seller", "question"],
  },
  {
    question: "How do I change my delivery address?",
    answer: "Addresses live in your account. Add or edit one there, then pick it at checkout. Delivery fees are recalculated for the address you choose.",
    topics: ["account", "delivery", "order"],
  },
  {
    question: "When do I get paid?",
    answer:
      "Earnings move from pending to available as orders complete. Request a payout from your dashboard; support reviews it and the status only becomes Paid once the provider confirms the transfer.",
    topics: ["seller", "rider", "payment"],
  },
  {
    question: "Why does my order need a prescription?",
    answer:
      "Some medications are prescription-only. Upload a prescription for that pharmacy and wait for the pharmacy to approve it — checkout unlocks those items once it is approved and unexpired.",
    topics: ["pharmacy", "order"],
  },
];

/* ------------------------------- unread badges ------------------------------ */

export function useUnreadCounts() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["unread-counts", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("my_unread_counts");
      if (error) throw error;
      return (data ?? {}) as { notifications?: number; support?: number; messages?: number };
    },
  });

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => {
          void queryClient.invalidateQueries({ queryKey: ["unread-counts"] });
          void queryClient.invalidateQueries({ queryKey: ["notifications"] });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user, queryClient]);

  return query;
}

/* --------------------------------- my support ------------------------------ */

const TICKET_COLUMNS =
  "id, reference, subject, category, status, priority, is_sos, order_id, delivery_id, payment_id, refund_request_id, payout_request_id, consultation_id, assigned_to, created_at, updated_at, last_activity_at, user_last_read_at, archived_at";

export function useMySupportTickets() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["my-support-tickets", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_tickets")
        .select(TICKET_COLUMNS)
        .eq("user_id", user!.id)
        .order("last_activity_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });
}

/** Messages for one conversation, live-updated and scoped to that ticket only. */
export function useSupportMessages(ticketId: string | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["support-messages", ticketId],
    enabled: !!ticketId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_messages")
        .select(
          "id, sender_id, sender_role, body, is_internal, attachment_path, attachment_name, attachment_type, edited_at, deleted_at, created_at",
        )
        .eq("ticket_id", ticketId!)
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (!ticketId) return;
    const channel = supabase
      .channel(`support-messages:${ticketId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "support_messages", filter: `ticket_id=eq.${ticketId}` },
        () => {
          void queryClient.invalidateQueries({ queryKey: ["support-messages", ticketId] });
          void queryClient.invalidateQueries({ queryKey: ["unread-counts"] });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [ticketId, queryClient]);

  return query;
}

export type OpenTicketInput = {
  category: string;
  subject?: string;
  message: string;
  orderId?: string;
  deliveryId?: string;
  fulfillmentId?: string;
  paymentId?: string;
  refundRequestId?: string;
  payoutRequestId?: string;
  consultationId?: string;
  storeId?: string;
};

export function useOpenSupportTicket() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: OpenTicketInput) => {
      const { data, error } = await supabase.rpc("open_support_ticket", {
        _category: input.category,
        _message: input.message,
        _subject: input.subject ?? input.category.replace(/_/g, " "),
        ...(input.orderId ? { _order_id: input.orderId } : {}),
        ...(input.deliveryId ? { _delivery_id: input.deliveryId } : {}),
        ...(input.fulfillmentId ? { _fulfillment_id: input.fulfillmentId } : {}),
        ...(input.paymentId ? { _payment_id: input.paymentId } : {}),
        ...(input.refundRequestId ? { _refund_request_id: input.refundRequestId } : {}),
        ...(input.payoutRequestId ? { _payout_request_id: input.payoutRequestId } : {}),
        ...(input.consultationId ? { _consultation_id: input.consultationId } : {}),
        ...(input.storeId ? { _store_id: input.storeId } : {}),
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["my-support-tickets"] });
      void queryClient.invalidateQueries({ queryKey: ["support-inbox"] });
    },
  });
}

export type SupportAttachment = {
  path: string;
  name: string;
  type: string;
  size: number;
};

export const ALLOWED_ATTACHMENT_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "application/pdf",
];
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

/** Uploads to the private support bucket under the sender's own folder. */
export async function uploadSupportAttachment(userId: string, file: File): Promise<SupportAttachment> {
  if (!ALLOWED_ATTACHMENT_TYPES.includes(file.type)) {
    throw new Error("Only images and PDF files can be attached.");
  }
  if (file.size > MAX_ATTACHMENT_BYTES) {
    throw new Error("That file is larger than 10MB.");
  }
  const safeName = file.name.replace(/[^\w.\-]+/g, "_").slice(-80);
  const path = `${userId}/${Date.now()}-${safeName}`;
  const { error } = await supabase.storage.from("support-attachments").upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (error) throw error;
  return { path, name: file.name, type: file.type, size: file.size };
}

export async function signedAttachmentUrl(path: string) {
  const { data, error } = await supabase.storage.from("support-attachments").createSignedUrl(path, 300);
  if (error) throw error;
  return data.signedUrl;
}

export function useSendSupportMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      ticketId: string;
      body: string;
      internal?: boolean;
      attachment?: SupportAttachment;
    }) => {
      const { error } = await supabase.rpc("send_support_message", {
        _ticket_id: input.ticketId,
        _body: input.body,
        ...(input.internal ? { _internal: true } : {}),
        ...(input.attachment
          ? {
              _attachment_path: input.attachment.path,
              _attachment_name: input.attachment.name,
              _attachment_type: input.attachment.type,
              _attachment_size: input.attachment.size,
            }
          : {}),
      });
      if (error) throw error;
    },
    onSuccess: (_data, input) => {
      void queryClient.invalidateQueries({ queryKey: ["support-messages", input.ticketId] });
      void queryClient.invalidateQueries({ queryKey: ["my-support-tickets"] });
      void queryClient.invalidateQueries({ queryKey: ["support-inbox"] });
    },
  });
}

export function useMarkSupportRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (ticketId: string) => {
      const { error } = await supabase.rpc("support_mark_read", { _ticket_id: ticketId });
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["unread-counts"] });
      void queryClient.invalidateQueries({ queryKey: ["my-support-tickets"] });
    },
  });
}

export function useReportMessage() {
  return useMutation({
    mutationFn: async (input: {
      reason: string;
      details?: string;
      supportMessageId?: string;
      conversationMessageId?: string;
    }) => {
      const { error } = await supabase.rpc("report_message", {
        _reason: input.reason,
        ...(input.details ? { _details: input.details } : {}),
        ...(input.supportMessageId ? { _support_message_id: input.supportMessageId } : {}),
        ...(input.conversationMessageId ? { _conversation_message_id: input.conversationMessageId } : {}),
      });
      if (error) throw error;
    },
  });
}

/* ------------------------- customer <-> seller / rider -------------------- */

export function useEnsureConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { fulfillmentId?: string; deliveryId?: string }) => {
      if (input.fulfillmentId) {
        const { data, error } = await supabase.rpc("ensure_order_conversation", {
          _fulfillment_id: input.fulfillmentId,
        });
        if (error) throw error;
        return data as string;
      }
      const { data, error } = await supabase.rpc("ensure_delivery_conversation", {
        _delivery_id: input.deliveryId!,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["my-conversations"] });
    },
  });
}

export function useConversation(conversationId: string | undefined) {
  return useQuery({
    queryKey: ["conversation", conversationId],
    enabled: !!conversationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conversations")
        .select(
          "id, kind, order_id, fulfillment_id, delivery_id, store_id, customer_id, seller_id, rider_id, is_locked, read_only_at, last_message_at, orders(order_number), stores(name)",
        )
        .eq("id", conversationId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useConversationMessages(conversationId: string | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["conversation-messages", conversationId],
    enabled: !!conversationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conversation_messages")
        .select(
          "id, sender_id, sender_role, body, attachment_path, attachment_name, attachment_type, read_at, deleted_at, created_at",
        )
        .eq("conversation_id", conversationId!)
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (!conversationId) return;
    const channel = supabase
      .channel(`conversation:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "conversation_messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        () => {
          void queryClient.invalidateQueries({ queryKey: ["conversation-messages", conversationId] });
          void queryClient.invalidateQueries({ queryKey: ["unread-counts"] });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [conversationId, queryClient]);

  return query;
}

export function useSendConversationMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { conversationId: string; body: string; attachment?: SupportAttachment }) => {
      const { error } = await supabase.rpc("send_conversation_message", {
        _conversation_id: input.conversationId,
        _body: input.body,
        ...(input.attachment
          ? {
              _attachment_path: input.attachment.path,
              _attachment_name: input.attachment.name,
              _attachment_type: input.attachment.type,
              _attachment_size: input.attachment.size,
            }
          : {}),
      });
      if (error) throw error;
    },
    onSuccess: (_d, input) => {
      void queryClient.invalidateQueries({ queryKey: ["conversation-messages", input.conversationId] });
    },
  });
}

export function useMarkConversationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (conversationId: string) => {
      const { error } = await supabase.rpc("conversation_mark_read", { _conversation_id: conversationId });
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["unread-counts"] });
    },
  });
}

/* ----------------------------------- staff -------------------------------- */

export type SupportInboxFilters = {
  status?: string;
  priority?: string;
  role?: string;
  category?: string;
  assigned?: string;
  sosOnly?: boolean;
  search?: string;
  page?: number;
  pageSize?: number;
};

export function useSupportInbox(filters: SupportInboxFilters) {
  const pageSize = filters.pageSize ?? 20;
  const page = filters.page ?? 0;

  return useQuery({
    queryKey: ["support-inbox", filters],
    queryFn: async () => {
      let query = supabase
        .from("support_tickets")
        .select(`${TICKET_COLUMNS}, user_id, requester_role, staff_last_read_at`, { count: "exact" })
        .order("priority", { ascending: false })
        .order("last_activity_at", { ascending: false })
        .range(page * pageSize, page * pageSize + pageSize - 1);

      if (filters.status) query = query.eq("status", filters.status as never);
      if (filters.priority) query = query.eq("priority", filters.priority as never);
      if (filters.role) query = query.eq("requester_role", filters.role);
      if (filters.category) query = query.eq("category", filters.category);
      if (filters.sosOnly) query = query.eq("is_sos", true);
      if (filters.assigned === "unassigned") query = query.is("assigned_to", null);
      if (filters.search) query = query.or(`reference.ilike.%${filters.search}%,subject.ilike.%${filters.search}%`);

      const { data, error, count } = await query;
      if (error) throw error;
      return { rows: data ?? [], count: count ?? 0, pageSize, page };
    },
  });
}

export function useSupportMetrics() {
  return useQuery({
    queryKey: ["support-metrics"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("support_metrics");
      if (error) throw error;
      return (data ?? {}) as Record<string, unknown>;
    },
    retry: false,
  });
}

export function useSupportEvents(ticketId: string | undefined) {
  return useQuery({
    queryKey: ["support-events", ticketId],
    enabled: !!ticketId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_events")
        .select("id, actor_id, actor_role, action, from_value, to_value, reason, created_at")
        .eq("ticket_id", ticketId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useSupportAdminAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      ticketId: string;
      action: string;
      value?: string;
      reason?: string;
      targetAdmin?: string;
      entityId?: string;
    }) => {
      const { error } = await supabase.rpc("support_admin_action", {
        _ticket_id: input.ticketId,
        _action: input.action,
        ...(input.value ? { _value: input.value } : {}),
        ...(input.reason ? { _reason: input.reason } : {}),
        ...(input.targetAdmin ? { _target_admin: input.targetAdmin } : {}),
        ...(input.entityId ? { _entity_id: input.entityId } : {}),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["support-inbox"] });
      void queryClient.invalidateQueries({ queryKey: ["support-metrics"] });
      void queryClient.invalidateQueries({ queryKey: ["support-events"] });
    },
  });
}
