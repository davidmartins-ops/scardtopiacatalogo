-- Notification type enum
CREATE TYPE public.admin_notification_type AS ENUM (
  'new_order',
  'new_dispute',
  'low_stock',
  'out_of_stock',
  'payment_confirmed',
  'sla_breach',
  'system'
);

-- Main notifications table (one row per event, shared across admins)
CREATE TABLE public.admin_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type public.admin_notification_type NOT NULL,
  title text NOT NULL,
  message text NOT NULL DEFAULT '',
  link text,
  entity_type text,
  entity_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_admin_notifications_created_at ON public.admin_notifications (created_at DESC);
CREATE INDEX idx_admin_notifications_type ON public.admin_notifications (type);

ALTER TABLE public.admin_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read notifications"
  ON public.admin_notifications FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "Admins insert notifications"
  ON public.admin_notifications FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "Service role insert notifications"
  ON public.admin_notifications FOR INSERT
  TO public
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Admins delete notifications"
  ON public.admin_notifications FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- Per-admin read state
CREATE TABLE public.admin_notification_reads (
  notification_id uuid NOT NULL REFERENCES public.admin_notifications(id) ON DELETE CASCADE,
  admin_id uuid NOT NULL,
  read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (notification_id, admin_id)
);

CREATE INDEX idx_admin_notification_reads_admin ON public.admin_notification_reads (admin_id);

ALTER TABLE public.admin_notification_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage own reads"
  ON public.admin_notification_reads FOR ALL
  TO authenticated
  USING (public.is_admin() AND admin_id = auth.uid())
  WITH CHECK (public.is_admin() AND admin_id = auth.uid());

-- Trigger: new order
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
    '/conta/pedidos/' || NEW.id::text,
    'order',
    NEW.id::text,
    jsonb_build_object('total', NEW.total, 'payment_method', NEW.payment_method, 'status', NEW.status)
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_new_order
  AFTER INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.notify_new_order();

-- Trigger: new dispute
CREATE OR REPLACE FUNCTION public.notify_new_dispute()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.admin_notifications (type, title, message, link, entity_type, entity_id, metadata)
  VALUES (
    'new_dispute',
    'Nova solicitação de devolução',
    COALESCE(NEW.reason, 'Disputa aberta'),
    '/conta/pedidos/' || NEW.order_id::text,
    'dispute',
    NEW.id::text,
    jsonb_build_object('order_id', NEW.order_id, 'status', NEW.status)
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_new_dispute
  AFTER INSERT ON public.order_disputes
  FOR EACH ROW EXECUTE FUNCTION public.notify_new_dispute();

-- Trigger: low / out of stock
CREATE OR REPLACE FUNCTION public.notify_stock_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.quantity = 0 AND COALESCE(OLD.quantity, 0) > 0 THEN
    INSERT INTO public.admin_notifications (type, title, message, link, entity_type, entity_id, metadata)
    VALUES (
      'out_of_stock',
      'Produto esgotado',
      NEW.name || ' está sem estoque',
      CASE WHEN NEW.product_type = 'single'
        THEN '/catalogo/single/' || NEW.id
        ELSE '/catalogo/drop/' || NEW.id END,
      'inventory',
      NEW.id,
      jsonb_build_object('name', NEW.name, 'quantity', NEW.quantity)
    );
  ELSIF NEW.quantity > 0 AND NEW.quantity <= 3 AND COALESCE(OLD.quantity, 0) > 3 THEN
    INSERT INTO public.admin_notifications (type, title, message, link, entity_type, entity_id, metadata)
    VALUES (
      'low_stock',
      'Estoque baixo',
      NEW.name || ' — restam ' || NEW.quantity::text,
      CASE WHEN NEW.product_type = 'single'
        THEN '/catalogo/single/' || NEW.id
        ELSE '/catalogo/drop/' || NEW.id END,
      'inventory',
      NEW.id,
      jsonb_build_object('name', NEW.name, 'quantity', NEW.quantity)
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_stock_changes
  AFTER UPDATE OF quantity ON public.inventory
  FOR EACH ROW EXECUTE FUNCTION public.notify_stock_changes();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.admin_notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.admin_notification_reads;