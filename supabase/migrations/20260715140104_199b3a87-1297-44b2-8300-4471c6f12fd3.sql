-- 1) Colunas de status/emissão da etiqueta em orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS shipping_label_status text
    NOT NULL DEFAULT 'pending'
    CHECK (shipping_label_status IN ('pending','released','posted','delivered','canceled','error')),
  ADD COLUMN IF NOT EXISTS shipping_label_issued_at timestamptz,
  ADD COLUMN IF NOT EXISTS shipping_label_issued_by uuid,
  ADD COLUMN IF NOT EXISTS shipping_label_last_synced_at timestamptz;

-- 2) Histórico / audit trail de etiquetas
CREATE TABLE IF NOT EXISTS public.shipping_label_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('issued','resent','synced','canceled','error')),
  status text,
  tracking_code text,
  label_url text,
  actor_id uuid,
  actor_email text,
  source text NOT NULL DEFAULT 'admin_ui',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.shipping_label_events TO authenticated;
GRANT ALL ON public.shipping_label_events TO service_role;

ALTER TABLE public.shipping_label_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins gerenciam todos os eventos de etiqueta"
  ON public.shipping_label_events
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Cliente ve eventos do proprio pedido"
  ON public.shipping_label_events
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = shipping_label_events.order_id
        AND o.user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS shipping_label_events_order_id_idx
  ON public.shipping_label_events(order_id, created_at DESC);
CREATE INDEX IF NOT EXISTS orders_shipping_label_status_idx
  ON public.orders(shipping_label_status)
  WHERE shipping_label_status IN ('released','posted');