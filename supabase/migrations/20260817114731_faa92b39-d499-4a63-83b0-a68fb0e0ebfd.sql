DROP POLICY IF EXISTS order_items_read ON public.order_items;
CREATE POLICY order_items_read ON public.order_items FOR SELECT TO authenticated
USING (
  seller_id = auth.uid()
  OR public.is_staff(auth.uid())
  OR EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_items.order_id AND o.customer_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.deliveries d WHERE d.order_id = order_items.order_id AND d.rider_id = auth.uid())
);

DROP POLICY IF EXISTS order_history_read ON public.order_status_history;
CREATE POLICY order_history_read ON public.order_status_history FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_status_history.order_id AND (o.customer_id = auth.uid() OR public.is_staff(auth.uid())))
  OR EXISTS (SELECT 1 FROM public.order_items oi WHERE oi.order_id = order_status_history.order_id AND oi.seller_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.deliveries d WHERE d.order_id = order_status_history.order_id AND d.rider_id = auth.uid())
);

DROP POLICY IF EXISTS fulfillments_rider_read ON public.order_fulfillments;
CREATE POLICY fulfillments_rider_read ON public.order_fulfillments FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.deliveries d
    WHERE d.rider_id = auth.uid()
      AND (d.fulfillment_id = order_fulfillments.id OR d.order_id = order_fulfillments.order_id)
  )
);

REVOKE EXECUTE ON FUNCTION public.confirm_order_payment(uuid, text, text) FROM authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.confirm_membership_payment(uuid, text, text, text) FROM authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.confirm_consultation_payment(uuid, text, text) FROM authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.log_prescription_status_change() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_consultation_change() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.feature_enabled(text) FROM anon;

INSERT INTO public.feature_flags (key, label, enabled, description)
VALUES ('payments.provider.enabled', 'Payments provider connected', false, 'Verified external payment provider is connected and checkout may take payments.')
ON CONFLICT (key) DO NOTHING;