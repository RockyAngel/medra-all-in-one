DELETE FROM public.qa_log;

DO $iso$
DECLARE
  _buyer uuid; _owner uuid; _store uuid; _prod uuid; _addr uuid; _cart uuid; _res jsonb;
  _uid uuid; _label text; _out jsonb := '{}'::jsonb;
  _o int; _d int; _l int;
BEGIN
  SELECT id INTO _buyer FROM auth.users WHERE email='demo.admin@medra.test';
  SELECT id INTO _owner FROM auth.users WHERE email='demo.superadmin@medra.test';

  DELETE FROM public.stores WHERE slug='qa-second-store';
  INSERT INTO public.stores (owner_id, name, slug, city, state, status, verification_status, verified_at,
      latitude, longitude, location_source, address, is_accepting_orders, is_open)
  VALUES (_owner, 'QA Second Store', 'qa-second-store', 'Lagos', 'Lagos', 'approved', 'approved', now(),
      6.5300, 3.3700, 'qa', '9 QA Lane, Lagos', true, true) RETURNING id INTO _store;
  INSERT INTO public.products (store_id, seller_id, name, seller_price, stock_quantity, status)
  VALUES (_store, _owner, 'QA Second Product', 2000, 5, 'active') RETURNING id INTO _prod;

  INSERT INTO public.addresses (user_id, label, line1, city, state, latitude, longitude, location_source, is_default)
  VALUES (_buyer, 'QA Office', '4 QA Street', 'Lagos', 'Lagos', 6.5400, 3.3800, 'qa', true)
  RETURNING id INTO _addr;

  SELECT id INTO _cart FROM public.carts WHERE user_id=_buyer;
  IF _cart IS NULL THEN INSERT INTO public.carts (user_id) VALUES (_buyer) RETURNING id INTO _cart; END IF;
  DELETE FROM public.cart_items WHERE cart_id=_cart;
  INSERT INTO public.cart_items (cart_id, product_id, quantity, store_id, seller_id)
  VALUES (_cart, _prod, 1, _store, _owner);

  PERFORM set_config('request.jwt.claims', json_build_object('sub', _buyer, 'role','authenticated')::text, true);
  _res := public.place_order(_addr, 0, false, 'QA isolation order');
  PERFORM public.confirm_order_payment((_res->>'order_id')::uuid, 'test', 'QA-ISO-PAY');
  PERFORM set_config('request.jwt.claims', NULL, true);

  FOR _label, _uid IN
    SELECT v.l, u.id FROM (VALUES ('customer','demo.customer@medra.test'),
                                  ('vendor','demo.vendor@medra.test'),
                                  ('rider','demo.rider@medra.test'),
                                  ('admin','demo.admin@medra.test'),
                                  ('superadmin','demo.superadmin@medra.test')) v(l,e)
    JOIN auth.users u ON u.email = v.e
  LOOP
    PERFORM set_config('request.jwt.claims', json_build_object('sub', _uid, 'role','authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    SELECT count(*) INTO _o FROM public.orders;
    SELECT count(*) INTO _d FROM public.deliveries;
    SELECT count(*) INTO _l FROM public.ledger_entries;
    RESET ROLE;
    _out := _out || jsonb_build_object(_label, jsonb_build_object('orders',_o,'deliveries',_d,'ledger',_l));
  END LOOP;
  PERFORM set_config('request.jwt.claims', NULL, true);
  INSERT INTO public.qa_log(step, detail) VALUES ('isolation2', _out);
  INSERT INTO public.qa_log(step, detail) VALUES ('totals', (SELECT to_jsonb(x) FROM (SELECT
    (SELECT count(*) FROM public.orders) orders,
    (SELECT count(*) FROM public.deliveries) deliveries,
    (SELECT count(*) FROM public.ledger_entries) ledger) x));
END $iso$;