-- ============================================================
-- HEALTHCARE / PHARMACY PHASE
-- ============================================================

-- ---------- roles ----------
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'health_professional';

-- ---------- stores ----------
ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS store_type text NOT NULL DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS verification_note text,
  ADD COLUMN IF NOT EXISTS verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS pharmacy_license_number text,
  ADD COLUMN IF NOT EXISTS pharmacy_license_expiry date,
  ADD COLUMN IF NOT EXISTS responsible_pharmacist_name text,
  ADD COLUMN IF NOT EXISTS responsible_pharmacist_license text,
  ADD COLUMN IF NOT EXISTS operating_hours jsonb,
  ADD COLUMN IF NOT EXISTS accepts_emergency_orders boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_open boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS expiry_alert_days integer NOT NULL DEFAULT 60;

DO $$ BEGIN
  ALTER TABLE public.stores ADD CONSTRAINT stores_store_type_check
    CHECK (store_type IN ('general','restaurant','grocery','pharmacy','fashion','electronics','other'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.stores ADD CONSTRAINT stores_verification_status_check
    CHECK (verification_status IN ('pending','under_review','more_info_required','approved','rejected','suspended'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

UPDATE public.stores SET verification_status = 'approved', verified_at = COALESCE(verified_at, now())
  WHERE status = 'approved' AND verification_status = 'pending';

-- ---------- seller applications ----------
ALTER TABLE public.seller_applications
  ADD COLUMN IF NOT EXISTS store_type text NOT NULL DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS pharmacy_name text,
  ADD COLUMN IF NOT EXISTS pharmacy_license_number text,
  ADD COLUMN IF NOT EXISTS pharmacy_license_expiry date,
  ADD COLUMN IF NOT EXISTS responsible_pharmacist_name text,
  ADD COLUMN IF NOT EXISTS responsible_pharmacist_license text,
  ADD COLUMN IF NOT EXISTS responsible_pharmacist_phone text,
  ADD COLUMN IF NOT EXISTS operating_hours jsonb,
  ADD COLUMN IF NOT EXISTS logo_path text;

DO $$ BEGIN
  ALTER TABLE public.seller_applications ADD CONSTRAINT seller_apps_store_type_check
    CHECK (store_type IN ('general','restaurant','grocery','pharmacy','fashion','electronics','other'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------- products ----------
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS is_medication boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS prescription_required boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS emergency_eligible boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS generic_name text,
  ADD COLUMN IF NOT EXISTS brand_name text,
  ADD COLUMN IF NOT EXISTS strength text,
  ADD COLUMN IF NOT EXISTS dosage_form text,
  ADD COLUMN IF NOT EXISTS pack_size text,
  ADD COLUMN IF NOT EXISTS manufacturer text,
  ADD COLUMN IF NOT EXISTS active_ingredient text,
  ADD COLUMN IF NOT EXISTS nafdac_number text,
  ADD COLUMN IF NOT EXISTS storage_requirements text,
  ADD COLUMN IF NOT EXISTS instructions text,
  ADD COLUMN IF NOT EXISTS warnings text,
  ADD COLUMN IF NOT EXISTS min_age integer;

-- ---------- inventory batches ----------
CREATE TABLE IF NOT EXISTS public.inventory_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  seller_id uuid NOT NULL,
  batch_number text,
  quantity integer NOT NULL DEFAULT 0,
  expiry_date date,
  received_at date NOT NULL DEFAULT current_date,
  note text,
  alerted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_batches TO authenticated;
GRANT ALL ON public.inventory_batches TO service_role;
ALTER TABLE public.inventory_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Seller manages own batches" ON public.inventory_batches
  FOR ALL TO authenticated USING (seller_id = auth.uid()) WITH CHECK (seller_id = auth.uid());
CREATE POLICY "Staff read batches" ON public.inventory_batches
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE TRIGGER inventory_batches_updated_at BEFORE UPDATE ON public.inventory_batches
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- prescriptions ----------
CREATE TABLE IF NOT EXISTS public.prescriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  file_path text NOT NULL,
  file_type text,
  prescriber_name text,
  prescriber_contact text,
  patient_note text,
  status text NOT NULL DEFAULT 'pending_review',
  reviewed_by uuid,
  reviewed_at timestamptz,
  review_note text,
  expires_at date,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  fulfilled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT prescriptions_status_check CHECK (status IN
    ('pending_review','approved','rejected','more_info_needed','expired','fulfilled'))
);
GRANT SELECT, INSERT, UPDATE ON public.prescriptions TO authenticated;
GRANT ALL ON public.prescriptions TO service_role;
ALTER TABLE public.prescriptions ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_pharmacy_owner(_user_id uuid, _store_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.stores s
    WHERE s.id = _store_id AND s.owner_id = _user_id AND s.store_type = 'pharmacy')
$$;

CREATE POLICY "Customer reads own prescriptions" ON public.prescriptions
  FOR SELECT TO authenticated USING (customer_id = auth.uid());
CREATE POLICY "Customer uploads own prescriptions" ON public.prescriptions
  FOR INSERT TO authenticated WITH CHECK (customer_id = auth.uid());
CREATE POLICY "Pharmacy reads its prescriptions" ON public.prescriptions
  FOR SELECT TO authenticated USING (public.is_pharmacy_owner(auth.uid(), store_id));
CREATE POLICY "Health admin reads prescriptions" ON public.prescriptions
  FOR SELECT TO authenticated USING (public.has_permission(auth.uid(),'health.prescriptions.view'));
CREATE TRIGGER prescriptions_updated_at BEFORE UPDATE ON public.prescriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.prescription_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prescription_id uuid NOT NULL REFERENCES public.prescriptions(id) ON DELETE CASCADE,
  status text NOT NULL,
  note text,
  actor_id uuid,
  actor_role text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.prescription_events TO authenticated;
GRANT ALL ON public.prescription_events TO service_role;
ALTER TABLE public.prescription_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Prescription parties read events" ON public.prescription_events
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM public.prescriptions p WHERE p.id = prescription_id
      AND (p.customer_id = auth.uid()
        OR public.is_pharmacy_owner(auth.uid(), p.store_id)
        OR public.has_permission(auth.uid(),'health.prescriptions.view'))));

-- ---------- orders: emergency priority + prescription link ----------
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS is_emergency boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS priority integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS emergency_surcharge numeric NOT NULL DEFAULT 0;
ALTER TABLE public.order_fulfillments
  ADD COLUMN IF NOT EXISTS is_emergency boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS prescription_id uuid REFERENCES public.prescriptions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS customer_note text;
ALTER TABLE public.deliveries
  ADD COLUMN IF NOT EXISTS priority integer NOT NULL DEFAULT 0;
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS prescription_required boolean NOT NULL DEFAULT false;

-- ---------- customer health ----------
CREATE TABLE IF NOT EXISTS public.health_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  blood_type text,
  allergies text,
  conditions text,
  current_medications text,
  emergency_contact_name text,
  emergency_contact_phone text,
  preferred_store_id uuid REFERENCES public.stores(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.health_profiles TO authenticated;
GRANT ALL ON public.health_profiles TO service_role;
ALTER TABLE public.health_profiles ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER health_profiles_updated_at BEFORE UPDATE ON public.health_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.family_health_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permission text NOT NULL,
  granted boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, member_id, permission),
  CONSTRAINT family_health_permission_check CHECK (permission IN
    ('health_profile','medications','reminders','vitals','pharmacy_orders','refills','appointments'))
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.family_health_permissions TO authenticated;
GRANT ALL ON public.family_health_permissions TO service_role;
ALTER TABLE public.family_health_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manages health sharing" ON public.family_health_permissions
  FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Member reads own grants" ON public.family_health_permissions
  FOR SELECT TO authenticated USING (member_id = auth.uid());

CREATE OR REPLACE FUNCTION public.has_health_access(_owner_id uuid, _permission text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _owner_id = auth.uid() OR EXISTS (
    SELECT 1 FROM public.family_health_permissions f
    WHERE f.owner_id = _owner_id AND f.member_id = auth.uid()
      AND f.permission = _permission AND f.granted)
$$;

CREATE POLICY "Health profile access" ON public.health_profiles
  FOR SELECT TO authenticated USING (public.has_health_access(user_id,'health_profile'));
CREATE POLICY "Health profile self write" ON public.health_profiles
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Health profile self update" ON public.health_profiles
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Health profile self delete" ON public.health_profiles
  FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.medications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  strength text,
  dosage text,
  frequency text,
  instructions text,
  prescriber text,
  start_date date,
  end_date date,
  notes text,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT medications_status_check CHECK (status IN ('active','discontinued'))
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.medications TO authenticated;
GRANT ALL ON public.medications TO service_role;
ALTER TABLE public.medications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Medications read" ON public.medications
  FOR SELECT TO authenticated USING (public.has_health_access(user_id,'medications'));
CREATE POLICY "Medications self write" ON public.medications
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Medications self update" ON public.medications
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Medications self delete" ON public.medications
  FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE TRIGGER medications_updated_at BEFORE UPDATE ON public.medications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.medication_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  medication_id uuid NOT NULL REFERENCES public.medications(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  times time[] NOT NULL DEFAULT '{}',
  days_of_week integer[] NOT NULL DEFAULT '{0,1,2,3,4,5,6}',
  enabled boolean NOT NULL DEFAULT true,
  starts_on date NOT NULL DEFAULT current_date,
  ends_on date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.medication_reminders TO authenticated;
GRANT ALL ON public.medication_reminders TO service_role;
ALTER TABLE public.medication_reminders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Reminders read" ON public.medication_reminders
  FOR SELECT TO authenticated USING (public.has_health_access(user_id,'reminders'));
CREATE POLICY "Reminders self write" ON public.medication_reminders
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Reminders self update" ON public.medication_reminders
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Reminders self delete" ON public.medication_reminders
  FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE TRIGGER medication_reminders_updated_at BEFORE UPDATE ON public.medication_reminders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.medication_doses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  medication_id uuid NOT NULL REFERENCES public.medications(id) ON DELETE CASCADE,
  reminder_id uuid REFERENCES public.medication_reminders(id) ON DELETE SET NULL,
  scheduled_for timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  acted_at timestamptz,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (medication_id, scheduled_for),
  CONSTRAINT medication_doses_status_check CHECK (status IN ('pending','taken','missed','skipped'))
);
GRANT SELECT, INSERT, UPDATE ON public.medication_doses TO authenticated;
GRANT ALL ON public.medication_doses TO service_role;
ALTER TABLE public.medication_doses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Doses read" ON public.medication_doses
  FOR SELECT TO authenticated USING (public.has_health_access(user_id,'reminders'));
CREATE POLICY "Doses self write" ON public.medication_doses
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Doses self update" ON public.medication_doses
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.vitals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL,
  value_primary numeric NOT NULL,
  value_secondary numeric,
  unit text NOT NULL,
  measured_at timestamptz NOT NULL DEFAULT now(),
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vitals_kind_check CHECK (kind IN
    ('blood_pressure','heart_rate','blood_glucose','weight','temperature','oxygen_saturation'))
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vitals TO authenticated;
GRANT ALL ON public.vitals TO service_role;
ALTER TABLE public.vitals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Vitals read" ON public.vitals
  FOR SELECT TO authenticated USING (public.has_health_access(user_id,'vitals'));
CREATE POLICY "Vitals self write" ON public.vitals
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Vitals self update" ON public.vitals
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Vitals self delete" ON public.vitals
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ---------- telehealth ----------
CREATE TABLE IF NOT EXISTS public.telehealth_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  label text NOT NULL,
  professional_type text NOT NULL,
  mode text NOT NULL,
  price numeric NOT NULL,
  duration_minutes integer NOT NULL DEFAULT 15,
  platform_percent numeric NOT NULL DEFAULT 20,
  is_active boolean NOT NULL DEFAULT true,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT telehealth_mode_check CHECK (mode IN ('call','chat')),
  CONSTRAINT telehealth_type_check CHECK (professional_type IN ('pharmacist','doctor'))
);
GRANT SELECT ON public.telehealth_services TO authenticated, anon;
GRANT ALL ON public.telehealth_services TO service_role;
ALTER TABLE public.telehealth_services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Everyone reads telehealth services" ON public.telehealth_services FOR SELECT USING (true);
CREATE POLICY "Super admin writes telehealth services" ON public.telehealth_services
  FOR ALL TO authenticated USING (public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'super_admin'));

INSERT INTO public.telehealth_services (key, label, professional_type, mode, price) VALUES
  ('pharmacist_call','Pharmacist call','pharmacist','call',500),
  ('pharmacist_chat','Pharmacist chat','pharmacist','chat',800),
  ('doctor_call','Doctor call','doctor','call',800),
  ('doctor_chat','Doctor chat','doctor','chat',1200)
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.health_professionals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  professional_type text NOT NULL,
  credentials text,
  license_number text,
  bio text,
  specialties text[] NOT NULL DEFAULT '{}',
  photo_path text,
  consultation_modes text[] NOT NULL DEFAULT '{}',
  document_paths text[] NOT NULL DEFAULT '{}',
  verification_status text NOT NULL DEFAULT 'pending',
  review_note text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  is_active boolean NOT NULL DEFAULT false,
  is_available_now boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT professional_type_check CHECK (professional_type IN ('pharmacist','doctor')),
  CONSTRAINT professional_verification_check CHECK (verification_status IN
    ('pending','under_review','approved','rejected','suspended'))
);
GRANT SELECT, INSERT, UPDATE ON public.health_professionals TO authenticated;
GRANT SELECT ON public.health_professionals TO anon;
GRANT ALL ON public.health_professionals TO service_role;
ALTER TABLE public.health_professionals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Approved professionals are public" ON public.health_professionals
  FOR SELECT USING (verification_status = 'approved' AND is_active);
CREATE POLICY "Professional reads own record" ON public.health_professionals
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Health admin reads professionals" ON public.health_professionals
  FOR SELECT TO authenticated USING (public.has_permission(auth.uid(),'health.telehealth.manage'));
CREATE POLICY "Professional applies" ON public.health_professionals
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND verification_status = 'pending');
CREATE POLICY "Professional edits own profile" ON public.health_professionals
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE TRIGGER health_professionals_updated_at BEFORE UPDATE ON public.health_professionals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- professionals cannot verify themselves
CREATE OR REPLACE FUNCTION public.guard_professional_self_verify()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF auth.uid() = NEW.user_id AND (
      NEW.verification_status IS DISTINCT FROM OLD.verification_status
      OR (NEW.is_active AND NOT OLD.is_active)) THEN
    RAISE EXCEPTION 'Verification is handled by the Medra team';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER health_professionals_guard BEFORE UPDATE ON public.health_professionals
  FOR EACH ROW EXECUTE FUNCTION public.guard_professional_self_verify();

