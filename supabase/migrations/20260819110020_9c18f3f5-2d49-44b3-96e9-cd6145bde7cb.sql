ALTER TABLE public.deliveries
  ADD COLUMN IF NOT EXISTS payout_approval text NOT NULL DEFAULT 'not_required',
  ADD COLUMN IF NOT EXISTS payout_review_note text,
  ADD COLUMN IF NOT EXISTS payout_reviewed_by uuid,
  ADD COLUMN IF NOT EXISTS payout_reviewed_at timestamptz;

CREATE INDEX IF NOT EXISTS deliveries_payout_approval_idx ON public.deliveries (payout_approval);

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
     SET status = 'delivered', delivered_at = now(), delivery_verified_at = now(),
         payout_approval = 'pending'
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
     CASE WHEN _d.is_peak THEN 'peak_split' ELSE 'regular_split' END, 'pending'),
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
    'Your earnings are awaiting admin approval before payout.', '/rider/earnings');
END $function$;

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
     SET payout_status = CASE WHEN _approve THEN 'available' ELSE 'withheld' END
   WHERE delivery_id = _delivery_id
     AND kind = 'rider_delivery_earning'
     AND payout_status = 'pending';

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

-- Seed catalog for the approved demo store
INSERT INTO public.products
  (store_id, seller_id, category_id, name, description, seller_price, price, stock_quantity,
   status, brand, delivery_fee, low_stock_threshold, tags)
SELECT s.id, s.owner_id, c.id, v.name, v.description, v.seller_price,
       round(v.seller_price * 1.1, 2), v.stock, 'active', v.brand, v.delivery_fee, 5, v.tags
FROM public.stores s
JOIN (VALUES
  ('groceries','Golden Penny Semovita 2kg','Fine semolina flour for smooth swallow meals. Sealed 2kg pack.',2400,60,'Golden Penny',150,ARRAY['flour','staples']),
  ('groceries','Mamador Vegetable Oil 3.8L','Cholesterol-free vegetable cooking oil in a 3.8 litre keg.',9800,35,'Mamador',300,ARRAY['oil','cooking']),
  ('groceries','Dangote Granulated Sugar 1kg','Refined granulated sugar, vitamin A fortified, 1kg sachet.',1450,80,'Dangote',100,ARRAY['sugar','staples']),
  ('electronics','Oraimo 20000mAh Power Bank','Dual USB fast-charge power bank with digital battery display.',18500,18,'Oraimo',500,ARRAY['charger','accessories']),
  ('electronics','Anker Soundcore Bluetooth Speaker','Portable speaker with 12-hour playtime and IPX7 water resistance.',32000,10,'Anker',600,ARRAY['audio','bluetooth']),
  ('fashion','Unisex Canvas Sneakers','Lightweight lace-up canvas sneakers with cushioned insole.',12500,24,'Medra Basics',450,ARRAY['shoes','sneakers']),
  ('beauty','Shea Moisture Body Butter 250ml','Raw shea body butter for very dry skin, unscented.',7600,22,'Shea Moisture',250,ARRAY['skincare','bodycare']),
  ('home-living','Stainless Steel Cookware Set (5 pieces)','Five-piece induction-ready stainless steel pot set with glass lids.',46000,7,'Chef Pro',900,ARRAY['kitchen','cookware'])
) AS v(cat, name, description, seller_price, stock, brand, delivery_fee, tags)
  ON TRUE
JOIN public.categories c ON c.slug = v.cat
WHERE s.status = 'approved'
  AND s.store_type = 'general'
  AND NOT EXISTS (SELECT 1 FROM public.products p WHERE p.store_id = s.id AND p.name = v.name);

-- Seed membership plans
INSERT INTO public.membership_plans
  (name, audience, description, price, billing_period, trial_days, benefits, entitlements, display_order, is_active)
SELECT * FROM (VALUES
  ('Medra Lite','customer'::public.membership_audience,'Free delivery on qualifying orders and early access to flash deals.',5000::numeric,'monthly',2,
    ARRAY['2 free deliveries monthly','Early access to flash deals','Priority support queue'],
    '{"free_deliveries":2,"priority_support":true}'::jsonb,1,true),
  ('Medra Plus','customer'::public.membership_audience,'Unlimited free delivery within your zone plus double reward games.',15000::numeric,'monthly',2,
    ARRAY['Unlimited zone deliveries','Double game rewards','Emergency pharmacy priority'],
    '{"free_deliveries":-1,"emergency_priority":true,"reward_multiplier":2}'::jsonb,2,true),
  ('Seller Growth','seller'::public.membership_audience,'Lower commission and featured placement for growing stores.',25000::numeric,'monthly',2,
    ARRAY['2% commission discount','2 featured placements monthly','Advanced sales analytics'],
    '{"commission_discount_percent":2,"featured_placements":2,"analytics":true}'::jsonb,3,true),
  ('Seller Pro','seller'::public.membership_audience,'Best commission rate, homepage placement and faster payouts.',80000::numeric,'monthly',2,
    ARRAY['4% commission discount','Homepage placement','Next-day payouts','Dedicated account manager'],
    '{"commission_discount_percent":4,"featured_placements":6,"fast_payout":true}'::jsonb,4,true),
  ('Rider Boost','rider'::public.membership_audience,'Priority in the offer queue and weekly payouts.',5000::numeric,'monthly',2,
    ARRAY['Priority offer matching','Weekly payouts','Fuel partner discounts'],
    '{"offer_priority":1,"weekly_payout":true}'::jsonb,5,true),
  ('Rider Elite','rider'::public.membership_audience,'Top of the offer queue, peak bonuses and instant payouts.',20000::numeric,'monthly',2,
    ARRAY['Top offer priority','Peak-hour bonus','Instant payouts','Accident cover partner'],
    '{"offer_priority":2,"peak_bonus":true,"instant_payout":true}'::jsonb,6,true)
) AS v(name, audience, description, price, billing_period, trial_days, benefits, entitlements, display_order, is_active)
WHERE NOT EXISTS (SELECT 1 FROM public.membership_plans m WHERE m.name = v.name);