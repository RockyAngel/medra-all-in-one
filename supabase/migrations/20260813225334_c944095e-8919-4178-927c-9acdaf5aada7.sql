-- ============================================================
-- LOGISTICS ENGINE: geo data, pricing engine, quotes, dispatch
-- ============================================================

-- 1. STRUCTURED CUSTOMER ADDRESSES ---------------------------------
ALTER TABLE public.addresses
  ADD COLUMN IF NOT EXISTS area text,
  ADD COLUMN IF NOT EXISTS landmark text,
  ADD COLUMN IF NOT EXISTS building text,
  ADD COLUMN IF NOT EXISTS estate text,
  ADD COLUMN IF NOT EXISTS apartment text,
  ADD COLUMN IF NOT EXISTS country text NOT NULL DEFAULT 'Nigeria',
  ADD COLUMN IF NOT EXISTS postal_code text,
  ADD COLUMN IF NOT EXISTS place_id text,
  ADD COLUMN IF NOT EXISTS latitude numeric,
  ADD COLUMN IF NOT EXISTS longitude numeric,
  ADD COLUMN IF NOT EXISTS location_source text,
  ADD COLUMN IF NOT EXISTS delivery_instructions text;

-- 2. STORE PICKUP LOCATION (all seller types) ----------------------
ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS area text,
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS country text NOT NULL DEFAULT 'Nigeria',
  ADD COLUMN IF NOT EXISTS postal_code text,
  ADD COLUMN IF NOT EXISTS place_id text,
  ADD COLUMN IF NOT EXISTS latitude numeric,
  ADD COLUMN IF NOT EXISTS longitude numeric,
  ADD COLUMN IF NOT EXISTS location_source text,
  ADD COLUMN IF NOT EXISTS location_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS pickup_notes text;

-- 3. SERVICE AREAS -------------------------------------------------
ALTER TABLE public.delivery_zones
  ADD COLUMN IF NOT EXISTS country text NOT NULL DEFAULT 'Nigeria',
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS center_latitude numeric,
  ADD COLUMN IF NOT EXISTS center_longitude numeric,
  ADD COLUMN IF NOT EXISTS radius_km numeric,
  ADD COLUMN IF NOT EXISTS polygon jsonb;

-- 3b. DELIVERY + OFFER + RIDER PROFILE COLUMNS --------------------
ALTER TABLE public.deliveries
  ADD COLUMN IF NOT EXISTS fulfillment_id uuid REFERENCES public.order_fulfillments(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS store_id uuid REFERENCES public.stores(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS pickup_latitude numeric,
  ADD COLUMN IF NOT EXISTS pickup_longitude numeric,
  ADD COLUMN IF NOT EXISTS dropoff_latitude numeric,
  ADD COLUMN IF NOT EXISTS dropoff_longitude numeric,
  ADD COLUMN IF NOT EXISTS distance_meters integer,
  ADD COLUMN IF NOT EXISTS duration_seconds integer,
  ADD COLUMN IF NOT EXISTS routing_provider text,
  ADD COLUMN IF NOT EXISTS route_calculated_at timestamptz,
  ADD COLUMN IF NOT EXISTS rider_percent numeric,
  ADD COLUMN IF NOT EXISTS platform_percent numeric,
  ADD COLUMN IF NOT EXISTS priority_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_priority boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS eta_at timestamptz,
  ADD COLUMN IF NOT EXISTS eta_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS expected_pickup_at timestamptz,
  ADD COLUMN IF NOT EXISTS milestone text,
  ADD COLUMN IF NOT EXISTS failure_reason text,
  ADD COLUMN IF NOT EXISTS failure_note text,
  ADD COLUMN IF NOT EXISTS attempt_number integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS location_accuracy numeric,
  ADD COLUMN IF NOT EXISTS offer_round integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_dispatch_at timestamptz,
  ADD COLUMN IF NOT EXISTS code_attempts integer NOT NULL DEFAULT 0;

ALTER TABLE public.delivery_offers
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS decline_reason text,
  ADD COLUMN IF NOT EXISTS offer_round integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS pickup_distance_km numeric;

ALTER TABLE public.rider_profiles
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'offline',
  ADD COLUMN IF NOT EXISTS vehicle_plate text,
  ADD COLUMN IF NOT EXISTS vehicle_capacity integer,
  ADD COLUMN IF NOT EXISTS vehicle_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS is_suspended boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS latitude numeric,
  ADD COLUMN IF NOT EXISTS longitude numeric,
  ADD COLUMN IF NOT EXISTS location_accuracy numeric,
  ADD COLUMN IF NOT EXISTS location_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS service_state text,
  ADD COLUMN IF NOT EXISTS break_until timestamptz;

-- 4. PRICING ENGINE (versioned) ------------------------------------
CREATE TABLE IF NOT EXISTS public.delivery_pricing_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version integer NOT NULL,
  label text,
  delivery_enabled boolean NOT NULL DEFAULT true,
  base_fee numeric NOT NULL DEFAULT 0,
  per_km_fee numeric NOT NULL DEFAULT 0,
  min_fee numeric NOT NULL DEFAULT 0,
  max_fee numeric,
  peak_surcharge_percent numeric NOT NULL DEFAULT 0,
  priority_enabled boolean NOT NULL DEFAULT false,
  priority_fee numeric NOT NULL DEFAULT 0,
  emergency_fee numeric NOT NULL DEFAULT 0,
  regular_rider_percent numeric NOT NULL DEFAULT 85,
  peak_rider_percent numeric NOT NULL DEFAULT 90,
  offer_timeout_seconds integer NOT NULL DEFAULT 60,
  late_threshold_minutes integer NOT NULL DEFAULT 20,
  quote_ttl_seconds integer NOT NULL DEFAULT 900,
  max_offer_rounds integer NOT NULL DEFAULT 5,
  location_min_interval_seconds integer NOT NULL DEFAULT 20,
  location_retention_days integer NOT NULL DEFAULT 30,
  is_active boolean NOT NULL DEFAULT false,
  effective_from timestamptz NOT NULL DEFAULT now(),
  effective_to timestamptz,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (version)
);
GRANT SELECT ON public.delivery_pricing_versions TO authenticated;
GRANT ALL ON public.delivery_pricing_versions TO service_role;
ALTER TABLE public.delivery_pricing_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in users read delivery pricing"
  ON public.delivery_pricing_versions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Super admins manage delivery pricing"
  ON public.delivery_pricing_versions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'super_admin'));
