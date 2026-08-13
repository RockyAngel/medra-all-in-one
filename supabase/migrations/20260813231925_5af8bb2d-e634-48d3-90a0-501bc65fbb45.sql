CREATE OR REPLACE FUNCTION public.coupon_discount_amount(
  _coupon public.coupons, _merchandise numeric, _delivery numeric)
RETURNS numeric LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE _base numeric; _value numeric;
BEGIN
  _base := CASE WHEN _coupon.discount_type LIKE 'delivery%' THEN _delivery ELSE _merchandise END;
  _value := CASE
    WHEN _coupon.discount_type IN ('percent','delivery_percent') THEN _base * _coupon.discount_value / 100
    ELSE _coupon.discount_value END;
  IF _coupon.max_discount IS NOT NULL THEN _value := LEAST(_value, _coupon.max_discount); END IF;
  RETURN GREATEST(0, ROUND(LEAST(_value, _base), 2));
END;
$$;
REVOKE ALL ON FUNCTION public.coupon_discount_amount(public.coupons,numeric,numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.coupon_discount_amount(public.coupons,numeric,numeric) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.validate_coupon(
  _code text, _merchandise numeric, _delivery numeric DEFAULT 0, _store_ids uuid[] DEFAULT '{}')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _c public.coupons; _used integer; _orders integer; _discount numeric;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Log in to use a coupon'; END IF;
  IF NOT public.feature_enabled('promotions.coupons.enabled') THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'Coupons are not available right now');
  END IF;

  SELECT * INTO _c FROM public.coupons WHERE upper(code) = upper(trim(_code));
  IF _c.id IS NULL THEN RETURN jsonb_build_object('valid',false,'reason','That coupon code does not exist'); END IF;
  IF NOT _c.is_active THEN RETURN jsonb_build_object('valid',false,'reason','This coupon is not active'); END IF;
  IF _c.starts_at IS NOT NULL AND _c.starts_at > now() THEN
    RETURN jsonb_build_object('valid',false,'reason','This coupon has not started yet'); END IF;
  IF _c.ends_at IS NOT NULL AND _c.ends_at <= now() THEN
    RETURN jsonb_build_object('valid',false,'reason','This coupon has expired'); END IF;
  IF _c.usage_limit IS NOT NULL AND _c.usage_count >= _c.usage_limit THEN
    RETURN jsonb_build_object('valid',false,'reason','This coupon has been fully redeemed'); END IF;
  IF _c.budget IS NOT NULL AND _c.budget_used >= _c.budget THEN
    RETURN jsonb_build_object('valid',false,'reason','This campaign budget is exhausted'); END IF;
  IF array_length(_c.eligible_user_ids,1) IS NOT NULL AND NOT (_uid = ANY (_c.eligible_user_ids)) THEN
    RETURN jsonb_build_object('valid',false,'reason','This coupon is not available on your account'); END IF;
  IF _c.requires_membership AND NOT EXISTS (
      SELECT 1 FROM public.subscriptions s WHERE s.user_id = _uid
        AND public.subscription_is_live(s.status)) THEN
    RETURN jsonb_build_object('valid',false,'reason','This coupon is for members only'); END IF;

  SELECT count(*) INTO _used FROM public.coupon_redemptions WHERE coupon_id = _c.id AND user_id = _uid;
  IF _c.per_user_limit IS NOT NULL AND _used >= _c.per_user_limit THEN
    RETURN jsonb_build_object('valid',false,'reason','You have already used this coupon'); END IF;

  IF _c.first_order_only THEN
    SELECT count(*) INTO _orders FROM public.orders
     WHERE customer_id = _uid AND status NOT IN ('pending_payment','payment_failed','cancelled');
    IF _orders > 0 THEN RETURN jsonb_build_object('valid',false,'reason','This coupon is for first orders only'); END IF;
  END IF;

  IF _c.store_id IS NOT NULL AND NOT (_c.store_id = ANY (COALESCE(_store_ids,'{}'))) THEN
    RETURN jsonb_build_object('valid',false,'reason','This coupon does not apply to the stores in your cart'); END IF;

  IF _merchandise < _c.min_order THEN
    RETURN jsonb_build_object('valid',false,'reason',
      'Spend at least ' || to_char(_c.min_order,'FM999,999,999') || ' to use this coupon'); END IF;

  _discount := public.coupon_discount_amount(_c, _merchandise, COALESCE(_delivery,0));
  IF _discount <= 0 THEN RETURN jsonb_build_object('valid',false,'reason','This coupon gives no discount on this order'); END IF;

  RETURN jsonb_build_object(
    'valid', true, 'coupon_id', _c.id, 'code', upper(_c.code), 'description', _c.description,
    'discount_type', _c.discount_type, 'applies_to',
      CASE WHEN _c.discount_type LIKE 'delivery%' THEN 'delivery' ELSE 'merchandise' END,
    'discount', _discount, 'funding_source', _c.funding_source,
    'platform_funded', ROUND(_discount * _c.platform_funded_percent / 100, 2),
    'seller_funded', ROUND(_discount * (100 - _c.platform_funded_percent) / 100, 2),
    'stackable', _c.stackable);
