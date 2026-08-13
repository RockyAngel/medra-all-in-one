-- =========================================================
-- PHASE 10: COMMUNICATION LAYER (support, messaging, notifications)
-- =========================================================

-- ---------- enums ----------
DO $$ BEGIN
  CREATE TYPE public.support_status AS ENUM ('open','waiting_support','waiting_user','assigned','escalated','resolved','closed','reopened');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.support_priority AS ENUM ('low','normal','high','urgent','critical');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.conversation_kind AS ENUM ('order_customer_seller','delivery_customer_rider','sos_incident');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.notification_channel AS ENUM ('in_app','email','sms','push');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------- support tickets ----------
UPDATE public.support_tickets SET status = 'open'
 WHERE status IS NULL OR status NOT IN ('open','waiting_support','waiting_user','assigned','escalated','resolved','closed','reopened');

ALTER TABLE public.support_tickets ALTER COLUMN status DROP DEFAULT;

ALTER TABLE public.support_tickets
  ALTER COLUMN status TYPE public.support_status USING status::public.support_status,
  ALTER COLUMN status SET DEFAULT 'open'::public.support_status,
  ADD COLUMN IF NOT EXISTS priority public.support_priority NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS delivery_id uuid REFERENCES public.deliveries(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS fulfillment_id uuid REFERENCES public.order_fulfillments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS payment_id uuid REFERENCES public.payments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS refund_request_id uuid REFERENCES public.refund_requests(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS payout_request_id uuid REFERENCES public.payout_requests(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS consultation_id uuid REFERENCES public.consultations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sos_incident_id uuid REFERENCES public.sos_incidents(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS store_id uuid REFERENCES public.stores(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_activity_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS first_response_at timestamptz,
  ADD COLUMN IF NOT EXISTS resolved_at timestamptz,
  ADD COLUMN IF NOT EXISTS closed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reopen_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS user_last_read_at timestamptz,
  ADD COLUMN IF NOT EXISTS staff_last_read_at timestamptz,
  ADD COLUMN IF NOT EXISTS is_sos boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reference text;

UPDATE public.support_tickets
   SET reference = 'SUP-' || upper(substr(replace(id::text,'-',''),1,8))
 WHERE reference IS NULL;

CREATE INDEX IF NOT EXISTS support_tickets_status_idx ON public.support_tickets(status, priority DESC, last_activity_at DESC);
CREATE INDEX IF NOT EXISTS support_tickets_assigned_idx ON public.support_tickets(assigned_to) WHERE assigned_to IS NOT NULL;

-- ---------- support messages ----------
ALTER TABLE public.support_messages
  ADD COLUMN IF NOT EXISTS is_internal boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS attachment_path text,
  ADD COLUMN IF NOT EXISTS attachment_name text,
  ADD COLUMN IF NOT EXISTS attachment_type text,
  ADD COLUMN IF NOT EXISTS attachment_size integer,
  ADD COLUMN IF NOT EXISTS edited_at timestamptz,
  ADD COLUMN IF NOT EXISTS edit_history jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS mentions uuid[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS support_messages_ticket_idx ON public.support_messages(ticket_id, created_at);

-- ---------- support history ----------
CREATE TABLE IF NOT EXISTS public.support_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_role text,
  action text NOT NULL,
  from_value text,
  to_value text,
  reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.support_events TO authenticated;
GRANT ALL ON public.support_events TO service_role;
ALTER TABLE public.support_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "support events staff read" ON public.support_events;
CREATE POLICY "support events staff read" ON public.support_events
  FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(), 'support.view'));

-- ---------- conversations (customer <-> seller / rider) ----------
CREATE TABLE IF NOT EXISTS public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind public.conversation_kind NOT NULL,
  order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE,
  fulfillment_id uuid REFERENCES public.order_fulfillments(id) ON DELETE CASCADE,
  delivery_id uuid REFERENCES public.deliveries(id) ON DELETE CASCADE,
  store_id uuid REFERENCES public.stores(id) ON DELETE SET NULL,
  customer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  seller_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  rider_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  is_locked boolean NOT NULL DEFAULT false,
  read_only_at timestamptz,
  last_message_at timestamptz,
  customer_last_read_at timestamptz,
  counterpart_last_read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS conversations_fulfillment_uniq ON public.conversations(fulfillment_id) WHERE fulfillment_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS conversations_delivery_uniq ON public.conversations(delivery_id) WHERE delivery_id IS NOT NULL;

GRANT SELECT ON public.conversations TO authenticated;
GRANT ALL ON public.conversations TO service_role;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "conversations participants read" ON public.conversations;
CREATE POLICY "conversations participants read" ON public.conversations
  FOR SELECT TO authenticated
  USING (
    customer_id = auth.uid() OR seller_id = auth.uid() OR rider_id = auth.uid()
    OR public.has_permission(auth.uid(), 'support.view')
  );

CREATE TABLE IF NOT EXISTS public.conversation_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_role text NOT NULL,
  body text NOT NULL,
  attachment_path text,
  attachment_name text,
  attachment_type text,
  attachment_size integer,
  read_at timestamptz,
  edited_at timestamptz,
  edit_history jsonb NOT NULL DEFAULT '[]'::jsonb,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS conversation_messages_idx ON public.conversation_messages(conversation_id, created_at);
GRANT SELECT ON public.conversation_messages TO authenticated;
GRANT ALL ON public.conversation_messages TO service_role;
ALTER TABLE public.conversation_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "conversation messages participants read" ON public.conversation_messages;
CREATE POLICY "conversation messages participants read" ON public.conversation_messages
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.conversations c
     WHERE c.id = conversation_id
       AND (c.customer_id = auth.uid() OR c.seller_id = auth.uid() OR c.rider_id = auth.uid()
            OR public.has_permission(auth.uid(), 'support.view'))
  ));

-- ---------- moderation ----------
CREATE TABLE IF NOT EXISTS public.message_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reported_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  support_message_id uuid REFERENCES public.support_messages(id) ON DELETE CASCADE,
  conversation_message_id uuid REFERENCES public.conversation_messages(id) ON DELETE CASCADE,
  reason text NOT NULL CHECK (reason IN ('harassment','spam','fraud','inappropriate','other')),
  details text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','under_review','actioned','dismissed')),
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  resolution_note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.message_reports TO authenticated;
GRANT ALL ON public.message_reports TO service_role;
ALTER TABLE public.message_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "message reports own or staff" ON public.message_reports;
CREATE POLICY "message reports own or staff" ON public.message_reports
  FOR SELECT TO authenticated
  USING (reporter_id = auth.uid() OR public.has_permission(auth.uid(), 'support.view'));

-- ---------- notifications ----------
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS event_id text,
  ADD COLUMN IF NOT EXISTS event_type text,
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'account',
  ADD COLUMN IF NOT EXISTS priority public.support_priority NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS entity_type text,
  ADD COLUMN IF NOT EXISTS entity_id uuid,
  ADD COLUMN IF NOT EXISTS is_mandatory boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS notifications_event_uniq ON public.notifications(user_id, event_id) WHERE event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS notifications_unread_idx ON public.notifications(user_id, read_at) WHERE read_at IS NULL;

DROP POLICY IF EXISTS "Users update own notifications" ON public.notifications;
CREATE POLICY "Users update own notifications" ON public.notifications
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.notification_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL,
  channel public.notification_channel NOT NULL,
  language text NOT NULL DEFAULT 'en',
  event_type text NOT NULL,
  category text NOT NULL,
  subject text,
  body text NOT NULL,
  variables text[] NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (key, channel, language)
);
GRANT SELECT ON public.notification_templates TO authenticated;
GRANT ALL ON public.notification_templates TO service_role;
ALTER TABLE public.notification_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "templates staff read" ON public.notification_templates;
CREATE POLICY "templates staff read" ON public.notification_templates
  FOR SELECT TO authenticated USING (public.has_permission(auth.uid(), 'notifications.templates.manage'));

CREATE TABLE IF NOT EXISTS public.notification_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category text NOT NULL,
  in_app boolean NOT NULL DEFAULT true,
  email boolean NOT NULL DEFAULT true,
  sms boolean NOT NULL DEFAULT false,
  push boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, category)
);
GRANT SELECT, INSERT, UPDATE ON public.notification_preferences TO authenticated;
GRANT ALL ON public.notification_preferences TO service_role;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own notification preferences" ON public.notification_preferences;
CREATE POLICY "own notification preferences" ON public.notification_preferences
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.notification_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id uuid REFERENCES public.notifications(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  channel public.notification_channel NOT NULL,
  status text NOT NULL DEFAULT 'created' CHECK (status IN ('created','queued','sent','delivered','failed','skipped')),
  provider text,
  provider_reference text,
  provider_status text,
  failure_reason text,
  attempts integer NOT NULL DEFAULT 0,
  queued_at timestamptz,
  sent_at timestamptz,
  delivered_at timestamptz,
  failed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notification_deliveries_status_idx ON public.notification_deliveries(status, created_at DESC);
GRANT SELECT ON public.notification_deliveries TO authenticated;
GRANT ALL ON public.notification_deliveries TO service_role;
ALTER TABLE public.notification_deliveries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "notification deliveries own or staff" ON public.notification_deliveries;
CREATE POLICY "notification deliveries own or staff" ON public.notification_deliveries
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_permission(auth.uid(), 'notifications.templates.manage'));

