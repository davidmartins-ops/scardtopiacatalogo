CREATE POLICY "Anyone can insert inventory"
ON public.inventory
FOR INSERT
TO public
WITH CHECK (true);