GRANT EXECUTE ON FUNCTION public.confirm_order_payment(uuid, text, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.confirm_order_payment(uuid, text, text) FROM anon;