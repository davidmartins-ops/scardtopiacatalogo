-- Drop permissive public policies
DROP POLICY IF EXISTS "Anyone can insert inventory" ON public.inventory;
DROP POLICY IF EXISTS "Anyone can update inventory" ON public.inventory;
DROP POLICY IF EXISTS "Anyone can delete inventory" ON public.inventory;

-- Create authenticated-only policies
CREATE POLICY "Authenticated users can insert inventory"
ON public.inventory FOR INSERT TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update inventory"
ON public.inventory FOR UPDATE TO authenticated
USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete inventory"
ON public.inventory FOR DELETE TO authenticated
USING (true);