CREATE TABLE IF NOT EXISTS public.professional_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id uuid NOT NULL REFERENCES public.health_professionals(id) ON DELETE CASCADE,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  mode text NOT NULL DEFAULT 'both',
  is_booked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT availability_mode_check CHECK (mode IN ('call','chat','both'))
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.professional_availability TO authenticated;
GRANT SELECT ON public.professional_availability TO anon;
GRANT ALL ON public.professional_availability TO service_role;
ALTER TABLE public.professional_availability ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Everyone reads availability" ON public.professional_availability FOR SELECT USING (true);
CREATE POLICY "Professional manages availability" ON public.professional_availability
  FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.health_professionals hp
    WHERE hp.id = professional_id AND hp.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.health_professionals hp
    WHERE hp.id = professional_id AND hp.user_id = auth.uid()));

CREATE TABLE IF NOT EXISTS public.consultations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference text UNIQUE NOT NULL,
  customer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  professional_id uuid NOT NULL REFERENCES public.health_professionals(id) ON DELETE RESTRICT,
  service_id uuid NOT NULL REFERENCES public.telehealth_services(id) ON DELETE RESTRICT,
  availability_id uuid REFERENCES public.professional_availability(id) ON DELETE SET NULL,
  mode text NOT NULL,
  price_charged numeric NOT NULL,
  platform_amount numeric NOT NULL DEFAULT 0,
  professional_amount numeric NOT NULL DEFAULT 0,
  payment_status text NOT NULL DEFAULT 'pending',
  status text NOT NULL DEFAULT 'booked',
  scheduled_at timestamptz NOT NULL,
  started_at timestamptz,
  ended_at timestamptz,
  duration_minutes integer,
  customer_note text,
  professional_note text,
  cancel_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT consultation_status_check CHECK (status IN
    ('booked','confirmed','waiting','in_progress','completed','cancelled','no_show','refund_pending','refunded')),
  CONSTRAINT consultation_payment_check CHECK (payment_status IN ('pending','paid','failed','refunded'))
);
GRANT SELECT, INSERT, UPDATE ON public.consultations TO authenticated;
GRANT ALL ON public.consultations TO service_role;
ALTER TABLE public.consultations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Customer reads own consultations" ON public.consultations
  FOR SELECT TO authenticated USING (customer_id = auth.uid());
