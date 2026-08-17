-- Launch delivery configuration (platform config, not demo data)
INSERT INTO public.delivery_pricing_versions (
  version, label, delivery_enabled, base_fee, per_km_fee, min_fee, max_fee,
  peak_surcharge_percent, priority_enabled, priority_fee, emergency_fee,
  regular_rider_percent, peak_rider_percent, is_active
)
SELECT 1, 'Launch pricing v1', true, 500, 120, 600, 8000,
       20, true, 400, 700, 85, 90, true
WHERE NOT EXISTS (SELECT 1 FROM public.delivery_pricing_versions);

INSERT INTO public.delivery_distance_bands (pricing_version_id, name, min_km, max_km, base_fee, per_km_fee)
SELECT v.id, b.name, b.min_km, b.max_km, b.base_fee, b.per_km_fee
FROM public.delivery_pricing_versions v
CROSS JOIN (VALUES
  ('0-3 km', 0::numeric, 3::numeric, 500::numeric, 0::numeric),
  ('3-7 km', 3, 7, 700, 100),
  ('7-15 km', 7, 15, 900, 130),
  ('15 km+', 15, NULL, 1200, 150)
) AS b(name, min_km, max_km, base_fee, per_km_fee)
WHERE v.version = 1
  AND NOT EXISTS (SELECT 1 FROM public.delivery_distance_bands d WHERE d.pricing_version_id = v.id);

INSERT INTO public.delivery_peak_windows (pricing_version_id, label, days, start_time, end_time, surcharge_percent, rider_percent)
SELECT v.id, 'Evening peak', '{1,2,3,4,5}', '17:00', '20:00', 20, 90
FROM public.delivery_pricing_versions v
WHERE v.version = 1
  AND NOT EXISTS (SELECT 1 FROM public.delivery_peak_windows w WHERE w.pricing_version_id = v.id);

INSERT INTO public.delivery_zones (name, city, state, base_fee, per_km_fee, min_fee, center_latitude, center_longitude, radius_km)
SELECT 'Lagos Mainland', 'Lagos', 'Lagos', 500, 120, 600, 6.5244, 3.3792, 45
WHERE NOT EXISTS (SELECT 1 FROM public.delivery_zones);

UPDATE public.platform_settings
   SET value = jsonb_set(value, '{configured}', 'true'::jsonb)
 WHERE key = 'delivery_pricing';

-- Remove stale 2-argument overload that could make rider offer responses ambiguous
DROP FUNCTION IF EXISTS public.rider_respond_to_offer(uuid, boolean);