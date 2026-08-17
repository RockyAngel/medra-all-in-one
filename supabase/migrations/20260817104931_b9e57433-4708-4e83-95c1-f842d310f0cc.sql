-- 1) Immutable prescription review audit trail -------------------------------

CREATE OR REPLACE FUNCTION public.prevent_prescription_event_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'Prescription review history is immutable';
END $$;

DROP TRIGGER IF EXISTS prescription_events_no_update ON public.prescription_events;
CREATE TRIGGER prescription_events_no_update
  BEFORE UPDATE OR DELETE ON public.prescription_events
  FOR EACH ROW EXECUTE FUNCTION public.prevent_prescription_event_mutation();

REVOKE UPDATE, DELETE ON public.prescription_events FROM authenticated;
GRANT SELECT ON public.prescription_events TO authenticated;
GRANT ALL ON public.prescription_events TO service_role;

DROP POLICY IF EXISTS "Staff read prescription events" ON public.prescription_events;
CREATE POLICY "Staff read prescription events" ON public.prescription_events
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

DROP POLICY IF EXISTS "Staff read prescriptions" ON public.prescriptions;
CREATE POLICY "Staff read prescriptions" ON public.prescriptions
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

-- log every prescription status change, whatever code path changed it
CREATE OR REPLACE FUNCTION public.log_prescription_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status
     AND NOT EXISTS (
       SELECT 1 FROM public.prescription_events e
       WHERE e.prescription_id = NEW.id AND e.status = NEW.status
         AND e.created_at > now() - interval '5 seconds'
     ) THEN
    INSERT INTO public.prescription_events (prescription_id, status, note, actor_id, actor_role)
    VALUES (NEW.id, NEW.status, NEW.review_note, auth.uid(), 'system');
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS prescriptions_log_status ON public.prescriptions;
CREATE TRIGGER prescriptions_log_status
  AFTER UPDATE OF status ON public.prescriptions
  FOR EACH ROW EXECUTE FUNCTION public.log_prescription_status_change();

-- 2) Consultation lifecycle timeline -----------------------------------------

CREATE TABLE IF NOT EXISTS public.consultation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consultation_id uuid NOT NULL REFERENCES public.consultations(id) ON DELETE CASCADE,
  status text NOT NULL,
  note text,
  actor_id uuid,
  actor_role text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS consultation_events_consultation_idx
  ON public.consultation_events (consultation_id, created_at);

GRANT SELECT ON public.consultation_events TO authenticated;
GRANT ALL ON public.consultation_events TO service_role;
ALTER TABLE public.consultation_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Participants read consultation events" ON public.consultation_events;
CREATE POLICY "Participants read consultation events" ON public.consultation_events
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.consultations c
    WHERE c.id = consultation_events.consultation_id
      AND (c.customer_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.health_professionals hp
                   WHERE hp.id = c.professional_id AND hp.user_id = auth.uid()))
  ));

CREATE OR REPLACE FUNCTION public.prevent_consultation_event_mutation()
RETURNS trigger LANGUAGE plpgsql SET search_path = public
AS $$ BEGIN RAISE EXCEPTION 'Consultation history is immutable'; END $$;

DROP TRIGGER IF EXISTS consultation_events_no_update ON public.consultation_events;
CREATE TRIGGER consultation_events_no_update
  BEFORE UPDATE OR DELETE ON public.consultation_events
  FOR EACH ROW EXECUTE FUNCTION public.prevent_consultation_event_mutation();

CREATE OR REPLACE FUNCTION public.log_consultation_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.consultation_events (consultation_id, status, note, actor_id, actor_role)
    VALUES (NEW.id, NEW.status, 'Appointment booked', NEW.customer_id, 'customer');
    RETURN NEW;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.consultation_events (consultation_id, status, note, actor_id, actor_role)
    VALUES (NEW.id, NEW.status, NEW.cancel_reason, auth.uid(), 'system');
  END IF;
  IF NEW.payment_status IS DISTINCT FROM OLD.payment_status THEN
    INSERT INTO public.consultation_events (consultation_id, status, note, actor_id, actor_role)
    VALUES (NEW.id, 'payment_' || NEW.payment_status, NULL, auth.uid(), 'system');
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS consultations_log_change ON public.consultations;
CREATE TRIGGER consultations_log_change
  AFTER INSERT OR UPDATE ON public.consultations
  FOR EACH ROW EXECUTE FUNCTION public.log_consultation_change();

-- 3) Prioritised pharmacy dispatch queue -------------------------------------

