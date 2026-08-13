-- ============ ENUM EXPANSION ============
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'confirmed';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'seller_reviewing';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'accepted_by_seller';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'rider_assignment';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'rider_assigned';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'rider_en_route_to_seller';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'rider_arrived_at_seller';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'picked_up';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'out_for_delivery';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'rider_arrived_at_customer';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'delivery_verification';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'completed';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'seller_rejected';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'payment_failed';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'refund_pending';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'delivery_failed';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'disputed';

CREATE TYPE public.application_status AS ENUM ('draft','submitted','under_review','approved','rejected');
CREATE TYPE public.fulfillment_status AS ENUM ('pending','seller_reviewing','accepted','rejected','preparing','ready_for_pickup','picked_up','delivered','completed','cancelled');
CREATE TYPE public.ledger_kind AS ENUM ('seller_product_earning','platform_product_commission','rider_delivery_earning','platform_delivery_share','refund');
CREATE TYPE public.payout_status AS ENUM ('pending','available','paid','withheld');

-- ============ PLATFORM CONFIG ============
CREATE TABLE public.delivery_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  city text,
  base_fee numeric(12,2) NOT NULL,
  per_km_fee numeric(12,2) NOT NULL DEFAULT 0,
  min_fee numeric(12,2) NOT NULL DEFAULT 0,
  peak_multiplier numeric(6,3) NOT NULL DEFAULT 1.0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.delivery_zones TO anon, authenticated;
GRANT ALL ON public.delivery_zones TO service_role;
ALTER TABLE public.delivery_zones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "zones_read" ON public.delivery_zones FOR SELECT USING (true);
CREATE POLICY "zones_super_admin_write" ON public.delivery_zones FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'super_admin')) WITH CHECK (public.has_role(auth.uid(),'super_admin'));
CREATE TRIGGER delivery_zones_updated_at BEFORE UPDATE ON public.delivery_zones
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.platform_settings (key, value) VALUES
  ('commission', '{"product_markup_percent": 10, "rider_regular_percent": 85, "rider_peak_percent": 90}'::jsonb),
  ('delivery_pricing', '{"configured": false, "peak_windows": [{"start":"17:00","end":"20:00"}], "notes": "Distance provider not configured yet."}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- ============ PRODUCT PRICING (seller enters what they receive) ============
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS seller_price numeric(12,2),
  ADD COLUMN IF NOT EXISTS platform_markup_percent numeric(6,3) NOT NULL DEFAULT 10;

UPDATE public.products SET seller_price = ROUND(price / 1.10, 2) WHERE seller_price IS NULL;

CREATE OR REPLACE FUNCTION public.apply_product_pricing()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.seller_price IS NULL THEN
    NEW.seller_price := ROUND(COALESCE(NEW.price,0) / (1 + NEW.platform_markup_percent/100.0), 2);
  END IF;
  NEW.price := ROUND(NEW.seller_price * (1 + NEW.platform_markup_percent/100.0), 2);
  RETURN NEW;
END $$;

CREATE TRIGGER products_pricing BEFORE INSERT OR UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.apply_product_pricing();

-- ============ ORDERS: SNAPSHOTS + PAYMENT STATE ============
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS address_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS platform_product_amount numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS delivery_is_peak boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS delivery_rider_amount numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS delivery_platform_amount numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS delivery_rule text,
  ADD COLUMN IF NOT EXISTS cancelled_reason text,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS seller_unit_price numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS platform_unit_amount numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS product_image_path text,
  ADD COLUMN IF NOT EXISTS variant_label text;

ALTER TABLE public.order_status_history
  ADD COLUMN IF NOT EXISTS previous_status public.order_status,
  ADD COLUMN IF NOT EXISTS actor_role text;

-- ============ SELLER FULFILLMENT GROUPS ============
CREATE TABLE public.order_fulfillments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id),
  seller_id uuid NOT NULL REFERENCES auth.users(id),
  status public.fulfillment_status NOT NULL DEFAULT 'pending',
  rejection_reason text,
  rejection_note text,
  items_subtotal numeric(12,2) NOT NULL DEFAULT 0,
  seller_amount numeric(12,2) NOT NULL DEFAULT 0,
  platform_amount numeric(12,2) NOT NULL DEFAULT 0,
  accepted_at timestamptz,
  ready_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (order_id, store_id)
);
GRANT SELECT, INSERT, UPDATE ON public.order_fulfillments TO authenticated;
GRANT ALL ON public.order_fulfillments TO service_role;
ALTER TABLE public.order_fulfillments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fulfillments_seller_read" ON public.order_fulfillments FOR SELECT TO authenticated
  USING (seller_id = auth.uid());
