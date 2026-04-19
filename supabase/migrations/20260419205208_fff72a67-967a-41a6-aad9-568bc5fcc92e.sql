-- Allow admins to UPDATE and DELETE orders for order management workflows
CREATE POLICY "Admins can update orders"
ON public.orders
FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete orders"
ON public.orders
FOR DELETE
TO authenticated
USING (public.is_admin());

-- Allow anonymous (session-based) analytics inserts but force user_id to NULL for anon
-- Authenticated users can insert with their own user_id or NULL
CREATE POLICY "Anonymous users can insert anon analytics events"
ON public.analytics_events
FOR INSERT
TO anon
WITH CHECK (user_id IS NULL);