-- Fix 1: orders — add explicit UPDATE/DELETE restrictions for regular users
-- Only owners can update/delete their own orders (admins already covered by separate admin policy)
CREATE POLICY "Users can update their own orders"
ON public.orders
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own orders"
ON public.orders
FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- Fix 2: stock_notifications — add UPDATE policy scoped to owner
CREATE POLICY "Users can update their own stock notifications"
ON public.stock_notifications
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Fix 3: receipts bucket — allow owners to update/delete their own receipts
-- Files are stored under <user_id>/<filename>, so first folder == auth.uid()
CREATE POLICY "Users can update their own receipts"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'receipts' AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id = 'receipts' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete their own receipts"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'receipts' AND (storage.foldername(name))[1] = auth.uid()::text);