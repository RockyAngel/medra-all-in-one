CREATE OR REPLACE FUNCTION public.notify_order_status_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _o record;
BEGIN
  SELECT o.id, o.order_number, o.customer_id INTO _o FROM public.orders o WHERE o.id = NEW.order_id;
  IF _o.id IS NULL THEN RETURN NEW; END IF;

  PERFORM public.create_notification(
    _o.customer_id, 'order.' || NEW.status::text,
    'Order ' || _o.order_number,
    'Status: ' || initcap(replace(NEW.status::text,'_',' ')),
    '/orders/' || _o.id::text, 'order',
    CASE WHEN NEW.status::text IN ('delivery_failed','payment_failed','disputed') THEN 'high'::public.support_priority
         ELSE 'normal'::public.support_priority END,
    'order', _o.id, 'order.status:' || NEW.id::text, false);

  RETURN NEW;
END $function$;