CREATE POLICY "Professional reads own consultations" ON public.consultations
  FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.health_professionals hp
    WHERE hp.id = professional_id AND hp.user_id = auth.uid()));
CREATE POLICY "Telehealth admin reads consultations" ON public.consultations
  FOR SELECT TO authenticated USING (public.has_permission(auth.uid(),'health.telehealth.appointments'));
CREATE TRIGGER consultations_updated_at BEFORE UPDATE ON public.consultations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.consultation_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consultation_id uuid NOT NULL REFERENCES public.consultations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  sender_role text NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.consultation_messages TO authenticated;
GRANT ALL ON public.consultation_messages TO service_role;
ALTER TABLE public.consultation_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Participants read consultation chat" ON public.consultation_messages
  FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.consultations c
    WHERE c.id = consultation_id AND (c.customer_id = auth.uid()
      OR EXISTS (SELECT 1 FROM public.health_professionals hp
        WHERE hp.id = c.professional_id AND hp.user_id = auth.uid()))));
CREATE POLICY "Participants send consultation chat" ON public.consultation_messages
  FOR INSERT TO authenticated WITH CHECK (sender_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.consultations c
    WHERE c.id = consultation_id AND c.payment_status = 'paid'
      AND c.status IN ('confirmed','waiting','in_progress','completed')
      AND (c.customer_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.health_professionals hp
          WHERE hp.id = c.professional_id AND hp.user_id = auth.uid()))));