END;
$$;
REVOKE ALL ON FUNCTION public.validate_coupon(text,numeric,numeric,uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_coupon(text,numeric,numeric,uuid[]) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.apply_coupon_to_order(_order_id uuid, _code text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid(); _order public.orders; _c public.coupons;
  _check jsonb; _discount numeric; _platform numeric; _seller numeric; _stores uuid[];
BEGIN
  SELECT * INTO _order FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF _order.id IS NULL THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF _order.customer_id <> _uid THEN RAISE EXCEPTION 'Not authorised'; END IF;
  IF _order.payment_status = 'paid' THEN RAISE EXCEPTION 'This order is already paid'; END IF;
  IF _order.coupon_id IS NOT NULL THEN
    RETURN jsonb_build_object('applied', true, 'idempotent', true,
      'code', _order.coupon_code, 'discount', _order.coupon_discount, 'total', _order.total);
  END IF;

  SELECT array_agg(DISTINCT store_id) INTO _stores FROM public.order_items WHERE order_id = _order_id;
  _check := public.validate_coupon(_code, _order.subtotal, _order.delivery_fee, COALESCE(_stores,'{}'));
  IF NOT (_check->>'valid')::boolean THEN RAISE EXCEPTION '%', _check->>'reason'; END IF;

  SELECT * INTO _c FROM public.coupons WHERE id = (_check->>'coupon_id')::uuid FOR UPDATE;
  IF _c.usage_limit IS NOT NULL AND _c.usage_count >= _c.usage_limit THEN
    RAISE EXCEPTION 'This coupon has been fully redeemed'; END IF;

  _discount := (_check->>'discount')::numeric;
  _platform := (_check->>'platform_funded')::numeric;
  _seller := (_check->>'seller_funded')::numeric;
  IF _c.budget IS NOT NULL AND _c.budget_used + _platform > _c.budget THEN
    RAISE EXCEPTION 'This campaign budget is exhausted'; END IF;

  INSERT INTO public.coupon_redemptions (coupon_id, user_id, order_id, discount_amount, platform_funded, seller_funded)
  VALUES (_c.id, _uid, _order_id, _discount, _platform, _seller);

  UPDATE public.coupons
     SET usage_count = usage_count + 1, budget_used = budget_used + _platform WHERE id = _c.id;

  UPDATE public.orders
     SET coupon_id = _c.id,
         coupon_code = upper(_c.code),
         coupon_discount = _discount,
         platform_funded_discount = platform_funded_discount + _platform,
         seller_funded_discount = seller_funded_discount + _seller,
         total = GREATEST(0, total - _discount),
         discount_snapshot = discount_snapshot || jsonb_build_object('coupon', _check)
   WHERE id = _order_id RETURNING * INTO _order;

  RETURN jsonb_build_object('applied', true, 'code', upper(_c.code), 'discount', _discount,
    'platform_funded', _platform, 'seller_funded', _seller, 'total', _order.total);
END;
$$;
REVOKE ALL ON FUNCTION public.apply_coupon_to_order(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_coupon_to_order(uuid,text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.seller_upsert_promotion(
  _promotion_id uuid, _name text, _kind public.promotion_kind, _discount_value numeric,
  _store_id uuid, _product_ids uuid[] DEFAULT '{}', _category_ids uuid[] DEFAULT '{}',
  _max_discount numeric DEFAULT NULL, _min_order numeric DEFAULT 0,
  _quantity_limit integer DEFAULT NULL, _per_user_limit integer DEFAULT NULL,
  _budget numeric DEFAULT NULL, _starts_at timestamptz DEFAULT now(), _ends_at timestamptz DEFAULT NULL,
  _description text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid(); _id uuid := _promotion_id; _threshold numeric; _status public.promotion_status;
  _bad integer;
BEGIN
  IF NOT public.feature_enabled('promotions.seller.enabled') THEN
    RAISE EXCEPTION 'Seller promotions are currently disabled'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.stores WHERE id = _store_id AND owner_id = _uid) THEN
    RAISE EXCEPTION 'You can only promote your own store'; END IF;
  IF _kind = 'percent_off' AND _discount_value > 90 THEN
    RAISE EXCEPTION 'Discount cannot exceed 90 percent'; END IF;

  SELECT count(*) INTO _bad FROM unnest(COALESCE(_product_ids,'{}')) pid
   WHERE NOT EXISTS (SELECT 1 FROM public.products p WHERE p.id = pid AND p.store_id = _store_id);
  IF _bad > 0 THEN RAISE EXCEPTION 'Promotion products must belong to your store'; END IF;

  _threshold := COALESCE((public.membership_setting('promotion_rules',
      '{"seller_auto_approve_max_percent": 30}'::jsonb)->>'seller_auto_approve_max_percent')::numeric, 30);
  _status := CASE WHEN _kind = 'percent_off' AND _discount_value > _threshold
                  THEN 'pending_approval'::public.promotion_status
                  ELSE 'active'::public.promotion_status END;

  IF _id IS NULL THEN
    INSERT INTO public.promotions (name, description, kind, funding_source, platform_funded_percent,
      discount_value, max_discount, min_order, store_id, seller_id, product_ids, category_ids,
      quantity_limit, per_user_limit, budget, starts_at, ends_at, status, created_by)
    VALUES (_name, _description, _kind, 'seller', 0, _discount_value, _max_discount, COALESCE(_min_order,0),
      _store_id, _uid, COALESCE(_product_ids,'{}'), COALESCE(_category_ids,'{}'),
      _quantity_limit, _per_user_limit, _budget, _starts_at, _ends_at, _status, _uid)
    RETURNING id INTO _id;
  ELSE
    UPDATE public.promotions SET
      name = _name, description = _description, kind = _kind, discount_value = _discount_value,
      max_discount = _max_discount, min_order = COALESCE(_min_order,0),
      product_ids = COALESCE(_product_ids,'{}'), category_ids = COALESCE(_category_ids,'{}'),
      quantity_limit = _quantity_limit, per_user_limit = _per_user_limit, budget = _budget,
      starts_at = _starts_at, ends_at = _ends_at, status = _status
    WHERE id = _id AND seller_id = _uid;
    IF NOT FOUND THEN RAISE EXCEPTION 'Promotion not found'; END IF;
  END IF;

  PERFORM public.log_audit('promotion.upsert','promotion',_id,'Seller promotion saved',NULL,
    jsonb_build_object('status',_status,'discount',_discount_value));
  RETURN _id;
END;
$$;
REVOKE ALL ON FUNCTION public.seller_upsert_promotion(uuid,text,public.promotion_kind,numeric,uuid,uuid[],uuid[],numeric,numeric,integer,integer,numeric,timestamptz,timestamptz,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.seller_upsert_promotion(uuid,text,public.promotion_kind,numeric,uuid,uuid[],uuid[],numeric,numeric,integer,integer,numeric,timestamptz,timestamptz,text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.set_promotion_status(_promotion_id uuid, _status public.promotion_status, _note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _p public.promotions;
BEGIN
  SELECT * INTO _p FROM public.promotions WHERE id = _promotion_id FOR UPDATE;
  IF _p.id IS NULL THEN RAISE EXCEPTION 'Promotion not found'; END IF;

  IF _p.seller_id = auth.uid() THEN
    IF _status NOT IN ('paused','active','ended') THEN RAISE EXCEPTION 'Not authorised'; END IF;
    IF _p.status = 'pending_approval' THEN RAISE EXCEPTION 'This promotion is awaiting approval'; END IF;
  ELSIF NOT public.has_permission(auth.uid(),'promotions.manage') THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;

  UPDATE public.promotions
     SET status = _status, approval_note = COALESCE(_note, approval_note),
         reviewed_by = CASE WHEN _p.seller_id = auth.uid() THEN reviewed_by ELSE auth.uid() END,
         reviewed_at = CASE WHEN _p.seller_id = auth.uid() THEN reviewed_at ELSE now() END
   WHERE id = _promotion_id;

  PERFORM public.log_audit('promotion.status','promotion',_promotion_id,_note,
    to_jsonb(_p.status), to_jsonb(_status));
END;
$$;
REVOKE ALL ON FUNCTION public.set_promotion_status(uuid,public.promotion_status,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_promotion_status(uuid,public.promotion_status,text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.upsert_membership_plan(
  _plan_id uuid, _name text, _audience public.membership_audience, _price numeric,
  _billing_period text DEFAULT 'monthly', _trial_days integer DEFAULT 0,
  _benefits text[] DEFAULT '{}', _entitlements jsonb DEFAULT '{}'::jsonb,
  _description text DEFAULT NULL, _display_order integer DEFAULT 0,
  _is_active boolean DEFAULT false, _max_members integer DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id uuid := _plan_id; _prev jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(),'super_admin') THEN RAISE EXCEPTION 'Not authorised'; END IF;
  IF _id IS NULL THEN
    INSERT INTO public.membership_plans (name,audience,description,price,billing_period,trial_days,
      benefits,entitlements,display_order,is_active,max_members,created_by)
    VALUES (_name,_audience,_description,_price,_billing_period,_trial_days,
      COALESCE(_benefits,'{}'),COALESCE(_entitlements,'{}'::jsonb),_display_order,_is_active,_max_members,auth.uid())
    RETURNING id INTO _id;
  ELSE
    SELECT to_jsonb(p) INTO _prev FROM public.membership_plans p WHERE p.id = _id;
    UPDATE public.membership_plans SET name=_name, audience=_audience, description=_description,
      price=_price, billing_period=_billing_period, trial_days=_trial_days,
      benefits=COALESCE(_benefits,'{}'), entitlements=COALESCE(_entitlements,'{}'::jsonb),
      display_order=_display_order, is_active=_is_active, max_members=_max_members
     WHERE id=_id;
  END IF;
  PERFORM public.log_audit('membership.plan_saved','membership_plan',_id,'Plan configuration changed',_prev,
    (SELECT to_jsonb(p) FROM public.membership_plans p WHERE p.id=_id));
  RETURN _id;
END;
$$;
REVOKE ALL ON FUNCTION public.upsert_membership_plan(uuid,text,public.membership_audience,numeric,text,integer,text[],jsonb,text,integer,boolean,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_membership_plan(uuid,text,public.membership_audience,numeric,text,integer,text[],jsonb,text,integer,boolean,integer) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.archive_membership_plan(_plan_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'super_admin') THEN RAISE EXCEPTION 'Not authorised'; END IF;
  UPDATE public.membership_plans SET archived_at = now(), is_active = false WHERE id = _plan_id;
  PERFORM public.log_audit('membership.plan_archived','membership_plan',_plan_id,'Plan archived',NULL,NULL);
END;
$$;
REVOKE ALL ON FUNCTION public.archive_membership_plan(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.archive_membership_plan(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.upsert_coupon(
  _coupon_id uuid, _code text, _discount_type text, _discount_value numeric,
  _funding_source public.funding_source DEFAULT 'platform', _platform_funded_percent numeric DEFAULT 100,
  _min_order numeric DEFAULT 0, _max_discount numeric DEFAULT NULL,
  _usage_limit integer DEFAULT NULL, _per_user_limit integer DEFAULT 1,
  _budget numeric DEFAULT NULL, _starts_at timestamptz DEFAULT now(), _ends_at timestamptz DEFAULT NULL,
  _store_id uuid DEFAULT NULL, _requires_membership boolean DEFAULT false,
  _first_order_only boolean DEFAULT false, _is_active boolean DEFAULT true, _description text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id uuid := _coupon_id; _seller uuid := NULL; _funding public.funding_source := _funding_source;
        _percent numeric := _platform_funded_percent;
BEGIN
  IF _store_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.stores WHERE id=_store_id AND owner_id=auth.uid()) THEN
    IF NOT public.feature_enabled('promotions.seller.enabled') THEN
      RAISE EXCEPTION 'Seller coupons are currently disabled'; END IF;
    _seller := auth.uid(); _funding := 'seller'; _percent := 0;
  ELSIF NOT public.has_permission(auth.uid(),'promotions.manage') THEN
    RAISE EXCEPTION 'Not authorised to manage coupons';
  END IF;

  IF _discount_type NOT IN ('percent','amount','delivery_percent','delivery_amount') THEN
    RAISE EXCEPTION 'Unsupported discount type'; END IF;
  IF _discount_type LIKE '%percent' AND _discount_value > 90 THEN
    RAISE EXCEPTION 'Percentage discount cannot exceed 90 percent'; END IF;

  IF _id IS NULL THEN
    INSERT INTO public.coupons (code,description,discount_type,discount_value,funding_source,
      platform_funded_percent,min_order,max_discount,usage_limit,per_user_limit,budget,
      starts_at,ends_at,store_id,seller_id,requires_membership,first_order_only,is_active,created_by)
    VALUES (upper(trim(_code)),_description,_discount_type,_discount_value,_funding,_percent,
      COALESCE(_min_order,0),_max_discount,_usage_limit,_per_user_limit,_budget,
      _starts_at,_ends_at,_store_id,_seller,_requires_membership,_first_order_only,_is_active,auth.uid())
    RETURNING id INTO _id;
  ELSE
    UPDATE public.coupons SET description=_description, discount_type=_discount_type,
      discount_value=_discount_value, funding_source=_funding, platform_funded_percent=_percent,
      min_order=COALESCE(_min_order,0), max_discount=_max_discount, usage_limit=_usage_limit,
      per_user_limit=_per_user_limit, budget=_budget, starts_at=_starts_at, ends_at=_ends_at,
      requires_membership=_requires_membership, first_order_only=_first_order_only, is_active=_is_active
     WHERE id=_id AND (_seller IS NULL OR seller_id = _seller);
    IF NOT FOUND THEN RAISE EXCEPTION 'Coupon not found'; END IF;
  END IF;
  PERFORM public.log_audit('coupon.saved','coupon',_id,'Coupon configuration changed',NULL,
    jsonb_build_object('code',upper(trim(_code)),'value',_discount_value,'funding',_funding));
  RETURN _id;
END;
$$;
REVOKE ALL ON FUNCTION public.upsert_coupon(uuid,text,text,numeric,public.funding_source,numeric,numeric,numeric,integer,integer,numeric,timestamptz,timestamptz,uuid,boolean,boolean,boolean,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_coupon(uuid,text,text,numeric,public.funding_source,numeric,numeric,numeric,integer,integer,numeric,timestamptz,timestamptz,uuid,boolean,boolean,boolean,text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.set_platform_setting(_key text, _value jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _prev jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(),'super_admin') THEN RAISE EXCEPTION 'Not authorised'; END IF;
  SELECT value INTO _prev FROM public.platform_settings WHERE key = _key;
  INSERT INTO public.platform_settings (key, value) VALUES (_key, _value)
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();
  PERFORM public.log_audit('settings.updated','platform_setting',NULL,_key,_prev,_value);
END;
$$;
REVOKE ALL ON FUNCTION public.set_platform_setting(text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_platform_setting(text,jsonb) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.growth_metrics()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'Not authorised'; END IF;
  RETURN jsonb_build_object(
    'active_members', (SELECT count(*) FROM public.subscriptions WHERE status = 'active'),
    'trial_members', (SELECT count(*) FROM public.subscriptions WHERE status = 'trialing'),
    'cancelled_members', (SELECT count(*) FROM public.subscriptions WHERE status = 'cancelled'),
    'expired_members', (SELECT count(*) FROM public.subscriptions WHERE status = 'expired'),
    'failed_renewals', (SELECT count(*) FROM public.subscription_invoices WHERE status = 'failed'),
    'membership_revenue', (SELECT COALESCE(sum(amount),0) FROM public.subscription_invoices WHERE status = 'paid'),
    'plan_distribution', (SELECT COALESCE(jsonb_object_agg(p.name, c.n), '{}'::jsonb)
       FROM (SELECT plan_id, count(*) n FROM public.subscriptions
              WHERE public.subscription_is_live(status) GROUP BY plan_id) c
       JOIN public.membership_plans p ON p.id = c.plan_id),
    'active_promotions', (SELECT count(*) FROM public.promotions WHERE status = 'active'
       AND (ends_at IS NULL OR ends_at > now())),
    'pending_promotions', (SELECT count(*) FROM public.promotions WHERE status = 'pending_approval'),
    'active_coupons', (SELECT count(*) FROM public.coupons WHERE is_active
       AND (ends_at IS NULL OR ends_at > now())),
    'coupon_redemptions', (SELECT count(*) FROM public.coupon_redemptions),
    'coupon_discount_total', (SELECT COALESCE(sum(discount_amount),0) FROM public.coupon_redemptions),
    'coupon_platform_funded', (SELECT COALESCE(sum(platform_funded),0) FROM public.coupon_redemptions),
    'coupon_seller_funded', (SELECT COALESCE(sum(seller_funded),0) FROM public.coupon_redemptions)
  );
END;
$$;
REVOKE ALL ON FUNCTION public.growth_metrics() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.growth_metrics() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.my_savings()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'coupon_savings', COALESCE((SELECT sum(coupon_discount) FROM public.orders
        WHERE customer_id = auth.uid() AND payment_status = 'paid'),0),
    'promotion_savings', COALESCE((SELECT sum(promotion_discount + membership_discount) FROM public.orders
        WHERE customer_id = auth.uid() AND payment_status = 'paid'),0),
    'points_savings', COALESCE((SELECT sum(points_discount) FROM public.orders
        WHERE customer_id = auth.uid() AND payment_status = 'paid'),0))
$$;
REVOKE ALL ON FUNCTION public.my_savings() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.my_savings() TO authenticated, service_role;

INSERT INTO public.feature_flags (key, label, description, enabled) VALUES
  ('membership.customer.enabled','Customer membership','Allow customers to subscribe to membership plans.',true),
  ('membership.seller.enabled','Seller membership','Allow sellers to subscribe to growth plans.',true),
  ('membership.rider.enabled','Rider membership','Allow riders to subscribe to rider plans.',true),
  ('membership.trials.enabled','Membership trials','Allow eligible free trials.',true),
  ('membership.auto_renewal.enabled','Automatic renewal','Enable provider-driven recurring billing.',false),
  ('membership.delivery_benefits.enabled','Membership delivery benefits','Allow capped delivery discounts for members.',false),
  ('promotions.coupons.enabled','Coupons','Allow coupon redemption at checkout.',true),
  ('promotions.seller.enabled','Seller promotions','Allow sellers to create promotions and coupons.',true),
  ('promotions.campaigns.enabled','Platform campaigns','Allow platform-funded campaigns.',true),
  ('promotions.flash_deals.enabled','Flash deals','Allow limited-time flash deals.',false),
  ('promotions.delivery.enabled','Delivery promotions','Allow delivery-fee promotions.',false),
  ('promotions.reward_multipliers.enabled','Reward multipliers','Allow bonus point multipliers.',false),
  ('promotions.sponsored.enabled','Sponsored placement','Allow paid seller placement, labelled as sponsored.',false)
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.role_permissions (role, permission, enabled) VALUES
  ('super_admin','promotions.manage',true),
  ('super_admin','memberships.manage',true),
  ('super_admin','promotions.view',true),
  ('admin','promotions.view',true)
ON CONFLICT DO NOTHING;

INSERT INTO public.platform_settings (key, value) VALUES
  ('membership_rules', '{"trials_enabled": true, "trial_days_default": 2, "one_trial_per_user": true, "grace_period_days": 5, "proration_enabled": false, "downgrade_effective": "period_end"}'::jsonb),
  ('promotion_rules', '{"seller_auto_approve_max_percent": 30, "max_percent_discount": 90, "coupon_stacking_enabled": false, "stacking_order": ["product_promotion","coupon","membership_discount","points","wallet"], "high_cost_warning_percent": 40}'::jsonb),
  ('delivery_promotion_rules', '{"rider_earning_basis": "original_delivery_fee", "member_delivery_discount_percent": 0, "member_delivery_discount_cap": 0, "monthly_member_delivery_cap": 0}'::jsonb)
ON CONFLICT (key) DO NOTHING;