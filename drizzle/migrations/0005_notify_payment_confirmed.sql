CREATE OR REPLACE FUNCTION public.notify_order_paid()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status = 'payment_confirmed' AND OLD.status IS DISTINCT FROM 'payment_confirmed' THEN
    INSERT INTO public.admin_notifications (type, title, message, link, entity_type, entity_id, metadata)
    VALUES ('payment_confirmed', 'Pagamento confirmado',
      COALESCE(NEW.customer_info->>'name','Cliente') || ' pagou R$ ' || to_char(COALESCE(NEW.paid_amount, NEW.total), 'FM999G999G990D00') || ' (' || NEW.payment_method::text || ')',
      '/admin/pedidos/' || NEW.id::text, 'order', NEW.id::text,
      jsonb_build_object('total', NEW.total, 'payment_method', NEW.payment_method, 'coupon_code', NEW.coupon_code));
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.notify_order_paid() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_notify_order_paid AFTER UPDATE OF status ON public.orders FOR EACH ROW EXECUTE FUNCTION public.notify_order_paid();
ALTER PUBLICATION supabase_realtime ADD TABLE public.admin_notifications;