CREATE TRIGGER trg_pricing_versions_updated BEFORE UPDATE ON public.delivery_pricing_versions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.delivery_distance_bands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pricing_version_id uuid NOT NULL REFERENCES public.delivery_pricing_versions(id) ON DELETE CASCADE,
  name text NOT NULL,
  min_km numeric NOT NULL DEFAULT 0,
  max_km numeric,
  base_fee numeric NOT NULL DEFAULT 0,
  per_km_fee numeric NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.delivery_distance_bands TO authenticated;
GRANT ALL ON public.delivery_distance_bands TO service_role;
ALTER TABLE public.delivery_distance_bands ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in users read distance bands"
  ON public.delivery_distance_bands FOR SELECT TO authenticated USING (true);
CREATE POLICY "Super admins manage distance bands"
  ON public.delivery_distance_bands FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'super_admin'));
CREATE TRIGGER trg_distance_bands_updated BEFORE UPDATE ON public.delivery_distance_bands
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.delivery_peak_windows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pricing_version_id uuid NOT NULL REFERENCES public.delivery_pricing_versions(id) ON DELETE CASCADE,
  label text,
  days integer[] NOT NULL DEFAULT '{0,1,2,3,4,5,6}',
  start_time time NOT NULL,
  end_time time NOT NULL,
  surcharge_percent numeric NOT NULL DEFAULT 0,
  rider_percent numeric,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.delivery_peak_windows TO authenticated;
GRANT ALL ON public.delivery_peak_windows TO service_role;
ALTER TABLE public.delivery_peak_windows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in users read peak windows"
  ON public.delivery_peak_windows FOR SELECT TO authenticated USING (true);
CREATE POLICY "Super admins manage peak windows"
  ON public.delivery_peak_windows FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'super_admin'));
