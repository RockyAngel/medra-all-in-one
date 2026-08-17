DROP POLICY IF EXISTS user_roles_self_signup ON public.user_roles;
CREATE POLICY user_roles_self_signup ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND role = 'customer'::public.app_role);

DROP POLICY IF EXISTS products_super_admin_write ON public.products;
CREATE POLICY products_super_admin_write ON public.products FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'super_admin')) WITH CHECK (public.has_role(auth.uid(),'super_admin'));

DROP POLICY IF EXISTS product_images_super_admin_write ON public.product_images;
CREATE POLICY product_images_super_admin_write ON public.product_images FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'super_admin')) WITH CHECK (public.has_role(auth.uid(),'super_admin'));

DROP POLICY IF EXISTS stores_super_admin_write ON public.stores;
CREATE POLICY stores_super_admin_write ON public.stores FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'super_admin')) WITH CHECK (public.has_role(auth.uid(),'super_admin'));

CREATE OR REPLACE FUNCTION public.set_feature_state(_key text, _state text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'super_admin') THEN
    RAISE EXCEPTION 'Only super admins can change feature availability';
  END IF;
  IF _state NOT IN ('enabled','beta','disabled') THEN
    RAISE EXCEPTION 'Unknown feature state %', _state;
  END IF;
  UPDATE public.feature_flags
     SET state = _state, enabled = (_state <> 'disabled'), updated_by = auth.uid(), updated_at = now()
   WHERE key = _key;
  PERFORM public.log_audit('feature.state', 'feature_flags', NULL, _key || ' -> ' || _state);
END $$;

REVOKE ALL ON FUNCTION public.set_feature_state(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_feature_state(text, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.resolve_late_delivery(_event_id uuid, _status text, _note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Only platform staff can resolve late deliveries';
  END IF;
  IF _status NOT IN ('open','investigating','resolved','compensated','dismissed') THEN
    RAISE EXCEPTION 'Unknown status %', _status;
  END IF;
  UPDATE public.late_delivery_events
     SET status = _status, admin_note = COALESCE(_note, admin_note)
   WHERE id = _event_id;
  PERFORM public.log_audit('late_delivery.' || _status, 'late_delivery_events', _event_id, _note);
END $$;

REVOKE ALL ON FUNCTION public.resolve_late_delivery(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_late_delivery(uuid, text, text) TO authenticated, service_role;