CREATE TABLE IF NOT EXISTS public.consultation_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consultation_id uuid UNIQUE NOT NULL REFERENCES public.consultations(id) ON DELETE CASCADE,
  provider text,
  room_id text,
  status text NOT NULL DEFAULT 'not_configured',
  join_opens_at timestamptz,
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT session_status_check CHECK (status IN ('not_configured','scheduled','live','ended'))
);
GRANT SELECT, UPDATE ON public.consultation_sessions TO authenticated;
GRANT ALL ON public.consultation_sessions TO service_role;
ALTER TABLE public.consultation_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Participants read call session" ON public.consultation_sessions
  FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.consultations c
    WHERE c.id = consultation_id AND (c.customer_id = auth.uid()
      OR EXISTS (SELECT 1 FROM public.health_professionals hp
        WHERE hp.id = c.professional_id AND hp.user_id = auth.uid()))));

-- ---------- permissions & feature flags ----------
INSERT INTO public.feature_flags (key, label, description, enabled) VALUES
  ('pharmacy','Pharmacy stores','Pharmacy store type and medication products.', true),
  ('prescriptions','Prescription workflow','Prescription upload and pharmacy review.', true),
  ('telehealth','Telehealth','Pharmacist and doctor consultations.', true),
  ('medication_reminders','Medication reminders','Reminders, dose logging and adherence.', true),
  ('vitals','Vitals tracking','Customer-recorded vitals.', true),
  ('health_profile','Health profile','Optional customer health profile.', true)
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.role_permissions (role, permission, enabled) VALUES
  ('admin','health.pharmacy.applications',false),
  ('admin','health.pharmacy.approve',false),
  ('admin','health.prescriptions.view',false),
  ('admin','health.telehealth.manage',false),
  ('admin','health.telehealth.appointments',false),
  ('admin','health.support',false)
ON CONFLICT DO NOTHING;

INSERT INTO public.platform_settings (key, value) VALUES
  ('emergency_pharmacy', jsonb_build_object(
     'surcharge_percent', 25, 'priority', 10,
     'note','Prioritised pharmacy delivery. Not an emergency medical service.')),
  ('prescription_policy', jsonb_build_object('validity_days', 90, 'retention_days', 1825))
ON CONFLICT (key) DO NOTHING;

