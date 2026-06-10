
-- ============ payment_reconciliation ============
CREATE TABLE public.payment_reconciliation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  expected_amount numeric(12,2) NOT NULL DEFAULT 0,
  received_amount numeric(12,2) NOT NULL DEFAULT 0,
  method text NOT NULL DEFAULT 'pix',
  received_at timestamptz,
  bank_reference text,
  status text NOT NULL DEFAULT 'unmatched',
  notes text,
  reconciled_by uuid,
  reconciled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payment_reconciliation_status_chk CHECK (status IN ('matched','divergent','unmatched','manual')),
  CONSTRAINT payment_reconciliation_method_chk CHECK (method IN ('pix','credit','debit','cash','other'))
);

CREATE INDEX idx_payment_reconciliation_order ON public.payment_reconciliation(order_id);
CREATE INDEX idx_payment_reconciliation_status ON public.payment_reconciliation(status);
CREATE INDEX idx_payment_reconciliation_received_at ON public.payment_reconciliation(received_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_reconciliation TO authenticated;
GRANT ALL ON public.payment_reconciliation TO service_role;

ALTER TABLE public.payment_reconciliation ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage reconciliation"
  ON public.payment_reconciliation
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE TRIGGER trg_payment_reconciliation_updated
  BEFORE UPDATE ON public.payment_reconciliation
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ cash_closures ============
CREATE TABLE public.cash_closures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  closure_date date NOT NULL UNIQUE,
  total_orders int NOT NULL DEFAULT 0,
  total_expected numeric(12,2) NOT NULL DEFAULT 0,
  total_received numeric(12,2) NOT NULL DEFAULT 0,
  divergence numeric(12,2) NOT NULL DEFAULT 0,
  closed_by uuid,
  closed_at timestamptz NOT NULL DEFAULT now(),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_cash_closures_date ON public.cash_closures(closure_date DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cash_closures TO authenticated;
GRANT ALL ON public.cash_closures TO service_role;

ALTER TABLE public.cash_closures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage cash closures"
  ON public.cash_closures
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE TRIGGER trg_cash_closures_updated
  BEFORE UPDATE ON public.cash_closures
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ divergence notification trigger ============
CREATE OR REPLACE FUNCTION public.notify_reconciliation_divergence()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'divergent' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'divergent') THEN
    INSERT INTO public.admin_notifications (type, title, message, link, entity_type, entity_id, metadata)
    VALUES (
      'system',
      'Divergência de pagamento',
      'Pedido ' || NEW.order_id::text || ' — esperado R$ ' || to_char(NEW.expected_amount, 'FM999G999G990D00')
        || ' / recebido R$ ' || to_char(NEW.received_amount, 'FM999G999G990D00'),
      '/admin/reconciliacao',
      'reconciliation',
      NEW.id::text,
      jsonb_build_object(
        'order_id', NEW.order_id,
        'expected', NEW.expected_amount,
        'received', NEW.received_amount,
        'method', NEW.method
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_payment_reconciliation_divergence
  AFTER INSERT OR UPDATE OF status ON public.payment_reconciliation
  FOR EACH ROW EXECUTE FUNCTION public.notify_reconciliation_divergence();
