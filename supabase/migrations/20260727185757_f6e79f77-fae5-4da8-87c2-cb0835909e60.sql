-- 1. Column on orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS credits_applied numeric NOT NULL DEFAULT 0 CHECK (credits_applied >= 0);

-- 2. store_credits (balance per user)
CREATE TABLE IF NOT EXISTS public.store_credits (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  balance numeric NOT NULL DEFAULT 0 CHECK (balance >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.store_credits TO authenticated;
GRANT ALL ON public.store_credits TO service_role;

ALTER TABLE public.store_credits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own credits"
  ON public.store_credits FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins read all credits"
  ON public.store_credits FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE POLICY "Admins manage credits"
  ON public.store_credits FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 3. store_credit_transactions (ledger)
CREATE TABLE IF NOT EXISTS public.store_credit_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount numeric NOT NULL,                       -- signed: positive = credit, negative = debit
  kind text NOT NULL CHECK (kind IN ('admin_add','admin_remove','order_debit','order_refund')),
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_store_credit_tx_user ON public.store_credit_transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_store_credit_tx_order ON public.store_credit_transactions(order_id);

GRANT SELECT ON public.store_credit_transactions TO authenticated;
GRANT ALL ON public.store_credit_transactions TO service_role;

ALTER TABLE public.store_credit_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own credit tx"
  ON public.store_credit_transactions FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins read all credit tx"
  ON public.store_credit_transactions FOR SELECT TO authenticated
  USING (public.is_admin());

-- 4. Admin function to add / remove credits
CREATE OR REPLACE FUNCTION public.admin_adjust_store_credit(
  _user_id uuid,
  _amount numeric,
  _note text DEFAULT NULL
) RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _new_balance numeric;
  _kind text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Apenas administradores podem ajustar créditos';
  END IF;
  IF _amount IS NULL OR _amount = 0 THEN
    RAISE EXCEPTION 'Valor inválido';
  END IF;

  INSERT INTO public.store_credits (user_id, balance, updated_at)
  VALUES (_user_id, GREATEST(0, _amount), now())
  ON CONFLICT (user_id) DO UPDATE
    SET balance = GREATEST(0, public.store_credits.balance + _amount),
        updated_at = now()
  RETURNING balance INTO _new_balance;

  _kind := CASE WHEN _amount >= 0 THEN 'admin_add' ELSE 'admin_remove' END;

  INSERT INTO public.store_credit_transactions (user_id, amount, kind, note, created_by)
  VALUES (_user_id, _amount, _kind, _note, auth.uid());

  RETURN _new_balance;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_adjust_store_credit(uuid, numeric, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_adjust_store_credit(uuid, numeric, text) TO authenticated;

-- 5. Order triggers: debit on insert, refund on delete
CREATE OR REPLACE FUNCTION public.apply_order_credit_debit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _current numeric;
BEGIN
  IF NEW.credits_applied IS NULL OR NEW.credits_applied <= 0 THEN
    RETURN NEW;
  END IF;
  IF NEW.user_id IS NULL THEN
    RAISE EXCEPTION 'Créditos exigem pedido de cliente autenticado';
  END IF;

  SELECT balance INTO _current FROM public.store_credits WHERE user_id = NEW.user_id FOR UPDATE;
  IF _current IS NULL THEN _current := 0; END IF;
  IF _current < NEW.credits_applied THEN
    RAISE EXCEPTION 'Saldo de crédito insuficiente (disponível R$ %, solicitado R$ %)', _current, NEW.credits_applied;
  END IF;

  INSERT INTO public.store_credits (user_id, balance, updated_at)
  VALUES (NEW.user_id, 0, now())
  ON CONFLICT (user_id) DO UPDATE
    SET balance = public.store_credits.balance - NEW.credits_applied,
        updated_at = now();

  INSERT INTO public.store_credit_transactions (user_id, amount, kind, order_id, note, created_by)
  VALUES (NEW.user_id, -NEW.credits_applied, 'order_debit', NEW.id,
          'Débito automático — pedido ' || NEW.id::text, auth.uid());

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_credit_debit ON public.orders;
CREATE TRIGGER trg_orders_credit_debit
AFTER INSERT ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.apply_order_credit_debit();

CREATE OR REPLACE FUNCTION public.refund_order_credit_on_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.credits_applied IS NULL OR OLD.credits_applied <= 0 OR OLD.user_id IS NULL THEN
    RETURN OLD;
  END IF;

  -- Only refund if a debit was recorded for this order and hasn't been refunded
  IF NOT EXISTS (
    SELECT 1 FROM public.store_credit_transactions
    WHERE order_id = OLD.id AND kind = 'order_debit'
  ) THEN
    RETURN OLD;
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.store_credit_transactions
    WHERE order_id = OLD.id AND kind = 'order_refund'
  ) THEN
    RETURN OLD;
  END IF;

  INSERT INTO public.store_credits (user_id, balance, updated_at)
  VALUES (OLD.user_id, OLD.credits_applied, now())
  ON CONFLICT (user_id) DO UPDATE
    SET balance = public.store_credits.balance + OLD.credits_applied,
        updated_at = now();

  INSERT INTO public.store_credit_transactions (user_id, amount, kind, order_id, note, created_by)
  VALUES (OLD.user_id, OLD.credits_applied, 'order_refund', OLD.id,
          'Reembolso automático — pedido excluído', auth.uid());

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_credit_refund ON public.orders;
CREATE TRIGGER trg_orders_credit_refund
BEFORE DELETE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.refund_order_credit_on_delete();