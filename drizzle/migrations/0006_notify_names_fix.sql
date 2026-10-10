CREATE OR REPLACE FUNCTION public.notify_order_paid()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _c text;
BEGIN
  IF NEW.status = 'payment_confirmed' AND OLD.status IS DISTINCT FROM 'payment_confirmed' THEN
    _c := COALESCE(NULLIF(NEW.customer_info->>'name',''), NULLIF(NEW.customer_info->>'full_name',''), NULLIF(NEW.customer_info->>'email',''), 'Cliente');
    INSERT INTO public.admin_notifications (type, title, message, link, entity_type, entity_id, metadata)
    VALUES ('payment_confirmed', 'Pagamento confirmado',
      _c || ' pagou R$ ' || replace(to_char(COALESCE(NEW.paid_amount, NEW.total), 'FM999990.00'), '.', ',') || ' (' || NEW.payment_method::text || ')',
      '/admin/pedidos/' || NEW.id::text, 'order', NEW.id::text,
      jsonb_build_object('total', NEW.total, 'payment_method', NEW.payment_method, 'coupon_code', NEW.coupon_code));
  END IF;
  RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.notify_new_order()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _customer text;
BEGIN
  _customer := COALESCE(NULLIF(NEW.customer_info->>'name',''), NULLIF(NEW.customer_info->>'full_name',''), NULLIF(NEW.customer_info->>'email',''), 'Cliente');
  INSERT INTO public.admin_notifications (type, title, message, link, entity_type, entity_id, metadata)
  VALUES ('new_order', 'Novo pedido recebido',
    _customer || ' — R$ ' || replace(to_char(NEW.total, 'FM999990.00'), '.', ','),
    '/admin/pedidos/' || NEW.id::text, 'order', NEW.id::text,
    jsonb_build_object('total', NEW.total, 'payment_method', NEW.payment_method, 'status', NEW.status, 'coupon_code', NEW.coupon_code));
  RETURN NEW;
END $$;