CREATE TRIGGER trg_peak_windows_updated BEFORE UPDATE ON public.delivery_peak_windows
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5. DELIVERY QUOTES ----------------------------------------------
CREATE TABLE IF NOT EXISTS public.delivery_quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  address_id uuid REFERENCES public.addresses(id) ON DELETE SET NULL,
  pricing_version_id uuid REFERENCES public.delivery_pricing_versions(id),
  band_id uuid REFERENCES public.delivery_distance_bands(id),
  zone_id uuid REFERENCES public.delivery_zones(id),
  pickup_latitude numeric,
  pickup_longitude numeric,
  dropoff_latitude numeric,
  dropoff_longitude numeric,
  distance_meters integer,
  duration_seconds integer,
  routing_provider text,
  route_calculated_at timestamptz,
  base_amount numeric NOT NULL DEFAULT 0,
  distance_amount numeric NOT NULL DEFAULT 0,
  peak_surcharge numeric NOT NULL DEFAULT 0,
  priority_amount numeric NOT NULL DEFAULT 0,
  emergency_amount numeric NOT NULL DEFAULT 0,
  total_fee numeric NOT NULL DEFAULT 0,
  is_peak boolean NOT NULL DEFAULT false,
  is_priority boolean NOT NULL DEFAULT false,
  is_emergency boolean NOT NULL DEFAULT false,
  rider_percent numeric NOT NULL,
  platform_percent numeric NOT NULL,
  rider_amount numeric NOT NULL DEFAULT 0,
  platform_amount numeric NOT NULL DEFAULT 0,
  rule text,
  status text NOT NULL DEFAULT 'active',
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_delivery_quotes_customer ON public.delivery_quotes(customer_id, created_at DESC);
GRANT SELECT ON public.delivery_quotes TO authenticated;
GRANT ALL ON public.delivery_quotes TO service_role;
ALTER TABLE public.delivery_quotes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Customers read their own delivery quotes"
  ON public.delivery_quotes FOR SELECT TO authenticated
  USING (customer_id = auth.uid() OR public.is_staff(auth.uid()));

