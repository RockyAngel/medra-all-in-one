ALTER FUNCTION public.place_order(uuid, integer, boolean, text) SET search_path = public, extensions;
ALTER FUNCTION public.place_order_from_quotes(uuid, uuid[], integer, boolean, text) SET search_path = public, extensions;
ALTER FUNCTION public.book_consultation(uuid, uuid, uuid, timestamptz, text) SET search_path = public, extensions;