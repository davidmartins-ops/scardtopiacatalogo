
-- 1. Create roles enum + user_roles table to replace email-based admin check
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'user');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer helper that checks roles by user id (not by email)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

-- Backfill admin role for currently authorized emails (matched against existing auth users)
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'admin'::public.app_role
FROM auth.users u
JOIN public.authorized_emails ae ON lower(ae.email) = lower(u.email)
ON CONFLICT (user_id, role) DO NOTHING;

-- Replace is_admin() to use user_roles instead of JWT email claim
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'admin'::public.app_role);
$$;

-- RLS for user_roles: only admins can manage; users can view their own
DROP POLICY IF EXISTS "Admins manage user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users view own roles" ON public.user_roles;

CREATE POLICY "Admins manage user_roles"
  ON public.user_roles FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Users view own roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- 2. analytics_events: restrict viewing to admins; restrict insert to authenticated only
DROP POLICY IF EXISTS "Authenticated can view analytics" ON public.analytics_events;
DROP POLICY IF EXISTS "Anyone can insert analytics" ON public.analytics_events;

CREATE POLICY "Admins can view analytics"
  ON public.analytics_events FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE POLICY "Authenticated can insert analytics"
  ON public.analytics_events FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Anonymous can insert analytics"
  ON public.analytics_events FOR INSERT TO anon
  WITH CHECK (user_id IS NULL);

-- 3. products bucket: restrict writes to admins only (keep public reads)
DROP POLICY IF EXISTS "Authenticated can upload products" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can update products" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can delete products" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload products" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update products" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete products" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload products" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update products" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete products" ON storage.objects;

CREATE POLICY "Admins can upload products"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'products' AND public.is_admin());

CREATE POLICY "Admins can update products"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'products' AND public.is_admin())
  WITH CHECK (bucket_id = 'products' AND public.is_admin());

CREATE POLICY "Admins can delete products"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'products' AND public.is_admin());

-- 4. stock_notifications: scope policies to authenticated only
DROP POLICY IF EXISTS "Users can view own notifications" ON public.stock_notifications;
DROP POLICY IF EXISTS "Users can create own notifications" ON public.stock_notifications;
DROP POLICY IF EXISTS "Users can delete own notifications" ON public.stock_notifications;

CREATE POLICY "Users can view own notifications"
  ON public.stock_notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can create own notifications"
  ON public.stock_notifications FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own notifications"
  ON public.stock_notifications FOR DELETE TO authenticated
  USING (user_id = auth.uid());
