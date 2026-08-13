CREATE OR REPLACE FUNCTION public.subscription_is_live(_status public.subscription_status)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT _status IN ('trialing','active','past_due','grace_period')
$$;

CREATE OR REPLACE FUNCTION public.my_entitlements()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(jsonb_object_agg(k, v), '{}'::jsonb)
  FROM (
    SELECT e.key AS k, e.value AS v
    FROM public.subscriptions s
    CROSS JOIN LATERAL jsonb_each(s.entitlements_snapshot) e
    WHERE s.user_id = auth.uid()
      AND public.subscription_is_live(s.status)
      AND (s.current_period_end IS NULL OR s.current_period_end > now())
  ) t
$$;
REVOKE ALL ON FUNCTION public.my_entitlements() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.my_entitlements() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.has_entitlement(_user_id uuid, _key text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.subscriptions s
    WHERE s.user_id = _user_id
      AND public.subscription_is_live(s.status)
      AND (s.current_period_end IS NULL OR s.current_period_end > now())
      AND COALESCE(s.entitlements_snapshot -> _key, 'false'::jsonb) NOT IN ('false'::jsonb, 'null'::jsonb, '0'::jsonb)
  )
$$;
REVOKE ALL ON FUNCTION public.has_entitlement(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_entitlement(uuid,text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.membership_setting(_key text, _default jsonb)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT value FROM public.platform_settings WHERE key = _key), _default)
$$;
REVOKE ALL ON FUNCTION public.membership_setting(text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.membership_setting(text,jsonb) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.feature_enabled(_key text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT enabled FROM public.feature_flags WHERE key = _key), false)
$$;
REVOKE ALL ON FUNCTION public.feature_enabled(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.feature_enabled(text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.start_membership(_plan_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _plan public.membership_plans;
  _settings jsonb;
  _trials_enabled boolean;
  _one_trial boolean;
  _had_trial boolean;
  _members integer;
  _sub public.subscriptions;
  _invoice public.subscription_invoices;
  _period interval;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO _plan FROM public.membership_plans
   WHERE id = _plan_id AND archived_at IS NULL AND is_active FOR SHARE;
  IF _plan.id IS NULL THEN RAISE EXCEPTION 'Plan is not available'; END IF;
  IF _plan.starts_at IS NOT NULL AND _plan.starts_at > now() THEN RAISE EXCEPTION 'Plan is not open yet'; END IF;
  IF _plan.ends_at IS NOT NULL AND _plan.ends_at <= now() THEN RAISE EXCEPTION 'Plan is no longer offered'; END IF;

  IF NOT public.feature_enabled('membership.' || _plan.audience::text || '.enabled') THEN
    RAISE EXCEPTION 'Memberships are not available for this account type right now';
  END IF;

  IF _plan.audience::text <> 'customer'
     AND NOT public.has_role(_uid, _plan.audience::text::public.app_role) THEN
    RAISE EXCEPTION 'This plan is not available for your account type';
  END IF;

  IF EXISTS (SELECT 1 FROM public.subscriptions s
              WHERE s.user_id = _uid AND s.audience = _plan.audience
                AND s.status IN ('trialing','active','past_due','payment_failed','grace_period','paused')) THEN
    RAISE EXCEPTION 'You already have a membership for this account type';
  END IF;

  IF _plan.max_members IS NOT NULL THEN
    SELECT count(*) INTO _members FROM public.subscriptions
     WHERE plan_id = _plan.id AND public.subscription_is_live(status);
    IF _members >= _plan.max_members THEN RAISE EXCEPTION 'This plan is full'; END IF;
  END IF;

  _settings := public.membership_setting('membership_rules',
    '{"trials_enabled": true, "one_trial_per_user": true, "grace_period_days": 5}'::jsonb);
  _trials_enabled := COALESCE((_settings->>'trials_enabled')::boolean, true)
                     AND public.feature_enabled('membership.trials.enabled');
  _one_trial := COALESCE((_settings->>'one_trial_per_user')::boolean, true);
  _period := CASE _plan.billing_period WHEN 'yearly' THEN interval '1 year'
                                       WHEN 'quarterly' THEN interval '3 months'
                                       ELSE interval '1 month' END;

  SELECT EXISTS (SELECT 1 FROM public.subscriptions
                  WHERE user_id = _uid AND trial_start IS NOT NULL)
    INTO _had_trial;

  IF _trials_enabled AND _plan.trial_days > 0 AND NOT (_one_trial AND _had_trial) THEN
    INSERT INTO public.subscriptions (
      user_id, payer_id, plan_id, audience, price_paid, currency, billing_period,
      entitlements_snapshot, benefits_snapshot, status,
      trial_start, trial_end, started_at, current_period_start, current_period_end, next_billing_at)
    VALUES (_uid, _uid, _plan.id, _plan.audience, 0, _plan.currency, _plan.billing_period,
      _plan.entitlements, _plan.benefits, 'trialing',
      now(), now() + make_interval(days => _plan.trial_days), now(),
      now(), now() + make_interval(days => _plan.trial_days),
      now() + make_interval(days => _plan.trial_days))
    RETURNING * INTO _sub;

    INSERT INTO public.subscription_events (subscription_id, actor_id, event, to_status, note)
    VALUES (_sub.id, _uid, 'trial_started', 'trialing', _plan.trial_days || ' day trial');

    INSERT INTO public.notifications (user_id, title, body, link)
    VALUES (_uid, 'Membership trial started',
      'Your ' || _plan.name || ' trial is active until ' || to_char(_sub.trial_end, 'DD Mon YYYY') || '.',
      '/membership');

    RETURN jsonb_build_object('status','trialing','subscription_id',_sub.id,
      'trial_end',_sub.trial_end,'payment_required',false);
  END IF;

  INSERT INTO public.subscriptions (
    user_id, payer_id, plan_id, audience, price_paid, currency, billing_period,
    entitlements_snapshot, benefits_snapshot, status)
  VALUES (_uid, _uid, _plan.id, _plan.audience, _plan.price, _plan.currency, _plan.billing_period,
    _plan.entitlements, _plan.benefits, 'past_due')
  RETURNING * INTO _sub;

  INSERT INTO public.subscription_invoices (subscription_id, user_id, amount, currency, period_start, period_end)
  VALUES (_sub.id, _uid, _plan.price, _plan.currency, now(), now() + _period)
  RETURNING * INTO _invoice;

  INSERT INTO public.subscription_events (subscription_id, actor_id, event, to_status, note)
  VALUES (_sub.id, _uid, 'checkout_started', _sub.status, 'Awaiting payment verification');

  RETURN jsonb_build_object('status', _sub.status, 'subscription_id', _sub.id,
    'invoice_id', _invoice.id, 'invoice_reference', _invoice.reference,
    'amount', _invoice.amount, 'currency', _invoice.currency, 'payment_required', true);
END;
$$;
REVOKE ALL ON FUNCTION public.start_membership(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.start_membership(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.confirm_membership_payment(
  _invoice_id uuid, _provider text, _provider_reference text, _provider_status text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _inv public.subscription_invoices;
  _sub public.subscriptions;
  _period interval;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'Not authorised to confirm membership payments';
  END IF;

  SELECT * INTO _inv FROM public.subscription_invoices WHERE id = _invoice_id FOR UPDATE;
  IF _inv.id IS NULL THEN RAISE EXCEPTION 'Invoice not found'; END IF;

  IF _inv.status = 'paid' THEN
    RETURN jsonb_build_object('status','paid','idempotent',true,'subscription_id',_inv.subscription_id);
  END IF;
  IF lower(COALESCE(_provider_status,'')) NOT IN ('success','succeeded','paid','completed') THEN
    RAISE EXCEPTION 'Provider status % does not confirm payment', _provider_status;
  END IF;

  SELECT * INTO _sub FROM public.subscriptions WHERE id = _inv.subscription_id FOR UPDATE;
  _period := CASE _sub.billing_period WHEN 'yearly' THEN interval '1 year'
                                      WHEN 'quarterly' THEN interval '3 months'
                                      ELSE interval '1 month' END;

  UPDATE public.subscription_invoices
     SET status = 'paid', provider = _provider, provider_reference = _provider_reference,
         provider_status = _provider_status, processed_at = now(), failure_reason = NULL
   WHERE id = _inv.id;

  UPDATE public.subscriptions
     SET status = 'active',
         provider = _provider,
         started_at = COALESCE(started_at, now()),
         current_period_start = now(),
         current_period_end = now() + _period,
         next_billing_at = now() + _period,
         grace_until = NULL,
         expires_at = NULL
   WHERE id = _sub.id
   RETURNING * INTO _sub;

  INSERT INTO public.subscription_events (subscription_id, event, to_status, note)
  VALUES (_sub.id, 'payment_verified', 'active', 'Provider reference ' || COALESCE(_provider_reference,'n/a'));

  INSERT INTO public.notifications (user_id, title, body, link)
  VALUES (_sub.user_id, 'Membership active',
    'Your membership is active until ' || to_char(_sub.current_period_end, 'DD Mon YYYY') || '.', '/membership');

  PERFORM public.log_audit('membership.payment_verified','subscription',_sub.id,
    'Provider confirmed payment', NULL, to_jsonb(_sub));
  RETURN jsonb_build_object('status','active','subscription_id',_sub.id,
    'current_period_end',_sub.current_period_end);
END;
$$;
REVOKE ALL ON FUNCTION public.confirm_membership_payment(uuid,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirm_membership_payment(uuid,text,text,text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.fail_membership_payment(_invoice_id uuid, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _inv public.subscription_invoices; _sub public.subscriptions; _grace integer;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;
  SELECT * INTO _inv FROM public.subscription_invoices WHERE id = _invoice_id FOR UPDATE;
  IF _inv.id IS NULL OR _inv.status = 'paid' THEN RETURN; END IF;
  UPDATE public.subscription_invoices
     SET status = 'failed', failure_reason = _reason, processed_at = now() WHERE id = _inv.id;
  _grace := COALESCE((public.membership_setting('membership_rules','{"grace_period_days":5}'::jsonb)->>'grace_period_days')::int, 5);
  UPDATE public.subscriptions
     SET status = 'grace_period', grace_until = now() + make_interval(days => _grace)
   WHERE id = _inv.subscription_id RETURNING * INTO _sub;
  INSERT INTO public.subscription_events (subscription_id, event, to_status, note)
  VALUES (_sub.id, 'payment_failed', _sub.status, _reason);
  INSERT INTO public.notifications (user_id, title, body, link)
  VALUES (_sub.user_id, 'Membership payment failed',
    'We could not verify your membership payment. Your access continues until ' ||
    to_char(_sub.grace_until,'DD Mon YYYY') || '.', '/membership');
END;
$$;
REVOKE ALL ON FUNCTION public.fail_membership_payment(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fail_membership_payment(uuid,text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.cancel_membership(_subscription_id uuid, _immediate boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _sub public.subscriptions;
BEGIN
  SELECT * INTO _sub FROM public.subscriptions WHERE id = _subscription_id FOR UPDATE;
  IF _sub.id IS NULL THEN RAISE EXCEPTION 'Subscription not found'; END IF;
  IF _sub.user_id <> auth.uid() AND NOT public.has_role(auth.uid(),'super_admin') THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;

  IF _immediate OR _sub.status IN ('trialing','grace_period','past_due','payment_failed') THEN
    UPDATE public.subscriptions
       SET status = 'cancelled', cancelled_at = now(), expires_at = now(),
           current_period_end = LEAST(COALESCE(current_period_end, now()), now()),
           next_billing_at = NULL, cancel_at_period_end = false
     WHERE id = _sub.id RETURNING * INTO _sub;
  ELSE
    UPDATE public.subscriptions
       SET cancel_at_period_end = true, cancelled_at = now(), next_billing_at = NULL,
           expires_at = current_period_end
     WHERE id = _sub.id RETURNING * INTO _sub;
  END IF;

  INSERT INTO public.subscription_events (subscription_id, actor_id, event, to_status, note)
  VALUES (_sub.id, auth.uid(), 'cancelled', _sub.status,
          CASE WHEN _sub.cancel_at_period_end THEN 'Access continues until period end' ELSE 'Access ended immediately' END);
  RETURN jsonb_build_object('status',_sub.status,'access_until',COALESCE(_sub.expires_at,_sub.current_period_end),
                            'cancel_at_period_end',_sub.cancel_at_period_end);
END;
$$;
REVOKE ALL ON FUNCTION public.cancel_membership(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_membership(uuid, boolean) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.expire_memberships()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _count integer := 0;
BEGIN
  WITH expired AS (
    UPDATE public.subscriptions
       SET status = 'expired', expires_at = COALESCE(expires_at, now())
     WHERE status IN ('trialing','active','grace_period','past_due','payment_failed')
       AND ((status = 'grace_period' AND grace_until IS NOT NULL AND grace_until <= now())
            OR (status <> 'grace_period' AND current_period_end IS NOT NULL AND current_period_end <= now()))
    RETURNING id, user_id)
  INSERT INTO public.subscription_events (subscription_id, event, to_status, note)
  SELECT id, 'expired', 'expired', 'Period ended' FROM expired;
  GET DIAGNOSTICS _count = ROW_COUNT;
  RETURN _count;
END;
$$;
REVOKE ALL ON FUNCTION public.expire_memberships() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.expire_memberships() TO service_role;