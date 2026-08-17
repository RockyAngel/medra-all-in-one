CREATE OR REPLACE FUNCTION public.verify_delivery(_delivery_id uuid, _code text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE _d public.deliveries; _o public.orders; _f public.order_fulfillments;
  _all_done boolean;
BEGIN
  SELECT * INTO _d FROM public.deliveries WHERE id = _delivery_id FOR UPDATE;
  IF _d.id IS NULL OR _d.rider_id <> auth.uid() THEN RAISE EXCEPTION 'Not permitted'; END IF;
  IF _d.pickup_verified_at IS NULL THEN RAISE EXCEPTION 'Pickup has not been verified'; END IF;
  IF _d.delivery_code IS NULL OR _d.delivery_code <> trim(_code) THEN
    UPDATE public.deliveries SET code_attempts = code_attempts + 1 WHERE id = _delivery_id;
    IF _d.code_attempts + 1 >= 5 THEN
      UPDATE public.deliveries SET status = 'failed' WHERE id = _delivery_id;
      RAISE EXCEPTION 'Too many incorrect codes. Delivery flagged for support.';
    END IF;
    RAISE EXCEPTION 'Incorrect delivery code';
  END IF;

  SELECT * INTO _o FROM public.orders WHERE id = _d.order_id FOR UPDATE;

  UPDATE public.deliveries
     SET status = 'delivered', delivered_at = now(), delivery_verified_at = now()
   WHERE id = _delivery_id;

  IF _d.fulfillment_id IS NOT NULL THEN
    SELECT * INTO _f FROM public.order_fulfillments WHERE id = _d.fulfillment_id;
    UPDATE public.order_fulfillments SET status = 'delivered' WHERE id = _d.fulfillment_id;
  END IF;

  INSERT INTO public.ledger_entries (order_id, delivery_id, user_id, kind, amount, percent, notes)
  VALUES (_o.id, _d.id, _d.rider_id, 'rider_delivery_earning', _d.rider_amount,
    _d.rider_percent, COALESCE(_o.delivery_rule,'per_fulfillment_quote'));

  INSERT INTO public.ledger_entries (order_id, delivery_id, user_id, kind, amount, percent, notes)
  VALUES (_o.id, _d.id, NULL, 'platform_delivery_share', _d.platform_amount,
    _d.platform_percent, COALESCE(_o.delivery_rule,'per_fulfillment_quote'));

  UPDATE public.rider_profiles SET active_assignments = GREATEST(active_assignments - 1, 0)
   WHERE user_id = _d.rider_id;

  SELECT NOT EXISTS (
    SELECT 1 FROM public.deliveries WHERE order_id = _o.id AND delivered_at IS NULL
      AND status NOT IN ('cancelled','failed')) INTO _all_done;

  PERFORM public.log_order_status(_o.id, 'delivered', 'Delivery verified with customer code');
  IF _all_done THEN
    UPDATE public.orders SET completed_at = now() WHERE id = _o.id;
    PERFORM public.log_order_status(_o.id, 'completed', 'Order completed');
  END IF;

  INSERT INTO public.notifications (user_id, title, body, link)
  VALUES (_o.customer_id, 'Order delivered',
    'Order ' || _o.order_number || ' was delivered.', '/orders/' || _o.id);
  INSERT INTO public.notifications (user_id, title, body, link)
  VALUES (_d.rider_id, 'Delivery completed',
    'Your earnings for this delivery have been recorded.', '/rider/earnings');
END $function$;