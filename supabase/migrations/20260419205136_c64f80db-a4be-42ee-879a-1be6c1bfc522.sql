-- Remove UPDATE/DELETE policies from orders for regular users
-- Orders must be immutable for users; only admins can modify (existing admin policy covers that)
DROP POLICY IF EXISTS "Users can update their own orders" ON public.orders;
DROP POLICY IF EXISTS "Users can delete their own orders" ON public.orders;

-- Tighten analytics_events: require authentication (drops anon insert)
-- Drop existing permissive insert policies and replace with an authenticated-only one
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'analytics_events' AND cmd = 'INSERT'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.analytics_events', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "Authenticated users can insert their own analytics events"
ON public.analytics_events
FOR INSERT
TO authenticated
WITH CHECK (user_id IS NULL OR user_id = auth.uid());