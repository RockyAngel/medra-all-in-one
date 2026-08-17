DO $cleanup$
DECLARE _oid uuid;
BEGIN
  FOR _oid IN
    SELECT DISTINCT order_id FROM public.order_fulfillments
     WHERE store_id IN (SELECT id FROM public.stores WHERE slug IN ('qa-test-store','qa-second-store'))
  LOOP
    DELETE FROM public.ledger_entries WHERE order_id=_oid;
    DELETE FROM public.delivery_status_history WHERE delivery_id IN (SELECT id FROM public.deliveries WHERE order_id=_oid);
    DELETE FROM public.delivery_offers WHERE delivery_id IN (SELECT id FROM public.deliveries WHERE order_id=_oid);
    DELETE FROM public.delivery_assignments WHERE delivery_id IN (SELECT id FROM public.deliveries WHERE order_id=_oid);
    DELETE FROM public.late_delivery_events WHERE delivery_id IN (SELECT id FROM public.deliveries WHERE order_id=_oid);
    DELETE FROM public.deliveries WHERE order_id=_oid;
    DELETE FROM public.order_status_history WHERE order_id=_oid;
    DELETE FROM public.order_items WHERE order_id=_oid;
    DELETE FROM public.order_fulfillments WHERE order_id=_oid;
    DELETE FROM public.payments WHERE order_id=_oid;
    DELETE FROM public.inventory_movements WHERE order_id=_oid;
    DELETE FROM public.notifications WHERE link LIKE '%'||_oid::text||'%';
    DELETE FROM public.orders WHERE id=_oid;
  END LOOP;
  DELETE FROM public.stores WHERE slug IN ('qa-test-store','qa-second-store');
  DELETE FROM public.addresses WHERE label IN ('QA Home','QA Office');
  UPDATE public.rider_profiles SET active_assignments = 0
   WHERE user_id IN (SELECT id FROM auth.users WHERE email='demo.rider@medra.test');
END $cleanup$;

DROP TABLE IF EXISTS public.qa_log;