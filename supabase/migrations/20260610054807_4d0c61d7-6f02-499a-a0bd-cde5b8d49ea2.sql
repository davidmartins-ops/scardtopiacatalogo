
CREATE TABLE public.order_refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  dispute_id uuid REFERENCES public.order_disputes(id) ON DELETE SET NULL,
  amount numeric(12,2) NOT NULL,
  reason text NOT NULL,
  method text NOT NULL DEFAULT 'pix',
  status text NOT NULL DEFAULT 'pending',
  pix_key text,
  proof_url text,
  requested_by uuid,
  approved_by uuid,
  approved_at timestamptz,
  processed_at timestamptz,
  restocked boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT order_refunds_status_chk CHECK (status IN ('pending','approved','processed','rejected')),
  CONSTRAINT order_refunds_method_chk CHECK (method IN ('pix','reverse_credit','store_credit','cash')),
  CONSTRAINT order_refunds_amount_chk CHECK (amount > 0)
);

CREATE INDEX idx_order_refunds_order ON public.order_refunds(order_id);
CREATE INDEX idx_order_refunds_status ON public.order_refunds(status);
CREATE INDEX idx_order_refunds_requested_by ON public.order_refunds(requested_by);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_refunds TO authenticated;
GRANT ALL ON public.order_refunds TO service_role;

ALTER TABLE public.order_refunds ENABLE ROW LEVEL SECURITY;

-- Customer can view their own refunds
CREATE POLICY "Customers view own refunds"
  ON public.order_refunds FOR SELECT TO authenticated
  USING (
    requested_by = auth.uid()
    OR EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.user_id = auth.uid())
    OR public.is_admin()
  );

-- Customer can request refunds for own orders
CREATE POLICY "Customers create refund requests"
  ON public.order_refunds FOR INSERT TO authenticated
  WITH CHECK (
    requested_by = auth.uid()
    AND EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.user_id = auth.uid())
    AND status = 'pending'
  );

-- Admin can update / delete / change status
CREATE POLICY "Admins manage refunds"
  ON public.order_refunds FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Admins delete refunds"
  ON public.order_refunds FOR DELETE TO authenticated
  USING (public.is_admin());

CREATE TRIGGER trg_order_refunds_updated
  BEFORE UPDATE ON public.order_refunds
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Restock function (admin only)
CREATE OR REPLACE FUNCTION public.restock_refunded_items(_refund_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _refund RECORD;
  _order RECORD;
  it jsonb;
  _item_id text;
  _qty int;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Apenas administradores podem repor estoque';
  END IF;

  SELECT * INTO _refund FROM public.order_refunds WHERE id = _refund_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Reembolso não encontrado'; END IF;
  IF _refund.restocked THEN RETURN; END IF;

  SELECT * INTO _order FROM public.orders WHERE id = _refund.order_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pedido não encontrado'; END IF;

  FOR it IN SELECT * FROM jsonb_array_elements(_order.items)
  LOOP
    _item_id := it->>'id';
    _qty := COALESCE((it->>'quantity')::int, 0);
    IF _item_id IS NOT NULL AND _qty > 0 THEN
      UPDATE public.inventory
      SET quantity = quantity + _qty
      WHERE id = _item_id;

      INSERT INTO public.inventory_audit (inventory_item_id, quantity_delta, source, user_id, order_id, metadata)
      VALUES (_item_id, _qty, 'refund', auth.uid(), _order.id,
              jsonb_build_object('refund_id', _refund_id, 'amount', _refund.amount));
    END IF;
  END LOOP;

  UPDATE public.order_refunds SET restocked = true WHERE id = _refund_id;
END;
$$;

-- Status change trigger: notify admin + cancel order if full refund
CREATE OR REPLACE FUNCTION public.handle_refund_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _order RECORD;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.admin_notifications (type, title, message, link, entity_type, entity_id, metadata)
    VALUES (
      'system',
      'Solicitação de reembolso',
      'Pedido ' || NEW.order_id::text || ' — R$ ' || to_char(NEW.amount, 'FM999G999G990D00'),
      '/admin/reembolsos',
      'refund',
      NEW.id::text,
      jsonb_build_object('order_id', NEW.order_id, 'amount', NEW.amount, 'reason', NEW.reason)
    );
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'processed' THEN
      NEW.processed_at := COALESCE(NEW.processed_at, now());
      SELECT * INTO _order FROM public.orders WHERE id = NEW.order_id;
      IF FOUND AND NEW.amount >= _order.total - 0.05 THEN
        UPDATE public.orders SET status = 'cancelled' WHERE id = NEW.order_id AND status <> 'cancelled';
      END IF;
    ELSIF NEW.status = 'approved' THEN
      NEW.approved_at := COALESCE(NEW.approved_at, now());
      NEW.approved_by := COALESCE(NEW.approved_by, auth.uid());
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_refund_status_insert
  AFTER INSERT ON public.order_refunds
  FOR EACH ROW EXECUTE FUNCTION public.handle_refund_status_change();

CREATE TRIGGER trg_refund_status_update
  BEFORE UPDATE OF status ON public.order_refunds
  FOR EACH ROW EXECUTE FUNCTION public.handle_refund_status_change();
