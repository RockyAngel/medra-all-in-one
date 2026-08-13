-- ============ PRODUCTS / INVENTORY ============
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS low_stock_threshold integer NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS reserved_quantity integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS brand text,
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS weight_grams integer,
  ADD COLUMN IF NOT EXISTS dimensions text,
  ADD COLUMN IF NOT EXISTS variant_label text;

ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.categories(id),
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS public.inventory_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  seller_id uuid NOT NULL,
  store_id uuid REFERENCES public.stores(id) ON DELETE SET NULL,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  kind text NOT NULL CHECK (kind IN ('stock_added','sale','cancellation_restore','refund_restore','manual_adjustment','damage','expired','correction')),
  quantity_delta integer NOT NULL,
  resulting_stock integer NOT NULL,
  reason text,
  actor_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.inventory_movements TO authenticated;
GRANT ALL ON public.inventory_movements TO service_role;
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Sellers read own inventory history" ON public.inventory_movements
  FOR SELECT TO authenticated USING (seller_id = auth.uid() OR public.is_staff(auth.uid()));

-- ============ PAYOUTS ============
CREATE TABLE IF NOT EXISTS public.payout_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  bank_name text NOT NULL,
  account_name text NOT NULL,
  account_number text NOT NULL,
  is_default boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.payout_accounts TO authenticated;
GRANT ALL ON public.payout_accounts TO service_role;
ALTER TABLE public.payout_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manages payout accounts" ON public.payout_accounts
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Staff read payout accounts" ON public.payout_accounts
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE TRIGGER payout_accounts_updated_at BEFORE UPDATE ON public.payout_accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.payout_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  payout_account_id uuid REFERENCES public.payout_accounts(id),
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  status text NOT NULL DEFAULT 'requested'
    CHECK (status IN ('requested','under_review','approved','processing','paid','rejected','failed')),
  reference text,
  review_note text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.payout_requests TO authenticated;
GRANT ALL ON public.payout_requests TO service_role;
ALTER TABLE public.payout_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner reads own payout requests" ON public.payout_requests
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE TRIGGER payout_requests_updated_at BEFORE UPDATE ON public.payout_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.payout_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payout_id uuid NOT NULL REFERENCES public.payout_requests(id) ON DELETE CASCADE,
  status text NOT NULL,
  note text,
  actor_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.payout_events TO authenticated;
GRANT ALL ON public.payout_events TO service_role;
ALTER TABLE public.payout_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Payout events follow payout" ON public.payout_events
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.payout_requests p WHERE p.id = payout_id AND (p.user_id = auth.uid() OR public.is_staff(auth.uid())))
  );

-- ============ REFUNDS ============
CREATE TABLE IF NOT EXISTS public.refund_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  fulfillment_id uuid REFERENCES public.order_fulfillments(id) ON DELETE SET NULL,
  customer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  seller_id uuid,
  scope text NOT NULL DEFAULT 'order' CHECK (scope IN ('order','items')),
  item_ids uuid[] NOT NULL DEFAULT '{}',
  amount_requested numeric(12,2) NOT NULL CHECK (amount_requested > 0),
  amount_approved numeric(12,2),
  reason text NOT NULL,
  details text,
  evidence_paths text[] NOT NULL DEFAULT '{}',
  destination text NOT NULL DEFAULT 'original' CHECK (destination IN ('original','wallet')),
  status text NOT NULL DEFAULT 'requested'
    CHECK (status IN ('requested','under_review','more_info_needed','approved','partially_approved','rejected','processing','refunded','escalated')),
  decision_note text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.refund_requests TO authenticated;
GRANT ALL ON public.refund_requests TO service_role;
ALTER TABLE public.refund_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Customer reads own refunds" ON public.refund_requests
  FOR SELECT TO authenticated USING (
    customer_id = auth.uid() OR seller_id = auth.uid() OR public.is_staff(auth.uid())
  );
CREATE POLICY "Customer creates own refunds" ON public.refund_requests
  FOR INSERT TO authenticated WITH CHECK (customer_id = auth.uid());
