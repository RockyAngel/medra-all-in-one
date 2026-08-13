-- ============ event-driven notifications ============
CREATE OR REPLACE FUNCTION public.notify_order_status_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _o record;
BEGIN
  SELECT o.id, o.order_number, o.customer_id INTO _o FROM public.orders o WHERE o.id = NEW.order_id;
  IF _o.id IS NULL THEN RETURN NEW; END IF;

  PERFORM public.create_notification(
    _o.customer_id, 'order.' || NEW.new_status::text,
    'Order ' || _o.order_number,
    'Status: ' || initcap(replace(NEW.new_status::text,'_',' ')),
    '/orders/' || _o.id::text, 'order',
    CASE WHEN NEW.new_status::text IN ('delivery_failed','payment_failed','disputed') THEN 'high'::public.support_priority
         ELSE 'normal'::public.support_priority END,
    'order', _o.id, 'order.status:' || NEW.id::text, false);

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS notify_order_status_change ON public.order_status_history;
CREATE TRIGGER notify_order_status_change
AFTER INSERT ON public.order_status_history
FOR EACH ROW EXECUTE FUNCTION public.notify_order_status_change();

CREATE OR REPLACE FUNCTION public.notify_fulfillment_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _num text;
BEGIN
  SELECT order_number INTO _num FROM public.orders WHERE id = NEW.order_id;
  IF TG_OP = 'INSERT' THEN
    PERFORM public.create_notification(NEW.seller_id, 'order.new', 'New order to review',
      'Order ' || coalesce(_num,'') || ' is waiting for your response.',
      '/seller?tab=orders', 'order', 'high', 'order_fulfillment', NEW.id,
      'fulfillment.new:' || NEW.id::text, false);
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM public.create_notification(NEW.seller_id, 'order.fulfillment.' || NEW.status::text,
      'Order ' || coalesce(_num,''),
      'Fulfillment status: ' || initcap(replace(NEW.status::text,'_',' ')),
      '/seller?tab=orders', 'order', 'normal', 'order_fulfillment', NEW.id,
      'fulfillment.status:' || NEW.id::text || ':' || NEW.status::text, false);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS notify_fulfillment_change ON public.order_fulfillments;
CREATE TRIGGER notify_fulfillment_change
AFTER INSERT OR UPDATE OF status ON public.order_fulfillments
FOR EACH ROW EXECUTE FUNCTION public.notify_fulfillment_change();

CREATE OR REPLACE FUNCTION public.notify_delivery_assignment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _o record;
BEGIN
  IF NEW.rider_id IS NOT NULL AND NEW.rider_id IS DISTINCT FROM OLD.rider_id THEN
    SELECT o.id, o.order_number, o.customer_id INTO _o FROM public.orders o WHERE o.id = NEW.order_id;
    PERFORM public.create_notification(_o.customer_id, 'delivery.rider_assigned',
      'Rider assigned', 'A rider is handling order ' || coalesce(_o.order_number,'') || '.',
      '/orders/' || _o.id::text, 'delivery', 'normal', 'delivery', NEW.id,
      'delivery.assigned:' || NEW.id::text || ':' || NEW.rider_id::text, false);
    PERFORM public.create_notification(NEW.rider_id, 'delivery.assigned',
      'Delivery assigned', 'You have a new delivery to complete.',
      '/rider', 'delivery', 'high', 'delivery', NEW.id,
      'delivery.rider:' || NEW.id::text || ':' || NEW.rider_id::text, false);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS notify_delivery_assignment ON public.deliveries;
CREATE TRIGGER notify_delivery_assignment
AFTER UPDATE OF rider_id ON public.deliveries
FOR EACH ROW EXECUTE FUNCTION public.notify_delivery_assignment();

-- ============ SOS -> critical support conversation ============
CREATE OR REPLACE FUNCTION public.sos_open_support_conversation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _ticket uuid;
BEGIN
  INSERT INTO public.support_tickets (user_id, delivery_id, sos_incident_id, category, subject,
    requester_role, status, priority, is_sos, last_activity_at, reference)
  VALUES (NEW.rider_id, NEW.delivery_id, NEW.id, 'sos',
    'SOS: ' || initcap(replace(coalesce(NEW.kind,'incident'),'_',' ')),
    'rider', 'open', 'critical', true, now(),
    'SOS-' || upper(substr(replace(NEW.id::text,'-',''),1,8)))
  RETURNING id INTO _ticket;

  IF coalesce(btrim(NEW.note),'') <> '' THEN
    INSERT INTO public.support_messages (ticket_id, sender_id, sender_role, body)
    VALUES (_ticket, NEW.rider_id, 'rider', NEW.note);
  END IF;

  INSERT INTO public.support_events (ticket_id, actor_id, actor_role, action, to_value)
  VALUES (_ticket, NEW.rider_id, 'rider', 'sos_raised', NEW.kind);

  PERFORM public.notify_support_staff('SOS raised by a rider',
    'Immediate attention required: ' || initcap(replace(coalesce(NEW.kind,'incident'),'_',' ')),
    '/admin?tab=support&ticket=' || _ticket::text, 'critical', _ticket, 'sos:' || NEW.id::text);

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS sos_open_support_conversation ON public.sos_incidents;
CREATE TRIGGER sos_open_support_conversation
AFTER INSERT ON public.sos_incidents
FOR EACH ROW EXECUTE FUNCTION public.sos_open_support_conversation();

-- ============ notification templates ============
INSERT INTO public.notification_templates (key, channel, event_type, category, subject, body, variables) VALUES
 ('welcome','email','account.created','account','Welcome to Medra','Hi {{first_name}}, welcome to Medra. Shop better, live better.','{first_name}'),
 ('order_confirmation','email','order.paid','order','Order {{order_number}} confirmed','Hi {{first_name}}, we received your payment of {{amount}} for order {{order_number}}.','{first_name,order_number,amount}'),
 ('payment_receipt','email','payment.succeeded','payment','Your Medra receipt','Payment of {{amount}} for order {{order_number}} was successful.','{order_number,amount}'),
 ('refund_update','email','refund.updated','refund','Refund update','Your refund request for order {{order_number}} is now {{status}}.','{order_number,status}'),
 ('payout_update','email','payout.updated','payout','Payout update','Your payout of {{amount}} is now {{status}}.','{amount,status}'),
 ('membership_update','email','membership.updated','membership','Membership update','Your {{plan_name}} membership is now {{status}}.','{plan_name,status}'),
 ('support_reply','email','support.reply','support','Support replied to {{reference}}','Our team replied to your conversation {{reference}}.','{reference}'),
 ('security_alert','email','security.alert','security','Security alert on your Medra account','{{status}} on {{date}}. If this was not you, contact support immediately.','{status,date}')
ON CONFLICT (key, channel, language) DO NOTHING;

-- ============ attachment access rules ============
DROP POLICY IF EXISTS "support attachments own upload" ON storage.objects;
CREATE POLICY "support attachments own upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'support-attachments' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "support attachments read" ON storage.objects;
CREATE POLICY "support attachments read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'support-attachments' AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.has_permission(auth.uid(), 'support.view')
    OR EXISTS (SELECT 1 FROM public.support_messages m
                JOIN public.support_tickets t ON t.id = m.ticket_id
               WHERE m.attachment_path = storage.objects.name AND t.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.conversation_messages cm
                JOIN public.conversations c ON c.id = cm.conversation_id
               WHERE cm.attachment_path = storage.objects.name
                 AND (c.customer_id = auth.uid() OR c.seller_id = auth.uid() OR c.rider_id = auth.uid()))
  ));