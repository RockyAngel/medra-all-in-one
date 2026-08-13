-- ==========================================================
-- DISPATCH, VERIFICATION AND SETTLEMENT ENGINE
-- ==========================================================

ALTER TABLE public.deliveries
  ADD COLUMN IF NOT EXISTS quote_id uuid REFERENCES public.delivery_quotes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS pricing_version_id uuid REFERENCES public.delivery_pricing_versions(id);

-- 1. PLACE ORDER FROM REAL QUOTES ---------------------------------
CREATE OR REPLACE FUNCTION public.place_order_from_quotes(
  _address_id uuid,
  _quote_ids uuid[],
  _points_to_redeem integer DEFAULT 0,
  _is_emergency boolean DEFAULT false,
  _customer_note text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  _uid uuid := auth.uid(); _cart uuid; _order uuid; _num text; _addr public.addresses;
  _item record; _store record; _q public.delivery_quotes;
  _subtotal numeric := 0; _platform_total numeric := 0; _fee_total numeric := 0;
  _points integer := 0; _discount numeric := 0; _total numeric; _ful uuid;
  _wallet record; _rx record; _rx_used jsonb := '{}'::jsonb; _rx_id uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO _addr FROM public.addresses WHERE id = _address_id AND user_id = _uid;
  IF _addr.id IS NULL THEN RAISE EXCEPTION 'Delivery address not found'; END IF;

  SELECT id INTO _cart FROM public.carts WHERE user_id = _uid;
  IF _cart IS NULL THEN RAISE EXCEPTION 'Your cart is empty'; END IF;
  PERFORM 1 FROM public.cart_items WHERE cart_id = _cart LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Your cart is empty'; END IF;

  -- every seller in the cart needs a live, matching quote
  FOR _store IN
    SELECT DISTINCT p.store_id AS sid, s.name AS sname
      FROM public.cart_items ci
      JOIN public.products p ON p.id = ci.product_id
      JOIN public.stores s ON s.id = p.store_id
     WHERE ci.cart_id = _cart
  LOOP
    SELECT * INTO _q FROM public.delivery_quotes
     WHERE id = ANY(_quote_ids) AND customer_id = _uid AND store_id = _store.sid
       AND address_id = _address_id AND status = 'active'
     ORDER BY created_at DESC LIMIT 1;
    IF _q.id IS NULL THEN
      RAISE EXCEPTION 'QUOTE_REQUIRED: We need a delivery quote for % before checkout', _store.sname;
    END IF;
    IF _q.expires_at <= now() THEN
      RAISE EXCEPTION 'QUOTE_EXPIRED: The delivery price for % has expired, please refresh your quote', _store.sname;
    END IF;
    _fee_total := _fee_total + _q.total_fee;
  END LOOP;

  -- prescription gate, per pharmacy in the cart
  FOR _rx IN
    SELECT p.store_id AS sid, st.name AS sname
      FROM public.cart_items ci
      JOIN public.products p ON p.id = ci.product_id
      JOIN public.stores st ON st.id = p.store_id
     WHERE ci.cart_id = _cart AND p.prescription_required
     GROUP BY p.store_id, st.name
  LOOP
    SELECT id INTO _rx_id FROM public.prescriptions
     WHERE customer_id = _uid AND store_id = _rx.sid AND status = 'approved'
       AND (expires_at IS NULL OR expires_at >= current_date)
     ORDER BY created_at DESC LIMIT 1;
    IF _rx_id IS NULL THEN
      RAISE EXCEPTION 'PRESCRIPTION_REQUIRED: % needs an approved prescription before checkout', _rx.sname;
    END IF;
    _rx_used := _rx_used || jsonb_build_object(_rx.sid::text, _rx_id::text);
  END LOOP;

  IF _is_emergency THEN
    IF NOT COALESCE((SELECT enabled FROM public.feature_flags WHERE key='emergency_pharmacy'), false) THEN
      RAISE EXCEPTION 'EMERGENCY_UNAVAILABLE: Priority pharmacy delivery is not available right now';
    END IF;
    PERFORM 1 FROM public.cart_items ci
      JOIN public.products p ON p.id = ci.product_id
      JOIN public.stores s ON s.id = p.store_id
     WHERE ci.cart_id = _cart AND NOT (s.store_type = 'pharmacy' AND s.accepts_emergency_orders
       AND s.is_open AND s.verification_status = 'approved' AND p.emergency_eligible);
    IF FOUND THEN
      RAISE EXCEPTION 'EMERGENCY_UNAVAILABLE: One or more items are not eligible for priority delivery';
    END IF;
  END IF;

  _num := 'MED-' || to_char(now(),'YYMMDD') || '-' || upper(substr(encode(gen_random_bytes(3),'hex'),1,6));
  INSERT INTO public.orders (order_number, customer_id, address_id, subtotal, delivery_fee,
      points_redeemed, points_discount, total, status, payment_status, address_snapshot,
      delivery_is_peak, delivery_rider_amount, delivery_platform_amount, delivery_rule,
      is_emergency, priority, emergency_surcharge)
  VALUES (_num, _uid, _address_id, 0, _fee_total, 0, 0, 0, 'pending_payment', 'pending',
      to_jsonb(_addr), false, 0, 0, 'per_fulfillment_quote', _is_emergency,
      CASE WHEN _is_emergency THEN 10 ELSE 0 END, 0)
  RETURNING id INTO _order;

  FOR _item IN
    SELECT ci.quantity, p.id AS product_id, p.name, p.price, p.seller_price, p.image_path,
           p.stock_quantity, p.status, p.store_id, p.seller_id, p.prescription_required
      FROM public.cart_items ci
      JOIN public.products p ON p.id = ci.product_id
     WHERE ci.cart_id = _cart
     ORDER BY p.store_id
     FOR UPDATE OF p
  LOOP
    IF _item.status <> 'active' THEN
      RAISE EXCEPTION 'PRODUCT_UNAVAILABLE: % is no longer available', _item.name; END IF;
    IF _item.stock_quantity < _item.quantity THEN
      RAISE EXCEPTION 'OUT_OF_STOCK: Only % left of %', _item.stock_quantity, _item.name; END IF;

    SELECT id INTO _ful FROM public.order_fulfillments WHERE order_id = _order AND store_id = _item.store_id;
    IF _ful IS NULL THEN
      INSERT INTO public.order_fulfillments (order_id, store_id, seller_id, is_emergency,
        customer_note, prescription_id)
      VALUES (_order, _item.store_id, _item.seller_id, _is_emergency, _customer_note,
        NULLIF(_rx_used->>_item.store_id::text,'')::uuid)
      RETURNING id INTO _ful;
    END IF;

    INSERT INTO public.order_items (order_id, fulfillment_id, product_id, seller_id, store_id,
      product_name, unit_price, seller_unit_price, platform_unit_amount, quantity,
      product_image_path, prescription_required)
    VALUES (_order, _ful, _item.product_id, _item.seller_id, _item.store_id, _item.name,
      _item.price, _item.seller_price, ROUND(_item.price - _item.seller_price, 2),
      _item.quantity, _item.image_path, _item.prescription_required);

    UPDATE public.products SET stock_quantity = stock_quantity - _item.quantity
     WHERE id = _item.product_id;

    UPDATE public.order_fulfillments SET
      items_subtotal = items_subtotal + (_item.price * _item.quantity),
      seller_amount = seller_amount + (_item.seller_price * _item.quantity),
      platform_amount = platform_amount + ((_item.price - _item.seller_price) * _item.quantity)
     WHERE id = _ful;

    _subtotal := _subtotal + (_item.price * _item.quantity);
    _platform_total := _platform_total + ((_item.price - _item.seller_price) * _item.quantity);
  END LOOP;

  -- one delivery per fulfillment group, snapshotting its own quote
  FOR _store IN SELECT * FROM public.order_fulfillments WHERE order_id = _order LOOP
    SELECT * INTO _q FROM public.delivery_quotes
     WHERE id = ANY(_quote_ids) AND customer_id = _uid AND store_id = _store.store_id
       AND status = 'active' ORDER BY created_at DESC LIMIT 1;

    INSERT INTO public.deliveries (order_id, fulfillment_id, store_id, quote_id, status,
      fee_total, rider_amount, platform_amount, is_peak, priority,
      pricing_version_id, pickup_latitude, pickup_longitude, dropoff_latitude, dropoff_longitude,
      distance_meters, duration_seconds, routing_provider, route_calculated_at,
      rider_percent, platform_percent, priority_amount, is_priority, milestone)
    VALUES (_order, _store.id, _store.store_id, _q.id, 'awaiting_payment',
      _q.total_fee, _q.rider_amount, _q.platform_amount, _q.is_peak,
      CASE WHEN _is_emergency THEN 10 ELSE 0 END,
      _q.pricing_version_id, _q.pickup_latitude, _q.pickup_longitude,
      _q.dropoff_latitude, _q.dropoff_longitude, _q.distance_meters, _q.duration_seconds,
      _q.routing_provider, _q.route_calculated_at, _q.rider_percent, _q.platform_percent,
      _q.priority_amount, _q.is_priority, 'awaiting_payment');

    UPDATE public.delivery_quotes SET status = 'used', order_id = _order WHERE id = _q.id;
  END LOOP;

  SELECT * INTO _wallet FROM public.wallets WHERE user_id = _uid;
  _points := LEAST(GREATEST(COALESCE(_points_to_redeem,0),0), COALESCE(_wallet.points_balance,0),
                   FLOOR(_subtotal)::integer);
  _discount := _points;
  _total := GREATEST(_subtotal - _discount, 0) + _fee_total;

  UPDATE public.orders SET subtotal = _subtotal, points_redeemed = _points,
    points_discount = _discount, total = _total, platform_product_amount = _platform_total,
    delivery_rider_amount = (SELECT COALESCE(sum(rider_amount),0) FROM public.deliveries WHERE order_id = _order),
    delivery_platform_amount = (SELECT COALESCE(sum(platform_amount),0) FROM public.deliveries WHERE order_id = _order),
    delivery_is_peak = (SELECT bool_or(is_peak) FROM public.deliveries WHERE order_id = _order)
   WHERE id = _order;

  IF _points > 0 THEN
    UPDATE public.wallets SET points_balance = points_balance - _points WHERE user_id = _uid;
    INSERT INTO public.wallet_transactions (user_id, order_id, kind, points, description)
    VALUES (_uid, _order, 'redeem', -_points, 'Redeemed on order ' || _num);
  END IF;

  UPDATE public.prescriptions SET status = 'fulfilled', order_id = _order, fulfilled_at = now()
   WHERE id IN (SELECT (jsonb_each_text(_rx_used)).value::uuid);

  INSERT INTO public.payments (order_id, provider, amount, status)
  VALUES (_order, 'card', _total, 'pending');

  DELETE FROM public.cart_items WHERE cart_id = _cart;
  INSERT INTO public.order_status_history (order_id, status, note, created_by, actor_role)
  VALUES (_order, 'pending_payment', 'Order created, awaiting payment', _uid, 'customer');

  RETURN jsonb_build_object('order_id', _order, 'order_number', _num, 'total', _total,
    'delivery_fee', _fee_total, 'subtotal', _subtotal, 'is_emergency', _is_emergency);
END $$;

-- 2. RIDER ELIGIBILITY + MATCHING ---------------------------------
CREATE OR REPLACE FUNCTION public.eligible_riders_for_delivery(_delivery_id uuid)
RETURNS TABLE(rider_id uuid, pickup_distance_km numeric, score numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _d public.deliveries;
BEGIN
  SELECT * INTO _d FROM public.deliveries WHERE id = _delivery_id;
  IF _d.id IS NULL THEN RETURN; END IF;
  RETURN QUERY
  SELECT rp.user_id,
         public.geo_distance_km(rp.latitude, rp.longitude, _d.pickup_latitude, _d.pickup_longitude) AS dist,
         public.geo_distance_km(rp.latitude, rp.longitude, _d.pickup_latitude, _d.pickup_longitude)
           + (rp.active_assignments * 2) AS score
    FROM public.rider_profiles rp
   WHERE rp.is_online AND rp.is_available AND NOT rp.is_suspended
     AND rp.status IN ('online','available')
     AND (rp.break_until IS NULL OR rp.break_until < now())
     AND rp.active_assignments < COALESCE(rp.max_assignments, 1)
     AND public.has_role(rp.user_id, 'rider')
     AND rp.latitude IS NOT NULL AND rp.longitude IS NOT NULL
     AND rp.location_updated_at > now() - interval '15 minutes'
     AND _d.pickup_latitude IS NOT NULL
     AND public.geo_distance_km(rp.latitude, rp.longitude, _d.pickup_latitude, _d.pickup_longitude) <= 15
     AND NOT EXISTS (
       SELECT 1 FROM public.delivery_offers o
        WHERE o.delivery_id = _delivery_id AND o.rider_id = rp.user_id
          AND o.status IN ('offered','declined'))
   ORDER BY score ASC
   LIMIT 5;
END $$;

CREATE OR REPLACE FUNCTION public.dispatch_delivery(_delivery_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _d public.deliveries; _p public.delivery_pricing_versions; _r record;
  _n integer := 0; _exp timestamptz; _round integer;
BEGIN
  SELECT * INTO _d FROM public.deliveries WHERE id = _delivery_id FOR UPDATE;
  IF _d.id IS NULL THEN RAISE EXCEPTION 'Delivery not found'; END IF;
  IF _d.rider_id IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'already_assigned', true); END IF;

  _p := public.active_delivery_pricing();
  _round := COALESCE(_d.offer_round, 0) + 1;
  IF _round > COALESCE(_p.max_offer_rounds, 5) THEN
    UPDATE public.deliveries SET status = 'rider_unavailable', last_dispatch_at = now()
     WHERE id = _delivery_id;
    PERFORM public.notify_staff('No rider found',
      'A delivery could not be matched to a rider.', '/admin/dispatch');
    RETURN jsonb_build_object('ok', false, 'code', 'MAX_ROUNDS');
  END IF;

  _exp := now() + make_interval(secs => COALESCE(_p.offer_timeout_seconds, 60));

  FOR _r IN SELECT * FROM public.eligible_riders_for_delivery(_delivery_id) LOOP
    INSERT INTO public.delivery_offers (delivery_id, rider_id, status, expires_at,
      offer_round, pickup_distance_km)
    VALUES (_delivery_id, _r.rider_id, 'offered', _exp, _round, _r.pickup_distance_km);
    INSERT INTO public.delivery_assignments (delivery_id, rider_id, offer_round, kind,
      outcome, score, pickup_distance_km, expires_at)
    VALUES (_delivery_id, _r.rider_id, _round, 'auto_offer', 'offered', _r.score,
      _r.pickup_distance_km, _exp);
    INSERT INTO public.notifications (user_id, title, body, link)
    VALUES (_r.rider_id, 'New delivery offer',
      'A delivery is available near you. Respond before the offer expires.', '/rider/offers');
    _n := _n + 1;
  END LOOP;

  UPDATE public.deliveries
     SET offer_round = _round, last_dispatch_at = now(),
         status = CASE WHEN _n > 0 THEN 'rider_offered' ELSE 'searching_for_rider' END,
         milestone = 'assignment'
   WHERE id = _delivery_id;

  IF _n = 0 THEN
    PERFORM public.notify_staff('Delivery waiting for a rider',
      'No eligible rider was found on this search round.', '/admin/dispatch');
  END IF;
  RETURN jsonb_build_object('ok', true, 'offers', _n, 'round', _round, 'expires_at', _exp);
END $$;

CREATE OR REPLACE FUNCTION public.expire_delivery_offers()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _d record; _n integer := 0;
BEGIN
  UPDATE public.delivery_offers SET status = 'expired'
   WHERE status = 'offered' AND expires_at IS NOT NULL AND expires_at < now();
  UPDATE public.delivery_assignments SET outcome = 'expired', resolved_at = now()
   WHERE outcome = 'offered' AND expires_at IS NOT NULL AND expires_at < now();
  FOR _d IN
    SELECT d.id FROM public.deliveries d
     WHERE d.rider_id IS NULL
       AND d.status IN ('rider_offered','searching_for_rider')
       AND NOT EXISTS (SELECT 1 FROM public.delivery_offers o
                        WHERE o.delivery_id = d.id AND o.status = 'offered')
  LOOP
    PERFORM public.dispatch_delivery(_d.id);
    _n := _n + 1;
  END LOOP;
  RETURN _n;
END $$;

-- 3. RIDER RESPONSE (single-claim safe) ---------------------------
CREATE OR REPLACE FUNCTION public.rider_respond_to_offer(
  _delivery_id uuid, _accept boolean, _reason text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _d public.deliveries; _o public.orders; _off public.delivery_offers;
BEGIN
  IF NOT public.has_role(auth.uid(),'rider') THEN RAISE EXCEPTION 'Riders only'; END IF;
  SELECT * INTO _off FROM public.delivery_offers
   WHERE delivery_id = _delivery_id AND rider_id = auth.uid() ORDER BY created_at DESC LIMIT 1;
  IF _off.id IS NULL THEN RAISE EXCEPTION 'This delivery was not offered to you'; END IF;
  IF _off.status <> 'offered' OR (_off.expires_at IS NOT NULL AND _off.expires_at < now()) THEN
    RAISE EXCEPTION 'OFFER_CLOSED: This delivery is no longer available';
  END IF;

  IF NOT _accept THEN
    UPDATE public.delivery_offers SET status = 'declined', responded_at = now(),
      decline_reason = _reason WHERE id = _off.id;
    UPDATE public.delivery_assignments SET outcome = 'declined', reason = _reason,
      resolved_at = now()
     WHERE delivery_id = _delivery_id AND rider_id = auth.uid() AND outcome = 'offered';
    RETURN;
  END IF;

  -- exclusive claim: only one rider can win
  UPDATE public.deliveries
     SET rider_id = auth.uid(), status = 'rider_assigned', assigned_at = now(),
         milestone = 'to_pickup',
         expected_pickup_at = now() + interval '20 minutes',
         expected_delivery_at = now() + make_interval(secs => COALESCE(duration_seconds, 0) + 1800)
   WHERE id = _delivery_id AND rider_id IS NULL
   RETURNING * INTO _d;
  IF _d.id IS NULL THEN
    RAISE EXCEPTION 'OFFER_CLOSED: This delivery is no longer available';
  END IF;

  SELECT * INTO _o FROM public.orders WHERE id = _d.order_id;
  UPDATE public.delivery_offers SET status = 'accepted', responded_at = now() WHERE id = _off.id;
  UPDATE public.delivery_offers SET status = 'expired'
   WHERE delivery_id = _delivery_id AND rider_id <> auth.uid() AND status = 'offered';
  UPDATE public.delivery_assignments SET outcome = 'accepted', resolved_at = now()
   WHERE delivery_id = _delivery_id AND rider_id = auth.uid() AND outcome = 'offered';
  UPDATE public.delivery_assignments SET outcome = 'expired', resolved_at = now()
   WHERE delivery_id = _delivery_id AND rider_id <> auth.uid() AND outcome = 'offered';

  INSERT INTO public.rider_profiles (user_id, active_assignments) VALUES (auth.uid(), 1)
    ON CONFLICT (user_id) DO UPDATE SET active_assignments = public.rider_profiles.active_assignments + 1;

  PERFORM public.log_order_status(_o.id, 'rider_assigned', 'Rider accepted the delivery');
  INSERT INTO public.notifications (user_id, title, body, link)
  VALUES (_o.customer_id, 'Rider assigned',
    'A rider is on the way to collect order ' || _o.order_number || '.', '/orders/' || _o.id);
  INSERT INTO public.notifications (user_id, title, body, link)
  SELECT f.seller_id, 'Rider assigned',
    'A rider is coming to collect order ' || _o.order_number || '.', '/seller/orders'
    FROM public.order_fulfillments f WHERE f.id = _d.fulfillment_id;
END $$;

-- 4. ADMIN MANUAL ASSIGNMENT / REASSIGNMENT ------------------------
CREATE OR REPLACE FUNCTION public.admin_assign_rider(
  _delivery_id uuid, _rider_id uuid, _reason text, _override boolean DEFAULT false)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _d public.deliveries; _o public.orders; _prev uuid; _ok boolean;
BEGIN
  IF NOT public.has_permission(auth.uid(), 'delivery.dispatch') THEN
    RAISE EXCEPTION 'Not permitted'; END IF;
  IF _reason IS NULL OR length(trim(_reason)) < 3 THEN
    RAISE EXCEPTION 'A reason is required for manual assignment'; END IF;

  SELECT * INTO _d FROM public.deliveries WHERE id = _delivery_id FOR UPDATE;
  IF _d.id IS NULL THEN RAISE EXCEPTION 'Delivery not found'; END IF;
  IF _d.delivered_at IS NOT NULL THEN RAISE EXCEPTION 'Delivery already completed'; END IF;

  IF NOT _override THEN
    SELECT EXISTS (SELECT 1 FROM public.eligible_riders_for_delivery(_delivery_id) e
                    WHERE e.rider_id = _rider_id) INTO _ok;
    IF NOT _ok THEN RAISE EXCEPTION 'That rider is not currently eligible for this delivery'; END IF;
  END IF;

  _prev := _d.rider_id;
  IF _prev IS NOT NULL THEN
    UPDATE public.rider_profiles SET active_assignments = GREATEST(active_assignments - 1, 0)
     WHERE user_id = _prev;
    INSERT INTO public.delivery_assignments (delivery_id, rider_id, offer_round, kind, outcome,
      reason, assigned_by, resolved_at)
    VALUES (_delivery_id, _prev, COALESCE(_d.offer_round,0), 'admin_reassign', 'unassigned',
      _reason, auth.uid(), now());
    INSERT INTO public.notifications (user_id, title, body, link)
    VALUES (_prev, 'Delivery reassigned', 'This delivery was reassigned by support.', '/rider/deliveries');
  END IF;

  UPDATE public.deliveries SET rider_id = _rider_id, status = 'rider_assigned',
    assigned_at = now(), milestone = 'to_pickup',
    expected_pickup_at = now() + interval '20 minutes'
   WHERE id = _delivery_id;
  UPDATE public.delivery_offers SET status = 'expired'
   WHERE delivery_id = _delivery_id AND status = 'offered';
  INSERT INTO public.rider_profiles (user_id, active_assignments) VALUES (_rider_id, 1)
    ON CONFLICT (user_id) DO UPDATE SET active_assignments = public.rider_profiles.active_assignments + 1;
  INSERT INTO public.delivery_assignments (delivery_id, rider_id, offer_round, kind, outcome,
    reason, assigned_by, resolved_at)
  VALUES (_delivery_id, _rider_id, COALESCE(_d.offer_round,0), 'admin_assign', 'accepted',
    _reason, auth.uid(), now());

  SELECT * INTO _o FROM public.orders WHERE id = _d.order_id;
  PERFORM public.log_order_status(_o.id, 'rider_assigned', 'Rider assigned by support');
  PERFORM public.log_audit('delivery.assign_rider', 'delivery', _delivery_id, _reason,
    jsonb_build_object('rider_id', _prev), jsonb_build_object('rider_id', _rider_id));
  INSERT INTO public.notifications (user_id, title, body, link)
  VALUES (_rider_id, 'Delivery assigned to you',
    'Support assigned you a delivery. Open it for pickup details.', '/rider/deliveries');
END $$;

-- 5. VERIFICATION (per fulfillment, attempt limited) ---------------
CREATE OR REPLACE FUNCTION public.verify_pickup(_delivery_id uuid, _code text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _d public.deliveries; _o public.orders;
BEGIN
  SELECT * INTO _d FROM public.deliveries WHERE id = _delivery_id FOR UPDATE;
  IF _d.id IS NULL OR _d.rider_id <> auth.uid() THEN RAISE EXCEPTION 'Not permitted'; END IF;
  IF _d.pickup_code IS NULL OR _d.pickup_code <> trim(_code) THEN
    UPDATE public.deliveries SET code_attempts = code_attempts + 1 WHERE id = _delivery_id;
    IF _d.code_attempts + 1 >= 5 THEN
      PERFORM public.notify_staff('Repeated verification failures',
        'A rider has failed code verification several times.', '/admin/dispatch');
      RAISE EXCEPTION 'INVALID_CODE: Too many incorrect attempts. Please contact support.';
    END IF;
    RAISE EXCEPTION 'INVALID_CODE: That pickup code is not correct';
  END IF;
  SELECT * INTO _o FROM public.orders WHERE id = _d.order_id;
  UPDATE public.deliveries SET pickup_verified_at = now(), picked_up_at = now(),
    status = 'picked_up', milestone = 'to_customer', code_attempts = 0,
    expected_delivery_at = now() + make_interval(secs => COALESCE(duration_seconds, 1800))
   WHERE id = _delivery_id;
  UPDATE public.order_fulfillments SET status = 'picked_up'
   WHERE id = COALESCE(_d.fulfillment_id, order_fulfillments.id)
     AND order_id = _o.id AND status = 'ready_for_pickup';
  PERFORM public.log_order_status(_o.id, 'picked_up', 'Pickup verified with store code');
  INSERT INTO public.notifications (user_id, title, body, link)
  VALUES (_o.customer_id, 'Order picked up',
    'Order ' || _o.order_number || ' has been collected and is on the way.', '/orders/' || _o.id);
END $$;

CREATE OR REPLACE FUNCTION public.verify_delivery(_delivery_id uuid, _code text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _d public.deliveries; _o public.orders; _f public.order_fulfillments;
  _pts integer; _all_done boolean;
BEGIN
  SELECT * INTO _d FROM public.deliveries WHERE id = _delivery_id FOR UPDATE;
  IF _d.id IS NULL OR _d.rider_id <> auth.uid() THEN RAISE EXCEPTION 'Not permitted'; END IF;
  IF _d.pickup_verified_at IS NULL THEN RAISE EXCEPTION 'Pickup has not been verified'; END IF;
  IF _d.delivery_code IS NULL OR _d.delivery_code <> trim(_code) THEN
    UPDATE public.deliveries SET code_attempts = code_attempts + 1 WHERE id = _delivery_id;
    IF _d.code_attempts + 1 >= 5 THEN
      PERFORM public.notify_staff('Repeated delivery code failures',
        'A rider has failed delivery verification several times.', '/admin/dispatch');
      RAISE EXCEPTION 'INVALID_CODE: Too many incorrect attempts. Please contact support.';
    END IF;
    RAISE EXCEPTION 'INVALID_CODE: That delivery code is not correct';
  END IF;

  SELECT * INTO _o FROM public.orders WHERE id = _d.order_id;
  UPDATE public.deliveries SET status = 'delivered', delivered_at = now(),
    delivery_verified_at = now(), milestone = 'delivered', code_attempts = 0
   WHERE id = _delivery_id;

  -- settle this fulfillment only, using its own stored snapshot
  IF _d.fulfillment_id IS NOT NULL THEN
    SELECT * INTO _f FROM public.order_fulfillments WHERE id = _d.fulfillment_id;
    UPDATE public.order_fulfillments SET status = 'completed' WHERE id = _f.id;
    INSERT INTO public.ledger_entries (order_id, fulfillment_id, kind, beneficiary_id, amount, rule, payout_status)
    VALUES (_o.id, _f.id, 'seller_product_earning', _f.seller_id, _f.seller_amount,
      'seller_entered_price', 'pending');
    INSERT INTO public.ledger_entries (order_id, fulfillment_id, kind, amount, rule)
    VALUES (_o.id, _f.id, 'platform_product_commission', _f.platform_amount, 'product_markup');
  ELSE
    FOR _f IN SELECT * FROM public.order_fulfillments WHERE order_id = _o.id
      AND status NOT IN ('rejected','cancelled') LOOP
      UPDATE public.order_fulfillments SET status = 'completed' WHERE id = _f.id;
      INSERT INTO public.ledger_entries (order_id, fulfillment_id, kind, beneficiary_id, amount, rule, payout_status)
      VALUES (_o.id, _f.id, 'seller_product_earning', _f.seller_id, _f.seller_amount,
        'seller_entered_price', 'pending');
      INSERT INTO public.ledger_entries (order_id, fulfillment_id, kind, amount, rule)
      VALUES (_o.id, _f.id, 'platform_product_commission', _f.platform_amount, 'product_markup');
    END LOOP;
  END IF;

  INSERT INTO public.ledger_entries (order_id, delivery_id, kind, beneficiary_id, amount, percentage, rule, payout_status)
  VALUES (_o.id, _d.id, 'rider_delivery_earning', _d.rider_id, _d.rider_amount,
    _d.rider_percent, COALESCE(_o.delivery_rule,'per_fulfillment_quote'), 'pending');
  INSERT INTO public.ledger_entries (order_id, delivery_id, kind, amount, percentage, rule)
  VALUES (_o.id, _d.id, 'platform_delivery_share', _d.platform_amount,
    _d.platform_percent, COALESCE(_o.delivery_rule,'per_fulfillment_quote'));

  UPDATE public.rider_profiles SET active_assignments = GREATEST(active_assignments - 1, 0)
   WHERE user_id = _d.rider_id;

  SELECT NOT EXISTS (
    SELECT 1 FROM public.deliveries WHERE order_id = _o.id AND delivered_at IS NULL
      AND status NOT IN ('cancelled','failed')) INTO _all_done;

  PERFORM public.log_order_status(_o.id, 'delivered', 'Delivery verified with customer code');
  IF _all_done THEN
    UPDATE public.orders SET completed_at = now() WHERE id = _o.id;
    _pts := FLOOR(_o.total / 100)::integer;
    IF _pts > 0 THEN
      INSERT INTO public.wallets (user_id, points_balance) VALUES (_o.customer_id, _pts)
        ON CONFLICT (user_id) DO UPDATE SET points_balance = public.wallets.points_balance + _pts;
      INSERT INTO public.wallet_transactions (user_id, order_id, kind, points, description)
      VALUES (_o.customer_id, _o.id, 'earn', _pts, 'Earned on order ' || _o.order_number);
    END IF;
    PERFORM public.log_order_status(_o.id, 'completed', 'Order completed');
  END IF;

  INSERT INTO public.notifications (user_id, title, body, link)
  VALUES (_o.customer_id, 'Order delivered',
    'Order ' || _o.order_number || ' was delivered.', '/orders/' || _o.id);
  INSERT INTO public.notifications (user_id, title, body, link)
  VALUES (_d.rider_id, 'Delivery completed',
    'Your earnings for this delivery have been recorded.', '/rider/earnings');
END $$;

-- 6. PICKUP / DELIVERY PROBLEMS ------------------------------------
CREATE OR REPLACE FUNCTION public.rider_report_delivery_problem(
  _delivery_id uuid, _stage text, _reason text, _note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _d public.deliveries; _o public.orders;
BEGIN
  SELECT * INTO _d FROM public.deliveries WHERE id = _delivery_id;
  IF _d.id IS NULL OR _d.rider_id <> auth.uid() THEN RAISE EXCEPTION 'Not permitted'; END IF;
  IF _stage NOT IN ('pickup','delivery') THEN RAISE EXCEPTION 'Invalid stage'; END IF;
  SELECT * INTO _o FROM public.orders WHERE id = _d.order_id;

  UPDATE public.deliveries
     SET status = CASE WHEN _stage = 'pickup' THEN 'pickup_problem' ELSE 'delivery_failed' END,
         failure_reason = _reason, failure_note = _note
   WHERE id = _delivery_id;

  INSERT INTO public.support_tickets (user_id, category, subject, message, status, order_id)
  VALUES (auth.uid(), 'order',
    CASE WHEN _stage = 'pickup' THEN 'Pickup problem' ELSE 'Delivery problem' END
      || ' on order ' || _o.order_number,
    _reason || COALESCE(' — ' || _note, ''), 'open', _o.id);

  PERFORM public.notify_staff(
    CASE WHEN _stage = 'pickup' THEN 'Pickup problem reported' ELSE 'Delivery failed' END,
    'Order ' || _o.order_number || ': ' || _reason, '/admin/dispatch');
  INSERT INTO public.notifications (user_id, title, body, link)
  VALUES (_o.customer_id, 'Delivery update',
    'Your delivery is taking longer than expected. Support is monitoring it.',
    '/orders/' || _o.id);
END $$;

-- 7. MILESTONE-BASED LATE DETECTION --------------------------------
CREATE OR REPLACE FUNCTION public.flag_late_deliveries()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE d record; n integer := 0; _p public.delivery_pricing_versions;
  _threshold integer; _expected timestamptz; _milestone text;
BEGIN
  _p := public.active_delivery_pricing();
  _threshold := COALESCE(_p.late_threshold_minutes, 20);
  FOR d IN
    SELECT * FROM public.deliveries
     WHERE delivered_at IS NULL AND rider_id IS NOT NULL
       AND status NOT IN ('cancelled','failed','delivery_failed')
  LOOP
    IF d.pickup_verified_at IS NULL THEN
      _expected := d.expected_pickup_at; _milestone := 'pickup';
    ELSE
      _expected := d.expected_delivery_at; _milestone := 'delivery';
    END IF;
    CONTINUE WHEN _expected IS NULL OR _expected > now() - make_interval(mins => _threshold);
    CONTINUE WHEN EXISTS (
      SELECT 1 FROM public.late_delivery_events e
       WHERE e.delivery_id = d.id AND e.status = 'open' AND e.expected_at = _expected);

    INSERT INTO public.late_delivery_events (delivery_id, order_id, rider_id, expected_at, delay_minutes)
    VALUES (d.id, d.order_id, d.rider_id, _expected,
      floor(extract(epoch from (now() - _expected))/60));
    UPDATE public.deliveries SET late_alert_sent_at = now() WHERE id = d.id;
    INSERT INTO public.notifications (user_id, title, body, link)
    VALUES (d.rider_id, 'Delivery running late',
      'This delivery has passed its expected ' || _milestone || ' time.', '/rider/deliveries');
    INSERT INTO public.notifications (user_id, title, body, link)
    SELECT o.customer_id, 'Delivery delayed',
      'Your delivery is taking longer than expected. Support is monitoring it.',
      '/orders/' || o.id FROM public.orders o WHERE o.id = d.order_id;
    PERFORM public.notify_staff('Late delivery',
      'A delivery has passed its expected ' || _milestone || ' time.', '/admin/dispatch');
    n := n + 1;
  END LOOP;
  RETURN n;
END $$;

-- 8. DISPATCH ON READY FOR PICKUP ----------------------------------
CREATE OR REPLACE FUNCTION public.queue_delivery_on_ready()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _did uuid;
BEGIN
  IF NEW.status = 'ready_for_pickup' AND OLD.status IS DISTINCT FROM NEW.status THEN
    SELECT id INTO _did FROM public.deliveries
     WHERE fulfillment_id = NEW.id AND rider_id IS NULL LIMIT 1;
    IF _did IS NOT NULL THEN
      UPDATE public.deliveries SET status = 'searching_for_rider', milestone = 'assignment'
       WHERE id = _did;
      PERFORM public.dispatch_delivery(_did);
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_queue_delivery_on_ready ON public.order_fulfillments;
CREATE TRIGGER trg_queue_delivery_on_ready
  AFTER UPDATE OF status ON public.order_fulfillments
  FOR EACH ROW EXECUTE FUNCTION public.queue_delivery_on_ready();

-- 9. PERMISSION + EXECUTE GRANTS -----------------------------------
INSERT INTO public.role_permissions (role, permission)
SELECT 'admin'::public.app_role, 'delivery.dispatch'
 WHERE NOT EXISTS (SELECT 1 FROM public.role_permissions
                    WHERE role = 'admin' AND permission = 'delivery.dispatch');
INSERT INTO public.role_permissions (role, permission)
SELECT 'super_admin'::public.app_role, 'delivery.dispatch'
 WHERE NOT EXISTS (SELECT 1 FROM public.role_permissions
                    WHERE role = 'super_admin' AND permission = 'delivery.dispatch');

REVOKE ALL ON FUNCTION public.place_order_from_quotes(uuid, uuid[], integer, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.place_order_from_quotes(uuid, uuid[], integer, boolean, text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.dispatch_delivery(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dispatch_delivery(uuid) TO service_role;
REVOKE ALL ON FUNCTION public.expire_delivery_offers() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.expire_delivery_offers() TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.eligible_riders_for_delivery(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.eligible_riders_for_delivery(uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.admin_assign_rider(uuid, uuid, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_assign_rider(uuid, uuid, text, boolean) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.rider_report_delivery_problem(uuid, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rider_report_delivery_problem(uuid, text, text, text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.rider_respond_to_offer(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rider_respond_to_offer(uuid, boolean, text) TO authenticated, service_role;