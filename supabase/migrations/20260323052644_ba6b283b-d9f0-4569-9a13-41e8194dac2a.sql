CREATE POLICY "Anyone can update inventory"
ON public.inventory
FOR UPDATE
TO public
USING (true)
WITH CHECK (true);

CREATE POLICY "Anyone can delete inventory"
ON public.inventory
FOR DELETE
TO public
USING (true);