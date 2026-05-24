
-- 1) Server-side order total validation trigger
CREATE OR REPLACE FUNCTION public.validate_order_prices()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  it jsonb;
  _item_id text;
  _qty integer;
  _client_unit numeric;
  _inv RECORD;
  _server_unit numeric;
  _server_total numeric := 0;
  _is_pix boolean;
  _tolerance numeric := 0.05; -- allow 5 cents rounding
BEGIN
  IF NEW.items IS NULL OR jsonb_array_length(NEW.items) = 0 THEN
    RAISE EXCEPTION 'Pedido sem itens';
  END IF;

  _is_pix := NEW.payment_method::text = 'pix';

  FOR it IN SELECT * FROM jsonb_array_elements(NEW.items)
  LOOP
    _item_id := it->>'id';
    _qty := COALESCE((it->>'quantity')::int, 0);
    _client_unit := COALESCE((it->>'unit_price')::numeric, 0);

    IF _item_id IS NULL OR _qty <= 0 THEN
      RAISE EXCEPTION 'Item de pedido inválido';
    END IF;

    SELECT price, price_pix, discount, quantity
      INTO _inv
      FROM public.inventory
      WHERE id = _item_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Produto % não encontrado', _item_id;
    END IF;

    IF _qty > _inv.quantity THEN
      RAISE EXCEPTION 'Estoque insuficiente para %', _item_id;
    END IF;

    IF _is_pix THEN
      _server_unit := (CASE WHEN COALESCE(_inv.price_pix,0) > 0 THEN _inv.price_pix ELSE _inv.price END)
                      * (1 - COALESCE(_inv.discount,0)/100.0);
    ELSE
      _server_unit := _inv.price;
    END IF;

    IF abs(_client_unit - _server_unit) > _tolerance THEN
      RAISE EXCEPTION 'Preço unitário inválido para % (esperado %, recebido %)', _item_id, _server_unit, _client_unit;
    END IF;

    _server_total := _server_total + (_server_unit * _qty);
  END LOOP;

  IF abs(COALESCE(NEW.total,0) - _server_total) > _tolerance THEN
    RAISE EXCEPTION 'Total do pedido inválido (esperado %, recebido %)', _server_total, NEW.total;
  END IF;

  -- Snap to server-computed total to eliminate any drift
  NEW.total := _server_total;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_order_prices ON public.orders;
CREATE TRIGGER trg_validate_order_prices
BEFORE INSERT ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.validate_order_prices();

-- 2) Remove admin-only tables from realtime publication to prevent cross-user leakage of admin data
ALTER PUBLICATION supabase_realtime DROP TABLE public.admin_audit_log;
ALTER PUBLICATION supabase_realtime DROP TABLE public.admin_notification_reads;
ALTER PUBLICATION supabase_realtime DROP TABLE public.order_status_history;

-- 3) Lock down user_roles writes explicitly (defense in depth)
DROP POLICY IF EXISTS "Admins manage user_roles" ON public.user_roles;
CREATE POLICY "Admins insert user_roles" ON public.user_roles
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "Admins update user_roles" ON public.user_roles
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Admins delete user_roles" ON public.user_roles
  FOR DELETE TO authenticated USING (public.is_admin());
CREATE POLICY "Admins select user_roles" ON public.user_roles
  FOR SELECT TO authenticated USING (public.is_admin());

-- 4) Revoke execute on internal SECURITY DEFINER helpers (only triggers / service role should call)
REVOKE EXECUTE ON FUNCTION public.apply_order_stock_decrement() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_order_status_change() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_new_order() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_new_dispute() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_stock_changes() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_customer() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_order_prices() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM anon, authenticated;

-- 5) Set explicit search_path on queue helpers (linter: function_search_path_mutable)
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public, pgmq;
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public, pgmq;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public, pgmq;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public, pgmq;
