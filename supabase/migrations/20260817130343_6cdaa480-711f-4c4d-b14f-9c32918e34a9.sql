CREATE OR REPLACE FUNCTION public.fill_delivery_split_percent()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF COALESCE(NEW.fee_total, 0) > 0 THEN
    IF NEW.rider_percent IS NULL AND NEW.rider_amount IS NOT NULL THEN
      NEW.rider_percent := ROUND(NEW.rider_amount / NEW.fee_total * 100, 2);
    END IF;
    IF NEW.platform_percent IS NULL AND NEW.platform_amount IS NOT NULL THEN
      NEW.platform_percent := ROUND(NEW.platform_amount / NEW.fee_total * 100, 2);
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS fill_delivery_split_percent ON public.deliveries;
CREATE TRIGGER fill_delivery_split_percent
BEFORE INSERT OR UPDATE ON public.deliveries
FOR EACH ROW EXECUTE FUNCTION public.fill_delivery_split_percent();

UPDATE public.deliveries
   SET rider_percent = ROUND(rider_amount / fee_total * 100, 2)
 WHERE rider_percent IS NULL AND fee_total > 0 AND rider_amount IS NOT NULL;
UPDATE public.deliveries
   SET platform_percent = ROUND(platform_amount / fee_total * 100, 2)
 WHERE platform_percent IS NULL AND fee_total > 0 AND platform_amount IS NOT NULL;