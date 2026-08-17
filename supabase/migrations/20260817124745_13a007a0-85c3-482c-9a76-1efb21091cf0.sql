-- Helper checks run with definer rights so order/delivery policies stop
-- referencing each other's tables (which caused infinite recursion).
CREATE OR REPLACE FUNCTION public.is_order_customer(_order_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.orders o WHERE o.id = _order_id AND o.customer_id = _user_id)
$$;

CREATE OR REPLACE FUNCTION public.is_order_seller(_order_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.order_items oi WHERE oi.order_id = _order_id AND oi.seller_id = _user_id
    UNION ALL
    SELECT 1 FROM public.order_fulfillments f WHERE f.order_id = _order_id AND f.seller_id = _user_id
  )
$$;

CREATE OR REPLACE FUNCTION public.is_order_rider(_order_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.deliveries d WHERE d.order_id = _order_id AND d.rider_id = _user_id)
$$;

REVOKE ALL ON FUNCTION public.is_order_customer(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_order_seller(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_order_rider(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_order_customer(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_order_seller(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_order_rider(uuid, uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS orders_customer_read ON public.orders;
CREATE POLICY orders_customer_read ON public.orders FOR SELECT TO authenticated
USING (
  customer_id = auth.uid()
  OR public.is_staff(auth.uid())
  OR public.is_order_seller(id, auth.uid())
  OR public.is_order_rider(id, auth.uid())
);

DROP POLICY IF EXISTS orders_update_involved ON public.orders;
CREATE POLICY orders_update_involved ON public.orders FOR UPDATE TO authenticated
USING (
  customer_id = auth.uid()
  OR public.is_staff(auth.uid())
  OR public.is_order_seller(id, auth.uid())
  OR public.is_order_rider(id, auth.uid())
)
WITH CHECK (true);

DROP POLICY IF EXISTS deliveries_read ON public.deliveries;
CREATE POLICY deliveries_read ON public.deliveries FOR SELECT TO authenticated
USING (
  rider_id = auth.uid()
  OR public.is_staff(auth.uid())
  OR public.is_order_customer(order_id, auth.uid())
  OR public.is_order_seller(order_id, auth.uid())
);

DROP POLICY IF EXISTS deliveries_insert ON public.deliveries;
CREATE POLICY deliveries_insert ON public.deliveries FOR INSERT TO authenticated
WITH CHECK (public.is_order_customer(order_id, auth.uid()) OR public.is_staff(auth.uid()));

DROP POLICY IF EXISTS fulfillments_customer_read ON public.order_fulfillments;
CREATE POLICY fulfillments_customer_read ON public.order_fulfillments FOR SELECT TO authenticated
USING (public.is_order_customer(order_id, auth.uid()));

DROP POLICY IF EXISTS fulfillments_rider_read ON public.order_fulfillments;
CREATE POLICY fulfillments_rider_read ON public.order_fulfillments FOR SELECT TO authenticated
USING (public.is_order_rider(order_id, auth.uid()));