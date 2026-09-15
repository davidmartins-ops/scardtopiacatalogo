ALTER TABLE public.orders ALTER COLUMN user_id SET NOT NULL;

REVOKE INSERT ON public.orders FROM anon;

DROP POLICY IF EXISTS "Anyone can insert orders" ON public.orders;

CREATE POLICY "Authenticated users can insert own orders"
ON public.orders FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND (status = 'pending_payment'::order_status OR is_admin())
);