DO $$
DECLARE _f record;
BEGIN
  FOR _f IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', _f.sig);
  END LOOP;
END $$;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_staff(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_pickup_code(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_delivery_code(uuid) TO authenticated;
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
GRANT EXECUTE ON FUNCTION public.current_actor_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.flag_late_deliveries() TO service_role;