-- ---------- prescription functions ----------
CREATE OR REPLACE FUNCTION public.upload_prescription(_store_id uuid, _file_path text, _file_type text,
  _prescriber_name text DEFAULT NULL, _prescriber_contact text DEFAULT NULL, _note text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id uuid; _owner uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT COALESCE((SELECT enabled FROM public.feature_flags WHERE key='prescriptions'), false) THEN
    RAISE EXCEPTION 'Prescription uploads are currently unavailable'; END IF;
  SELECT owner_id INTO _owner FROM public.stores
    WHERE id = _store_id AND store_type = 'pharmacy' AND status = 'approved'
      AND verification_status = 'approved';
  IF _owner IS NULL THEN RAISE EXCEPTION 'That pharmacy is not accepting prescriptions'; END IF;

  INSERT INTO public.prescriptions (customer_id, store_id, file_path, file_type,
    prescriber_name, prescriber_contact, patient_note)
  VALUES (auth.uid(), _store_id, _file_path, _file_type, _prescriber_name, _prescriber_contact, _note)
  RETURNING id INTO _id;

  INSERT INTO public.prescription_events (prescription_id, status, actor_id, actor_role)
  VALUES (_id, 'pending_review', auth.uid(), 'customer');

  INSERT INTO public.notifications (user_id, title, body, link)
  VALUES (_owner, 'New prescription to review',
    'A customer submitted a prescription for review.', '/seller/prescriptions');
  RETURN _id;
END $$;

CREATE OR REPLACE FUNCTION public.pharmacy_review_prescription(_prescription_id uuid, _decision text,
  _note text DEFAULT NULL, _expires_at date DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _p public.prescriptions; _days integer;
BEGIN
  SELECT * INTO _p FROM public.prescriptions WHERE id = _prescription_id;
  IF _p.id IS NULL OR NOT public.is_pharmacy_owner(auth.uid(), _p.store_id) THEN
    RAISE EXCEPTION 'Not permitted'; END IF;
  IF _decision NOT IN ('approved','rejected','more_info_needed') THEN
    RAISE EXCEPTION 'Invalid decision'; END IF;
  IF _decision <> 'approved' AND COALESCE(trim(_note),'') = '' THEN
    RAISE EXCEPTION 'A reason is required'; END IF;
  IF _p.status NOT IN ('pending_review','more_info_needed') THEN
    RAISE EXCEPTION 'This prescription has already been decided'; END IF;

  SELECT COALESCE((value->>'validity_days')::integer, 90) INTO _days
    FROM public.platform_settings WHERE key = 'prescription_policy';

  UPDATE public.prescriptions SET status = _decision, review_note = _note,
    reviewed_by = auth.uid(), reviewed_at = now(),
    expires_at = CASE WHEN _decision = 'approved'
      THEN COALESCE(_expires_at, (current_date + _days)) ELSE expires_at END
  WHERE id = _prescription_id;

  INSERT INTO public.prescription_events (prescription_id, status, note, actor_id, actor_role)
  VALUES (_prescription_id, _decision, _note, auth.uid(), 'seller');

  INSERT INTO public.notifications (user_id, title, body, link)
  VALUES (_p.customer_id,
    CASE _decision WHEN 'approved' THEN 'Prescription approved'
                   WHEN 'rejected' THEN 'Prescription rejected'
                   ELSE 'More information needed for your prescription' END,
    CASE WHEN _decision = 'approved' THEN 'You can now order the prescribed items.'
         ELSE COALESCE(_note,'Please review your prescription submission.') END,
    '/health/prescriptions');

  PERFORM public.log_audit('prescription_review','prescription', _prescription_id, _decision, NULL, NULL);
END $$;

-- Prescription readiness for the signed-in customer's cart
CREATE OR REPLACE FUNCTION public.cart_prescription_status()
RETURNS TABLE (store_id uuid, store_name text, requires_prescription boolean,
  prescription_id uuid, prescription_status text, expires_at date)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH stores_in_cart AS (
    SELECT p.store_id AS sid, bool_or(p.prescription_required) AS req
    FROM public.cart_items ci
    JOIN public.carts c ON c.id = ci.cart_id AND c.user_id = auth.uid()
    JOIN public.products p ON p.id = ci.product_id
    GROUP BY p.store_id
  )
  SELECT s.sid, st.name, s.req, rx.id, rx.status, rx.expires_at
  FROM stores_in_cart s
  JOIN public.stores st ON st.id = s.sid
  LEFT JOIN LATERAL (
    SELECT r.id, r.status, r.expires_at FROM public.prescriptions r
    WHERE r.customer_id = auth.uid() AND r.store_id = s.sid
    ORDER BY CASE r.status WHEN 'approved' THEN 1 WHEN 'pending_review' THEN 2
      WHEN 'more_info_needed' THEN 3 ELSE 4 END, r.created_at DESC
    LIMIT 1) rx ON true
$$;

-- Emergency delivery eligibility for a product
CREATE OR REPLACE FUNCTION public.emergency_eligibility(_product_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _p record; _reasons text[] := '{}';
BEGIN
  IF NOT COALESCE((SELECT enabled FROM public.feature_flags WHERE key='emergency_pharmacy'), false) THEN
    RETURN jsonb_build_object('eligible', false,
      'reasons', jsonb_build_array('Priority pharmacy delivery is not available right now.'));
  END IF;
  SELECT p.*, s.store_type, s.accepts_emergency_orders, s.is_open, s.status AS store_status,
         s.verification_status
    INTO _p FROM public.products p JOIN public.stores s ON s.id = p.store_id
    WHERE p.id = _product_id;
  IF _p.id IS NULL THEN RETURN jsonb_build_object('eligible', false,
    'reasons', jsonb_build_array('Product not found.')); END IF;
  IF _p.store_type <> 'pharmacy' OR _p.store_status <> 'approved'
     OR _p.verification_status <> 'approved' THEN
    _reasons := _reasons || 'Only verified pharmacies offer priority delivery.'; END IF;
  IF NOT _p.accepts_emergency_orders OR NOT _p.is_open THEN
    _reasons := _reasons || 'This pharmacy is not accepting priority orders right now.'; END IF;
  IF NOT _p.emergency_eligible THEN
    _reasons := _reasons || 'This item is not eligible for priority delivery.'; END IF;
  IF _p.stock_quantity <= 0 OR _p.status <> 'active' THEN
    _reasons := _reasons || 'This item is out of stock.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.rider_profiles WHERE is_online AND is_available
                   AND active_assignments < max_assignments) THEN
    _reasons := _reasons || 'No riders are available for priority delivery right now.'; END IF;
  RETURN jsonb_build_object('eligible', array_length(_reasons,1) IS NULL,
    'requires_prescription', _p.prescription_required,
    'reasons', COALESCE(to_jsonb(_reasons), '[]'::jsonb));
END $$;

-- ---------- order placement with prescription + priority ----------
DROP FUNCTION IF EXISTS public.place_order(uuid, integer);
CREATE OR REPLACE FUNCTION public.place_order(_address_id uuid, _points_to_redeem integer DEFAULT 0,
  _is_emergency boolean DEFAULT false, _customer_note text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid(); _cart uuid; _order uuid; _num text; _addr public.addresses;
  _item record; _quote jsonb; _subtotal numeric := 0; _seller_total numeric := 0;
  _platform_total numeric := 0; _points integer := 0; _discount numeric := 0;
  _fee numeric; _total numeric; _ful uuid; _wallet record; _rx record;
  _surcharge_pct numeric := 0; _surcharge numeric := 0; _priority integer := 0;
  _rx_used jsonb := '{}'::jsonb; _rx_id uuid;
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

  -- prescription gate, per pharmacy in the cart
  FOR _rx IN
    SELECT p.store_id AS sid, st.name AS sname
    FROM public.cart_items ci
    JOIN public.products p ON p.id = ci.product_id
    JOIN public.stores st ON st.id = p.store_id
    WHERE ci.cart_id = _cart AND p.prescription_required
    GROUP BY p.store_id, st.name
  LOOP
    SELECT id INTO _rx_id FROM public.prescriptions
      WHERE customer_id = _uid AND store_id = _rx.sid AND status = 'approved'
        AND (expires_at IS NULL OR expires_at >= current_date)
      ORDER BY created_at DESC LIMIT 1;
    IF _rx_id IS NULL THEN
      RAISE EXCEPTION 'PRESCRIPTION_REQUIRED: % needs an approved prescription before checkout', _rx.sname;
    END IF;
    _rx_used := _rx_used || jsonb_build_object(_rx.sid::text, _rx_id::text);
  END LOOP;

  -- priority pharmacy delivery
  IF _is_emergency THEN
    IF NOT COALESCE((SELECT enabled FROM public.feature_flags WHERE key='emergency_pharmacy'), false) THEN
      RAISE EXCEPTION 'EMERGENCY_UNAVAILABLE: Priority pharmacy delivery is not available right now';
    END IF;
    PERFORM 1 FROM public.cart_items ci
      JOIN public.products p ON p.id = ci.product_id
      JOIN public.stores s ON s.id = p.store_id
      WHERE ci.cart_id = _cart AND NOT (s.store_type = 'pharmacy' AND s.accepts_emergency_orders
        AND s.is_open AND s.verification_status = 'approved' AND p.emergency_eligible);
    IF FOUND THEN
      RAISE EXCEPTION 'EMERGENCY_UNAVAILABLE: One or more items are not eligible for priority delivery';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.rider_profiles WHERE is_online AND is_available
                     AND active_assignments < max_assignments) THEN
      RAISE EXCEPTION 'EMERGENCY_UNAVAILABLE: No riders are available for priority delivery right now';
    END IF;
    SELECT COALESCE((value->>'surcharge_percent')::numeric, 25),
           COALESCE((value->>'priority')::integer, 10)
      INTO _surcharge_pct, _priority FROM public.platform_settings WHERE key = 'emergency_pharmacy';
    _surcharge := ROUND(_fee * _surcharge_pct / 100, 2);
    _fee := _fee + _surcharge;
  END IF;

  _num := 'MED-' || to_char(now(),'YYMMDD') || '-' || upper(substr(encode(gen_random_bytes(3),'hex'),1,6));
  INSERT INTO public.orders (order_number, customer_id, address_id, subtotal, delivery_fee,
      points_redeemed, points_discount, total, status, payment_status, address_snapshot,
      delivery_is_peak, delivery_rider_amount, delivery_platform_amount, delivery_rule,
      is_emergency, priority, emergency_surcharge)
  VALUES (_num, _uid, _address_id, 0, _fee, 0, 0, 0, 'pending_payment', 'pending',
      to_jsonb(_addr), (_quote->>'is_peak')::boolean, (_quote->>'rider_amount')::numeric,
      (_quote->>'platform_amount')::numeric, _quote->>'rule', _is_emergency, _priority, _surcharge)
  RETURNING id INTO _order;

  FOR _item IN
    SELECT ci.quantity, p.id AS product_id, p.name, p.price, p.seller_price, p.image_path,
           p.stock_quantity, p.status, p.store_id, p.seller_id, p.prescription_required
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
      INSERT INTO public.order_fulfillments (order_id, store_id, seller_id, is_emergency,
        customer_note, prescription_id)
      VALUES (_order, _item.store_id, _item.seller_id, _is_emergency, _customer_note,
        NULLIF(_rx_used->>_item.store_id::text,'')::uuid)
      RETURNING id INTO _ful;
    END IF;

    INSERT INTO public.order_items (order_id, fulfillment_id, product_id, seller_id, store_id,
      product_name, unit_price, seller_unit_price, platform_unit_amount, quantity,
      product_image_path, prescription_required)
    VALUES (_order, _ful, _item.product_id, _item.seller_id, _item.store_id, _item.name,
      _item.price, _item.seller_price, ROUND(_item.price - _item.seller_price, 2),
      _item.quantity, _item.image_path, _item.prescription_required);

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

  -- consume the prescriptions used for this order
  UPDATE public.prescriptions SET status = 'fulfilled', order_id = _order, fulfilled_at = now()
   WHERE id IN (SELECT (jsonb_each_text(_rx_used)).value::uuid);

  INSERT INTO public.payments (order_id, provider, amount, status)
  VALUES (_order, 'card', _total, 'pending');

  INSERT INTO public.deliveries (order_id, status, fee_total, rider_amount, platform_amount,
    is_peak, priority)
  VALUES (_order, 'awaiting_payment', _fee, (_quote->>'rider_amount')::numeric,
          (_quote->>'platform_amount')::numeric, (_quote->>'is_peak')::boolean, _priority);

  DELETE FROM public.cart_items WHERE cart_id = _cart;
  INSERT INTO public.order_status_history (order_id, status, note, created_by, actor_role)
  VALUES (_order, 'pending_payment',
    CASE WHEN _is_emergency THEN 'Priority pharmacy order created, awaiting payment'
         ELSE 'Order created, awaiting payment' END, _uid, 'customer');

  RETURN jsonb_build_object('order_id', _order, 'order_number', _num, 'total', _total,
    'delivery_fee', _fee, 'subtotal', _subtotal, 'is_emergency', _is_emergency,
    'emergency_surcharge', _surcharge);
END $$;

-- ---------- medication doses & adherence ----------
CREATE OR REPLACE FUNCTION public.log_dose(_medication_id uuid, _scheduled_for timestamptz,
  _status text, _reminder_id uuid DEFAULT NULL, _note text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.medications WHERE id = _medication_id AND user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Not permitted'; END IF;
  IF _status NOT IN ('taken','missed','skipped','pending') THEN RAISE EXCEPTION 'Invalid status'; END IF;
  INSERT INTO public.medication_doses (user_id, medication_id, reminder_id, scheduled_for, status,
    acted_at, note)
  VALUES (auth.uid(), _medication_id, _reminder_id, _scheduled_for, _status,
    CASE WHEN _status = 'pending' THEN NULL ELSE now() END, _note)
  ON CONFLICT (medication_id, scheduled_for) DO UPDATE
    SET status = EXCLUDED.status, acted_at = EXCLUDED.acted_at, note = EXCLUDED.note
  RETURNING id INTO _id;
  RETURN _id;
END $$;

CREATE OR REPLACE FUNCTION public.adherence_summary(_owner_id uuid DEFAULT NULL)
RETURNS TABLE (window_label text, taken integer, missed integer, skipped integer, pending integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := COALESCE(_owner_id, auth.uid());
BEGIN
  IF NOT public.has_health_access(_uid, 'reminders') THEN RAISE EXCEPTION 'Not permitted'; END IF;
  RETURN QUERY
  SELECT w.label,
    COUNT(*) FILTER (WHERE d.status='taken')::int,
    COUNT(*) FILTER (WHERE d.status='missed')::int,
    COUNT(*) FILTER (WHERE d.status='skipped')::int,
    COUNT(*) FILTER (WHERE d.status='pending')::int
  FROM (VALUES ('today', current_date::timestamptz),
               ('week', (current_date - 6)::timestamptz),
               ('month', (current_date - 29)::timestamptz)) AS w(label, since)
  LEFT JOIN public.medication_doses d
    ON d.user_id = _uid AND d.scheduled_for >= w.since
  GROUP BY w.label;
END $$;

-- ---------- telehealth functions ----------
CREATE OR REPLACE FUNCTION public.book_consultation(_service_id uuid, _professional_id uuid,
  _availability_id uuid DEFAULT NULL, _scheduled_at timestamptz DEFAULT NULL, _note text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _svc public.telehealth_services; _pro public.health_professionals;
  _slot public.professional_availability; _when timestamptz; _id uuid; _ref text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT COALESCE((SELECT enabled FROM public.feature_flags WHERE key='telehealth'), false) THEN
    RAISE EXCEPTION 'Telehealth is not available right now'; END IF;
  SELECT * INTO _svc FROM public.telehealth_services WHERE id = _service_id AND is_active;
  IF _svc.id IS NULL THEN RAISE EXCEPTION 'That consultation type is unavailable'; END IF;
  SELECT * INTO _pro FROM public.health_professionals
    WHERE id = _professional_id AND verification_status = 'approved' AND is_active;
  IF _pro.id IS NULL THEN RAISE EXCEPTION 'That professional is not available'; END IF;
  IF _pro.professional_type <> _svc.professional_type THEN
    RAISE EXCEPTION 'That professional does not offer this service'; END IF;

  IF _availability_id IS NOT NULL THEN
    SELECT * INTO _slot FROM public.professional_availability
      WHERE id = _availability_id AND professional_id = _professional_id FOR UPDATE;
    IF _slot.id IS NULL OR _slot.is_booked OR _slot.starts_at < now() THEN
      RAISE EXCEPTION 'That time slot is no longer available'; END IF;
    IF _slot.mode <> 'both' AND _slot.mode <> _svc.mode THEN
      RAISE EXCEPTION 'That slot does not support this consultation type'; END IF;
    _when := _slot.starts_at;
    UPDATE public.professional_availability SET is_booked = true WHERE id = _availability_id;
  ELSE
    IF NOT _pro.is_available_now THEN RAISE EXCEPTION 'Choose an available time slot'; END IF;
    _when := COALESCE(_scheduled_at, now());
  END IF;

  _ref := 'TH-' || to_char(now(),'YYMMDD') || '-' || upper(substr(encode(gen_random_bytes(3),'hex'),1,6));
  INSERT INTO public.consultations (reference, customer_id, professional_id, service_id,
    availability_id, mode, price_charged, platform_amount, professional_amount,
    scheduled_at, customer_note)
  VALUES (_ref, auth.uid(), _professional_id, _service_id, _availability_id, _svc.mode,
    _svc.price, ROUND(_svc.price * _svc.platform_percent / 100, 2),
    ROUND(_svc.price * (100 - _svc.platform_percent) / 100, 2), _when, _note)
  RETURNING id INTO _id;

  INSERT INTO public.consultation_sessions (consultation_id, status, join_opens_at)
  VALUES (_id, CASE WHEN _svc.mode = 'call' THEN 'not_configured' ELSE 'scheduled' END,
    _when - interval '5 minutes');

  RETURN jsonb_build_object('consultation_id', _id, 'reference', _ref, 'amount', _svc.price);
END $$;

CREATE OR REPLACE FUNCTION public.confirm_consultation_payment(_consultation_id uuid,
  _provider text, _reference text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _c public.consultations; _pro public.health_professionals;
BEGIN
  SELECT * INTO _c FROM public.consultations WHERE id = _consultation_id;
  IF _c.id IS NULL OR _c.customer_id <> auth.uid() THEN RAISE EXCEPTION 'Not permitted'; END IF;
  IF _c.payment_status = 'paid' THEN RETURN; END IF;
  SELECT * INTO _pro FROM public.health_professionals WHERE id = _c.professional_id;

  UPDATE public.consultations SET payment_status = 'paid', status = 'confirmed'
    WHERE id = _consultation_id;

  INSERT INTO public.ledger_entries (kind, beneficiary_id, amount, rule, payout_status)
  VALUES ('seller_product_earning', _pro.user_id, _c.professional_amount,
    'telehealth_' || _c.mode, 'pending');
  INSERT INTO public.ledger_entries (kind, amount, rule)
  VALUES ('platform_product_commission', _c.platform_amount, 'telehealth_platform_share');

  INSERT INTO public.notifications (user_id, title, body, link)
  VALUES (_c.customer_id, 'Appointment confirmed',
    'Your consultation ' || _c.reference || ' is confirmed.', '/health/appointments');
  INSERT INTO public.notifications (user_id, title, body, link)
  VALUES (_pro.user_id, 'New consultation booked',
    'Consultation ' || _c.reference || ' has been paid and confirmed.', '/professional/appointments');
END $$;

CREATE OR REPLACE FUNCTION public.set_consultation_status(_consultation_id uuid, _status text,
  _reason text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _c public.consultations; _is_pro boolean; _is_customer boolean;
BEGIN
  SELECT * INTO _c FROM public.consultations WHERE id = _consultation_id;
  IF _c.id IS NULL THEN RAISE EXCEPTION 'Consultation not found'; END IF;
  _is_customer := _c.customer_id = auth.uid();
  SELECT EXISTS (SELECT 1 FROM public.health_professionals hp
    WHERE hp.id = _c.professional_id AND hp.user_id = auth.uid()) INTO _is_pro;
  IF NOT (_is_customer OR _is_pro OR public.has_permission(auth.uid(),'health.telehealth.appointments')) THEN
    RAISE EXCEPTION 'Not permitted'; END IF;
  IF _status NOT IN ('waiting','in_progress','completed','cancelled','no_show','refund_pending') THEN
    RAISE EXCEPTION 'Invalid status'; END IF;
  IF _is_customer AND _status NOT IN ('waiting','cancelled') THEN
    RAISE EXCEPTION 'Not permitted'; END IF;

  UPDATE public.consultations SET status = _status, cancel_reason = _reason,
    started_at = CASE WHEN _status = 'in_progress' THEN COALESCE(started_at, now()) ELSE started_at END,
    ended_at = CASE WHEN _status IN ('completed','no_show') THEN now() ELSE ended_at END,
    duration_minutes = CASE WHEN _status = 'completed' AND started_at IS NOT NULL
      THEN GREATEST(1, EXTRACT(epoch FROM (now() - started_at))::int / 60) ELSE duration_minutes END
  WHERE id = _consultation_id;

  IF _status = 'completed' THEN
    UPDATE public.ledger_entries SET payout_status = 'available'
      WHERE beneficiary_id = (SELECT user_id FROM public.health_professionals WHERE id = _c.professional_id)
        AND rule = 'telehealth_' || _c.mode AND payout_status = 'pending';
  END IF;
  IF _status = 'cancelled' AND _c.payment_status = 'paid' THEN
    UPDATE public.consultations SET status = 'refund_pending' WHERE id = _consultation_id;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.admin_review_professional(_professional_id uuid, _decision text,
  _note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _p public.health_professionals;
BEGIN
  IF NOT public.has_permission(auth.uid(),'health.telehealth.manage') THEN
    RAISE EXCEPTION 'Not permitted'; END IF;
  IF _decision NOT IN ('under_review','approved','rejected','suspended') THEN
    RAISE EXCEPTION 'Invalid decision'; END IF;
  IF _decision IN ('rejected','suspended') AND COALESCE(trim(_note),'') = '' THEN
    RAISE EXCEPTION 'A reason is required'; END IF;
  SELECT * INTO _p FROM public.health_professionals WHERE id = _professional_id;
  IF _p.id IS NULL THEN RAISE EXCEPTION 'Professional not found'; END IF;

  UPDATE public.health_professionals SET verification_status = _decision, review_note = _note,
    reviewed_by = auth.uid(), reviewed_at = now(),
    is_active = (_decision = 'approved')
  WHERE id = _professional_id;

  IF _decision = 'approved' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (_p.user_id, 'health_professional')
      ON CONFLICT DO NOTHING;
  END IF;

  INSERT INTO public.notifications (user_id, title, body, link)
  VALUES (_p.user_id, 'Telehealth application ' || replace(_decision,'_',' '),
    COALESCE(_note, 'Your professional profile status was updated.'), '/professional');
  PERFORM public.log_audit('professional_review','health_professional', _professional_id, _note, NULL,
    jsonb_build_object('decision', _decision));
END $$;

CREATE OR REPLACE FUNCTION public.set_telehealth_price(_service_id uuid, _price numeric,
  _platform_percent numeric DEFAULT NULL, _is_active boolean DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _old public.telehealth_services;
BEGIN
  IF NOT public.has_role(auth.uid(),'super_admin') THEN RAISE EXCEPTION 'Not permitted'; END IF;
  SELECT * INTO _old FROM public.telehealth_services WHERE id = _service_id;
  IF _old.id IS NULL THEN RAISE EXCEPTION 'Service not found'; END IF;
  UPDATE public.telehealth_services SET price = _price,
    platform_percent = COALESCE(_platform_percent, platform_percent),
    is_active = COALESCE(_is_active, is_active), updated_by = auth.uid(), updated_at = now()
  WHERE id = _service_id;
  PERFORM public.log_audit('telehealth_price_change','telehealth_service', _service_id, NULL,
    jsonb_build_object('price', _old.price, 'platform_percent', _old.platform_percent),
    jsonb_build_object('price', _price, 'platform_percent',
      COALESCE(_platform_percent, _old.platform_percent)));
END $$;

-- ---------- pharmacy verification (admin) ----------
CREATE OR REPLACE FUNCTION public.admin_set_store_verification(_store_id uuid, _status text,
  _note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _s public.stores;
BEGIN
  SELECT * INTO _s FROM public.stores WHERE id = _store_id;
  IF _s.id IS NULL THEN RAISE EXCEPTION 'Store not found'; END IF;
  IF _s.store_type = 'pharmacy' THEN
    IF NOT public.has_permission(auth.uid(),'health.pharmacy.approve') THEN
      RAISE EXCEPTION 'Not permitted'; END IF;
  ELSIF NOT public.has_permission(auth.uid(),'sellers.approve') THEN
    RAISE EXCEPTION 'Not permitted';
  END IF;
  IF _status NOT IN ('pending','under_review','more_info_required','approved','rejected','suspended') THEN
    RAISE EXCEPTION 'Invalid status'; END IF;
  IF _status IN ('rejected','suspended','more_info_required') AND COALESCE(trim(_note),'') = '' THEN
    RAISE EXCEPTION 'A reason is required'; END IF;

  UPDATE public.stores SET verification_status = _status, verification_note = _note,
    verified_at = CASE WHEN _status = 'approved' THEN now() ELSE verified_at END,
    status = CASE WHEN _status = 'approved' THEN 'approved'::public.store_status
                  WHEN _status = 'suspended' THEN 'suspended'::public.store_status
                  ELSE status END
  WHERE id = _store_id;

  INSERT INTO public.notifications (user_id, title, body, link)
  VALUES (_s.owner_id, 'Store verification ' || replace(_status,'_',' '),
    COALESCE(_note, 'Your store verification status was updated.'), '/seller/store');
  PERFORM public.log_audit('store_verification','store', _store_id, _note,
    jsonb_build_object('status', _s.verification_status), jsonb_build_object('status', _status));
END $$;

-- ---------- expiry alerts ----------
CREATE OR REPLACE FUNCTION public.flag_expiring_batches()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _b record; _count integer := 0;
BEGIN
  FOR _b IN
    SELECT ib.*, p.name AS product_name, s.expiry_alert_days
    FROM public.inventory_batches ib
    JOIN public.products p ON p.id = ib.product_id
    JOIN public.stores s ON s.id = ib.store_id
    WHERE ib.expiry_date IS NOT NULL AND ib.quantity > 0 AND ib.alerted_at IS NULL
      AND ib.expiry_date <= current_date + s.expiry_alert_days
  LOOP
    UPDATE public.inventory_batches SET alerted_at = now() WHERE id = _b.id;
    INSERT INTO public.notifications (user_id, title, body, link)
    VALUES (_b.seller_id, 'Stock expiring soon',
      _b.product_name || ' batch ' || COALESCE(_b.batch_number,'—') ||
      ' expires on ' || _b.expiry_date || '.', '/seller/inventory');
    _count := _count + 1;
  END LOOP;
  RETURN _count;
END $$;

-- expired batches must not be purchasable
CREATE OR REPLACE FUNCTION public.sync_expired_stock()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _p record; _count integer := 0;
BEGIN
  FOR _p IN
    SELECT DISTINCT product_id FROM public.inventory_batches
    WHERE expiry_date IS NOT NULL AND expiry_date < current_date AND quantity > 0
  LOOP
    UPDATE public.inventory_batches SET quantity = 0
      WHERE product_id = _p.product_id AND expiry_date < current_date;
    UPDATE public.products p SET stock_quantity = GREATEST(0, COALESCE((
        SELECT SUM(quantity) FROM public.inventory_batches b
        WHERE b.product_id = p.id AND (b.expiry_date IS NULL OR b.expiry_date >= current_date)
      ), 0)),
      status = CASE WHEN COALESCE((SELECT SUM(quantity) FROM public.inventory_batches b
        WHERE b.product_id = p.id AND (b.expiry_date IS NULL OR b.expiry_date >= current_date)),0) = 0
        THEN 'out_of_stock'::public.product_status ELSE p.status END
    WHERE p.id = _p.product_id;
    _count := _count + 1;
  END LOOP;
  RETURN _count;
END $$;

-- ---------- grants for new functions ----------
DO $$
DECLARE f record;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prokind = 'f'
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon, public', f.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', f.sig);
  END LOOP;
END $$;

-- ---------- prescription storage policies ----------
CREATE POLICY "prescriptions_customer_upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'prescriptions' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "prescriptions_customer_read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'prescriptions' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "prescriptions_pharmacy_read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'prescriptions' AND EXISTS (
    SELECT 1 FROM public.prescriptions r
    WHERE r.file_path = storage.objects.name
      AND (public.is_pharmacy_owner(auth.uid(), r.store_id)
        OR public.has_permission(auth.uid(),'health.prescriptions.view'))));
