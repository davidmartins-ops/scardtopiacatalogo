CREATE OR REPLACE FUNCTION public.check_orphan_stock_debits()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _count integer := 0;
  _orders text;
BEGIN
  WITH orphans AS (
    SELECT ia.order_id, sum(-ia.quantity_delta) AS units
    FROM public.inventory_audit ia
    WHERE ia.order_id IS NOT NULL
      AND ia.quantity_delta < 0
      AND ia.source IN ('order_trigger', 'order_confirm')
      AND NOT EXISTS (SELECT 1 FROM public.orders o WHERE o.id = ia.order_id)
      AND NOT EXISTS (
        SELECT 1 FROM public.inventory_audit r
        WHERE r.order_id = ia.order_id AND r.source = 'order_delete'
      )
    GROUP BY ia.order_id
  )
  SELECT count(*), string_agg(substr(order_id::text, 1, 8), ', ')
  INTO _count, _orders
  FROM orphans;

  IF _count > 0 THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.admin_notifications
      WHERE type = 'system' AND entity_type = 'orphan_debits'
        AND created_at > now() - interval '24 hours'
    ) THEN
      INSERT INTO public.admin_notifications (type, title, message, link, entity_type, entity_id, metadata)
      VALUES (
        'system',
        'Débitos de estoque órfãos detectados',
        _count::text || ' pedido(s) excluído(s) sem reposição: ' || _orders,
        '/admin?tab=order-audit#deleted-orders-panel',
        'orphan_debits',
        NULL,
        jsonb_build_object('count', _count, 'orders', _orders, 'checked_at', now())
      );
    END IF;
  END IF;

  RETURN _count;
END;
$$;