CREATE TABLE IF NOT EXISTS public.broadcasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audience text NOT NULL CHECK (audience IN ('sellers','riders','customers')),
  category text NOT NULL DEFAULT 'announcement',
  title text NOT NULL,
  body text NOT NULL,
  link text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  recipient_count integer NOT NULL DEFAULT 0,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.broadcasts TO authenticated;
GRANT ALL ON public.broadcasts TO service_role;
ALTER TABLE public.broadcasts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "broadcasts staff read" ON public.broadcasts;
CREATE POLICY "broadcasts staff read" ON public.broadcasts
  FOR SELECT TO authenticated USING (public.has_permission(auth.uid(), 'broadcast.send'));

-- ---------- permissions & settings ----------
INSERT INTO public.role_permissions (role, permission, enabled) VALUES
  ('admin','support.view',true),
  ('admin','support.respond',true),
  ('admin','support.assign',true),
  ('admin','support.escalate',true),
  ('admin','support.sos.view',true),
  ('admin','broadcast.send',false),
  ('admin','notifications.templates.manage',false),
  ('admin','support.analytics.view',true),
  ('super_admin','support.view',true),
  ('super_admin','support.respond',true),
  ('super_admin','support.assign',true),
  ('super_admin','support.escalate',true),
  ('super_admin','support.sos.view',true),
  ('super_admin','broadcast.send',true),
  ('super_admin','notifications.templates.manage',true),
  ('super_admin','support.analytics.view',true)
ON CONFLICT DO NOTHING;

INSERT INTO public.platform_settings (key, value) VALUES
  ('support_hours', '{"timezone":"Africa/Lagos","enabled":false,"note":"Your message has been received."}'::jsonb),
  ('support_retention', '{"general_days":365,"financial_days":2555,"health_days":2555,"sos_days":2555}'::jsonb),
  ('support_rate_limits', '{"messages_per_minute":10,"tickets_per_hour":5}'::jsonb),
  ('delivery_chat_window', '{"post_delivery_readonly_minutes":120}'::jsonb)
ON CONFLICT (key) DO NOTHING;