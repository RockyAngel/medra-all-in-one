DELETE FROM public.qa_log;

DO $iso$
DECLARE
  _uid uuid; _label text; _res jsonb; _out jsonb := '{}'::jsonb;
  _o int; _p int; _d int; _l int; _rx int; _pr int; _w int;
BEGIN
  FOR _label, _uid IN
    SELECT v.l, u.id FROM (VALUES ('customer','demo.customer@medra.test'),
                                  ('vendor','demo.vendor@medra.test'),
                                  ('rider','demo.rider@medra.test'),
                                  ('admin','demo.admin@medra.test')) v(l,e)
    JOIN auth.users u ON u.email = v.e
  LOOP
    PERFORM set_config('request.jwt.claims', json_build_object('sub', _uid, 'role','authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    SELECT count(*) INTO _o FROM public.orders;
    SELECT count(*) INTO _p FROM public.payout_requests;
    SELECT count(*) INTO _d FROM public.deliveries;
    SELECT count(*) INTO _l FROM public.ledger_entries;
    SELECT count(*) INTO _rx FROM public.prescriptions;
    SELECT count(*) INTO _pr FROM public.profiles;
    SELECT count(*) INTO _w FROM public.wallets;
    RESET ROLE;
    _out := _out || jsonb_build_object(_label, jsonb_build_object(
      'orders',_o,'payouts',_p,'deliveries',_d,'ledger',_l,
      'prescriptions',_rx,'profiles',_pr,'wallets',_w));
  END LOOP;
  PERFORM set_config('request.jwt.claims', NULL, true);
  INSERT INTO public.qa_log(step, detail) VALUES ('isolation', _out);
  INSERT INTO public.qa_log(step, detail) VALUES ('totals', (SELECT to_jsonb(x) FROM (SELECT
    (SELECT count(*) FROM public.orders) orders,
    (SELECT count(*) FROM public.payout_requests) payouts,
    (SELECT count(*) FROM public.deliveries) deliveries,
    (SELECT count(*) FROM public.ledger_entries) ledger,
    (SELECT count(*) FROM public.prescriptions) prescriptions,
    (SELECT count(*) FROM public.profiles) profiles,
    (SELECT count(*) FROM public.wallets) wallets) x));
END $iso$;