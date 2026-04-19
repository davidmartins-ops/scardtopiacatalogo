-- 1) Allow guest orders (nullable user_id) and update RLS
ALTER TABLE public.orders ALTER COLUMN user_id DROP NOT NULL;

DROP POLICY IF EXISTS "Users can insert own orders" ON public.orders;
CREATE POLICY "Anyone can insert orders"
  ON public.orders
  FOR INSERT
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());

-- Keep view policy for own orders (already exists). Add admin view.
DROP POLICY IF EXISTS "Admins can view all orders" ON public.orders;
CREATE POLICY "Admins can view all orders"
  ON public.orders
  FOR SELECT
  USING (public.is_admin());

-- 2) Secure stock decrement RPC
CREATE OR REPLACE FUNCTION public.decrement_inventory_stock(_item_id text, _qty integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _qty IS NULL OR _qty <= 0 THEN
    RAISE EXCEPTION 'Quantidade inválida';
  END IF;
  UPDATE public.inventory
  SET quantity = GREATEST(0, quantity - _qty)
  WHERE id = _item_id;
END;
$$;

REVOKE ALL ON FUNCTION public.decrement_inventory_stock(text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.decrement_inventory_stock(text, integer) TO anon, authenticated;

-- 3) Update inventory description CHECK to allow Etched Foil (if any)
DO $$ BEGIN
  PERFORM 1 FROM pg_constraint WHERE conname = 'inventory_description_check';
  IF FOUND THEN
    ALTER TABLE public.inventory DROP CONSTRAINT inventory_description_check;
  END IF;
END $$;