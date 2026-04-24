-- 1. Enum de status
CREATE TYPE public.order_status AS ENUM (
  'pending_payment',
  'payment_confirmed',
  'preparing',
  'shipped',
  'delivered',
  'cancelled'
);

-- 2. Migrar coluna status (text -> enum)
-- Primeiro normaliza valores existentes: 'sent' vira 'payment_confirmed'
UPDATE public.orders SET status = 'payment_confirmed' WHERE status = 'sent' OR status NOT IN ('pending_payment','payment_confirmed','preparing','shipped','delivered','cancelled');

ALTER TABLE public.orders 
  ALTER COLUMN status DROP DEFAULT,
  ALTER COLUMN status TYPE public.order_status USING status::public.order_status,
  ALTER COLUMN status SET DEFAULT 'payment_confirmed'::public.order_status;

-- 3. Novas colunas em orders
ALTER TABLE public.orders
  ADD COLUMN tracking_code text,
  ADD COLUMN status_updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN receipt_url text;

-- 4. Tabela de histórico
CREATE TABLE public.order_status_history (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  from_status public.order_status,
  to_status public.order_status NOT NULL,
  note text,
  changed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_order_status_history_order_id ON public.order_status_history(order_id);

ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own order history"
ON public.order_status_history FOR SELECT
TO authenticated
USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_status_history.order_id AND o.user_id = auth.uid()));

CREATE POLICY "Admins view all order history"
ON public.order_status_history FOR SELECT
TO authenticated
USING (public.is_admin());

CREATE POLICY "Admins insert order history"
ON public.order_status_history FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

-- 5. Trigger para registrar mudanças automaticamente
CREATE OR REPLACE FUNCTION public.log_order_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.order_status_history (order_id, from_status, to_status, changed_by)
    VALUES (NEW.id, NULL, NEW.status, NEW.user_id);
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.status_updated_at := now();
    INSERT INTO public.order_status_history (order_id, from_status, to_status, changed_by)
    VALUES (NEW.id, OLD.status, NEW.status, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_orders_status_change
BEFORE UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.log_order_status_change();

CREATE TRIGGER trg_orders_status_insert
AFTER INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.log_order_status_change();

-- Backfill histórico para pedidos existentes
INSERT INTO public.order_status_history (order_id, from_status, to_status, changed_by, created_at)
SELECT id, NULL, status, user_id, created_at FROM public.orders
WHERE NOT EXISTS (SELECT 1 FROM public.order_status_history h WHERE h.order_id = orders.id);

-- 6. Tabela de devoluções
CREATE TYPE public.dispute_status AS ENUM ('open', 'in_review', 'resolved', 'rejected');

CREATE TABLE public.order_disputes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  reason text NOT NULL,
  description text NOT NULL,
  attachment_url text,
  status public.dispute_status NOT NULL DEFAULT 'open',
  admin_response text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_order_disputes_order_id ON public.order_disputes(order_id);
CREATE INDEX idx_order_disputes_user_id ON public.order_disputes(user_id);

ALTER TABLE public.order_disputes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own disputes"
ON public.order_disputes FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users create own disputes"
ON public.order_disputes FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.user_id = auth.uid()));

CREATE POLICY "Admins view all disputes"
ON public.order_disputes FOR SELECT
TO authenticated
USING (public.is_admin());

CREATE POLICY "Admins update disputes"
ON public.order_disputes FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE TRIGGER trg_disputes_updated_at
BEFORE UPDATE ON public.order_disputes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();