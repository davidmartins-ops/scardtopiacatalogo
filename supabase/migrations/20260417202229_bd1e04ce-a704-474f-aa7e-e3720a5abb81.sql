-- 1. Admin check helper (security definer to avoid recursion)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.authorized_emails
    WHERE lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

-- 2. authorized_emails: lock down
DROP POLICY IF EXISTS "Anyone can read authorized_emails" ON public.authorized_emails;
DROP POLICY IF EXISTS "Authenticated users can manage authorized_emails" ON public.authorized_emails;

CREATE POLICY "Admins can read authorized_emails"
  ON public.authorized_emails FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE POLICY "Admins can manage authorized_emails"
  ON public.authorized_emails FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 3. inventory: only admins can write
DROP POLICY IF EXISTS "Authenticated users can insert inventory" ON public.inventory;
DROP POLICY IF EXISTS "Authenticated users can update inventory" ON public.inventory;
DROP POLICY IF EXISTS "Authenticated users can delete inventory" ON public.inventory;

CREATE POLICY "Admins can insert inventory"
  ON public.inventory FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update inventory"
  ON public.inventory FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete inventory"
  ON public.inventory FOR DELETE TO authenticated
  USING (public.is_admin());

-- 4. banners: only admins can write
DROP POLICY IF EXISTS "Authenticated users can insert banners" ON public.banners;
DROP POLICY IF EXISTS "Authenticated users can update banners" ON public.banners;
DROP POLICY IF EXISTS "Authenticated users can delete banners" ON public.banners;

CREATE POLICY "Admins can insert banners"
  ON public.banners FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update banners"
  ON public.banners FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete banners"
  ON public.banners FOR DELETE TO authenticated
  USING (public.is_admin());

-- 5. drop_singles_images: only admins can write
DROP POLICY IF EXISTS "Authenticated users can insert drop singles images" ON public.drop_singles_images;
DROP POLICY IF EXISTS "Authenticated users can update drop singles images" ON public.drop_singles_images;
DROP POLICY IF EXISTS "Authenticated users can delete drop singles images" ON public.drop_singles_images;

CREATE POLICY "Admins can insert drop singles images"
  ON public.drop_singles_images FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update drop singles images"
  ON public.drop_singles_images FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete drop singles images"
  ON public.drop_singles_images FOR DELETE TO authenticated
  USING (public.is_admin());

-- 6. price_history: restrict insert to service role only
DROP POLICY IF EXISTS "Service role can insert price_history" ON public.price_history;
-- (no INSERT policy = only service_role bypasses RLS)

-- 7. receipts storage bucket: scope SELECT/INSERT/UPDATE/DELETE by user folder
DROP POLICY IF EXISTS "Authenticated users can view own receipts" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload receipts" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own receipts" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload own receipts" ON storage.objects;
DROP POLICY IF EXISTS "Admins can view all receipts" ON storage.objects;

CREATE POLICY "Users can view own receipts"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'receipts'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can upload own receipts"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'receipts'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Admins can view all receipts"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'receipts' AND public.is_admin());