CREATE POLICY "fulfillments_customer_read" ON public.order_fulfillments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.customer_id = auth.uid()));
CREATE POLICY "fulfillments_rider_read" ON public.order_fulfillments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.deliveries d WHERE d.order_id = order_id AND d.rider_id = auth.uid()));
CREATE POLICY "fulfillments_staff_read" ON public.order_fulfillments FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));
CREATE POLICY "fulfillments_seller_update" ON public.order_fulfillments FOR UPDATE TO authenticated
  USING (seller_id = auth.uid()) WITH CHECK (seller_id = auth.uid());
CREATE TRIGGER order_fulfillments_updated_at BEFORE UPDATE ON public.order_fulfillments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS fulfillment_id uuid REFERENCES public.order_fulfillments(id) ON DELETE CASCADE;

-- ============ DELIVERIES: VERIFICATION + OFFERS ============
ALTER TABLE public.deliveries
  ADD COLUMN IF NOT EXISTS pickup_code text,
  ADD COLUMN IF NOT EXISTS delivery_code text,
  ADD COLUMN IF NOT EXISTS pickup_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS delivery_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS assigned_at timestamptz,
  ADD COLUMN IF NOT EXISTS expected_delivery_at timestamptz,
  ADD COLUMN IF NOT EXISTS late_alert_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS fee_total numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rider_amount numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS platform_amount numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_peak boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS location_updated_at timestamptz;

CREATE TABLE public.delivery_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id uuid NOT NULL REFERENCES public.deliveries(id) ON DELETE CASCADE,
  rider_id uuid NOT NULL REFERENCES auth.users(id),
  status text NOT NULL DEFAULT 'offered',
  responded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (delivery_id, rider_id)
);
GRANT SELECT, INSERT, UPDATE ON public.delivery_offers TO authenticated;
GRANT ALL ON public.delivery_offers TO service_role;
ALTER TABLE public.delivery_offers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "offers_rider_read" ON public.delivery_offers FOR SELECT TO authenticated
  USING (rider_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "offers_rider_update" ON public.delivery_offers FOR UPDATE TO authenticated
  USING (rider_id = auth.uid()) WITH CHECK (rider_id = auth.uid());
CREATE POLICY "offers_staff_insert" ON public.delivery_offers FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()));

CREATE TABLE public.rider_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  is_online boolean NOT NULL DEFAULT false,
  is_available boolean NOT NULL DEFAULT true,
  vehicle_type text,
  service_city text,
  active_assignments integer NOT NULL DEFAULT 0,
  max_assignments integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.rider_profiles TO authenticated;
GRANT ALL ON public.rider_profiles TO service_role;
ALTER TABLE public.rider_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rider_profiles_self" ON public.rider_profiles FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "rider_profiles_staff_read" ON public.rider_profiles FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));
CREATE TRIGGER rider_profiles_updated_at BEFORE UPDATE ON public.rider_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ FINANCIAL LEDGER ============
CREATE TABLE public.ledger_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  fulfillment_id uuid REFERENCES public.order_fulfillments(id) ON DELETE SET NULL,
  delivery_id uuid REFERENCES public.deliveries(id) ON DELETE SET NULL,
  kind public.ledger_kind NOT NULL,
  beneficiary_id uuid REFERENCES auth.users(id),
  amount numeric(12,2) NOT NULL,
  percentage numeric(6,3),
  rule text,
  payout_status public.payout_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ledger_entries TO authenticated;
GRANT ALL ON public.ledger_entries TO service_role;
ALTER TABLE public.ledger_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ledger_beneficiary_read" ON public.ledger_entries FOR SELECT TO authenticated
  USING (beneficiary_id = auth.uid());
CREATE POLICY "ledger_staff_read" ON public.ledger_entries FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

