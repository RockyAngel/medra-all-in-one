CREATE TABLE IF NOT EXISTS public.qa_log (id bigserial primary key, step text, detail jsonb, at timestamptz default now());
DELETE FROM public.qa_log;

DO $qa$
DECLARE
  _cust uuid; _sell uuid; _ride uuid;
  _store uuid; _prod uuid; _addr uuid; _cart uuid;
  _res jsonb; _order uuid; _ful uuid; _del uuid;
  _pcode text; _dcode text; _err text;
BEGIN
  SELECT id INTO _cust FROM auth.users WHERE email='demo.customer@medra.test';
  SELECT id INTO _sell FROM auth.users WHERE email='demo.vendor@medra.test';
  SELECT id INTO _ride FROM auth.users WHERE email='demo.rider@medra.test';

  DELETE FROM public.stores WHERE slug='qa-test-store';

  INSERT INTO public.stores (owner_id, name, slug, city, state, status, verification_status, verified_at,
      latitude, longitude, location_source, address, is_accepting_orders, is_open)
  VALUES (_sell, 'QA Test Store', 'qa-test-store', 'Lagos', 'Lagos', 'approved', 'approved', now(),
      6.5244, 3.3792, 'qa', '1 QA Road, Lagos', true, true)
  RETURNING id INTO _store;

  INSERT INTO public.products (store_id, seller_id, name, seller_price, stock_quantity, status)
  VALUES (_store, _sell, 'QA Test Product', 5000, 10, 'active') RETURNING id INTO _prod;

  INSERT INTO public.addresses (user_id, label, line1, city, state, latitude, longitude, location_source, is_default)
  VALUES (_cust, 'QA Home', '25 QA Close', 'Lagos', 'Lagos', 6.5450, 3.3950, 'qa', true)
  RETURNING id INTO _addr;

  SELECT id INTO _cart FROM public.carts WHERE user_id=_cust;
  IF _cart IS NULL THEN INSERT INTO public.carts (user_id) VALUES (_cust) RETURNING id INTO _cart; END IF;
  DELETE FROM public.cart_items WHERE cart_id=_cart;
  INSERT INTO public.cart_items (cart_id, product_id, quantity, store_id, seller_id)
  VALUES (_cart, _prod, 2, _store, _sell);

  INSERT INTO public.rider_profiles (user_id, is_online, is_available, latitude, longitude, max_assignments)
  VALUES (_ride, true, true, 6.5280, 3.3820, 3)
  ON CONFLICT (user_id) DO UPDATE SET is_online=true, is_available=true,
    latitude=6.5280, longitude=3.3820, active_assignments=0;

  INSERT INTO public.qa_log(step, detail) VALUES ('product_pricing',
    (SELECT to_jsonb(x) FROM (SELECT seller_price, price, platform_markup_percent FROM public.products WHERE id=_prod) x));

  PERFORM set_config('request.jwt.claims', json_build_object('sub', _cust, 'role','authenticated')::text, true);
  _res := public.place_order(_addr, 0, false, 'QA reconciliation test');
  INSERT INTO public.qa_log(step, detail) VALUES ('place_order', _res);
  _order := (_res->>'order_id')::uuid;
  PERFORM public.confirm_order_payment(_order, 'test', 'QA-TEST-PAYMENT');
  INSERT INTO public.qa_log(step, detail) VALUES ('payment',
    (SELECT to_jsonb(x) FROM (SELECT o.payment_status, o.status, p.status pay_status, p.amount, p.provider
       FROM public.orders o JOIN public.payments p ON p.order_id=o.id WHERE o.id=_order) x));

  SELECT id INTO _ful FROM public.order_fulfillments WHERE order_id=_order;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', _sell, 'role','authenticated')::text, true);
  BEGIN
    PERFORM public.seller_respond_to_order(_ful, true, NULL, 'QA accept');
    PERFORM public.seller_set_fulfillment_status(_ful, 'preparing');
    PERFORM public.seller_set_fulfillment_status(_ful, 'ready_for_pickup');
    INSERT INTO public.qa_log(step, detail) VALUES ('seller_flow',
      (SELECT to_jsonb(x) FROM (SELECT status FROM public.order_fulfillments WHERE id=_ful) x));
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public.qa_log(step, detail) VALUES ('seller_flow', jsonb_build_object('error', SQLERRM));
  END;

  SELECT id INTO _del FROM public.deliveries WHERE order_id=_order LIMIT 1;
  INSERT INTO public.qa_log(step, detail) VALUES ('delivery_after_ready',
    (SELECT to_jsonb(x) FROM (SELECT status, rider_id, fee_total, rider_amount, platform_amount FROM public.deliveries WHERE id=_del) x));
  BEGIN
    INSERT INTO public.qa_log(step, detail) VALUES ('dispatch', public.dispatch_delivery(_del));
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public.qa_log(step, detail) VALUES ('dispatch', jsonb_build_object('error', SQLERRM));
  END;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', _ride, 'role','authenticated')::text, true);
  BEGIN
    PERFORM public.rider_respond_to_offer(_del, true, NULL);
    INSERT INTO public.qa_log(step, detail) VALUES ('rider_accept', '{"ok":true}');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public.qa_log(step, detail) VALUES ('rider_accept', jsonb_build_object('error', SQLERRM));
  END;

  BEGIN
    PERFORM public.rider_advance_delivery(_del, 'en_route_to_seller');
    PERFORM public.rider_advance_delivery(_del, 'arrived_at_seller');
    SELECT pickup_code, delivery_code INTO _pcode, _dcode FROM public.deliveries WHERE id=_del;
    PERFORM public.verify_pickup(_del, _pcode);
    PERFORM public.rider_advance_delivery(_del, 'out_for_delivery');
    PERFORM public.rider_advance_delivery(_del, 'arrived_at_customer');
    PERFORM public.verify_delivery(_del, _dcode);
    INSERT INTO public.qa_log(step, detail) VALUES ('rider_journey', '{"ok":true}');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public.qa_log(step, detail) VALUES ('rider_journey', jsonb_build_object('error', SQLERRM));
  END;

  INSERT INTO public.qa_log(step, detail) VALUES ('delivery_final',
    (SELECT to_jsonb(x) FROM (SELECT status, pickup_verified_at is not null pv, delivery_verified_at is not null dv,
       fee_total, rider_amount, platform_amount, rider_percent FROM public.deliveries WHERE id=_del) x));

  PERFORM set_config('request.jwt.claims', NULL, true);
  INSERT INTO public.qa_log(step, detail) VALUES ('order_totals',
    (SELECT to_jsonb(x) FROM (SELECT subtotal, delivery_fee, total, platform_product_amount, status,
      delivery_rider_amount, delivery_platform_amount FROM public.orders WHERE id=_order) x));
  INSERT INTO public.qa_log(step, detail) VALUES ('ledger',
    (SELECT jsonb_agg(jsonb_build_object('kind', kind, 'amount', amount, 'payout_status', payout_status))
       FROM public.ledger_entries WHERE order_id=_order));
  INSERT INTO public.qa_log(step, detail) VALUES ('wallet_points',
    (SELECT to_jsonb(x) FROM (SELECT points_balance FROM public.wallets WHERE user_id=_cust) x));
  INSERT INTO public.qa_log(step, detail) VALUES ('ids',
    jsonb_build_object('order', _order, 'delivery', _del, 'store', _store, 'product', _prod, 'address', _addr, 'ful', _ful));
END $qa$;