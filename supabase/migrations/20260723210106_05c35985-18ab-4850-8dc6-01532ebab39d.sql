
CREATE OR REPLACE FUNCTION public.notify_new_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _customer text;
BEGIN
  _customer := COALESCE(NEW.customer_info->>'name', NEW.customer_info->>'full_name', 'Cliente');
  INSERT INTO public.admin_notifications (type, title, message, link, entity_type, entity_id, metadata)
  VALUES (
    'new_order',
    'Novo pedido recebido',
    _customer || ' — R$ ' || to_char(NEW.total, 'FM999G999G990D00'),
    '/admin/pedidos/' || NEW.id::text,
    'order',
    NEW.id::text,
    jsonb_build_object('total', NEW.total, 'payment_method', NEW.payment_method, 'status', NEW.status)
  );
  RETURN NEW;
END;
$$;

-- Redirect existing admin order notifications to the new admin page
UPDATE public.admin_notifications
SET link = REPLACE(link, '/conta/pedidos/', '/admin/pedidos/')
WHERE link LIKE '/conta/pedidos/%'
  AND entity_type = 'order';
