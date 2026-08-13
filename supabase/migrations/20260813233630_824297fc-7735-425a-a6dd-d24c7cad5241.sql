-- ============ notification creator (idempotent, preference aware) ============
CREATE OR REPLACE FUNCTION public.create_notification(
  _user_id uuid, _event_type text, _title text, _body text,
  _link text DEFAULT NULL, _category text DEFAULT 'account',
  _priority public.support_priority DEFAULT 'normal',
  _entity_type text DEFAULT NULL, _entity_id uuid DEFAULT NULL,
  _event_id text DEFAULT NULL, _mandatory boolean DEFAULT false,
  _metadata jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _pref public.notification_preferences; _id uuid; _event text;
BEGIN
  IF _user_id IS NULL THEN RETURN NULL; END IF;
  _event := coalesce(_event_id, _event_type || ':' || coalesce(_entity_id::text, gen_random_uuid()::text));

  SELECT * INTO _pref FROM public.notification_preferences
   WHERE user_id = _user_id AND category = _category;

  IF NOT _mandatory AND _pref.id IS NOT NULL AND _pref.in_app = false THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.notifications (user_id, title, body, link, event_id, event_type, category,
                                    priority, entity_type, entity_id, is_mandatory, metadata)
  VALUES (_user_id, _title, _body, _link, _event, _event_type, _category,
          _priority, _entity_type, _entity_id, _mandatory, coalesce(_metadata,'{}'::jsonb))
  ON CONFLICT (user_id, event_id) WHERE event_id IS NOT NULL DO NOTHING
  RETURNING id INTO _id;

  IF _id IS NULL THEN RETURN NULL; END IF;

  INSERT INTO public.notification_deliveries (notification_id, user_id, channel, status, sent_at)
  VALUES (_id, _user_id, 'in_app', 'sent', now());

  -- other channels are only queued; nothing is marked delivered without a provider
  IF _mandatory OR coalesce(_pref.email, false) THEN
    INSERT INTO public.notification_deliveries (notification_id, user_id, channel, status, queued_at)
    VALUES (_id, _user_id, 'email', 'queued', now());
  END IF;
  IF coalesce(_pref.sms, false) AND _priority IN ('urgent','critical') THEN
    INSERT INTO public.notification_deliveries (notification_id, user_id, channel, status, queued_at)
    VALUES (_id, _user_id, 'sms', 'queued', now());
  END IF;
  IF coalesce(_pref.push, false) THEN
    INSERT INTO public.notification_deliveries (notification_id, user_id, channel, status, queued_at)
    VALUES (_id, _user_id, 'push', 'queued', now());
  END IF;

  RETURN _id;
END $$;
REVOKE ALL ON FUNCTION public.create_notification(uuid,text,text,text,text,text,public.support_priority,text,uuid,text,boolean,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_notification(uuid,text,text,text,text,text,public.support_priority,text,uuid,text,boolean,jsonb) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.notify_support_staff(
  _title text, _body text, _link text, _priority public.support_priority, _entity_id uuid, _event_id text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _r record;
BEGIN
  FOR _r IN SELECT DISTINCT ur.user_id FROM public.user_roles ur
             WHERE ur.role IN ('admin','super_admin')
               AND public.has_permission(ur.user_id, 'support.view') LOOP
    PERFORM public.create_notification(_r.user_id, 'support.activity', _title, _body, _link,
      'support', _priority, 'support_ticket', _entity_id,
      _event_id || ':' || _r.user_id::text, _priority IN ('urgent','critical'));
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.notify_support_staff(text,text,text,public.support_priority,uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.notify_support_staff(text,text,text,public.support_priority,uuid,text) TO authenticated, service_role;

-- ============ open support ticket ============
CREATE OR REPLACE FUNCTION public.open_support_ticket(
  _category text, _subject text, _message text,
  _order_id uuid DEFAULT NULL, _delivery_id uuid DEFAULT NULL, _fulfillment_id uuid DEFAULT NULL,
  _payment_id uuid DEFAULT NULL, _refund_request_id uuid DEFAULT NULL, _payout_request_id uuid DEFAULT NULL,
  _consultation_id uuid DEFAULT NULL, _sos_incident_id uuid DEFAULT NULL, _store_id uuid DEFAULT NULL,
  _priority public.support_priority DEFAULT 'normal'
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _role text; _ticket uuid; _limit int; _recent int; _prio public.support_priority;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF coalesce(btrim(_message),'') = '' THEN RAISE EXCEPTION 'Message is required'; END IF;

  SELECT coalesce((value->>'tickets_per_hour')::int, 5) INTO _limit
    FROM public.platform_settings WHERE key = 'support_rate_limits';
  SELECT count(*) INTO _recent FROM public.support_tickets
   WHERE user_id = _uid AND created_at > now() - interval '1 hour';
  IF _recent >= coalesce(_limit,5) THEN
    RAISE EXCEPTION 'Too many support requests in the last hour. Please continue in an existing conversation.';
  END IF;

  _role := public.current_actor_role();

  -- users cannot self-assign high priority; the platform derives it from context
  _prio := 'normal';
  IF _sos_incident_id IS NOT NULL THEN _prio := 'critical';
  ELSIF _refund_request_id IS NOT NULL OR _payment_id IS NOT NULL OR _payout_request_id IS NOT NULL THEN _prio := 'high';
  ELSIF _delivery_id IS NOT NULL THEN _prio := 'high';
  ELSIF _category IN ('pharmacy','telehealth') THEN _prio := 'high';
  END IF;
  IF public.is_staff(_uid) AND _priority IS NOT NULL THEN _prio := _priority; END IF;

  -- ownership checks: users may only link their own records
  IF _order_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.orders o WHERE o.id = _order_id
        AND (o.customer_id = _uid OR public.is_staff(_uid))) THEN
    RAISE EXCEPTION 'Order not available';
  END IF;
  IF _delivery_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.deliveries d JOIN public.orders o ON o.id = d.order_id
       WHERE d.id = _delivery_id AND (o.customer_id = _uid OR d.rider_id = _uid OR public.is_staff(_uid))) THEN
    RAISE EXCEPTION 'Delivery not available';
  END IF;

  INSERT INTO public.support_tickets (
    user_id, order_id, delivery_id, fulfillment_id, payment_id, refund_request_id, payout_request_id,
    consultation_id, sos_incident_id, store_id, category, subject, requester_role, status, priority,
    is_sos, last_activity_at, reference)
  VALUES (_uid, _order_id, _delivery_id, _fulfillment_id, _payment_id, _refund_request_id, _payout_request_id,
    _consultation_id, _sos_incident_id, _store_id, _category, coalesce(nullif(btrim(_subject),''), initcap(replace(_category,'_',' '))),
    _role, 'open', _prio, _sos_incident_id IS NOT NULL, now(),
    'SUP-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)))
  RETURNING id INTO _ticket;

  INSERT INTO public.support_messages (ticket_id, sender_id, sender_role, body)
  VALUES (_ticket, _uid, _role, _message);

  INSERT INTO public.support_events (ticket_id, actor_id, actor_role, action, to_value)
  VALUES (_ticket, _uid, _role, 'opened', _prio::text);

  PERFORM public.notify_support_staff(
    CASE WHEN _prio = 'critical' THEN 'Critical support request' ELSE 'New support conversation' END,
    coalesce(_subject, initcap(replace(_category,'_',' '))),
    '/admin?tab=support&ticket=' || _ticket::text, _prio, _ticket, 'support.opened:' || _ticket::text);

  RETURN _ticket;
END $$;
REVOKE ALL ON FUNCTION public.open_support_ticket(text,text,text,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,public.support_priority) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.open_support_ticket(text,text,text,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,public.support_priority) TO authenticated;

-- ============ send support message ============
CREATE OR REPLACE FUNCTION public.send_support_message(
  _ticket_id uuid, _body text, _internal boolean DEFAULT false,
  _attachment_path text DEFAULT NULL, _attachment_name text DEFAULT NULL,
  _attachment_type text DEFAULT NULL, _attachment_size integer DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _t public.support_tickets; _role text; _staff boolean; _mid uuid; _limit int; _recent int;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF coalesce(btrim(_body),'') = '' AND _attachment_path IS NULL THEN RAISE EXCEPTION 'Message is required'; END IF;

  SELECT * INTO _t FROM public.support_tickets WHERE id = _ticket_id;
  IF _t.id IS NULL THEN RAISE EXCEPTION 'Conversation not found'; END IF;

  _staff := public.has_permission(_uid, 'support.respond');
  IF _t.user_id <> _uid AND NOT _staff THEN RAISE EXCEPTION 'Not allowed'; END IF;
  IF _internal AND NOT _staff THEN RAISE EXCEPTION 'Not allowed'; END IF;

  IF _attachment_type IS NOT NULL AND _attachment_type NOT IN
     ('image/png','image/jpeg','image/webp','image/gif','application/pdf') THEN
    RAISE EXCEPTION 'Unsupported attachment type';
  END IF;
  IF coalesce(_attachment_size,0) > 10485760 THEN RAISE EXCEPTION 'Attachment is too large (max 10MB)'; END IF;

  IF NOT _t.is_sos THEN
    SELECT coalesce((value->>'messages_per_minute')::int, 10) INTO _limit
      FROM public.platform_settings WHERE key = 'support_rate_limits';
    SELECT count(*) INTO _recent FROM public.support_messages
     WHERE sender_id = _uid AND created_at > now() - interval '1 minute';
    IF _recent >= coalesce(_limit,10) THEN RAISE EXCEPTION 'You are sending messages too quickly. Please wait a moment.'; END IF;
  END IF;

  _role := CASE WHEN _staff AND _t.user_id <> _uid THEN 'support' ELSE public.current_actor_role() END;

  INSERT INTO public.support_messages (ticket_id, sender_id, sender_role, body, is_internal,
    attachment_path, attachment_name, attachment_type, attachment_size)
  VALUES (_ticket_id, _uid, _role, coalesce(_body,''), coalesce(_internal,false),
    _attachment_path, _attachment_name, _attachment_type, _attachment_size)
  RETURNING id INTO _mid;

  UPDATE public.support_tickets SET
    last_activity_at = now(),
    updated_at = now(),
    first_response_at = CASE WHEN first_response_at IS NULL AND _role = 'support' AND NOT coalesce(_internal,false)
                             THEN now() ELSE first_response_at END,
    status = CASE
      WHEN coalesce(_internal,false) THEN status
      WHEN _role = 'support' THEN 'waiting_user'::public.support_status
      WHEN status IN ('resolved','closed') THEN 'reopened'::public.support_status
      ELSE 'waiting_support'::public.support_status END,
    reopen_count = reopen_count + CASE WHEN NOT coalesce(_internal,false) AND _role <> 'support'
                                       AND status IN ('resolved','closed') THEN 1 ELSE 0 END,
    staff_last_read_at = CASE WHEN _role = 'support' THEN now() ELSE staff_last_read_at END,
    user_last_read_at = CASE WHEN _role <> 'support' THEN now() ELSE user_last_read_at END
  WHERE id = _ticket_id;

  IF NOT coalesce(_internal,false) THEN
    IF _role = 'support' THEN
      PERFORM public.create_notification(_t.user_id, 'support.reply', 'Support replied',
        left(coalesce(_body,'Attachment'), 140), '/support?ticket=' || _ticket_id::text,
        'support', _t.priority, 'support_ticket', _ticket_id, 'support.msg:' || _mid::text, false);
    ELSE
      PERFORM public.notify_support_staff('New support message', left(coalesce(_body,'Attachment'), 140),
        '/admin?tab=support&ticket=' || _ticket_id::text, _t.priority, _ticket_id, 'support.msg:' || _mid::text);
    END IF;
  ELSE
    INSERT INTO public.support_events (ticket_id, actor_id, actor_role, action)
    VALUES (_ticket_id, _uid, _role, 'internal_note');
  END IF;

  RETURN _mid;
END $$;
REVOKE ALL ON FUNCTION public.send_support_message(uuid,text,boolean,text,text,text,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_support_message(uuid,text,boolean,text,text,text,integer) TO authenticated;

-- ============ read state ============
CREATE OR REPLACE FUNCTION public.support_mark_read(_ticket_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _t public.support_tickets;
BEGIN
  SELECT * INTO _t FROM public.support_tickets WHERE id = _ticket_id;
  IF _t.id IS NULL THEN RETURN; END IF;
  IF _t.user_id = _uid THEN
    UPDATE public.support_tickets SET user_last_read_at = now() WHERE id = _ticket_id;
  ELSIF public.has_permission(_uid, 'support.view') THEN
    UPDATE public.support_tickets SET staff_last_read_at = now() WHERE id = _ticket_id;
  END IF;
  UPDATE public.support_messages SET read_at = now()
   WHERE false; -- read receipts are tracked per conversation side
END $$;
REVOKE ALL ON FUNCTION public.support_mark_read(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.support_mark_read(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.my_unread_counts()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'notifications', (SELECT count(*) FROM public.notifications
                       WHERE user_id = auth.uid() AND read_at IS NULL AND archived_at IS NULL),
    'support', (SELECT count(*) FROM public.support_tickets t
                 WHERE t.user_id = auth.uid()
                   AND EXISTS (SELECT 1 FROM public.support_messages m
                                WHERE m.ticket_id = t.id AND m.is_internal = false
                                  AND m.sender_id <> auth.uid() AND m.deleted_at IS NULL
                                  AND (t.user_last_read_at IS NULL OR m.created_at > t.user_last_read_at))),
    'messages', (SELECT count(*) FROM public.conversations c
                  WHERE (c.customer_id = auth.uid() OR c.seller_id = auth.uid() OR c.rider_id = auth.uid())
                    AND EXISTS (SELECT 1 FROM public.conversation_messages m
                                 WHERE m.conversation_id = c.id AND m.sender_id <> auth.uid()
                                   AND m.deleted_at IS NULL
                                   AND m.created_at > coalesce(CASE WHEN c.customer_id = auth.uid()
                                        THEN c.customer_last_read_at ELSE c.counterpart_last_read_at END,
                                        'epoch'::timestamptz)))
  );
$$;
REVOKE ALL ON FUNCTION public.my_unread_counts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_unread_counts() TO authenticated;

-- ============ staff support actions ============
CREATE OR REPLACE FUNCTION public.support_admin_action(
  _ticket_id uuid, _action text, _value text DEFAULT NULL, _reason text DEFAULT NULL,
  _target_admin uuid DEFAULT NULL, _entity_id uuid DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _t public.support_tickets; _from text;
BEGIN
  SELECT * INTO _t FROM public.support_tickets WHERE id = _ticket_id;
  IF _t.id IS NULL THEN RAISE EXCEPTION 'Conversation not found'; END IF;
  IF NOT public.has_permission(_uid, 'support.view') THEN RAISE EXCEPTION 'Not allowed'; END IF;

  IF _action = 'assign' THEN
    IF NOT public.has_permission(_uid, 'support.assign') THEN RAISE EXCEPTION 'Not allowed'; END IF;
    _from := _t.assigned_to::text;
    UPDATE public.support_tickets
       SET assigned_to = coalesce(_target_admin, _uid), assigned_at = now(),
           status = CASE WHEN status IN ('open','reopened') THEN 'assigned'::public.support_status ELSE status END,
           last_activity_at = now(), updated_at = now()
     WHERE id = _ticket_id;

  ELSIF _action = 'priority' THEN
    IF NOT public.has_permission(_uid, 'support.escalate') THEN RAISE EXCEPTION 'Not allowed'; END IF;
    IF _reason IS NULL THEN RAISE EXCEPTION 'A reason is required'; END IF;
    _from := _t.priority::text;
    UPDATE public.support_tickets SET priority = _value::public.support_priority,
           last_activity_at = now(), updated_at = now() WHERE id = _ticket_id;

  ELSIF _action = 'escalate' THEN
    IF NOT public.has_permission(_uid, 'support.escalate') THEN RAISE EXCEPTION 'Not allowed'; END IF;
    IF _reason IS NULL THEN RAISE EXCEPTION 'A reason is required'; END IF;
    _from := _t.status::text;
    UPDATE public.support_tickets SET status = 'escalated',
           priority = CASE WHEN priority IN ('low','normal') THEN 'high'::public.support_priority ELSE priority END,
           last_activity_at = now(), updated_at = now() WHERE id = _ticket_id;

  ELSIF _action IN ('resolve','close','reopen') THEN
    IF NOT public.has_permission(_uid, 'support.respond') THEN RAISE EXCEPTION 'Not allowed'; END IF;
    _from := _t.status::text;
    UPDATE public.support_tickets SET
      status = CASE _action WHEN 'resolve' THEN 'resolved'::public.support_status
                            WHEN 'close' THEN 'closed'::public.support_status
                            ELSE 'reopened'::public.support_status END,
      resolved_at = CASE WHEN _action = 'resolve' THEN now() WHEN _action = 'reopen' THEN NULL ELSE resolved_at END,
      closed_at = CASE WHEN _action = 'close' THEN now() WHEN _action = 'reopen' THEN NULL ELSE closed_at END,
      reopen_count = reopen_count + CASE WHEN _action = 'reopen' THEN 1 ELSE 0 END,
      last_activity_at = now(), updated_at = now()
    WHERE id = _ticket_id;
    PERFORM public.create_notification(_t.user_id, 'support.status', 'Support update',
      'Your support conversation ' || _t.reference || ' is now ' || _action || 'd.',
      '/support?ticket=' || _ticket_id::text, 'support', _t.priority, 'support_ticket', _ticket_id,
      'support.status:' || _ticket_id::text || ':' || _action || ':' || extract(epoch from now())::bigint::text, false);

  ELSIF _action = 'archive' THEN
    IF NOT public.has_permission(_uid, 'support.assign') THEN RAISE EXCEPTION 'Not allowed'; END IF;
    UPDATE public.support_tickets SET archived_at = now() WHERE id = _ticket_id AND status IN ('resolved','closed');

  ELSIF _action IN ('link_order','link_delivery','link_payment','link_refund','link_payout') THEN
    IF NOT public.has_permission(_uid, 'support.respond') THEN RAISE EXCEPTION 'Not allowed'; END IF;
    UPDATE public.support_tickets SET
      order_id = CASE WHEN _action = 'link_order' THEN _entity_id ELSE order_id END,
      delivery_id = CASE WHEN _action = 'link_delivery' THEN _entity_id ELSE delivery_id END,
      payment_id = CASE WHEN _action = 'link_payment' THEN _entity_id ELSE payment_id END,
      refund_request_id = CASE WHEN _action = 'link_refund' THEN _entity_id ELSE refund_request_id END,
      payout_request_id = CASE WHEN _action = 'link_payout' THEN _entity_id ELSE payout_request_id END,
      last_activity_at = now(), updated_at = now()
    WHERE id = _ticket_id;
  ELSE
    RAISE EXCEPTION 'Unknown support action';
  END IF;

  INSERT INTO public.support_events (ticket_id, actor_id, actor_role, action, from_value, to_value, reason,
                                     metadata)
  VALUES (_ticket_id, _uid, public.current_actor_role(), _action, _from,
          coalesce(_value, _target_admin::text, _entity_id::text), _reason, '{}'::jsonb);

  PERFORM public.log_audit('support.' || _action, 'support_ticket', _ticket_id, _reason, NULL, NULL);
END $$;
REVOKE ALL ON FUNCTION public.support_admin_action(uuid,text,text,text,uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.support_admin_action(uuid,text,text,text,uuid,uuid) TO authenticated;

-- ============ order / delivery conversations ============
CREATE OR REPLACE FUNCTION public.ensure_order_conversation(_fulfillment_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _f record; _cid uuid;
BEGIN
  SELECT f.id, f.store_id, f.seller_id, f.order_id, o.customer_id
    INTO _f
    FROM public.order_fulfillments f JOIN public.orders o ON o.id = f.order_id
   WHERE f.id = _fulfillment_id;
  IF _f.id IS NULL THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF _uid <> _f.customer_id AND _uid <> _f.seller_id THEN RAISE EXCEPTION 'Not allowed'; END IF;

  SELECT id INTO _cid FROM public.conversations WHERE fulfillment_id = _fulfillment_id;
  IF _cid IS NULL THEN
    INSERT INTO public.conversations (kind, order_id, fulfillment_id, store_id, customer_id, seller_id)
    VALUES ('order_customer_seller', _f.order_id, _f.id, _f.store_id, _f.customer_id, _f.seller_id)
    RETURNING id INTO _cid;
  END IF;
  RETURN _cid;
END $$;
REVOKE ALL ON FUNCTION public.ensure_order_conversation(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_order_conversation(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.ensure_delivery_conversation(_delivery_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _d record; _cid uuid; _window int;
BEGIN
  SELECT d.id, d.order_id, d.rider_id, d.delivered_at, d.store_id, o.customer_id
    INTO _d FROM public.deliveries d JOIN public.orders o ON o.id = d.order_id
   WHERE d.id = _delivery_id;
  IF _d.id IS NULL THEN RAISE EXCEPTION 'Delivery not found'; END IF;
  IF _d.rider_id IS NULL THEN RAISE EXCEPTION 'No rider is assigned yet'; END IF;
  IF _uid <> _d.customer_id AND _uid <> _d.rider_id THEN RAISE EXCEPTION 'Not allowed'; END IF;

  SELECT coalesce((value->>'post_delivery_readonly_minutes')::int, 120) INTO _window
    FROM public.platform_settings WHERE key = 'delivery_chat_window';

  SELECT id INTO _cid FROM public.conversations WHERE delivery_id = _delivery_id;
  IF _cid IS NULL THEN
    INSERT INTO public.conversations (kind, order_id, delivery_id, store_id, customer_id, rider_id, read_only_at)
    VALUES ('delivery_customer_rider', _d.order_id, _d.id, _d.store_id, _d.customer_id, _d.rider_id,
            CASE WHEN _d.delivered_at IS NOT NULL
                 THEN _d.delivered_at + make_interval(mins => coalesce(_window,120)) END)
    RETURNING id INTO _cid;
  ELSIF _d.delivered_at IS NOT NULL THEN
    UPDATE public.conversations
       SET read_only_at = coalesce(read_only_at, _d.delivered_at + make_interval(mins => coalesce(_window,120)))
     WHERE id = _cid;
  END IF;
  RETURN _cid;
END $$;
REVOKE ALL ON FUNCTION public.ensure_delivery_conversation(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_delivery_conversation(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.send_conversation_message(
  _conversation_id uuid, _body text,
  _attachment_path text DEFAULT NULL, _attachment_name text DEFAULT NULL,
  _attachment_type text DEFAULT NULL, _attachment_size integer DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _c public.conversations; _role text; _mid uuid; _to uuid; _recent int;
BEGIN
  SELECT * INTO _c FROM public.conversations WHERE id = _conversation_id;
  IF _c.id IS NULL THEN RAISE EXCEPTION 'Conversation not found'; END IF;
  IF _uid NOT IN (coalesce(_c.customer_id,'00000000-0000-0000-0000-000000000000'::uuid),
                  coalesce(_c.seller_id,'00000000-0000-0000-0000-000000000000'::uuid),
                  coalesce(_c.rider_id,'00000000-0000-0000-0000-000000000000'::uuid)) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  IF _c.is_locked OR (_c.read_only_at IS NOT NULL AND now() > _c.read_only_at) THEN
    RAISE EXCEPTION 'This conversation is read-only';
  END IF;
  IF coalesce(btrim(_body),'') = '' AND _attachment_path IS NULL THEN RAISE EXCEPTION 'Message is required'; END IF;
  IF _attachment_type IS NOT NULL AND _attachment_type NOT IN
     ('image/png','image/jpeg','image/webp','image/gif','application/pdf') THEN
    RAISE EXCEPTION 'Unsupported attachment type';
  END IF;
  IF coalesce(_attachment_size,0) > 10485760 THEN RAISE EXCEPTION 'Attachment is too large (max 10MB)'; END IF;

  SELECT count(*) INTO _recent FROM public.conversation_messages
   WHERE sender_id = _uid AND created_at > now() - interval '1 minute';
  IF _recent >= 20 THEN RAISE EXCEPTION 'You are sending messages too quickly. Please wait a moment.'; END IF;

  _role := CASE WHEN _uid = _c.customer_id THEN 'customer'
                WHEN _uid = _c.seller_id THEN 'seller' ELSE 'rider' END;
  _to := CASE WHEN _uid = _c.customer_id THEN coalesce(_c.seller_id, _c.rider_id) ELSE _c.customer_id END;

  INSERT INTO public.conversation_messages (conversation_id, sender_id, sender_role, body,
    attachment_path, attachment_name, attachment_type, attachment_size)
  VALUES (_conversation_id, _uid, _role, coalesce(_body,''),
    _attachment_path, _attachment_name, _attachment_type, _attachment_size)
  RETURNING id INTO _mid;

  UPDATE public.conversations SET last_message_at = now(), updated_at = now(),
    customer_last_read_at = CASE WHEN _role = 'customer' THEN now() ELSE customer_last_read_at END,
    counterpart_last_read_at = CASE WHEN _role <> 'customer' THEN now() ELSE counterpart_last_read_at END
  WHERE id = _conversation_id;

  PERFORM public.create_notification(_to, 'message.received', 'New message',
    left(coalesce(_body,'Attachment'), 140),
    CASE WHEN _c.kind = 'delivery_customer_rider' AND _role = 'rider' THEN '/orders/' || _c.order_id::text
         WHEN _role = 'customer' THEN CASE WHEN _c.kind = 'order_customer_seller' THEN '/seller?tab=orders' ELSE '/rider' END
         ELSE '/orders/' || _c.order_id::text END,
    'messages', 'normal', 'conversation', _conversation_id, 'msg:' || _mid::text, false);

  RETURN _mid;
END $$;
REVOKE ALL ON FUNCTION public.send_conversation_message(uuid,text,text,text,text,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_conversation_message(uuid,text,text,text,text,integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.conversation_mark_read(_conversation_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _c public.conversations;
BEGIN
  SELECT * INTO _c FROM public.conversations WHERE id = _conversation_id;
  IF _c.id IS NULL THEN RETURN; END IF;
  IF _uid = _c.customer_id THEN
    UPDATE public.conversations SET customer_last_read_at = now() WHERE id = _conversation_id;
    UPDATE public.conversation_messages SET read_at = coalesce(read_at, now())
     WHERE conversation_id = _conversation_id AND sender_id <> _uid;
  ELSIF _uid IN (_c.seller_id, _c.rider_id) THEN
    UPDATE public.conversations SET counterpart_last_read_at = now() WHERE id = _conversation_id;
    UPDATE public.conversation_messages SET read_at = coalesce(read_at, now())
     WHERE conversation_id = _conversation_id AND sender_id <> _uid;
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.conversation_mark_read(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.conversation_mark_read(uuid) TO authenticated;

-- ============ moderation report ============
CREATE OR REPLACE FUNCTION public.report_message(
  _reason text, _details text DEFAULT NULL,
  _support_message_id uuid DEFAULT NULL, _conversation_message_id uuid DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _id uuid; _target uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT sender_id INTO _target FROM public.support_messages WHERE id = _support_message_id;
  IF _target IS NULL THEN
    SELECT sender_id INTO _target FROM public.conversation_messages WHERE id = _conversation_message_id;
  END IF;
  INSERT INTO public.message_reports (reporter_id, reported_user_id, support_message_id,
                                      conversation_message_id, reason, details)
  VALUES (_uid, _target, _support_message_id, _conversation_message_id, _reason, _details)
  RETURNING id INTO _id;
  PERFORM public.notify_staff('Message reported', 'A message was reported for review (' || _reason || ').', '/admin?tab=support');
  RETURN _id;
END $$;
REVOKE ALL ON FUNCTION public.report_message(text,text,uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.report_message(text,text,uuid,uuid) TO authenticated;

-- ============ metrics ============
CREATE OR REPLACE FUNCTION public.support_metrics()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _r jsonb;
BEGIN
  IF NOT public.has_permission(auth.uid(), 'support.analytics.view') THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  SELECT jsonb_build_object(
    'open', count(*) FILTER (WHERE status NOT IN ('resolved','closed')),
    'unassigned', count(*) FILTER (WHERE assigned_to IS NULL AND status NOT IN ('resolved','closed')),
    'escalated', count(*) FILTER (WHERE status = 'escalated'),
    'high_priority', count(*) FILTER (WHERE priority IN ('high','urgent','critical') AND status NOT IN ('resolved','closed')),
    'sos', count(*) FILTER (WHERE is_sos AND status NOT IN ('resolved','closed')),
    'new_today', count(*) FILTER (WHERE created_at >= date_trunc('day', now())),
    'resolved_today', count(*) FILTER (WHERE resolved_at >= date_trunc('day', now())),
    'reopen_rate', CASE WHEN count(*) FILTER (WHERE resolved_at IS NOT NULL) > 0
                        THEN round((count(*) FILTER (WHERE reopen_count > 0))::numeric
                             / count(*) FILTER (WHERE resolved_at IS NOT NULL) * 100, 1) END,
    'avg_first_response_minutes', round(avg(extract(epoch from (first_response_at - created_at))/60)
                                        FILTER (WHERE first_response_at IS NOT NULL)::numeric, 1),
    'avg_resolution_minutes', round(avg(extract(epoch from (resolved_at - created_at))/60)
                                    FILTER (WHERE resolved_at IS NOT NULL)::numeric, 1)
  ) INTO _r FROM public.support_tickets;

  RETURN _r || jsonb_build_object(
    'by_category', coalesce((SELECT jsonb_object_agg(category, c) FROM (
        SELECT category, count(*) c FROM public.support_tickets GROUP BY category) s), '{}'::jsonb),
    'workload', coalesce((SELECT jsonb_agg(jsonb_build_object(
        'admin_id', assigned_to, 'open', c)) FROM (
        SELECT assigned_to, count(*) c FROM public.support_tickets
         WHERE assigned_to IS NOT NULL AND status NOT IN ('resolved','closed')
         GROUP BY assigned_to) w), '[]'::jsonb));
END $$;
REVOKE ALL ON FUNCTION public.support_metrics() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.support_metrics() TO authenticated;

-- ============ broadcast ============
CREATE OR REPLACE FUNCTION public.send_broadcast(_audience text, _title text, _body text, _link text DEFAULT NULL,
  _category text DEFAULT 'announcement')
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _id uuid; _count int := 0; _r record;
BEGIN
  IF NOT public.has_permission(_uid, 'broadcast.send') THEN RAISE EXCEPTION 'Not allowed'; END IF;
  IF _audience NOT IN ('sellers','riders','customers') THEN RAISE EXCEPTION 'Unknown audience'; END IF;

  INSERT INTO public.broadcasts (audience, category, title, body, link, created_by)
  VALUES (_audience, _category, _title, _body, _link, _uid) RETURNING id INTO _id;

  FOR _r IN SELECT DISTINCT user_id FROM public.user_roles
             WHERE role = (CASE _audience WHEN 'sellers' THEN 'seller'
                                          WHEN 'riders' THEN 'rider'
                                          ELSE 'customer' END)::public.app_role LOOP
    IF public.create_notification(_r.user_id, 'broadcast', _title, _body, _link, _category, 'normal',
        'broadcast', _id, 'broadcast:' || _id::text || ':' || _r.user_id::text, false) IS NOT NULL THEN
      _count := _count + 1;
    END IF;
  END LOOP;

  UPDATE public.broadcasts SET recipient_count = _count, sent_at = now() WHERE id = _id;
  PERFORM public.log_audit('broadcast.sent', 'broadcast', _id, _audience, NULL, NULL);
  RETURN _id;
END $$;
REVOKE ALL ON FUNCTION public.send_broadcast(text,text,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_broadcast(text,text,text,text,text) TO authenticated;