-- 6. DELIVERY STATUS HISTORY --------------------------------------
CREATE TABLE IF NOT EXISTS public.delivery_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id uuid NOT NULL REFERENCES public.deliveries(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE,
  previous_status text,
  new_status text NOT NULL,
  actor_id uuid,
  actor_role text,
  reason text,
  latitude numeric,
  longitude numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_delivery_history_delivery ON public.delivery_status_history(delivery_id, created_at);
GRANT SELECT ON public.delivery_status_history TO authenticated;
GRANT ALL ON public.delivery_status_history TO service_role;
ALTER TABLE public.delivery_status_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Parties read delivery history"
  ON public.delivery_status_history FOR SELECT TO authenticated
  USING (
    public.is_staff(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.deliveries d
      LEFT JOIN public.orders o ON o.id = d.order_id
      LEFT JOIN public.order_fulfillments f ON f.id = d.fulfillment_id
      WHERE d.id = delivery_status_history.delivery_id
        AND (d.rider_id = auth.uid() OR o.customer_id = auth.uid() OR f.seller_id = auth.uid())
    )
  );

-- 7. ASSIGNMENT HISTORY -------------------------------------------
CREATE TABLE IF NOT EXISTS public.delivery_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id uuid NOT NULL REFERENCES public.deliveries(id) ON DELETE CASCADE,
  rider_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  offer_round integer NOT NULL DEFAULT 1,
  kind text NOT NULL DEFAULT 'auto_offer',
  outcome text NOT NULL DEFAULT 'offered',
  reason text,
  score numeric,
  pickup_distance_km numeric,
  assigned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  offered_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_delivery_assignments_delivery ON public.delivery_assignments(delivery_id, created_at);
GRANT SELECT ON public.delivery_assignments TO authenticated;
GRANT ALL ON public.delivery_assignments TO service_role;
ALTER TABLE public.delivery_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Riders and staff read assignment history"
  ON public.delivery_assignments FOR SELECT TO authenticated
  USING (rider_id = auth.uid() OR public.is_staff(auth.uid()));

-- 8. RIDER LOCATION RECORDS ---------------------------------------
CREATE TABLE IF NOT EXISTS public.rider_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rider_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  delivery_id uuid REFERENCES public.deliveries(id) ON DELETE CASCADE,
  latitude numeric NOT NULL,
  longitude numeric NOT NULL,
  accuracy numeric,
  speed_kmh numeric,
  recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rider_locations_rider ON public.rider_locations(rider_id, recorded_at DESC);
GRANT SELECT ON public.rider_locations TO authenticated;
GRANT ALL ON public.rider_locations TO service_role;
ALTER TABLE public.rider_locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Riders and staff read rider locations"
  ON public.rider_locations FOR SELECT TO authenticated
  USING (rider_id = auth.uid() OR public.is_staff(auth.uid()));

-- 9. DELIVERY + OFFER + RIDER PROFILE COLUMNS ---------------------
ALTER TABLE public.deliveries
  ADD COLUMN IF NOT EXISTS fulfillment_id uuid REFERENCES public.order_fulfillments(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS quote_id uuid REFERENCES public.delivery_quotes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS store_id uuid REFERENCES public.stores(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS pickup_latitude numeric,
  ADD COLUMN IF NOT EXISTS pickup_longitude numeric,
  ADD COLUMN IF NOT EXISTS dropoff_latitude numeric,
  ADD COLUMN IF NOT EXISTS dropoff_longitude numeric,
  ADD COLUMN IF NOT EXISTS distance_meters integer,
  ADD COLUMN IF NOT EXISTS duration_seconds integer,
  ADD COLUMN IF NOT EXISTS routing_provider text,
  ADD COLUMN IF NOT EXISTS route_calculated_at timestamptz,
  ADD COLUMN IF NOT EXISTS pricing_version_id uuid REFERENCES public.delivery_pricing_versions(id),
  ADD COLUMN IF NOT EXISTS rider_percent numeric,
  ADD COLUMN IF NOT EXISTS platform_percent numeric,
  ADD COLUMN IF NOT EXISTS priority_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_priority boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS eta_at timestamptz,
  ADD COLUMN IF NOT EXISTS eta_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS expected_pickup_at timestamptz,
  ADD COLUMN IF NOT EXISTS milestone text,
  ADD COLUMN IF NOT EXISTS failure_reason text,
  ADD COLUMN IF NOT EXISTS failure_note text,
  ADD COLUMN IF NOT EXISTS attempt_number integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS location_accuracy numeric,
  ADD COLUMN IF NOT EXISTS offer_round integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_dispatch_at timestamptz,
  ADD COLUMN IF NOT EXISTS code_attempts integer NOT NULL DEFAULT 0;

ALTER TABLE public.delivery_offers
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS decline_reason text,
  ADD COLUMN IF NOT EXISTS offer_round integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS pickup_distance_km numeric;

ALTER TABLE public.rider_profiles
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'offline',
  ADD COLUMN IF NOT EXISTS vehicle_plate text,
  ADD COLUMN IF NOT EXISTS vehicle_capacity integer,
  ADD COLUMN IF NOT EXISTS vehicle_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS is_suspended boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS latitude numeric,
  ADD COLUMN IF NOT EXISTS longitude numeric,
  ADD COLUMN IF NOT EXISTS location_accuracy numeric,
  ADD COLUMN IF NOT EXISTS location_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS service_state text,
  ADD COLUMN IF NOT EXISTS break_until timestamptz;

-- 10. GEO + PRICING HELPERS ---------------------------------------
CREATE OR REPLACE FUNCTION public.geo_distance_km(
  _lat1 numeric, _lng1 numeric, _lat2 numeric, _lng2 numeric)
RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN _lat1 IS NULL OR _lng1 IS NULL OR _lat2 IS NULL OR _lng2 IS NULL THEN NULL
    ELSE ROUND((
      6371 * 2 * asin(sqrt(
        power(sin(radians(_lat2 - _lat1) / 2), 2) +
        cos(radians(_lat1)) * cos(radians(_lat2)) *
        power(sin(radians(_lng2 - _lng1) / 2), 2)
      ))
    )::numeric, 3)
  END
$$;

CREATE OR REPLACE FUNCTION public.active_delivery_pricing()
RETURNS public.delivery_pricing_versions
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT * FROM public.delivery_pricing_versions
   WHERE is_active AND effective_from <= now()
     AND (effective_to IS NULL OR effective_to > now())
   ORDER BY effective_from DESC, version DESC LIMIT 1
$$;

-- peak state derived from trusted server time in Africa/Lagos
CREATE OR REPLACE FUNCTION public.peak_state()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _p public.delivery_pricing_versions; _w public.delivery_peak_windows;
  _now timestamptz := now(); _t time; _dow integer;
BEGIN
  _p := public.active_delivery_pricing();
  IF _p.id IS NULL THEN RETURN jsonb_build_object('is_peak', false); END IF;
  _t := (_now AT TIME ZONE 'Africa/Lagos')::time;
  _dow := extract(dow from (_now AT TIME ZONE 'Africa/Lagos'))::integer;
  SELECT * INTO _w FROM public.delivery_peak_windows
   WHERE pricing_version_id = _p.id AND is_active AND _dow = ANY(days)
     AND ((start_time <= end_time AND _t >= start_time AND _t < end_time)
       OR (start_time > end_time AND (_t >= start_time OR _t < end_time)))
   ORDER BY surcharge_percent DESC LIMIT 1;
  IF _w.id IS NULL THEN RETURN jsonb_build_object('is_peak', false); END IF;
  RETURN jsonb_build_object('is_peak', true, 'window_id', _w.id,
    'surcharge_percent', COALESCE(_w.surcharge_percent, _p.peak_surcharge_percent),
    'rider_percent', COALESCE(_w.rider_percent, _p.peak_rider_percent));
END $$;

CREATE OR REPLACE FUNCTION public.is_peak_now()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT COALESCE((public.peak_state()->>'is_peak')::boolean, false)
$$;

-- zone lookup: coordinates first (radius), then city/state, all active only
CREATE OR REPLACE FUNCTION public.find_delivery_zone(
  _lat numeric, _lng numeric, _city text DEFAULT NULL, _state text DEFAULT NULL)
RETURNS public.delivery_zones
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _z public.delivery_zones;
BEGIN
  IF _lat IS NOT NULL AND _lng IS NOT NULL THEN
    SELECT * INTO _z FROM public.delivery_zones
     WHERE is_active AND center_latitude IS NOT NULL AND center_longitude IS NOT NULL
       AND radius_km IS NOT NULL
       AND public.geo_distance_km(center_latitude, center_longitude, _lat, _lng) <= radius_km
     ORDER BY radius_km ASC LIMIT 1;
    IF _z.id IS NOT NULL THEN RETURN _z; END IF;
  END IF;
  SELECT * INTO _z FROM public.delivery_zones
   WHERE is_active
     AND (city IS NULL OR lower(city) = lower(COALESCE(_city,'')))
     AND (state IS NULL OR lower(state) = lower(COALESCE(_state,'')))
   ORDER BY (city IS NOT NULL) DESC, (state IS NOT NULL) DESC LIMIT 1;
  RETURN _z;
END $$;

-- 11. QUOTE CREATION ----------------------------------------------
-- Distance/duration may come from the platform's routing provider, but the
-- server validates them against the real straight-line distance between the
-- two stored coordinates and falls back to that geographic distance.
CREATE OR REPLACE FUNCTION public.create_delivery_quote(
  _store_id uuid,
  _address_id uuid,
  _distance_meters integer DEFAULT NULL,
  _duration_seconds integer DEFAULT NULL,
  _provider text DEFAULT NULL,
  _priority boolean DEFAULT false,
  _is_emergency boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  _uid uuid := auth.uid(); _s public.stores; _a public.addresses;
  _p public.delivery_pricing_versions; _z public.delivery_zones;
  _band public.delivery_distance_bands; _peak jsonb;
  _straight numeric; _km numeric; _dur integer; _prov text;
  _base numeric; _dist numeric; _sub numeric; _peak_amt numeric := 0;
  _prio numeric := 0; _emerg numeric := 0; _fee numeric;
  _rider_pct numeric; _plat_pct numeric; _qid uuid; _rule text;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO _s FROM public.stores WHERE id = _store_id;
  IF _s.id IS NULL THEN RAISE EXCEPTION 'Store not found'; END IF;
  SELECT * INTO _a FROM public.addresses WHERE id = _address_id AND user_id = _uid;
  IF _a.id IS NULL THEN RAISE EXCEPTION 'Delivery address not found'; END IF;

  _p := public.active_delivery_pricing();
  IF _p.id IS NULL OR NOT _p.delivery_enabled THEN
    RETURN jsonb_build_object('ok', false, 'code', 'PRICING_NOT_CONFIGURED',
      'reason', 'Delivery pricing has not been configured yet.');
  END IF;

  IF _s.latitude IS NULL OR _s.longitude IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'STORE_LOCATION_MISSING',
      'reason', _s.name || ' has not set a verified pickup location yet.');
  END IF;
  IF _a.latitude IS NULL OR _a.longitude IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'ADDRESS_LOCATION_MISSING',
      'reason', 'We need the map location of your delivery address to price delivery.');
  END IF;

  _z := public.find_delivery_zone(_a.latitude, _a.longitude, _a.city, _a.state);
  IF _z.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'OUTSIDE_SERVICE_AREA',
      'reason', 'Medra delivery is not available at this address yet.');
  END IF;

  _straight := public.geo_distance_km(_s.latitude, _s.longitude, _a.latitude, _a.longitude);
  IF _distance_meters IS NOT NULL AND _distance_meters > 0
     AND (_distance_meters / 1000.0) >= _straight * 0.95
     AND (_distance_meters / 1000.0) <= GREATEST(_straight * 4, _straight + 5) THEN
    _km := ROUND((_distance_meters / 1000.0)::numeric, 3);
    _dur := _duration_seconds;
    _prov := COALESCE(_provider, 'routing');
  ELSE
    _km := _straight;
    _dur := _duration_seconds;
    _prov := 'straight_line';
  END IF;

  SELECT * INTO _band FROM public.delivery_distance_bands
   WHERE pricing_version_id = _p.id AND is_active
     AND _km >= min_km AND (max_km IS NULL OR _km < max_km)
   ORDER BY min_km DESC LIMIT 1;

  _base := COALESCE(_band.base_fee, COALESCE(_z.base_fee, _p.base_fee));
  _dist := ROUND(_km * COALESCE(_band.per_km_fee, COALESCE(_z.per_km_fee, _p.per_km_fee)), 2);
  _sub := _base + _dist;

  _peak := public.peak_state();
  IF COALESCE((_peak->>'is_peak')::boolean, false) THEN
    _peak_amt := ROUND(_sub * COALESCE((_peak->>'surcharge_percent')::numeric, _p.peak_surcharge_percent) / 100, 2);
    _rider_pct := COALESCE((_peak->>'rider_percent')::numeric, _p.peak_rider_percent);
  ELSE
    _rider_pct := _p.regular_rider_percent;
  END IF;
  _plat_pct := 100 - _rider_pct;

  IF _priority THEN
    IF NOT _p.priority_enabled THEN
      RETURN jsonb_build_object('ok', false, 'code', 'PRIORITY_UNAVAILABLE',
        'reason', 'Priority delivery is not available right now.');
    END IF;
    _prio := _p.priority_fee;
  END IF;
  IF _is_emergency THEN _emerg := _p.emergency_fee; END IF;

  _fee := _sub + _peak_amt + _prio + _emerg;
  _fee := GREATEST(_fee, COALESCE(_z.min_fee, _p.min_fee));
  IF _p.max_fee IS NOT NULL THEN _fee := LEAST(_fee, _p.max_fee); END IF;
  _fee := ROUND(_fee, 2);

  _rule := 'pricing_v' || _p.version || '_' ||
    CASE WHEN COALESCE((_peak->>'is_peak')::boolean,false) THEN 'peak' ELSE 'regular' END ||
    '_' || _rider_pct || '_' || _plat_pct;

  INSERT INTO public.delivery_quotes (
    customer_id, store_id, address_id, pricing_version_id, band_id, zone_id,
    pickup_latitude, pickup_longitude, dropoff_latitude, dropoff_longitude,
    distance_meters, duration_seconds, routing_provider, route_calculated_at,
    base_amount, distance_amount, peak_surcharge, priority_amount, emergency_amount,
    total_fee, is_peak, is_priority, is_emergency, rider_percent, platform_percent,
    rider_amount, platform_amount, rule, expires_at)
  VALUES (
    _uid, _store_id, _address_id, _p.id, _band.id, _z.id,
    _s.latitude, _s.longitude, _a.latitude, _a.longitude,
    ROUND(_km * 1000)::integer, _dur, _prov, now(),
    _base, _dist, _peak_amt, _prio, _emerg,
    _fee, COALESCE((_peak->>'is_peak')::boolean,false), _priority, _is_emergency,
    _rider_pct, _plat_pct,
    ROUND(_fee * _rider_pct / 100, 2), ROUND(_fee * _plat_pct / 100, 2), _rule,
    now() + make_interval(secs => _p.quote_ttl_seconds))
  RETURNING id INTO _qid;

  RETURN jsonb_build_object(
    'ok', true, 'quote_id', _qid, 'store_id', _store_id, 'store_name', _s.name,
    'zone', _z.name, 'band', _band.name, 'distance_km', _km,
    'duration_seconds', _dur, 'routing_provider', _prov,
    'base_amount', _base, 'distance_amount', _dist, 'peak_surcharge', _peak_amt,
    'priority_amount', _prio, 'emergency_amount', _emerg, 'total_fee', _fee,
    'is_peak', COALESCE((_peak->>'is_peak')::boolean,false), 'is_priority', _priority,
    'rider_percent', _rider_pct, 'platform_percent', _plat_pct, 'rule', _rule,
    'expires_at', (now() + make_interval(secs => _p.quote_ttl_seconds)));
END $$;

-- 12. DELIVERY STATUS HISTORY TRIGGER ------------------------------
CREATE OR REPLACE FUNCTION public.record_delivery_status_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.delivery_status_history (
      delivery_id, order_id, previous_status, new_status, actor_id, actor_role,
      latitude, longitude)
    VALUES (NEW.id, NEW.order_id,
      CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.status END,
      NEW.status, auth.uid(), public.current_actor_role(),
      NEW.rider_latitude, NEW.rider_longitude);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_delivery_status_history ON public.deliveries;
CREATE TRIGGER trg_delivery_status_history
  AFTER INSERT OR UPDATE OF status ON public.deliveries
  FOR EACH ROW EXECUTE FUNCTION public.record_delivery_status_change();

-- 13. SECURE RIDER LOCATION SHARING -------------------------------
CREATE OR REPLACE FUNCTION public.rider_share_location(
  _lat numeric, _lng numeric, _accuracy numeric DEFAULT NULL,
  _delivery_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _uid uuid := auth.uid(); _p public.delivery_pricing_versions;
  _last timestamptz; _stored boolean := false;
BEGIN
  IF _uid IS NULL OR NOT public.has_role(_uid,'rider') THEN RAISE EXCEPTION 'Riders only'; END IF;
  IF _lat IS NULL OR _lng IS NULL THEN RAISE EXCEPTION 'Location required'; END IF;

  IF _delivery_id IS NOT NULL THEN
    UPDATE public.deliveries
       SET rider_latitude = _lat, rider_longitude = _lng, location_accuracy = _accuracy,
           location_updated_at = now()
     WHERE id = _delivery_id AND rider_id = _uid
       AND status NOT IN ('delivered','completed','cancelled','failed');
    IF NOT FOUND THEN RAISE EXCEPTION 'Not permitted'; END IF;
  END IF;

  INSERT INTO public.rider_profiles (user_id, latitude, longitude, location_accuracy, location_updated_at)
  VALUES (_uid, _lat, _lng, _accuracy, now())
  ON CONFLICT (user_id) DO UPDATE
    SET latitude = _lat, longitude = _lng, location_accuracy = _accuracy, location_updated_at = now();

  -- historical persistence only at configured intervals, never every second
  _p := public.active_delivery_pricing();
  SELECT max(recorded_at) INTO _last FROM public.rider_locations WHERE rider_id = _uid;
  IF _last IS NULL OR _last < now() - make_interval(secs => COALESCE(_p.location_min_interval_seconds, 20)) THEN
    INSERT INTO public.rider_locations (rider_id, delivery_id, latitude, longitude, accuracy)
    VALUES (_uid, _delivery_id, _lat, _lng, _accuracy);
    _stored := true;
  END IF;
  RETURN jsonb_build_object('ok', true, 'persisted', _stored);
END $$;

CREATE OR REPLACE FUNCTION public.purge_rider_locations()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _p public.delivery_pricing_versions; _n integer;
BEGIN
  _p := public.active_delivery_pricing();
  DELETE FROM public.rider_locations
   WHERE recorded_at < now() - make_interval(days => COALESCE(_p.location_retention_days, 30));
  GET DIAGNOSTICS _n = ROW_COUNT;
  RETURN _n;
END $$;

-- 14. LOCK DOWN EXECUTE -------------------------------------------
REVOKE ALL ON FUNCTION public.create_delivery_quote(uuid, uuid, integer, integer, text, boolean, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_delivery_quote(uuid, uuid, integer, integer, text, boolean, boolean) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.rider_share_location(numeric, numeric, numeric, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rider_share_location(numeric, numeric, numeric, uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.purge_rider_locations() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.purge_rider_locations() TO service_role;
REVOKE ALL ON FUNCTION public.find_delivery_zone(numeric, numeric, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.find_delivery_zone(numeric, numeric, text, text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.peak_state() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.peak_state() TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.active_delivery_pricing() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.active_delivery_pricing() TO authenticated, service_role;