CREATE TRIGGER refund_requests_updated_at BEFORE UPDATE ON public.refund_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.refund_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  refund_id uuid NOT NULL REFERENCES public.refund_requests(id) ON DELETE CASCADE,
  status text NOT NULL,
  note text,
  actor_id uuid,
  actor_role text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.refund_events TO authenticated;
GRANT ALL ON public.refund_events TO service_role;
ALTER TABLE public.refund_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Refund events follow refund" ON public.refund_events
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.refund_requests r WHERE r.id = refund_id
            AND (r.customer_id = auth.uid() OR r.seller_id = auth.uid() OR public.is_staff(auth.uid())))
  );

-- ============ LATE DELIVERIES ============
CREATE TABLE IF NOT EXISTS public.late_delivery_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id uuid NOT NULL REFERENCES public.deliveries(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  rider_id uuid,
  expected_at timestamptz,
  detected_at timestamptz NOT NULL DEFAULT now(),
  delay_minutes integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','acknowledged','resolved','dismissed')),
  admin_note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.late_delivery_events TO authenticated;
GRANT ALL ON public.late_delivery_events TO service_role;
ALTER TABLE public.late_delivery_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Rider and staff read late events" ON public.late_delivery_events
  FOR SELECT TO authenticated USING (rider_id = auth.uid() OR public.is_staff(auth.uid()));

-- ============ COMMISSION ENGINE / FEATURE FLAGS / PERMISSIONS ============
CREATE TABLE IF NOT EXISTS public.commission_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope text NOT NULL CHECK (scope IN ('default','category','seller')),
  category_id uuid REFERENCES public.categories(id) ON DELETE CASCADE,
  seller_id uuid,
  percent numeric(6,3) NOT NULL CHECK (percent >= 0 AND percent <= 100),
  effective_from timestamptz NOT NULL DEFAULT now(),
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.commission_rules TO authenticated;
GRANT ALL ON public.commission_rules TO service_role;
ALTER TABLE public.commission_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read commission rules" ON public.commission_rules
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Super admin writes commission rules" ON public.commission_rules
  FOR ALL TO authenticated USING (public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'super_admin'));

INSERT INTO public.commission_rules (scope, percent, is_active)
SELECT 'default', 10, true
WHERE NOT EXISTS (SELECT 1 FROM public.commission_rules WHERE scope = 'default');

CREATE TABLE IF NOT EXISTS public.feature_flags (
  key text PRIMARY KEY,
  label text NOT NULL,
  description text,
  enabled boolean NOT NULL DEFAULT false,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.feature_flags TO authenticated, anon;
GRANT ALL ON public.feature_flags TO service_role;
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Everyone reads feature flags" ON public.feature_flags FOR SELECT USING (true);
CREATE POLICY "Super admin writes feature flags" ON public.feature_flags
  FOR ALL TO authenticated USING (public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'super_admin'));

INSERT INTO public.feature_flags (key, label, description, enabled) VALUES
  ('customer_wallet','Customer wallet','Money wallet with top-up and checkout payment.', false),
  ('seller_payout_requests','Seller payout requests','Allow sellers to request payouts.', true),
  ('rider_payout_requests','Rider payout requests','Allow riders to request payouts.', true),
  ('rewards','Rewards points','Earn and redeem reward points.', true),
  ('referrals','Referral programme','Referral codes and rewards.', false),
  ('trivia','Daily engagement','Trivia, riddles and daily content.', false),
  ('leaderboard','Monthly leaderboard','Ranked reward activity.', false),
  ('scheduled_orders','Scheduled orders','Choose a future delivery slot.', false),
  ('recurring_orders','Recurring orders','Repeat orders on a schedule.', false),
  ('group_orders','Group orders','Shared carts with participants.', false),
  ('family_accounts','Family accounts','Shared household accounts.', false),
  ('emergency_pharmacy','Emergency pharmacy delivery','Prioritised pharmacy fulfilment.', false)
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.admin_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permission text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  granted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, permission)
);
GRANT SELECT ON public.admin_permissions TO authenticated;
GRANT ALL ON public.admin_permissions TO service_role;
ALTER TABLE public.admin_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read own or staff permissions" ON public.admin_permissions
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "Super admin writes admin permissions" ON public.admin_permissions
  FOR ALL TO authenticated USING (public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'super_admin'));

