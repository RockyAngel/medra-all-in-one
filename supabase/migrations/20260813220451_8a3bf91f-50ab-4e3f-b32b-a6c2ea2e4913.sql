REVOKE EXECUTE ON FUNCTION public.get_pickup_code(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_delivery_code(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_staff(uuid) FROM anon;

-- ---------- helpers ----------
CREATE OR REPLACE FUNCTION public.current_actor_role()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT role::text FROM public.user_roles WHERE user_id = auth.uid()
    ORDER BY CASE role WHEN 'super_admin' THEN 1 WHEN 'admin' THEN 2 WHEN 'seller' THEN 3
      WHEN 'rider' THEN 4 ELSE 5 END LIMIT 1), 'customer')
$$;

CREATE OR REPLACE FUNCTION public.log_order_status(_order_id uuid, _new public.order_status, _note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _prev public.order_status;
BEGIN
  SELECT status INTO _prev FROM public.orders WHERE id = _order_id;
  UPDATE public.orders SET status = _new, updated_at = now() WHERE id = _order_id;
  INSERT INTO public.order_status_history (order_id, status, previous_status, note, created_by, actor_role)
  VALUES (_order_id, _new, _prev, _note, auth.uid(), public.current_actor_role());
END $$;

CREATE OR REPLACE FUNCTION public.notify_staff(_title text, _body text, _link text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.notifications (user_id, title, body, link)
  SELECT user_id, _title, _body, _link FROM public.user_roles WHERE role IN ('admin','super_admin');
END $$;

-- ---------- delivery pricing ----------
CREATE OR REPLACE FUNCTION public.is_peak_now()
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _windows jsonb; _w jsonb; _now time := (now() AT TIME ZONE 'Africa/Lagos')::time;
BEGIN
  SELECT value->'peak_windows' INTO _windows FROM public.platform_settings WHERE key = 'delivery_pricing';
  IF _windows IS NULL THEN RETURN false; END IF;
  FOR _w IN SELECT * FROM jsonb_array_elements(_windows) LOOP
    IF _now >= (_w->>'start')::time AND _now <= (_w->>'end')::time THEN RETURN true; END IF;
  END LOOP;
  RETURN false;
END $$;

CREATE OR REPLACE FUNCTION public.quote_delivery_fee(_city text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _cfg jsonb; _zone public.delivery_zones; _peak boolean; _fee numeric;
  _rider_pct numeric; _platform_pct numeric; _comm jsonb;
BEGIN
  SELECT value INTO _cfg FROM public.platform_settings WHERE key = 'delivery_pricing';
  SELECT value INTO _comm FROM public.platform_settings WHERE key = 'commission';
  IF COALESCE((_cfg->>'configured')::boolean, false) IS NOT TRUE THEN
    RETURN jsonb_build_object('configured', false,
      'reason', 'Delivery pricing has not been configured by the Medra team yet.');
  END IF;
  SELECT * INTO _zone FROM public.delivery_zones
   WHERE is_active AND (city IS NULL OR lower(city) = lower(COALESCE(_city,'')))
   ORDER BY (city IS NOT NULL) DESC LIMIT 1;
  IF _zone.id IS NULL THEN
    RETURN jsonb_build_object('configured', false,
      'reason', 'No delivery zone covers this address yet.');
  END IF;
  _peak := public.is_peak_now();
  _fee := GREATEST(_zone.base_fee, _zone.min_fee);
  IF _peak THEN _fee := ROUND(_fee * _zone.peak_multiplier, 2); END IF;
  _rider_pct := CASE WHEN _peak THEN COALESCE((_comm->>'rider_peak_percent')::numeric, 90)
                     ELSE COALESCE((_comm->>'rider_regular_percent')::numeric, 85) END;
  _platform_pct := 100 - _rider_pct;
  RETURN jsonb_build_object(
    'configured', true, 'fee', _fee, 'is_peak', _peak, 'zone', _zone.name,
    'rider_percent', _rider_pct, 'platform_percent', _platform_pct,
    'rider_amount', ROUND(_fee * _rider_pct / 100, 2),
    'platform_amount', ROUND(_fee * _platform_pct / 100, 2),
    'rule', CASE WHEN _peak THEN 'peak_' || _rider_pct || '_' || _platform_pct
                 ELSE 'regular_' || _rider_pct || '_' || _platform_pct END);
END $$;

-- ---------- place order ----------
CREATE OR REPLACE FUNCTION public.place_order(_address_id uuid, _points_to_redeem integer DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid(); _cart uuid; _order uuid; _num text; _addr public.addresses;
  _item record; _quote jsonb; _subtotal numeric := 0; _seller_total numeric := 0;
  _platform_total numeric := 0; _points integer := 0; _discount numeric := 0;
  _fee numeric; _total numeric; _ful uuid; _wallet record;
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

  _num := 'MED-' || to_char(now(),'YYMMDD') || '-' || upper(substr(encode(gen_random_bytes(3),'hex'),1,6));
  INSERT INTO public.orders (order_number, customer_id, address_id, subtotal, delivery_fee,
      points_redeemed, points_discount, total, status, payment_status, address_snapshot,
      delivery_is_peak, delivery_rider_amount, delivery_platform_amount, delivery_rule)
  VALUES (_num, _uid, _address_id, 0, _fee, 0, 0, 0, 'pending_payment', 'pending',
      to_jsonb(_addr), (_quote->>'is_peak')::boolean, (_quote->>'rider_amount')::numeric,
      (_quote->>'platform_amount')::numeric, _quote->>'rule')
  RETURNING id INTO _order;

  FOR _item IN
    SELECT ci.quantity, p.id AS product_id, p.name, p.price, p.seller_price, p.image_path,
           p.stock_quantity, p.status, p.store_id, p.seller_id, p.platform_markup_percent
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
      INSERT INTO public.order_fulfillments (order_id, store_id, seller_id)
      VALUES (_order, _item.store_id, _item.seller_id) RETURNING id INTO _ful;
    END IF;

    INSERT INTO public.order_items (order_id, fulfillment_id, product_id, seller_id, store_id,
      product_name, unit_price, seller_unit_price, platform_unit_amount, quantity, product_image_path)
    VALUES (_order, _ful, _item.product_id, _item.seller_id, _item.store_id, _item.name,
      _item.price, _item.seller_price, ROUND(_item.price - _item.seller_price, 2),
      _item.quantity, _item.image_path);

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

  INSERT INTO public.payments (order_id, provider, amount, status)
  VALUES (_order, 'card', _total, 'pending');

  INSERT INTO public.deliveries (order_id, status, fee_total, rider_amount, platform_amount, is_peak)
  VALUES (_order, 'awaiting_payment', _fee, (_quote->>'rider_amount')::numeric,
          (_quote->>'platform_amount')::numeric, (_quote->>'is_peak')::boolean);

  DELETE FROM public.cart_items WHERE cart_id = _cart;
  INSERT INTO public.order_status_history (order_id, status, note, created_by, actor_role)
  VALUES (_order, 'pending_payment', 'Order created, awaiting payment', _uid, 'customer');

  RETURN jsonb_build_object('order_id', _order, 'order_number', _num, 'total', _total,
    'delivery_fee', _fee, 'subtotal', _subtotal);
END $$;

-- ---------- payment ----------
CREATE OR REPLACE FUNCTION public.confirm_order_payment(_order_id uuid, _provider text, _reference text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _o public.orders; _f record;
BEGIN
  SELECT * INTO _o FROM public.orders WHERE id = _order_id;
  IF _o.id IS NULL THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF NOT (_o.customer_id = auth.uid() OR public.is_staff(auth.uid())) THEN
    RAISE EXCEPTION 'Not permitted'; END IF;
  IF _o.payment_status = 'paid' THEN RETURN; END IF;

  UPDATE public.payments SET status = 'paid', provider = _provider, provider_reference = _reference
    WHERE order_id = _order_id;
  UPDATE public.orders SET payment_status = 'paid' WHERE id = _order_id;
  UPDATE public.order_fulfillments SET status = 'seller_reviewing' WHERE order_id = _order_id;
  UPDATE public.deliveries SET status = 'pending' WHERE order_id = _order_id;
  PERFORM public.log_order_status(_order_id, 'seller_reviewing', 'Payment confirmed');

  INSERT INTO public.notifications (user_id, title, body, link)
  VALUES (_o.customer_id, 'Payment successful',
    'Order ' || _o.order_number || ' has been sent to the store.', '/orders/' || _order_id);

  FOR _f IN SELECT seller_id FROM public.order_fulfillments WHERE order_id = _order_id LOOP
    INSERT INTO public.notifications (user_id, title, body, link)
    VALUES (_f.seller_id, 'New paid order',
      'Order ' || _o.order_number || ' needs your review.', '/seller/orders');
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.fail_order_payment(_order_id uuid, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _o public.orders; _i record;
BEGIN
  SELECT * INTO _o FROM public.orders WHERE id = _order_id;
  IF _o.id IS NULL OR NOT (_o.customer_id = auth.uid() OR public.is_staff(auth.uid())) THEN
    RAISE EXCEPTION 'Not permitted'; END IF;
  IF _o.payment_status = 'paid' THEN RAISE EXCEPTION 'Order already paid'; END IF;
  FOR _i IN SELECT product_id, quantity FROM public.order_items WHERE order_id = _order_id LOOP
    UPDATE public.products SET stock_quantity = stock_quantity + _i.quantity WHERE id = _i.product_id;
  END LOOP;
  IF _o.points_redeemed > 0 THEN
    UPDATE public.wallets SET points_balance = points_balance + _o.points_redeemed
      WHERE user_id = _o.customer_id;
    INSERT INTO public.wallet_transactions (user_id, order_id, kind, points, description)
    VALUES (_o.customer_id, _order_id, 'refund', _o.points_redeemed, 'Payment failed, points returned');
  END IF;
  UPDATE public.payments SET status = 'failed' WHERE order_id = _order_id;
  UPDATE public.orders SET payment_status = 'failed', cancelled_reason = _reason WHERE id = _order_id;
  UPDATE public.order_fulfillments SET status = 'cancelled' WHERE order_id = _order_id;
  PERFORM public.log_order_status(_order_id, 'payment_failed', _reason);
END $$;

-- ---------- seller actions ----------
CREATE OR REPLACE FUNCTION public.seller_respond_to_order(_fulfillment_id uuid, _accept boolean,
  _reason text DEFAULT NULL, _note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _f public.order_fulfillments; _o public.orders; _i record; _pending integer;
BEGIN
  SELECT * INTO _f FROM public.order_fulfillments WHERE id = _fulfillment_id;
  IF _f.id IS NULL OR _f.seller_id <> auth.uid() THEN RAISE EXCEPTION 'Not permitted'; END IF;
  IF _f.status NOT IN ('pending','seller_reviewing') THEN RAISE EXCEPTION 'Already responded'; END IF;
  SELECT * INTO _o FROM public.orders WHERE id = _f.order_id;

  IF _accept THEN
    UPDATE public.order_fulfillments SET status = 'accepted', accepted_at = now() WHERE id = _f.id;
    INSERT INTO public.notifications (user_id, title, body, link)
    VALUES (_o.customer_id, 'Store accepted your order',
      'Order ' || _o.order_number || ' was accepted and will be prepared.', '/orders/' || _o.id);
    SELECT count(*) INTO _pending FROM public.order_fulfillments
      WHERE order_id = _o.id AND status IN ('pending','seller_reviewing');
    IF _pending = 0 THEN PERFORM public.log_order_status(_o.id, 'accepted_by_seller', 'All stores accepted'); END IF;
  ELSE
    IF _reason IS NULL OR length(trim(_reason)) = 0 THEN RAISE EXCEPTION 'A rejection reason is required'; END IF;
    IF _reason = 'other' AND COALESCE(trim(_note),'') = '' THEN
      RAISE EXCEPTION 'Please explain the reason'; END IF;
    UPDATE public.order_fulfillments SET status = 'rejected', rejection_reason = _reason,
      rejection_note = _note WHERE id = _f.id;
    FOR _i IN SELECT product_id, quantity FROM public.order_items WHERE fulfillment_id = _f.id LOOP
      UPDATE public.products SET stock_quantity = stock_quantity + _i.quantity WHERE id = _i.product_id;
    END LOOP;
    INSERT INTO public.notifications (user_id, title, body, link)
    VALUES (_o.customer_id, 'A store could not fulfil your items',
      'Part of order ' || _o.order_number || ' was rejected. A refund is being processed.',
      '/orders/' || _o.id);
    PERFORM public.notify_staff('Refund needed',
      'Store rejected items on order ' || _o.order_number, '/admin/orders');
    SELECT count(*) INTO _pending FROM public.order_fulfillments
      WHERE order_id = _o.id AND status NOT IN ('rejected','cancelled');
    IF _pending = 0 THEN PERFORM public.log_order_status(_o.id, 'seller_rejected', _reason);
      UPDATE public.orders SET payment_status = 'refund_pending' WHERE id = _o.id;
    ELSE PERFORM public.log_order_status(_o.id, 'refund_pending', 'Partial rejection: ' || _reason);
    END IF;
  END IF;
  INSERT INTO public.audit_logs (actor_id, action, entity, entity_id, metadata)
  VALUES (auth.uid(), CASE WHEN _accept THEN 'seller_accept_order' ELSE 'seller_reject_order' END,
    'order_fulfillment', _f.id, jsonb_build_object('reason', _reason, 'note', _note));
END $$;

CREATE OR REPLACE FUNCTION public.seller_set_fulfillment_status(_fulfillment_id uuid, _status public.fulfillment_status)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _f public.order_fulfillments; _o public.orders; _remaining integer; _d public.deliveries;
BEGIN
  SELECT * INTO _f FROM public.order_fulfillments WHERE id = _fulfillment_id;
  IF _f.id IS NULL OR _f.seller_id <> auth.uid() THEN RAISE EXCEPTION 'Not permitted'; END IF;
  IF _status NOT IN ('preparing','ready_for_pickup') THEN RAISE EXCEPTION 'Invalid status change'; END IF;
  IF _status = 'preparing' AND _f.status <> 'accepted' THEN RAISE EXCEPTION 'Accept the order first'; END IF;
  IF _status = 'ready_for_pickup' AND _f.status <> 'preparing' THEN RAISE EXCEPTION 'Mark as preparing first'; END IF;
  SELECT * INTO _o FROM public.orders WHERE id = _f.order_id;

  UPDATE public.order_fulfillments SET status = _status,
    ready_at = CASE WHEN _status = 'ready_for_pickup' THEN now() ELSE ready_at END
    WHERE id = _f.id;

  IF _status = 'preparing' THEN
    PERFORM public.log_order_status(_o.id, 'preparing', 'Store is preparing the order');
    INSERT INTO public.notifications (user_id, title, body, link)
    VALUES (_o.customer_id, 'Your order is being prepared',
      'Order ' || _o.order_number || ' is being prepared.', '/orders/' || _o.id);
  ELSE
    SELECT count(*) INTO _remaining FROM public.order_fulfillments
      WHERE order_id = _o.id AND status NOT IN ('ready_for_pickup','rejected','cancelled');
    IF _remaining = 0 THEN
      SELECT * INTO _d FROM public.deliveries WHERE order_id = _o.id;
      UPDATE public.deliveries SET status = 'awaiting_rider',
        pickup_code = COALESCE(pickup_code, lpad((floor(random()*900000)+100000)::text, 6, '0')),
        delivery_code = COALESCE(delivery_code, lpad((floor(random()*900000)+100000)::text, 6, '0'))
        WHERE order_id = _o.id;
      PERFORM public.log_order_status(_o.id, 'rider_assignment', 'Ready for pickup, finding a rider');
      INSERT INTO public.notifications (user_id, title, body, link)
      SELECT rp.user_id, 'New delivery opportunity',
        'An order is ready for pickup near you.', '/rider'
      FROM public.rider_profiles rp WHERE rp.is_online AND rp.is_available
        AND rp.active_assignments < rp.max_assignments;
      INSERT INTO public.delivery_offers (delivery_id, rider_id)
      SELECT d.id, rp.user_id FROM public.deliveries d, public.rider_profiles rp
      WHERE d.order_id = _o.id AND rp.is_online AND rp.is_available
        AND rp.active_assignments < rp.max_assignments
      ON CONFLICT DO NOTHING;
    ELSE
      PERFORM public.log_order_status(_o.id, 'ready_for_pickup', 'A store marked its items ready');
    END IF;
    INSERT INTO public.notifications (user_id, title, body, link)
    VALUES (_o.customer_id, 'Order ready for pickup',
      'Order ' || _o.order_number || ' is ready and awaiting a rider.', '/orders/' || _o.id);
  END IF;
END $$;

-- ---------- rider actions ----------
CREATE OR REPLACE FUNCTION public.rider_respond_to_offer(_delivery_id uuid, _accept boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _d public.deliveries; _o public.orders;
BEGIN
  IF NOT public.has_role(auth.uid(),'rider') THEN RAISE EXCEPTION 'Riders only'; END IF;
  SELECT * INTO _d FROM public.deliveries WHERE id = _delivery_id FOR UPDATE;
  IF _d.id IS NULL THEN RAISE EXCEPTION 'Delivery not found'; END IF;
  PERFORM 1 FROM public.delivery_offers WHERE delivery_id = _delivery_id AND rider_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'This delivery was not offered to you'; END IF;

  IF NOT _accept THEN
    UPDATE public.delivery_offers SET status = 'declined', responded_at = now()
      WHERE delivery_id = _delivery_id AND rider_id = auth.uid();
    RETURN;
  END IF;

  IF _d.rider_id IS NOT NULL THEN RAISE EXCEPTION 'Another rider already accepted this delivery'; END IF;
  SELECT * INTO _o FROM public.orders WHERE id = _d.order_id;
  UPDATE public.deliveries SET rider_id = auth.uid(), status = 'rider_assigned',
    assigned_at = now(), expected_delivery_at = now() + interval '45 minutes' WHERE id = _delivery_id;
  UPDATE public.delivery_offers SET status = 'accepted', responded_at = now()
    WHERE delivery_id = _delivery_id AND rider_id = auth.uid();
  UPDATE public.delivery_offers SET status = 'expired'
    WHERE delivery_id = _delivery_id AND rider_id <> auth.uid() AND status = 'offered';
  INSERT INTO public.rider_profiles (user_id, active_assignments) VALUES (auth.uid(), 1)
    ON CONFLICT (user_id) DO UPDATE SET active_assignments = public.rider_profiles.active_assignments + 1;
  PERFORM public.log_order_status(_o.id, 'rider_assigned', 'Rider accepted the delivery');
  INSERT INTO public.notifications (user_id, title, body, link)
  VALUES (_o.customer_id, 'Rider assigned',
    'A rider is on the way to collect order ' || _o.order_number || '.', '/orders/' || _o.id);
  INSERT INTO public.notifications (user_id, title, body, link)
  SELECT seller_id, 'Rider assigned', 'A rider is coming to collect order ' || _o.order_number || '.',
    '/seller/orders' FROM public.order_fulfillments WHERE order_id = _o.id;
END $$;

CREATE OR REPLACE FUNCTION public.rider_advance_delivery(_delivery_id uuid, _stage text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _d public.deliveries; _o public.orders; _next public.order_status;
BEGIN
  SELECT * INTO _d FROM public.deliveries WHERE id = _delivery_id;
  IF _d.id IS NULL OR _d.rider_id <> auth.uid() THEN RAISE EXCEPTION 'Not permitted'; END IF;
  SELECT * INTO _o FROM public.orders WHERE id = _d.order_id;
  IF _stage NOT IN ('en_route_to_seller','arrived_at_seller','out_for_delivery','arrived_at_customer') THEN
    RAISE EXCEPTION 'Invalid delivery stage'; END IF;
  IF _stage IN ('out_for_delivery','arrived_at_customer') AND _d.pickup_verified_at IS NULL THEN
    RAISE EXCEPTION 'Verify pickup first'; END IF;
  _next := CASE _stage
    WHEN 'en_route_to_seller' THEN 'rider_en_route_to_seller'::public.order_status
    WHEN 'arrived_at_seller' THEN 'rider_arrived_at_seller'::public.order_status
    WHEN 'out_for_delivery' THEN 'out_for_delivery'::public.order_status
    ELSE 'rider_arrived_at_customer'::public.order_status END;
  UPDATE public.deliveries SET status = _stage WHERE id = _delivery_id;
  PERFORM public.log_order_status(_o.id, _next, 'Rider update');
  INSERT INTO public.notifications (user_id, title, body, link)
  VALUES (_o.customer_id, 'Delivery update',
    'Order ' || _o.order_number || ': ' || replace(_stage,'_',' ') || '.', '/orders/' || _o.id);
END $$;

CREATE OR REPLACE FUNCTION public.rider_update_location(_delivery_id uuid, _lat numeric, _lng numeric)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.deliveries SET rider_latitude = _lat, rider_longitude = _lng,
    location_updated_at = now()
  WHERE id = _delivery_id AND rider_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'Not permitted'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.verify_pickup(_delivery_id uuid, _code text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _d public.deliveries; _o public.orders;
BEGIN
  SELECT * INTO _d FROM public.deliveries WHERE id = _delivery_id;
  IF _d.id IS NULL OR _d.rider_id <> auth.uid() THEN RAISE EXCEPTION 'Not permitted'; END IF;
  IF _d.pickup_code IS NULL OR _d.pickup_code <> trim(_code) THEN
    RAISE EXCEPTION 'INVALID_CODE: That pickup code is not correct'; END IF;
  SELECT * INTO _o FROM public.orders WHERE id = _d.order_id;
  UPDATE public.deliveries SET pickup_verified_at = now(), picked_up_at = now(), status = 'picked_up'
    WHERE id = _delivery_id;
  UPDATE public.order_fulfillments SET status = 'picked_up'
    WHERE order_id = _o.id AND status = 'ready_for_pickup';
  PERFORM public.log_order_status(_o.id, 'picked_up', 'Pickup verified with store code');
  INSERT INTO public.notifications (user_id, title, body, link)
  VALUES (_o.customer_id, 'Order picked up',
    'Order ' || _o.order_number || ' has been collected and is on the way.', '/orders/' || _o.id);
END $$;

CREATE OR REPLACE FUNCTION public.verify_delivery(_delivery_id uuid, _code text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _d public.deliveries; _o public.orders; _f record; _pts integer;
BEGIN
  SELECT * INTO _d FROM public.deliveries WHERE id = _delivery_id;
  IF _d.id IS NULL OR _d.rider_id <> auth.uid() THEN RAISE EXCEPTION 'Not permitted'; END IF;
  IF _d.pickup_verified_at IS NULL THEN RAISE EXCEPTION 'Pickup has not been verified'; END IF;
  IF _d.delivery_code IS NULL OR _d.delivery_code <> trim(_code) THEN
    RAISE EXCEPTION 'INVALID_CODE: That delivery code is not correct'; END IF;
  SELECT * INTO _o FROM public.orders WHERE id = _d.order_id;

  UPDATE public.deliveries SET status = 'delivered', delivered_at = now(),
    delivery_verified_at = now() WHERE id = _delivery_id;
  UPDATE public.order_fulfillments SET status = 'completed' WHERE order_id = _o.id
    AND status NOT IN ('rejected','cancelled');
  UPDATE public.orders SET completed_at = now() WHERE id = _o.id;
  PERFORM public.log_order_status(_o.id, 'delivered', 'Delivery verified with customer code');

  FOR _f IN SELECT * FROM public.order_fulfillments WHERE order_id = _o.id
    AND status NOT IN ('rejected','cancelled') LOOP
    INSERT INTO public.ledger_entries (order_id, fulfillment_id, kind, beneficiary_id, amount, rule, payout_status)
    VALUES (_o.id, _f.id, 'seller_product_earning', _f.seller_id, _f.seller_amount,
      'seller_entered_price', 'available');
    INSERT INTO public.ledger_entries (order_id, fulfillment_id, kind, amount, percentage, rule)
    VALUES (_o.id, _f.id, 'platform_product_commission', _f.platform_amount, 10, 'product_markup_10');
  END LOOP;

  INSERT INTO public.ledger_entries (order_id, delivery_id, kind, beneficiary_id, amount, percentage, rule, payout_status)
  VALUES (_o.id, _d.id, 'rider_delivery_earning', _d.rider_id, _d.rider_amount,
    CASE WHEN _d.is_peak THEN 90 ELSE 85 END, _o.delivery_rule, 'available');
  INSERT INTO public.ledger_entries (order_id, delivery_id, kind, amount, percentage, rule)
  VALUES (_o.id, _d.id, 'platform_delivery_share', _d.platform_amount,
    CASE WHEN _d.is_peak THEN 10 ELSE 15 END, _o.delivery_rule);

  UPDATE public.rider_profiles SET active_assignments = GREATEST(active_assignments - 1, 0)
    WHERE user_id = _d.rider_id;

  _pts := FLOOR(_o.total / 100)::integer;
  IF _pts > 0 THEN
    INSERT INTO public.wallets (user_id, points_balance) VALUES (_o.customer_id, _pts)
      ON CONFLICT (user_id) DO UPDATE SET points_balance = public.wallets.points_balance + _pts;
    INSERT INTO public.wallet_transactions (user_id, order_id, kind, points, description)
    VALUES (_o.customer_id, _o.id, 'earn', _pts, 'Earned on order ' || _o.order_number);
  END IF;

  PERFORM public.log_order_status(_o.id, 'completed', 'Order completed');
  INSERT INTO public.notifications (user_id, title, body, link)
  VALUES (_o.customer_id, 'Order delivered',
    'Order ' || _o.order_number || ' was delivered. Enjoy!', '/orders/' || _o.id);
  INSERT INTO public.notifications (user_id, title, body, link)
  VALUES (_d.rider_id, 'Delivery completed',
    'Your earnings for this delivery have been recorded.', '/rider/earnings');
  INSERT INTO public.notifications (user_id, title, body, link)
  SELECT seller_id, 'Order completed', 'Order ' || _o.order_number || ' was delivered.',
    '/seller/earnings' FROM public.order_fulfillments WHERE order_id = _o.id;
END $$;

CREATE OR REPLACE FUNCTION public.raise_sos(_delivery_id uuid, _kind text, _note text,
  _lat numeric DEFAULT NULL, _lng numeric DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id uuid;
BEGIN
  IF NOT public.has_role(auth.uid(),'rider') THEN RAISE EXCEPTION 'Riders only'; END IF;
  INSERT INTO public.sos_incidents (rider_id, delivery_id, kind, note, latitude, longitude)
  VALUES (auth.uid(), _delivery_id, _kind, _note, _lat, _lng) RETURNING id INTO _id;
  PERFORM public.notify_staff('SOS raised by a rider',
    'Kind: ' || _kind || COALESCE(' — ' || _note, ''), '/admin/safety');
  RETURN _id;
END $$;

CREATE OR REPLACE FUNCTION public.flag_late_deliveries()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _d record; _count integer := 0;
BEGIN
  FOR _d IN SELECT dl.*, o.order_number FROM public.deliveries dl
    JOIN public.orders o ON o.id = dl.order_id
    WHERE dl.rider_id IS NOT NULL AND dl.delivered_at IS NULL
      AND dl.expected_delivery_at IS NOT NULL
      AND now() > dl.expected_delivery_at + interval '20 minutes'
      AND dl.late_alert_sent_at IS NULL
  LOOP
    UPDATE public.deliveries SET late_alert_sent_at = now() WHERE id = _d.id;
    INSERT INTO public.notifications (user_id, title, body, link)
    VALUES (_d.rider_id, 'Delivery running late',
      'Order ' || _d.order_number || ' is over 20 minutes behind. Update your status or contact support.',
      '/rider');
    PERFORM public.notify_staff('Rider late alert',
      'Order ' || _d.order_number || ' is more than 20 minutes late.', '/admin/orders');
    _count := _count + 1;
  END LOOP;
  RETURN _count;
END $$;

REVOKE EXECUTE ON FUNCTION public.log_order_status(uuid, public.order_status, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_staff(text, text, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.flag_late_deliveries() FROM anon;
GRANT EXECUTE ON FUNCTION public.quote_delivery_fee(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.place_order(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_order_payment(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fail_order_payment(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.seller_respond_to_order(uuid, boolean, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.seller_set_fulfillment_status(uuid, public.fulfillment_status) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rider_respond_to_offer(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rider_advance_delivery(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rider_update_location(uuid, numeric, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_pickup(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_delivery(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.raise_sos(uuid, text, text, numeric, numeric) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.current_actor_role() FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_peak_now() FROM anon;
REVOKE EXECUTE ON FUNCTION public.quote_delivery_fee(text) FROM anon;