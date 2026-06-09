
-- Add payment tracking columns to orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_transaction_id text UNIQUE,
  ADD COLUMN IF NOT EXISTS payment_invoice_slug text,
  ADD COLUMN IF NOT EXISTS paid_amount numeric,
  ADD COLUMN IF NOT EXISTS paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS payment_capture_method text,
  ADD COLUMN IF NOT EXISTS payment_installments integer;

-- Payment events table (idempotency + audit)
CREATE TABLE IF NOT EXISTS public.payment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  transaction_nsu text NOT NULL UNIQUE,
  invoice_slug text,
  provider text NOT NULL DEFAULT 'infinitepay',
  status text NOT NULL,
  amount numeric,
  paid_amount numeric,
  capture_method text,
  installments integer,
  raw_response jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.payment_events TO authenticated;
GRANT ALL ON public.payment_events TO service_role;

ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view payment events"
  ON public.payment_events FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE INDEX IF NOT EXISTS idx_payment_events_order ON public.payment_events(order_id);