INSERT INTO public.role_permissions (role, permission, enabled) VALUES
  ('admin','orders.view',true),('admin','orders.manage',true),
  ('admin','sellers.view',true),('admin','sellers.approve',true),
  ('admin','riders.view',true),('admin','riders.approve',true),
  ('admin','payments.view',true),('admin','refunds.manage',true),
  ('admin','payouts.manage',true),('admin','sos.view',true),('admin','sos.manage',true),
  ('admin','support.view',true),('admin','support.respond',true),
  ('admin','reports.view',true),('admin','categories.manage',false),
  ('admin','disputes.manage',true),('admin','reviews.moderate',true)
ON CONFLICT DO NOTHING;

ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS actor_role text,
  ADD COLUMN IF NOT EXISTS reason text,
  ADD COLUMN IF NOT EXISTS previous_value jsonb,
  ADD COLUMN IF NOT EXISTS new_value jsonb;

-- ============ REVIEWS / STORES / FAVOURITE STORES ============
ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'visible' CHECK (status IN ('visible','hidden','under_review')),
  ADD COLUMN IF NOT EXISTS seller_response text,
  ADD COLUMN IF NOT EXISTS responded_at timestamptz,
  ADD COLUMN IF NOT EXISTS store_id uuid REFERENCES public.stores(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS public.review_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL REFERENCES public.reviews(id) ON DELETE CASCADE,
  reporter_id uuid NOT NULL,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','reviewed','dismissed','actioned')),
  resolution_note text,
  resolved_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.review_reports TO authenticated;
GRANT ALL ON public.review_reports TO service_role;
ALTER TABLE public.review_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Reporter and staff read reports" ON public.review_reports
  FOR SELECT TO authenticated USING (reporter_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "Authenticated report reviews" ON public.review_reports
  FOR INSERT TO authenticated WITH CHECK (reporter_id = auth.uid());

ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS cover_url text,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS contact_phone text,
  ADD COLUMN IF NOT EXISTS contact_email text,
  ADD COLUMN IF NOT EXISTS opening_hours jsonb,
  ADD COLUMN IF NOT EXISTS is_accepting_orders boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS pending_changes jsonb;

CREATE TABLE IF NOT EXISTS public.favorite_stores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, store_id)
);
GRANT SELECT, INSERT, DELETE ON public.favorite_stores TO authenticated;
GRANT ALL ON public.favorite_stores TO service_role;
ALTER TABLE public.favorite_stores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own favourite stores" ON public.favorite_stores
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ============ FUNCTIONS ============
CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _permission text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_override boolean; v_role boolean;
BEGIN
  IF _user_id IS NULL THEN RETURN false; END IF;
  IF public.has_role(_user_id,'super_admin') THEN RETURN true; END IF;
  IF NOT public.has_role(_user_id,'admin') THEN RETURN false; END IF;
  SELECT enabled INTO v_override FROM public.admin_permissions
    WHERE user_id = _user_id AND permission = _permission;
  IF v_override IS NOT NULL THEN RETURN v_override; END IF;
  SELECT enabled INTO v_role FROM public.role_permissions
    WHERE role = 'admin' AND permission = _permission;
  RETURN COALESCE(v_role, false);
END $$;

