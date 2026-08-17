-- ============ feature marketplace ============
ALTER TABLE public.feature_flags
  ADD COLUMN IF NOT EXISTS state text NOT NULL DEFAULT 'enabled',
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'platform';

ALTER TABLE public.feature_flags DROP CONSTRAINT IF EXISTS feature_flags_state_check;
ALTER TABLE public.feature_flags
  ADD CONSTRAINT feature_flags_state_check CHECK (state IN ('enabled','beta','disabled'));

UPDATE public.feature_flags SET enabled = true, state = 'enabled'
WHERE key <> 'payments.provider.enabled';
UPDATE public.feature_flags SET enabled = false, state = 'disabled'
WHERE key = 'payments.provider.enabled';

UPDATE public.feature_flags SET category = CASE
  WHEN key LIKE 'promotions.%' THEN 'growth'
  WHEN key LIKE 'membership.%' THEN 'growth'
  WHEN key IN ('pharmacy','prescriptions','telehealth','health_profile','vitals','medication_reminders','emergency_pharmacy') THEN 'healthcare'
  WHEN key IN ('rewards','referrals','trivia','leaderboard','customer_wallet','family_accounts') THEN 'engagement'
  WHEN key IN ('group_orders','scheduled_orders','recurring_orders') THEN 'ordering'
  WHEN key LIKE '%payout%' OR key LIKE 'payments.%' THEN 'money'
  ELSE 'platform' END;

INSERT INTO public.feature_flags (key, label, description, enabled, state, category) VALUES
  ('marketplace.catalog','Product catalogue','Browsing, search, categories and product pages.',true,'enabled','platform'),
  ('marketplace.cart','Cart and checkout','Multi-vendor cart and checkout flow.',true,'enabled','platform'),
  ('marketplace.reviews','Product reviews','Customer reviews and seller responses.',true,'enabled','platform'),
  ('logistics.dispatch','Delivery dispatch','Rider matching, offers and live tracking.',true,'enabled','logistics'),
  ('logistics.sos','Rider SOS','Emergency safety reporting for riders.',true,'enabled','logistics'),
  ('support.inbox','Support inbox','Support tickets and staff replies.',true,'enabled','support'),
  ('support.mascot','Support mascot','In-app guided help widget.',true,'enabled','support'),
  ('community.chat','Community chat','Platform-wide and role-only chat channels.',true,'enabled','community'),
  ('staff.timeclock','Staff time clock','Staff clock in and clock out with supervisor corrections.',true,'enabled','staff'),
  ('appearance.store','Appearance store','Buy theme and appearance changes with reward points.',true,'enabled','engagement')
ON CONFLICT (key) DO UPDATE SET label = EXCLUDED.label, description = EXCLUDED.description,
  enabled = true, state = 'enabled', category = EXCLUDED.category;

-- ============ community chat ============
CREATE TABLE IF NOT EXISTS public.chat_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  kind text NOT NULL CHECK (kind IN ('community','role')),
  role public.app_role,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.chat_channels TO authenticated;
