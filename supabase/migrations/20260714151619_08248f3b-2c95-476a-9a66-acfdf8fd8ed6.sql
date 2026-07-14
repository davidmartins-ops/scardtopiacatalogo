
-- 1) Substituir apply_order_stock_decrement para só debitar quando payment_confirmed
CREATE OR REPLACE FUNCTION public.apply_order_stock_decrement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  it jsonb;
  _item_id text;
  _qty integer;
  _should_debit boolean := false;
BEGIN
  IF NEW.items IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    _should_debit := NEW.status = 'payment_confirmed';
  ELSIF TG_OP = 'UPDATE' THEN
    _should_debit := NEW.status = 'payment_confirmed'
                     AND (OLD.status IS DISTINCT FROM 'payment_confirmed');
  END IF;

  IF NOT _should_debit THEN
    RETURN NEW;
  END IF;

  -- Evitar débito duplicado caso já exista auditoria de débito para este pedido
  IF EXISTS (
    SELECT 1 FROM public.inventory_audit
    WHERE order_id = NEW.id AND quantity_delta < 0
      AND source IN ('order_trigger', 'order_confirm')
  ) THEN
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
      VALUES (_item_id, -_qty, 'order_confirm', NEW.user_id, NEW.id,
              jsonb_build_object('order_total', NEW.total, 'trigger_op', TG_OP));
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

-- Recriar triggers: INSERT e UPDATE
DROP TRIGGER IF EXISTS trg_orders_decrement_stock ON public.orders;
DROP TRIGGER IF EXISTS trg_orders_decrement_stock_upd ON public.orders;

CREATE TRIGGER trg_orders_decrement_stock
AFTER INSERT ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.apply_order_stock_decrement();

CREATE TRIGGER trg_orders_decrement_stock_upd
AFTER UPDATE OF status ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.apply_order_stock_decrement();

-- 2) Trigger BEFORE DELETE para repor estoque
CREATE OR REPLACE FUNCTION public.restock_on_order_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  it jsonb;
  _item_id text;
  _qty integer;
  _had_debit boolean;
  _restored_items jsonb := '[]'::jsonb;
BEGIN
  IF OLD.items IS NULL THEN
    RETURN OLD;
  END IF;

  -- Só repor se houve débito registrado (order_trigger ou order_confirm)
  SELECT EXISTS (
    SELECT 1 FROM public.inventory_audit
    WHERE order_id = OLD.id AND quantity_delta < 0
      AND source IN ('order_trigger', 'order_confirm')
  ) INTO _had_debit;

  IF NOT _had_debit THEN
    RETURN OLD;
  END IF;

  FOR it IN SELECT * FROM jsonb_array_elements(OLD.items)
  LOOP
    _item_id := it->>'id';
    _qty := COALESCE((it->>'quantity')::int, 0);
    IF _item_id IS NOT NULL AND _qty > 0 THEN
      UPDATE public.inventory
      SET quantity = quantity + _qty
      WHERE id = _item_id;

      INSERT INTO public.inventory_audit (inventory_item_id, quantity_delta, source, user_id, order_id, metadata)
      VALUES (_item_id, _qty, 'order_delete', auth.uid(), OLD.id,
              jsonb_build_object('order_status', OLD.status, 'order_total', OLD.total, 'deleted_at', now()));

      _restored_items := _restored_items || jsonb_build_object('id', _item_id, 'quantity', _qty);
    END IF;
  END LOOP;

  INSERT INTO public.admin_notifications (type, title, message, link, entity_type, entity_id, metadata)
  VALUES (
    'system',
    'Pedido excluído — estoque reposto',
    'Pedido ' || OLD.id::text || ' foi excluído. Itens repostos ao estoque.',
    '/admin',
    'order_delete',
    OLD.id::text,
    jsonb_build_object('order_id', OLD.id, 'status', OLD.status, 'total', OLD.total, 'restored', _restored_items)
  );

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_restock_on_delete ON public.orders;
CREATE TRIGGER trg_orders_restock_on_delete
BEFORE DELETE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.restock_on_order_delete();

-- 3) Backfill do incidente do pedido 797cb083 (reposição de 1x SLDDD06)
DO $$
DECLARE
  _order_id uuid := '797cb083-b071-400e-8fca-14a19b1c449d';
  _already boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.inventory_audit
    WHERE order_id = _order_id AND source = 'order_delete'
  ) INTO _already;

  IF NOT _already THEN
    UPDATE public.inventory SET quantity = quantity + 1 WHERE id = 'SLDDD06';
    INSERT INTO public.inventory_audit (inventory_item_id, quantity_delta, source, user_id, order_id, metadata)
    VALUES ('SLDDD06', 1, 'order_delete', NULL, _order_id,
            jsonb_build_object('backfill', true, 'note', 'Reposição retroativa do pedido excluído sem restore'));

    INSERT INTO public.admin_notifications (type, title, message, link, entity_type, entity_id, metadata)
    VALUES (
      'system',
      'Backfill: pedido excluído sem reposição',
      'Pedido 797cb083 — 1x SLDDD06 reposto retroativamente.',
      '/admin',
      'order_delete',
      _order_id::text,
      jsonb_build_object('backfill', true, 'restored', jsonb_build_array(jsonb_build_object('id','SLDDD06','quantity',1)))
    );
  END IF;
END $$;
