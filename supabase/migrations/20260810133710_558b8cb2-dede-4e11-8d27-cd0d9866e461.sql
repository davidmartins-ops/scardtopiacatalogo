CREATE OR REPLACE FUNCTION public.validate_order_credit_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  it jsonb;
  _item_id text;
  _qty integer;
  _unit numeric;
  _drop_subtotal numeric := 0;
  _gross numeric;
  _max_credits numeric;
  _tolerance numeric := 0.05;
  _ptype text;
BEGIN
  IF COALESCE(NEW.credits_applied, 0) <= 0 THEN
    RETURN NEW;
  END IF;

  FOR it IN SELECT * FROM jsonb_array_elements(COALESCE(NEW.items, '[]'::jsonb))
  LOOP
    _item_id := it->>'id';
    _qty := COALESCE((it->>'quantity')::int, 0);
    _unit := COALESCE((it->>'unit_price')::numeric, 0);
    IF _item_id IS NULL OR _qty <= 0 THEN
      CONTINUE;
    END IF;
    SELECT product_type INTO _ptype FROM public.inventory WHERE id = _item_id;
    IF COALESCE(_ptype, 'drop') = 'drop' THEN
      _drop_subtotal := _drop_subtotal + (_unit * _qty);
    END IF;
  END LOOP;

  _gross := COALESCE(NEW.total, 0) + COALESCE(NEW.shipping_cost, 0);
  _max_credits := GREATEST(0, _gross - (_drop_subtotal * 0.5));

  IF NEW.credits_applied > _max_credits + _tolerance THEN
    RAISE EXCEPTION 'Créditos acima do limite permitido: em drops os créditos cobrem no máximo 50%% do valor dos drops (máximo R$ %, solicitado R$ %)',
      round(_max_credits, 2), round(NEW.credits_applied, 2);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_order_credit_limit ON public.orders;
CREATE TRIGGER trg_validate_order_credit_limit
BEFORE INSERT OR UPDATE OF credits_applied ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.validate_order_credit_limit();