GRANT ALL ON public.chat_channels TO service_role;
ALTER TABLE public.chat_channels ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS chat_channels_read ON public.chat_channels;
CREATE POLICY chat_channels_read ON public.chat_channels FOR SELECT TO authenticated
  USING (is_active OR public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS chat_channels_manage ON public.chat_channels;
CREATE POLICY chat_channels_manage ON public.chat_channels FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

INSERT INTO public.chat_channels (slug, name, description, kind, role) VALUES
  ('community','Community chat','Everyone on Medra — customers, riders, vendors, health professionals, admins and super admins.','community',NULL),
  ('customers','Customer to customer','Shopping tips, product questions and feedback between customers.','role','customer'),
  ('riders','Rider to rider','Route advice, safety notes and shift chatter between riders.','role','rider'),
  ('vendors','Vendor to vendor','Store operations, stock and promotion talk between vendors.','role','seller'),
  ('admins','Admin to admin','Operational coordination between platform admins.','role','admin'),
  ('health-professionals','Health professional lounge','Private channel for verified health professionals.','role','health_professional')
ON CONFLICT (slug) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.chat_channel_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES public.chat_channels(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  sender_role public.app_role,
  body text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 2000),
  is_hidden boolean NOT NULL DEFAULT false,
  hidden_by uuid,
  hidden_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS chat_channel_messages_channel_idx
  ON public.chat_channel_messages (channel_id, created_at DESC);

GRANT SELECT, INSERT ON public.chat_channel_messages TO authenticated;
GRANT ALL ON public.chat_channel_messages TO service_role;
ALTER TABLE public.chat_channel_messages ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_access_chat_channel(_channel_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.chat_channels c
    WHERE c.id = _channel_id
      AND (c.is_active OR public.has_role(_user_id, 'super_admin'))
      AND (
        c.kind = 'community'
        OR public.has_role(_user_id, 'super_admin')
        OR (c.role IS NOT NULL AND public.has_role(_user_id, c.role))
      )
  )
$$;

REVOKE ALL ON FUNCTION public.can_access_chat_channel(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_access_chat_channel(uuid, uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS chat_messages_read ON public.chat_channel_messages;
CREATE POLICY chat_messages_read ON public.chat_channel_messages FOR SELECT TO authenticated
  USING (
    public.can_access_chat_channel(channel_id, auth.uid())
    AND (NOT is_hidden OR public.has_role(auth.uid(), 'super_admin') OR sender_id = auth.uid())
  );

DROP POLICY IF EXISTS chat_messages_send ON public.chat_channel_messages;
CREATE POLICY chat_messages_send ON public.chat_channel_messages FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid() AND public.can_access_chat_channel(channel_id, auth.uid()));

DROP POLICY IF EXISTS chat_messages_moderate ON public.chat_channel_messages;
CREATE POLICY chat_messages_moderate ON public.chat_channel_messages FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- ============ staff time clock ============
CREATE TABLE IF NOT EXISTS public.staff_shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  clock_in_at timestamptz NOT NULL DEFAULT now(),
  clock_out_at timestamptz,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','completed','late','missed','cancelled')),
  note text,
  adjusted_by uuid,
  adjusted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS staff_shifts_user_idx ON public.staff_shifts (user_id, clock_in_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.staff_shifts TO authenticated;
GRANT ALL ON public.staff_shifts TO service_role;
ALTER TABLE public.staff_shifts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS staff_shifts_read ON public.staff_shifts;
CREATE POLICY staff_shifts_read ON public.staff_shifts FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_staff(auth.uid()) OR public.has_role(auth.uid(),'super_admin'));

DROP POLICY IF EXISTS staff_shifts_self_insert ON public.staff_shifts;
CREATE POLICY staff_shifts_self_insert ON public.staff_shifts FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS staff_shifts_self_update ON public.staff_shifts;
CREATE POLICY staff_shifts_self_update ON public.staff_shifts FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND status = 'open')
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS staff_shifts_supervisor_update ON public.staff_shifts;
CREATE POLICY staff_shifts_supervisor_update ON public.staff_shifts FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.clock_in(_note text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  IF EXISTS (SELECT 1 FROM public.staff_shifts WHERE user_id = auth.uid() AND status = 'open') THEN
    RAISE EXCEPTION 'You already have an open shift';
  END IF;
  INSERT INTO public.staff_shifts (user_id, note) VALUES (auth.uid(), _note) RETURNING id INTO _id;
  RETURN _id;
END $$;

CREATE OR REPLACE FUNCTION public.clock_out(_note text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  UPDATE public.staff_shifts
     SET clock_out_at = now(), status = 'completed',
         note = COALESCE(_note, note)
   WHERE user_id = auth.uid() AND status = 'open'
   RETURNING id INTO _id;
  IF _id IS NULL THEN RAISE EXCEPTION 'You have no open shift'; END IF;
  RETURN _id;
END $$;

CREATE OR REPLACE FUNCTION public.adjust_staff_shift(_shift_id uuid, _status text, _note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin')) THEN
    RAISE EXCEPTION 'Only admins and super admins can correct shifts';
  END IF;
  IF _status NOT IN ('open','completed','late','missed','cancelled') THEN
    RAISE EXCEPTION 'Unknown shift status %', _status;
  END IF;
  UPDATE public.staff_shifts
     SET status = _status,
         note = COALESCE(_note, note),
         adjusted_by = auth.uid(),
         adjusted_at = now(),
         clock_out_at = CASE WHEN _status IN ('completed','late') AND clock_out_at IS NULL THEN now() ELSE clock_out_at END
   WHERE id = _shift_id;
  PERFORM public.log_audit('shift.adjust', 'staff_shifts', _shift_id, _note);
END $$;

REVOKE ALL ON FUNCTION public.clock_in(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.clock_out(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.adjust_staff_shift(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.clock_in(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.clock_out(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.adjust_staff_shift(uuid, text, text) TO authenticated, service_role;

-- ============ appearance store ============
CREATE TABLE IF NOT EXISTS public.appearance_preferences (
  user_id uuid PRIMARY KEY,
  theme text NOT NULL DEFAULT 'medra',
  mode text NOT NULL DEFAULT 'system',
  changes_purchased integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.appearance_preferences TO authenticated;
GRANT ALL ON public.appearance_preferences TO service_role;
ALTER TABLE public.appearance_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS appearance_own ON public.appearance_preferences;
CREATE POLICY appearance_own ON public.appearance_preferences FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.purchase_appearance(_theme text, _mode text)
RETURNS TABLE (theme text, mode text, points_balance integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _cost integer := 200; _balance integer; _current record;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  IF _mode NOT IN ('light','dark','system') THEN RAISE EXCEPTION 'Unknown appearance mode %', _mode; END IF;
  IF btrim(coalesce(_theme,'')) = '' THEN RAISE EXCEPTION 'Pick a theme'; END IF;

  SELECT * INTO _current FROM public.appearance_preferences WHERE user_id = auth.uid();
  IF _current.user_id IS NOT NULL AND _current.theme = _theme AND _current.mode = _mode THEN
    RETURN QUERY SELECT _current.theme, _current.mode,
      COALESCE((SELECT w.points_balance FROM public.wallets w WHERE w.user_id = auth.uid()), 0);
    RETURN;
  END IF;

  INSERT INTO public.wallets (user_id) VALUES (auth.uid()) ON CONFLICT (user_id) DO NOTHING;
  SELECT w.points_balance INTO _balance FROM public.wallets w WHERE w.user_id = auth.uid() FOR UPDATE;
  IF COALESCE(_balance,0) < _cost THEN
    RAISE EXCEPTION 'You need % points to change your appearance. Current balance: %', _cost, COALESCE(_balance,0);
  END IF;

  UPDATE public.wallets SET points_balance = points_balance - _cost, updated_at = now()
   WHERE user_id = auth.uid() RETURNING points_balance INTO _balance;

  INSERT INTO public.wallet_transactions (user_id, points, kind, description)
  VALUES (auth.uid(), -_cost, 'appearance_change', 'Appearance change: ' || _theme || ' / ' || _mode);

  INSERT INTO public.appearance_preferences (user_id, theme, mode, changes_purchased, updated_at)
  VALUES (auth.uid(), _theme, _mode, 1, now())
  ON CONFLICT (user_id) DO UPDATE
    SET theme = EXCLUDED.theme, mode = EXCLUDED.mode,
        changes_purchased = public.appearance_preferences.changes_purchased + 1,
        updated_at = now();

  RETURN QUERY SELECT _theme, _mode, _balance;
END $$;

REVOKE ALL ON FUNCTION public.purchase_appearance(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.purchase_appearance(text, text) TO authenticated, service_role;

-- ============ community chat moderation helper ============
CREATE OR REPLACE FUNCTION public.set_chat_message_hidden(_message_id uuid, _hidden boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'super_admin') THEN
    RAISE EXCEPTION 'Only super admins can moderate community chat';
  END IF;
  UPDATE public.chat_channel_messages
     SET is_hidden = _hidden,
         hidden_by = CASE WHEN _hidden THEN auth.uid() ELSE NULL END,
         hidden_at = CASE WHEN _hidden THEN now() ELSE NULL END
   WHERE id = _message_id;
  PERFORM public.log_audit(CASE WHEN _hidden THEN 'chat.hide' ELSE 'chat.unhide' END,
                           'chat_channel_messages', _message_id, NULL);
END $$;

REVOKE ALL ON FUNCTION public.set_chat_message_hidden(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_chat_message_hidden(uuid, boolean) TO authenticated, service_role;