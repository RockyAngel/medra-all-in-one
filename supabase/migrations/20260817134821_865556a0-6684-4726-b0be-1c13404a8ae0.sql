-- 1) place_order: create one delivery per store fulfillment, linked via fulfillment_id
CREATE OR REPLACE FUNCTION public.place_order(_address_id uuid, _points_to_redeem integer DEFAULT 0, _is_emergency boolean DEFAULT false, _customer_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  _uid uuid := auth.uid(); _cart uuid; _order uuid; _num text; _addr public.addresses;
  _item record; _quote jsonb; _subtotal numeric := 0; _seller_total numeric := 0;
  _platform_total numeric := 0; _points integer := 0; _discount numeric := 0;
  _fee numeric; _total numeric; _ful uuid; _wallet record; _rx record;
  _surcharge_pct numeric := 0; _surcharge numeric := 0; _priority integer := 0;
  _rx_used jsonb := '{}'::jsonb; _rx_id uuid;
  _ful_count integer; _idx integer := 0; _f record;
  _fee_left numeric; _rider_left numeric; _plat_left numeric;
  _fee_share numeric; _rider_share numeric; _plat_share numeric;
  _rider_total numeric; _plat_total_fee numeric;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO _addr FROM public.addresses WHERE id = _address_id AND user_id = _uid;
  IF _addr.id IS NULL THEN RAISE EXCEPTION 'Delivery address not found'; END IF;

  _quote := public.quote_delivery_fee(_addr.city);
  IF (_quote->>'configured')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'DELIVERY_UNAVAILABLE: %', _quote->>'reason';
  END IF;
  _fee := (_quote->>'fee')::numeric;

  SELECT id INTO _cart FROM public.carts WHERE user_id = _uid;
  IF _cart IS NULL THEN RAISE EXCEPTION 'Your cart is empty'; END IF;
  PERFORM 1 FROM public.cart_items WHERE cart_id = _cart LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Your cart is empty'; END IF;

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
    IF NOT EXISTS (SELECT 1 FROM public.rider_profiles WHERE is_online AND is_available
                     AND active_assignments < max_assignments) THEN
      RAISE EXCEPTION 'EMERGENCY_UNAVAILABLE: No riders are available for priority delivery right now';
    END IF;
    SELECT COALESCE((value->>'surcharge_percent')::numeric, 25),
           COALESCE((value->>'priority')::integer, 10)
      INTO _surcharge_pct, _priority FROM public.platform_settings WHERE key = 'emergency_pharmacy';
    _surcharge := ROUND(_fee * _surcharge_pct / 100, 2);
    _fee := _fee + _surcharge;
  END IF;

  _rider_total := ROUND(_fee * COALESCE((_quote->>'rider_percent')::numeric,
    CASE WHEN (_quote->>'fee')::numeric > 0
         THEN (_quote->>'rider_amount')::numeric / (_quote->>'fee')::numeric * 100 ELSE 85 END) / 100, 2);
  _plat_total_fee := _fee - _rider_total;

  _num := 'MED-' || to_char(now(),'YYMMDD') || '-' || upper(substr(encode(gen_random_bytes(3),'hex'),1,6));
  INSERT INTO public.orders (order_number, customer_id, address_id, subtotal, delivery_fee,
      points_redeemed, points_discount, total, status, payment_status, address_snapshot,
      delivery_is_peak, delivery_rider_amount, delivery_platform_amount, delivery_rule,
      is_emergency, priority, emergency_surcharge)
  VALUES (_num, _uid, _address_id, 0, _fee, 0, 0, 0, 'pending_payment', 'pending',
      to_jsonb(_addr), (_quote->>'is_peak')::boolean, _rider_total,
      _plat_total_fee, _quote->>'rule', _is_emergency, _priority, _surcharge)
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
      RAISE EXCEPTION 'PRODUCT_UNAVAILABLE: % is no longer available', _item.name;
    END IF;
    IF _item.stock_quantity < _item.quantity THEN
      RAISE EXCEPTION 'OUT_OF_STOCK: Only % left of %', _item.stock_quantity, _item.name;
    END IF;

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
    _seller_total := _seller_total + (_item.seller_price * _item.quantity);
    _platform_total := _platform_total + ((_item.price - _item.seller_price) * _item.quantity);
  END LOOP;

  SELECT * INTO _wallet FROM public.wallets WHERE user_id = _uid;
  _points := LEAST(GREATEST(COALESCE(_points_to_redeem,0),0), COALESCE(_wallet.points_balance,0),
                   FLOOR(_subtotal)::integer);
  _discount := _points;
  _total := GREATEST(_subtotal - _discount, 0) + _fee;

  UPDATE public.orders SET subtotal = _subtotal, points_redeemed = _points,
    points_discount = _discount, total = _total, platform_product_amount = _platform_total
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

  -- one delivery per store package, fee split proportionally, remainder on the last one
  SELECT count(*) INTO _ful_count FROM public.order_fulfillments WHERE order_id = _order;
  _fee_left := _fee; _rider_left := _rider_total; _plat_left := _plat_total_fee;
  FOR _f IN SELECT id FROM public.order_fulfillments WHERE order_id = _order ORDER BY created_at, id
  LOOP
    _idx := _idx + 1;
    IF _idx = _ful_count THEN
      _fee_share := _fee_left; _rider_share := _rider_left; _plat_share := _plat_left;
    ELSE
      _fee_share := ROUND(_fee / _ful_count, 2);
      _rider_share := ROUND(_rider_total / _ful_count, 2);
      _plat_share := ROUND(_plat_total_fee / _ful_count, 2);
      _fee_left := _fee_left - _fee_share;
      _rider_left := _rider_left - _rider_share;
      _plat_left := _plat_left - _plat_share;
    END IF;
    INSERT INTO public.deliveries (order_id, fulfillment_id, status, fee_total, rider_amount,
      platform_amount, is_peak, priority)
    VALUES (_order, _f.id, 'awaiting_payment', _fee_share, _rider_share, _plat_share,
      (_quote->>'is_peak')::boolean, _priority);
  END LOOP;

  DELETE FROM public.cart_items WHERE cart_id = _cart;
  INSERT INTO public.order_status_history (order_id, status, note, created_by, actor_role)
  VALUES (_order, 'pending_payment',
    CASE WHEN _is_emergency THEN 'Priority pharmacy order created, awaiting payment'
         ELSE 'Order created, awaiting payment' END, _uid, 'customer');

  RETURN jsonb_build_object('order_id', _order, 'order_number', _num, 'total', _total,
    'delivery_fee', _fee, 'subtotal', _subtotal, 'is_emergency', _is_emergency,
    'emergency_surcharge', _surcharge);
END $function$;

-- 2) backfill deliveries that were created without a fulfillment link
UPDATE public.deliveries d
   SET fulfillment_id = f.id
  FROM public.order_fulfillments f
 WHERE d.fulfillment_id IS NULL
   AND f.order_id = d.order_id
   AND (SELECT count(*) FROM public.order_fulfillments f2 WHERE f2.order_id = d.order_id) = 1;

