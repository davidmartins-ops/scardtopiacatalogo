-- 1) Audit table for inventory stock changes
CREATE TABLE IF NOT EXISTS public.inventory_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_item_id text NOT NULL,
  quantity_delta integer NOT NULL,
  source text NOT NULL,           -- 'order_trigger' | 'rpc' | 'admin'
  user_id uuid,
  order_id uuid,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.inventory_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view inventory audit"
  ON public.inventory_audit FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- No INSERT/UPDATE/DELETE policies: only SECURITY DEFINER functions/triggers can write.

-- 2) Lock down the RPC: admins only, with audit log
REVOKE EXECUTE ON FUNCTION public.decrement_inventory_stock(text, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.decrement_inventory_stock(text, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.decrement_inventory_stock(text, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.decrement_inventory_stock(text, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.decrement_inventory_stock(_item_id text, _qty integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Autenticação obrigatória para atualizar estoque';
  END IF;
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Apenas administradores podem ajustar estoque manualmente';
  END IF;
  IF _qty IS NULL OR _qty <= 0 THEN
    RAISE EXCEPTION 'Quantidade inválida';
  END IF;

  UPDATE public.inventory
  SET quantity = GREATEST(0, quantity - _qty)
  WHERE id = _item_id;

  INSERT INTO public.inventory_audit (inventory_item_id, quantity_delta, source, user_id, metadata)
  VALUES (_item_id, -_qty, 'rpc', _uid, jsonb_build_object('called_at', now()));
END;
$function$;

-- 3) Server-side trigger: decrement stock automatically on order insert
CREATE OR REPLACE FUNCTION public.apply_order_stock_decrement()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  it jsonb;
  _item_id text;
  _qty integer;
BEGIN
  IF NEW.items IS NULL THEN
    RETURN NEW;
  END IF;

  FOR it IN SELECT * FROM jsonb_array_elements(NEW.items)
  LOOP
    _item_id := it->>'id';
    _qty := COALESCE((it->>'quantity')::int, 0);
    IF _item_id IS NOT NULL AND _qty > 0 THEN
      UPDATE public.inventory
      SET quantity = GREATEST(0, quantity - _qty)
      WHERE id = _item_id;

      INSERT INTO public.inventory_audit (inventory_item_id, quantity_delta, source, user_id, order_id, metadata)
      VALUES (_item_id, -_qty, 'order_trigger', NEW.user_id, NEW.id, jsonb_build_object('order_total', NEW.total));
    END IF;
  END LOOP;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_orders_decrement_stock ON public.orders;
CREATE TRIGGER trg_orders_decrement_stock
AFTER INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.apply_order_stock_decrement();