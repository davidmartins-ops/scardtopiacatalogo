-- 1) Orders: clients must not be able to self-assign a paid status.
--    Payment confirmation is done exclusively server-side (payment webhooks /
--    polling / admin action). Non-privileged inserts are forced to
--    'pending_payment' regardless of what the client sends.
CREATE OR REPLACE FUNCTION public.enforce_order_initial_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- service_role (edge functions: payment webhooks, polling, checkout backend)
  -- and admins may set the initial status explicitly.
  IF current_setting('role', true) = 'service_role'
     OR auth.role() = 'service_role'
     OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM 'pending_payment'::public.order_status THEN
    NEW.status := 'pending_payment'::public.order_status;
    NEW.paid_at := NULL;
    NEW.paid_amount := NULL;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_enforce_order_initial_status ON public.orders;
CREATE TRIGGER trg_enforce_order_initial_status
BEFORE INSERT ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.enforce_order_initial_status();

-- Defense in depth at the RLS layer: the insert policy no longer accepts
-- 'payment_confirmed' from anon/authenticated clients.
DROP POLICY IF EXISTS "Anyone can insert orders" ON public.orders;
CREATE POLICY "Anyone can insert orders"
ON public.orders
FOR INSERT
TO anon, authenticated
WITH CHECK (
  ((user_id IS NULL) OR (user_id = auth.uid()))
  AND (
    status = 'pending_payment'::public.order_status
    OR public.is_admin()
  )
);

-- 2) Storage: the products bucket is a public storefront bucket, but public
--    reads are now limited to image objects with safe paths, so any
--    non-product file that ends up there is not served anonymously.
DROP POLICY IF EXISTS "Public can read individual product files" ON storage.objects;
CREATE POLICY "Public can read individual product files"
ON storage.objects
FOR SELECT
TO anon, authenticated
USING (
  bucket_id = 'products'
  AND name IS NOT NULL
  AND length(name) BETWEEN 1 AND 300
  AND name !~ '(^/|//|\.\./|^\.)'
  AND lower(name) ~ '\.(png|jpe?g|webp|avif|gif)$'
);