CREATE OR REPLACE FUNCTION public.log_audit(_action text, _entity text, _entity_id uuid, _reason text DEFAULT NULL, _previous jsonb DEFAULT NULL, _new jsonb DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.audit_logs (actor_id, actor_role, action, entity, entity_id, reason, previous_value, new_value)
  VALUES (auth.uid(), public.current_actor_role(), _action, _entity, _entity_id, _reason, _previous, _new);
END $$;

-- Effective commission percent for a seller/category at this moment
CREATE OR REPLACE FUNCTION public.effective_commission_percent(_seller_id uuid, _category_id uuid)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT percent FROM public.commission_rules
  WHERE is_active AND effective_from <= now()
    AND ((scope='seller' AND seller_id=_seller_id)
      OR (scope='category' AND category_id=_category_id)
      OR scope='default')
  ORDER BY CASE scope WHEN 'seller' THEN 1 WHEN 'category' THEN 2 ELSE 3 END, effective_from DESC
  LIMIT 1
$$;

-- Seller manual stock adjustment with audit trail
CREATE OR REPLACE FUNCTION public.seller_adjust_stock(_product_id uuid, _new_stock integer, _kind text, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p record; v_delta integer;
BEGIN
  SELECT * INTO p FROM public.products WHERE id = _product_id;
  IF p IS NULL THEN RAISE EXCEPTION 'Product not found'; END IF;
  IF p.seller_id <> auth.uid() THEN RAISE EXCEPTION 'Not your product'; END IF;
  IF _new_stock < 0 THEN RAISE EXCEPTION 'Stock cannot be negative'; END IF;
  v_delta := _new_stock - p.stock_quantity;
  IF v_delta = 0 THEN RETURN; END IF;
  IF abs(v_delta) >= 10 AND coalesce(btrim(_reason),'') = '' THEN
    RAISE EXCEPTION 'A reason is required for adjustments of 10 units or more';
  END IF;
  UPDATE public.products
    SET stock_quantity = _new_stock,
        status = CASE WHEN status = 'archived' THEN status
                      WHEN _new_stock = 0 THEN 'out_of_stock'::product_status
                      WHEN status = 'out_of_stock' THEN 'active'::product_status
                      ELSE status END
    WHERE id = _product_id;
  INSERT INTO public.inventory_movements (product_id, seller_id, store_id, kind, quantity_delta, resulting_stock, reason, actor_id)
  VALUES (_product_id, p.seller_id, p.store_id, coalesce(_kind,'manual_adjustment'), v_delta, _new_stock, _reason, auth.uid());
  IF _new_stock > 0 AND _new_stock <= p.low_stock_threshold THEN
    INSERT INTO public.notifications (user_id, title, body, link)
    VALUES (p.seller_id, 'Low stock', p.name || ' is down to ' || _new_stock || ' units.', '/seller/inventory');
  END IF;
END $$;

-- Ledger-derived balances (never trust the browser)
CREATE OR REPLACE FUNCTION public.my_balance()
RETURNS TABLE (pending numeric, available numeric, paid_out numeric, lifetime numeric, requested numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH l AS (
    SELECT payout_status, amount FROM public.ledger_entries
    WHERE beneficiary_id = auth.uid()
      AND kind IN ('seller_product_earning','rider_delivery_earning','refund')
  ), r AS (
    SELECT coalesce(sum(amount),0) amt FROM public.payout_requests
    WHERE user_id = auth.uid() AND status IN ('requested','under_review','approved','processing')
  )
  SELECT
    coalesce(sum(amount) FILTER (WHERE payout_status = 'pending'),0),
    greatest(coalesce(sum(amount) FILTER (WHERE payout_status = 'available'),0) - (SELECT amt FROM r), 0),
    coalesce(sum(amount) FILTER (WHERE payout_status = 'paid'),0),
    coalesce(sum(amount),0),
    (SELECT amt FROM r)
  FROM l
$$;

CREATE OR REPLACE FUNCTION public.request_payout(_amount numeric, _account_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_available numeric; v_role app_role; v_id uuid; v_flag text;
BEGIN
  IF _amount IS NULL OR _amount <= 0 THEN RAISE EXCEPTION 'Enter a valid amount'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.payout_accounts WHERE id = _account_id AND user_id = auth.uid() AND status='active') THEN
    RAISE EXCEPTION 'Add a payout account first';
  END IF;
  v_role := CASE WHEN public.has_role(auth.uid(),'seller') THEN 'seller'::app_role
                 WHEN public.has_role(auth.uid(),'rider') THEN 'rider'::app_role
                 ELSE NULL END;
  IF v_role IS NULL THEN RAISE EXCEPTION 'Only sellers and riders can request payouts'; END IF;
  v_flag := CASE WHEN v_role='seller' THEN 'seller_payout_requests' ELSE 'rider_payout_requests' END;
  IF NOT EXISTS (SELECT 1 FROM public.feature_flags WHERE key = v_flag AND enabled) THEN
    RAISE EXCEPTION 'Payout requests are currently disabled by the platform';
  END IF;
  SELECT available INTO v_available FROM public.my_balance();
  IF _amount > v_available THEN RAISE EXCEPTION 'Amount exceeds your available balance'; END IF;
  INSERT INTO public.payout_requests (user_id, role, payout_account_id, amount)
  VALUES (auth.uid(), v_role, _account_id, _amount) RETURNING id INTO v_id;
  INSERT INTO public.payout_events (payout_id, status, note, actor_id) VALUES (v_id,'requested','Payout requested', auth.uid());
  PERFORM public.notify_staff('Payout request', v_role || ' requested a payout', '/admin/payouts');
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.admin_review_payout(_payout_id uuid, _status text, _note text, _reference text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p record;
BEGIN
  IF NOT public.has_permission(auth.uid(),'payouts.manage') THEN RAISE EXCEPTION 'Not permitted'; END IF;
  IF _status NOT IN ('under_review','approved','processing','paid','rejected','failed') THEN
    RAISE EXCEPTION 'Invalid payout status';
  END IF;
  IF _status IN ('rejected','failed') AND coalesce(btrim(_note),'') = '' THEN
    RAISE EXCEPTION 'A reason is required';
  END IF;
  SELECT * INTO p FROM public.payout_requests WHERE id = _payout_id;
  IF p IS NULL THEN RAISE EXCEPTION 'Payout not found'; END IF;
  UPDATE public.payout_requests
    SET status = _status, review_note = _note, reviewed_by = auth.uid(), reviewed_at = now(),
        reference = coalesce(_reference, reference),
        paid_at = CASE WHEN _status = 'paid' THEN now() ELSE paid_at END
    WHERE id = _payout_id;
  INSERT INTO public.payout_events (payout_id, status, note, actor_id) VALUES (_payout_id, _status, _note, auth.uid());
  IF _status = 'paid' THEN
    UPDATE public.ledger_entries SET payout_status = 'paid'
      WHERE beneficiary_id = p.user_id AND payout_status = 'available';
  END IF;
  INSERT INTO public.notifications (user_id, title, body, link)
  VALUES (p.user_id, 'Payout ' || _status, coalesce(_note, 'Your payout status changed to ' || _status), '/payouts');
  PERFORM public.log_audit('payout.' || _status, 'payout_requests', _payout_id, _note,
    jsonb_build_object('status', p.status), jsonb_build_object('status', _status));
END $$;

-- Applications review (seller / rider)
CREATE OR REPLACE FUNCTION public.admin_review_application(_kind text, _application_id uuid, _decision text, _note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a record; v_store_id uuid; v_slug text;
BEGIN
  IF _decision NOT IN ('under_review','approved','rejected') THEN RAISE EXCEPTION 'Invalid decision'; END IF;
  IF _decision = 'rejected' AND coalesce(btrim(_note),'') = '' THEN RAISE EXCEPTION 'A reason is required'; END IF;

  IF _kind = 'seller' THEN
    IF NOT public.has_permission(auth.uid(),'sellers.approve') THEN RAISE EXCEPTION 'Not permitted'; END IF;
    SELECT * INTO a FROM public.seller_applications WHERE id = _application_id;
    IF a IS NULL THEN RAISE EXCEPTION 'Application not found'; END IF;
    IF _decision = 'approved' AND a.store_id IS NULL THEN
      v_slug := regexp_replace(lower(a.store_name), '[^a-z0-9]+', '-', 'g') || '-' || substr(_application_id::text,1,6);
      INSERT INTO public.stores (owner_id, name, slug, description, category_id, city, address, contact_phone, status)
      VALUES (a.user_id, a.store_name, v_slug, a.description, a.category_id, a.city, a.address, a.contact_phone, 'approved')
      RETURNING id INTO v_store_id;
      INSERT INTO public.user_roles (user_id, role) VALUES (a.user_id,'seller') ON CONFLICT DO NOTHING;
    END IF;
    UPDATE public.seller_applications
      SET status = _decision::application_status, review_note = _note, reviewed_by = auth.uid(),
          reviewed_at = now(), store_id = coalesce(v_store_id, store_id)
      WHERE id = _application_id;
    INSERT INTO public.notifications (user_id, title, body, link)
    VALUES (a.user_id, 'Seller application ' || _decision, coalesce(_note,'Your application status changed.'), '/apply/seller');
  ELSIF _kind = 'rider' THEN
    IF NOT public.has_permission(auth.uid(),'riders.approve') THEN RAISE EXCEPTION 'Not permitted'; END IF;
    SELECT * INTO a FROM public.rider_applications WHERE id = _application_id;
    IF a IS NULL THEN RAISE EXCEPTION 'Application not found'; END IF;
    IF _decision = 'approved' THEN
      INSERT INTO public.user_roles (user_id, role) VALUES (a.user_id,'rider') ON CONFLICT DO NOTHING;
      INSERT INTO public.rider_profiles (user_id, vehicle_type, service_city)
      VALUES (a.user_id, a.vehicle_type, a.city)
      ON CONFLICT (user_id) DO UPDATE SET vehicle_type = excluded.vehicle_type, service_city = excluded.service_city;
    END IF;
    UPDATE public.rider_applications
      SET status = _decision::application_status, review_note = _note, reviewed_by = auth.uid(), reviewed_at = now()
      WHERE id = _application_id;
    INSERT INTO public.notifications (user_id, title, body, link)
    VALUES (a.user_id, 'Rider application ' || _decision, coalesce(_note,'Your application status changed.'), '/apply/rider');
  ELSE
    RAISE EXCEPTION 'Unknown application kind';
  END IF;

  PERFORM public.log_audit(_kind || '_application.' || _decision, _kind || '_applications', _application_id, _note, NULL, NULL);
END $$;

-- Refunds
CREATE OR REPLACE FUNCTION public.customer_request_refund(_order_id uuid, _amount numeric, _reason text, _details text, _evidence text[], _item_ids uuid[])
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o record; v_id uuid;
BEGIN
  SELECT * INTO o FROM public.orders WHERE id = _order_id;
  IF o IS NULL OR o.customer_id <> auth.uid() THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF o.payment_status IS DISTINCT FROM 'paid' THEN RAISE EXCEPTION 'Only paid orders can be refunded'; END IF;
  IF _amount IS NULL OR _amount <= 0 OR _amount > o.total THEN RAISE EXCEPTION 'Invalid refund amount'; END IF;
  IF coalesce(btrim(_reason),'') = '' THEN RAISE EXCEPTION 'Select a reason'; END IF;
  IF _reason = 'Other' AND coalesce(btrim(_details),'') = '' THEN RAISE EXCEPTION 'Please explain your request'; END IF;
  IF EXISTS (SELECT 1 FROM public.refund_requests WHERE order_id = _order_id
             AND status NOT IN ('rejected','refunded')) THEN
    RAISE EXCEPTION 'A refund request is already open for this order';
  END IF;
  INSERT INTO public.refund_requests (order_id, customer_id, amount_requested, reason, details, evidence_paths,
    item_ids, scope)
  VALUES (_order_id, auth.uid(), _amount, _reason, _details, coalesce(_evidence,'{}'), coalesce(_item_ids,'{}'),
    CASE WHEN coalesce(array_length(_item_ids,1),0) > 0 THEN 'items' ELSE 'order' END)
  RETURNING id INTO v_id;
  INSERT INTO public.refund_events (refund_id, status, note, actor_id, actor_role)
  VALUES (v_id, 'requested', _reason, auth.uid(), 'customer');
  PERFORM public.notify_staff('Refund request', 'A customer requested a refund on ' || o.order_number, '/admin/refunds');
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.admin_review_refund(_refund_id uuid, _status text, _amount numeric, _note text, _destination text DEFAULT 'original')
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; o record;
BEGIN
  IF NOT public.has_permission(auth.uid(),'refunds.manage') THEN RAISE EXCEPTION 'Not permitted'; END IF;
  IF _status NOT IN ('under_review','more_info_needed','approved','partially_approved','rejected','processing','refunded','escalated') THEN
    RAISE EXCEPTION 'Invalid refund status';
  END IF;
  IF coalesce(btrim(_note),'') = '' THEN RAISE EXCEPTION 'A note or reason is required'; END IF;
  SELECT * INTO r FROM public.refund_requests WHERE id = _refund_id;
  IF r IS NULL THEN RAISE EXCEPTION 'Refund not found'; END IF;
  SELECT * INTO o FROM public.orders WHERE id = r.order_id;

  IF _status IN ('approved','partially_approved','refunded') THEN
    IF _amount IS NULL OR _amount <= 0 OR _amount > r.amount_requested THEN
      RAISE EXCEPTION 'Approved amount must be between 0 and the requested amount';
    END IF;
  END IF;

  UPDATE public.refund_requests
    SET status = _status, decision_note = _note, reviewed_by = auth.uid(), reviewed_at = now(),
        amount_approved = coalesce(_amount, amount_approved),
        destination = coalesce(_destination, destination)
    WHERE id = _refund_id;
  INSERT INTO public.refund_events (refund_id, status, note, actor_id, actor_role)
  VALUES (_refund_id, _status, _note, auth.uid(), 'admin');

  IF _status = 'refunded' THEN
    INSERT INTO public.ledger_entries (order_id, kind, beneficiary_id, amount, rule, payout_status)
    VALUES (r.order_id, 'refund', r.customer_id, -1 * _amount, 'refund:' || coalesce(_destination,'original'), 'paid');
    UPDATE public.orders SET status = 'refunded'::order_status WHERE id = r.order_id;
    PERFORM public.log_order_status(r.order_id, 'refunded'::order_status, _note);
  END IF;

  INSERT INTO public.notifications (user_id, title, body, link)
  VALUES (r.customer_id, 'Refund ' || replace(_status,'_',' '), _note, '/account/refunds');
  PERFORM public.log_audit('refund.' || _status, 'refund_requests', _refund_id, _note,
    jsonb_build_object('status', r.status), jsonb_build_object('status', _status, 'amount', _amount));
END $$;

-- Rider availability
CREATE OR REPLACE FUNCTION public.set_rider_status(_online boolean, _available boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'rider') THEN RAISE EXCEPTION 'Riders only'; END IF;
  INSERT INTO public.rider_profiles (user_id, is_online, is_available)
  VALUES (auth.uid(), _online, _available)
  ON CONFLICT (user_id) DO UPDATE SET is_online = _online, is_available = _available, updated_at = now();
END $$;

-- Seller replies to a review (never edits it)
CREATE OR REPLACE FUNCTION public.seller_respond_to_review(_review_id uuid, _response text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_seller uuid;
BEGIN
  SELECT p.seller_id INTO v_seller FROM public.reviews r JOIN public.products p ON p.id = r.product_id WHERE r.id = _review_id;
  IF v_seller IS NULL OR v_seller <> auth.uid() THEN RAISE EXCEPTION 'Not your review to answer'; END IF;
  IF coalesce(btrim(_response),'') = '' THEN RAISE EXCEPTION 'Write a response'; END IF;
  UPDATE public.reviews SET seller_response = _response, responded_at = now() WHERE id = _review_id;
END $$;

-- Super admin governance
CREATE OR REPLACE FUNCTION public.set_admin_permission(_user_id uuid, _permission text, _enabled boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'super_admin') THEN RAISE EXCEPTION 'Super admin only'; END IF;
  INSERT INTO public.admin_permissions (user_id, permission, enabled, granted_by)
  VALUES (_user_id, _permission, _enabled, auth.uid())
  ON CONFLICT (user_id, permission) DO UPDATE SET enabled = _enabled, granted_by = auth.uid();
  PERFORM public.log_audit('permission.change','admin_permissions', _user_id, _permission,
    NULL, jsonb_build_object('permission', _permission, 'enabled', _enabled));
END $$;

CREATE OR REPLACE FUNCTION public.set_admin_role(_user_id uuid, _make_admin boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'super_admin') THEN RAISE EXCEPTION 'Super admin only'; END IF;
  IF _user_id = auth.uid() THEN RAISE EXCEPTION 'You cannot change your own access'; END IF;
  IF _make_admin THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (_user_id,'admin') ON CONFLICT DO NOTHING;
  ELSE
    DELETE FROM public.user_roles WHERE user_id = _user_id AND role = 'admin';
  END IF;
  PERFORM public.log_audit(CASE WHEN _make_admin THEN 'admin.granted' ELSE 'admin.suspended' END,
    'user_roles', _user_id, NULL, NULL, jsonb_build_object('admin', _make_admin));
END $$;

CREATE OR REPLACE FUNCTION public.set_feature_flag(_key text, _enabled boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'super_admin') THEN RAISE EXCEPTION 'Super admin only'; END IF;
  UPDATE public.feature_flags SET enabled = _enabled, updated_by = auth.uid(), updated_at = now() WHERE key = _key;
  PERFORM public.log_audit('feature_flag.change','feature_flags', NULL, _key, NULL,
    jsonb_build_object('key', _key, 'enabled', _enabled));
END $$;

CREATE OR REPLACE FUNCTION public.set_commission_rule(_scope text, _percent numeric, _category_id uuid DEFAULT NULL, _seller_id uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT public.has_role(auth.uid(),'super_admin') THEN RAISE EXCEPTION 'Super admin only'; END IF;
  IF _scope NOT IN ('default','category','seller') THEN RAISE EXCEPTION 'Invalid scope'; END IF;
  UPDATE public.commission_rules SET is_active = false
    WHERE is_active AND scope = _scope
      AND coalesce(category_id::text,'') = coalesce(_category_id::text,'')
      AND coalesce(seller_id::text,'') = coalesce(_seller_id::text,'');
  INSERT INTO public.commission_rules (scope, percent, category_id, seller_id, created_by)
  VALUES (_scope, _percent, _category_id, _seller_id, auth.uid()) RETURNING id INTO v_id;
  PERFORM public.log_audit('commission.change','commission_rules', v_id, NULL, NULL,
    jsonb_build_object('scope',_scope,'percent',_percent));
  RETURN v_id;
END $$;

-- Late deliveries feed the incident table
CREATE OR REPLACE FUNCTION public.flag_late_deliveries()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d record; n integer := 0;
BEGIN
  FOR d IN
    SELECT * FROM public.deliveries
    WHERE delivered_at IS NULL AND late_alert_sent_at IS NULL
      AND expected_delivery_at IS NOT NULL AND expected_delivery_at < now() - interval '20 minutes'
  LOOP
    INSERT INTO public.late_delivery_events (delivery_id, order_id, rider_id, expected_at, delay_minutes)
    VALUES (d.id, d.order_id, d.rider_id, d.expected_delivery_at,
            floor(extract(epoch from (now() - d.expected_delivery_at))/60));
    UPDATE public.deliveries SET late_alert_sent_at = now() WHERE id = d.id;
    IF d.rider_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, title, body, link)
      VALUES (d.rider_id, 'Delivery running late', 'This delivery has passed its expected time.', '/rider/active');
    END IF;
    PERFORM public.notify_staff('Late delivery', 'A delivery has passed its expected time.', '/admin/late-deliveries');
    n := n + 1;
  END LOOP;
  RETURN n;
END $$;
