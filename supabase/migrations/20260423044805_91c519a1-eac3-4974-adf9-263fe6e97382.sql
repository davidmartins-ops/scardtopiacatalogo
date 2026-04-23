-- Revoke public/anon access to the decrement function
REVOKE EXECUTE ON FUNCTION public.decrement_inventory_stock(text, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.decrement_inventory_stock(text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.decrement_inventory_stock(text, integer) TO authenticated;

-- Add an authenticated-caller guard inside the SECURITY DEFINER function
CREATE OR REPLACE FUNCTION public.decrement_inventory_stock(_item_id text, _qty integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Autenticação obrigatória para atualizar estoque';
  END IF;
  IF _qty IS NULL OR _qty <= 0 THEN
    RAISE EXCEPTION 'Quantidade inválida';
  END IF;
  UPDATE public.inventory
  SET quantity = GREATEST(0, quantity - _qty)
  WHERE id = _item_id;
END;
$function$;