CREATE OR REPLACE FUNCTION public.pharmacy_dispatch_queue(_product_id uuid, _quantity integer DEFAULT 1)
RETURNS TABLE (
  rank integer,
  store_id uuid,
  store_name text,
  store_slug text,
  city text,
  is_open boolean,
  accepts_emergency_orders boolean,
  rating_average numeric,
  product_id uuid,
  product_name text,
  price numeric,
  stock_quantity integer,
  prescription_required boolean,
  score numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH target AS (
    SELECT p.id, lower(coalesce(p.generic_name, p.name)) AS key, p.strength
    FROM public.products p WHERE p.id = _product_id
  ), candidates AS (
    SELECT s.id AS store_id, s.name AS store_name, s.slug AS store_slug, s.city,
           s.is_open, s.accepts_emergency_orders, s.rating_average,
           p.id AS product_id, p.name AS product_name, p.price, p.stock_quantity,
           p.prescription_required,
           (CASE WHEN s.is_open THEN 40 ELSE 0 END)
             + (CASE WHEN s.accepts_emergency_orders THEN 30 ELSE 0 END)
             + least(p.stock_quantity, 20)
             + coalesce(s.rating_average, 0) * 4
             + (CASE WHEN p.id = _product_id THEN 6 ELSE 0 END)
             AS score
    FROM public.products p
    JOIN public.stores s ON s.id = p.store_id
    JOIN target t ON lower(coalesce(p.generic_name, p.name)) = t.key
    WHERE p.status = 'active'
      AND p.stock_quantity >= greatest(_quantity, 1)
      AND s.store_type = 'pharmacy'
      AND s.status = 'approved'
      AND s.verification_status = 'approved'
  )
  SELECT (row_number() OVER (ORDER BY score DESC, price ASC))::integer AS rank,
         store_id, store_name, store_slug, city, is_open, accepts_emergency_orders,
         rating_average, product_id, product_name, price, stock_quantity,
         prescription_required, round(score, 2) AS score
  FROM candidates
  ORDER BY score DESC, price ASC
  LIMIT 10;
$$;

REVOKE ALL ON FUNCTION public.pharmacy_dispatch_queue(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pharmacy_dispatch_queue(uuid, integer) TO authenticated, service_role;

-- 4) Carry pharmacy licence details onto the store when an admin approves ----

CREATE OR REPLACE FUNCTION public.admin_review_application(_kind text, _application_id uuid, _decision text, _note text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE a record; v_store_id uuid; v_slug text;
BEGIN
  IF _decision NOT IN ('under_review','approved','rejected') THEN RAISE EXCEPTION 'Invalid decision'; END IF;
  IF _decision = 'rejected' AND coalesce(btrim(_note),'') = '' THEN RAISE EXCEPTION 'A reason is required'; END IF;

  IF _kind = 'seller' THEN
    IF NOT public.has_permission(auth.uid(),'sellers.approve') THEN RAISE EXCEPTION 'Not permitted'; END IF;
    SELECT * INTO a FROM public.seller_applications WHERE id = _application_id;
    IF a IS NULL THEN RAISE EXCEPTION 'Application not found'; END IF;
    IF _decision = 'approved' AND a.store_id IS NULL THEN
      v_slug := regexp_replace(lower(a.store_name), '[^a-z0-9]+', '-', 'g') || '-' || substr(_application_id::text,1,6);
      INSERT INTO public.stores (owner_id, name, slug, description, category_id, city, address, contact_phone, status,
        store_type, logo_url, operating_hours,
        pharmacy_license_number, pharmacy_license_expiry,
        responsible_pharmacist_name, responsible_pharmacist_license,
        verification_status, verified_at)
      VALUES (a.user_id, a.store_name, v_slug, a.description, a.category_id, a.city, a.address, a.contact_phone, 'approved',
        coalesce(a.store_type,'general'), a.logo_path, a.operating_hours,
        a.pharmacy_license_number, a.pharmacy_license_expiry,
        a.responsible_pharmacist_name, a.responsible_pharmacist_license,
        'approved', now())
      RETURNING id INTO v_store_id;
      INSERT INTO public.user_roles (user_id, role) VALUES (a.user_id,'seller') ON CONFLICT DO NOTHING;
    END IF;
    UPDATE public.seller_applications
      SET status = _decision::application_status, review_note = _note, reviewed_by = auth.uid(),
          reviewed_at = now(), store_id = coalesce(v_store_id, store_id)
      WHERE id = _application_id;
    INSERT INTO public.notifications (user_id, title, body, link)
    VALUES (a.user_id, 'Seller application ' || _decision, coalesce(_note,'Your application status changed.'), '/apply/seller');
  ELSIF _kind = 'rider' THEN
    IF NOT public.has_permission(auth.uid(),'riders.approve') THEN RAISE EXCEPTION 'Not permitted'; END IF;
    SELECT * INTO a FROM public.rider_applications WHERE id = _application_id;
    IF a IS NULL THEN RAISE EXCEPTION 'Application not found'; END IF;
    IF _decision = 'approved' THEN
      INSERT INTO public.user_roles (user_id, role) VALUES (a.user_id,'rider') ON CONFLICT DO NOTHING;
      INSERT INTO public.rider_profiles (user_id, vehicle_type, service_city)
      VALUES (a.user_id, a.vehicle_type, a.city)
      ON CONFLICT (user_id) DO UPDATE SET vehicle_type = excluded.vehicle_type, service_city = excluded.service_city;
    END IF;
    UPDATE public.rider_applications
      SET status = _decision::application_status, review_note = _note, reviewed_by = auth.uid(), reviewed_at = now()
      WHERE id = _application_id;
    INSERT INTO public.notifications (user_id, title, body, link)
    VALUES (a.user_id, 'Rider application ' || _decision, coalesce(_note,'Your application status changed.'), '/apply/rider');
  ELSE
    RAISE EXCEPTION 'Unknown application kind';
  END IF;

  PERFORM public.log_audit(_kind || '_application.' || _decision, _kind || '_applications', _application_id, _note, NULL, NULL);
END $function$;

-- 5) Live updates -------------------------------------------------------------

ALTER PUBLICATION supabase_realtime ADD TABLE public.prescriptions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.prescription_events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.consultations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.consultation_events;