-- ============ APPLICATIONS ============
CREATE TABLE public.seller_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  store_name text NOT NULL,
  category_id uuid REFERENCES public.categories(id),
  description text,
  city text,
  address text,
  contact_phone text,
  business_reg_number text,
  document_paths text[] NOT NULL DEFAULT '{}',
  status public.application_status NOT NULL DEFAULT 'submitted',
  review_note text,
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  store_id uuid REFERENCES public.stores(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.seller_applications TO authenticated;
GRANT ALL ON public.seller_applications TO service_role;
ALTER TABLE public.seller_applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "seller_apps_self" ON public.seller_applications FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "seller_apps_insert_self" ON public.seller_applications FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "seller_apps_update_own_draft" ON public.seller_applications FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND status IN ('draft','submitted')) WITH CHECK (user_id = auth.uid());
CREATE POLICY "seller_apps_staff_update" ON public.seller_applications FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE TRIGGER seller_applications_updated_at BEFORE UPDATE ON public.seller_applications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.rider_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  phone text NOT NULL,
  city text NOT NULL,
  vehicle_type text NOT NULL,
  vehicle_plate text,
  has_smartphone boolean NOT NULL DEFAULT true,
  emergency_contact_name text,
  emergency_contact_phone text,
  document_paths text[] NOT NULL DEFAULT '{}',
  status public.application_status NOT NULL DEFAULT 'submitted',
  review_note text,
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.rider_applications TO authenticated;
GRANT ALL ON public.rider_applications TO service_role;
ALTER TABLE public.rider_applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rider_apps_self" ON public.rider_applications FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "rider_apps_insert_self" ON public.rider_applications FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "rider_apps_update_own_draft" ON public.rider_applications FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND status IN ('draft','submitted')) WITH CHECK (user_id = auth.uid());
CREATE POLICY "rider_apps_staff_update" ON public.rider_applications FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE TRIGGER rider_applications_updated_at BEFORE UPDATE ON public.rider_applications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ SUPPORT + SOS ============
CREATE TABLE public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  category text NOT NULL,
  subject text NOT NULL,
  requester_role text,
  contact_email text,
  contact_name text,
  status text NOT NULL DEFAULT 'open',
  assigned_to uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.support_tickets TO authenticated;
GRANT INSERT ON public.support_tickets TO anon;
GRANT ALL ON public.support_tickets TO service_role;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tickets_own_read" ON public.support_tickets FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "tickets_insert_self" ON public.support_tickets FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);
CREATE POLICY "tickets_insert_public" ON public.support_tickets FOR INSERT TO anon
  WITH CHECK (user_id IS NULL);
CREATE POLICY "tickets_staff_update" ON public.support_tickets FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE TRIGGER support_tickets_updated_at BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.support_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  sender_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  sender_role text,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.support_messages TO authenticated;
GRANT INSERT ON public.support_messages TO anon;
GRANT ALL ON public.support_messages TO service_role;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "support_messages_read" ON public.support_messages FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()) OR EXISTS (
    SELECT 1 FROM public.support_tickets t WHERE t.id = ticket_id AND t.user_id = auth.uid()));
CREATE POLICY "support_messages_insert" ON public.support_messages FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()) OR EXISTS (
    SELECT 1 FROM public.support_tickets t WHERE t.id = ticket_id AND t.user_id = auth.uid()));
CREATE POLICY "support_messages_insert_public" ON public.support_messages FOR INSERT TO anon
  WITH CHECK (EXISTS (SELECT 1 FROM public.support_tickets t WHERE t.id = ticket_id AND t.user_id IS NULL));

CREATE TABLE public.sos_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rider_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  delivery_id uuid REFERENCES public.deliveries(id) ON DELETE SET NULL,
  kind text NOT NULL,
  note text,
  latitude numeric,
  longitude numeric,
  status text NOT NULL DEFAULT 'open',
  acknowledged_by uuid REFERENCES auth.users(id),
  acknowledged_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.sos_incidents TO authenticated;
GRANT UPDATE ON public.sos_incidents TO authenticated;
GRANT ALL ON public.sos_incidents TO service_role;
ALTER TABLE public.sos_incidents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sos_read" ON public.sos_incidents FOR SELECT TO authenticated
  USING (rider_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "sos_insert_self" ON public.sos_incidents FOR INSERT TO authenticated
  WITH CHECK (rider_id = auth.uid());
CREATE POLICY "sos_staff_update" ON public.sos_incidents FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- ============ SECURE VIEW OF CODES FOR CUSTOMER/SELLER ONLY ============
REVOKE SELECT ON public.deliveries FROM authenticated;
GRANT SELECT (id, order_id, rider_id, status, rider_latitude, rider_longitude, picked_up_at,
  delivered_at, created_at, updated_at, pickup_verified_at, delivery_verified_at, assigned_at,
  expected_delivery_at, late_alert_sent_at, fee_total, rider_amount, platform_amount, is_peak,
  location_updated_at) ON public.deliveries TO authenticated;
GRANT INSERT, UPDATE ON public.deliveries TO authenticated;

CREATE OR REPLACE FUNCTION public.get_pickup_code(_order_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT d.pickup_code FROM public.deliveries d
  JOIN public.order_fulfillments f ON f.order_id = d.order_id
  WHERE d.order_id = _order_id AND f.seller_id = auth.uid()
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.get_delivery_code(_order_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT d.delivery_code FROM public.deliveries d
  JOIN public.orders o ON o.id = d.order_id
  WHERE d.order_id = _order_id AND o.customer_id = auth.uid()
  LIMIT 1
$$;
GRANT EXECUTE ON FUNCTION public.get_pickup_code(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_delivery_code(uuid) TO authenticated;