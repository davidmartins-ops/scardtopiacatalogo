-- 1) Lock down EXECUTE on public functions: revoke from anon/authenticated/PUBLIC,
--    then re-grant only the RPCs the app actually calls with a user session.
DO $$
DECLARE
  fn record;
  keep_authenticated text[] := ARRAY[
    'has_role', 'is_admin', 'log_admin_access_attempt',
    'restock_refunded_items', 'decrement_inventory_stock', 'admin_adjust_store_credit'
  ];
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure AS sig, p.proname
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prokind = 'f'
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn.sig);
    IF fn.proname = ANY (keep_authenticated) THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', fn.sig);
    END IF;
  END LOOP;
END $$;

-- Keep future functions closed by default for anon/authenticated.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

-- 2) Storage: stop anonymous/authenticated clients from listing the public
--    products bucket. Public product images stay reachable through their public
--    URLs (public buckets serve those without row-level checks).
DROP POLICY IF EXISTS "Public can read individual product files" ON storage.objects;

CREATE POLICY "Admins can read product files"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'products' AND public.is_admin());

-- 3) Inventory audit: make the write path explicit — only backend/service code
--    (and the existing SECURITY DEFINER triggers) may insert; clients cannot.
CREATE POLICY "Service role manages inventory audit"
ON public.inventory_audit FOR INSERT TO service_role
WITH CHECK (true);

GRANT INSERT ON public.inventory_audit TO service_role;