-- 3) verify_delivery: resolve the fulfillment even when the link is missing
CREATE OR REPLACE FUNCTION public.verify_delivery(_delivery_id uuid, _code text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE _d public.deliveries; _o public.orders; _f public.order_fulfillments;
  _all_done boolean; _fid uuid;
BEGIN
  SELECT * INTO _d FROM public.deliveries WHERE id = _delivery_id FOR UPDATE;
  IF _d.id IS NULL OR _d.rider_id <> auth.uid() THEN RAISE EXCEPTION 'Not permitted'; END IF;
  IF _d.pickup_verified_at IS NULL THEN RAISE EXCEPTION 'Pickup has not been verified'; END IF;
  IF _d.delivery_verified_at IS NOT NULL THEN RETURN; END IF;
  IF _d.delivery_code IS NULL OR _d.delivery_code <> trim(_code) THEN
    UPDATE public.deliveries SET code_attempts = code_attempts + 1 WHERE id = _delivery_id;
    IF _d.code_attempts + 1 >= 5 THEN
      UPDATE public.deliveries SET status = 'failed' WHERE id = _delivery_id;
      RAISE EXCEPTION 'Too many incorrect codes. Delivery flagged for support.';
    END IF;
    RAISE EXCEPTION 'Incorrect delivery code';
  END IF;

  SELECT * INTO _o FROM public.orders WHERE id = _d.order_id FOR UPDATE;

  _fid := _d.fulfillment_id;
  IF _fid IS NULL THEN
    SELECT id INTO _fid FROM public.order_fulfillments
     WHERE order_id = _d.order_id ORDER BY created_at, id LIMIT 1;
    UPDATE public.deliveries SET fulfillment_id = _fid WHERE id = _delivery_id;
  END IF;

  UPDATE public.deliveries
     SET status = 'delivered', delivered_at = now(), delivery_verified_at = now()
   WHERE id = _delivery_id;

  IF _fid IS NOT NULL THEN
    SELECT * INTO _f FROM public.order_fulfillments WHERE id = _fid;
    UPDATE public.order_fulfillments SET status = 'delivered' WHERE id = _fid;
  END IF;

  INSERT INTO public.ledger_entries
    (order_id, delivery_id, fulfillment_id, kind, beneficiary_id, amount, percentage, rule, payout_status)
  VALUES
    (_o.id, _d.id, _fid, 'rider_delivery_earning', _d.rider_id,
     COALESCE(_d.rider_amount, 0), _d.rider_percent,
     CASE WHEN _d.is_peak THEN 'peak_split' ELSE 'regular_split' END, 'available'),
    (_o.id, _d.id, _fid, 'platform_delivery_share', NULL,
     COALESCE(_d.platform_amount, 0), _d.platform_percent,
     CASE WHEN _d.is_peak THEN 'peak_split' ELSE 'regular_split' END, 'available');

  IF _f.id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.ledger_entries
     WHERE fulfillment_id = _f.id AND kind = 'seller_product_earning') THEN
    INSERT INTO public.ledger_entries
      (order_id, delivery_id, fulfillment_id, kind, beneficiary_id, amount, percentage, rule, payout_status)
    VALUES
      (_o.id, _d.id, _f.id, 'seller_product_earning', _f.seller_id,
       COALESCE(_f.seller_amount, 0), NULL, 'seller_items_subtotal', 'available'),
      (_o.id, _d.id, _f.id, 'platform_product_commission', NULL,
       COALESCE(_f.platform_amount, 0),
       CASE WHEN COALESCE(_f.items_subtotal, 0) > 0
            THEN round(COALESCE(_f.platform_amount, 0) / _f.items_subtotal * 100, 2) END,
       'platform_markup', 'available');
  END IF;

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