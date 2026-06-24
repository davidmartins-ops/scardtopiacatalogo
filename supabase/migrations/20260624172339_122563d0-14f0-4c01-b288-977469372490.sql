DROP POLICY IF EXISTS "Anyone can insert orders" ON public.orders;
CREATE POLICY "Anyone can insert orders"
  ON public.orders
  FOR INSERT
  WITH CHECK (
    ((user_id IS NULL) OR (user_id = auth.uid()))
    AND status IN ('pending_payment'::order_status, 'payment_confirmed'::order_status)
  );