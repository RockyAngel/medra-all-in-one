CREATE OR REPLACE FUNCTION public.admin_review_delivery_payout(
  _delivery_id uuid, _approve boolean, _note text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE _d public.deliveries;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin')) THEN
    RAISE EXCEPTION 'Not permitted';
  END IF;

  SELECT * INTO _d FROM public.deliveries WHERE id = _delivery_id FOR UPDATE;
  IF _d.id IS NULL THEN RAISE EXCEPTION 'Delivery not found'; END IF;
  IF _d.payout_approval <> 'pending' THEN RAISE EXCEPTION 'This delivery is not awaiting review'; END IF;

  UPDATE public.deliveries
     SET payout_approval = CASE WHEN _approve THEN 'approved' ELSE 'rejected' END,
         payout_review_note = NULLIF(trim(COALESCE(_note, '')), ''),
         payout_reviewed_by = auth.uid(),
         payout_reviewed_at = now()
   WHERE id = _delivery_id;

  UPDATE public.ledger_entries
     SET payout_status = (CASE WHEN _approve THEN 'available' ELSE 'withheld' END)::public.payout_status
   WHERE delivery_id = _delivery_id
     AND kind = 'rider_delivery_earning'
     AND payout_status = 'pending'::public.payout_status;

  PERFORM public.log_audit(
    CASE WHEN _approve THEN 'delivery_payout_approved' ELSE 'delivery_payout_rejected' END,
    'delivery', _delivery_id,
    jsonb_build_object('note', _note, 'rider_amount', _d.rider_amount));

  IF _d.rider_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, body, link)
    VALUES (_d.rider_id,
      CASE WHEN _approve THEN 'Delivery earnings approved' ELSE 'Delivery earnings withheld' END,
      CASE WHEN _approve THEN 'Your earnings for this delivery are now available for payout.'
           ELSE COALESCE(NULLIF(trim(COALESCE(_note, '')), ''), 'An admin withheld earnings for this delivery.') END,
      '/rider/earnings');
  END IF;
END $function$;

REVOKE ALL ON FUNCTION public.admin_review_delivery_payout(uuid, boolean, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_review_delivery_payout(uuid, boolean, text) TO authenticated;