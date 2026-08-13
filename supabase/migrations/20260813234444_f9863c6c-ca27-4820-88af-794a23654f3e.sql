DO $$
DECLARE
  fn record;
  keep_anon text[] := ARRAY['feature_enabled','geo_distance_km','coupon_discount_amount','subscription_is_live'];
  trigger_only text[] := ARRAY['notify_delivery_assignment','notify_fulfillment_change','notify_order_status_change',
    'queue_delivery_on_ready','record_delivery_status_change','apply_product_pricing','set_updated_at',
    'guard_professional_self_verify'];
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'geo_distance_km'
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = public', fn.sig);
  END LOOP;

  FOR fn IN
    SELECT p.oid::regprocedure AS sig, p.proname
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
  LOOP
    IF fn.proname = ANY (trigger_only) THEN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn.sig);
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn.sig);
    ELSIF NOT (fn.proname = ANY (keep_anon)) THEN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', fn.sig);
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', fn.sig);
    END IF;
  END LOOP;
END $$;