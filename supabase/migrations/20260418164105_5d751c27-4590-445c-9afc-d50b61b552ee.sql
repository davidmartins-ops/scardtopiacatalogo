-- Remove broad authenticated write policies on products bucket; keep admin-only ones
DROP POLICY IF EXISTS "Authenticated users can upload product images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update product images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete product images" ON storage.objects;

-- Tighten analytics insert: prevent spoofing other users' user_id
DROP POLICY IF EXISTS "Authenticated can insert analytics" ON public.analytics_events;
CREATE POLICY "Authenticated can insert analytics"
  ON public.analytics_events FOR INSERT TO authenticated
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());