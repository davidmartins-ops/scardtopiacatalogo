-- 1. orders: payment_method, customer_info, SLA breach
DO $$ BEGIN
  CREATE TYPE public.payment_method AS ENUM ('pix', 'credit', 'debit', 'whatsapp', 'other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_method public.payment_method NOT NULL DEFAULT 'whatsapp',
  ADD COLUMN IF NOT EXISTS customer_info jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS sla_breached_at timestamptz,
  ADD COLUMN IF NOT EXISTS sla_breach_status public.order_status;

CREATE INDEX IF NOT EXISTS idx_orders_payment_method ON public.orders(payment_method);
CREATE INDEX IF NOT EXISTS idx_orders_status_created ON public.orders(status, created_at);
CREATE INDEX IF NOT EXISTS idx_orders_customer_info_gin ON public.orders USING gin (customer_info);

-- 2. customer_profiles: cpf, phone, address
ALTER TABLE public.customer_profiles
  ADD COLUMN IF NOT EXISTS cpf text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS address jsonb DEFAULT '{}'::jsonb;

-- 3. order_sla_rules
CREATE TABLE IF NOT EXISTS public.order_sla_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status public.order_status NOT NULL UNIQUE,
  max_hours integer NOT NULL CHECK (max_hours > 0),
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.order_sla_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage sla rules" ON public.order_sla_rules
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

CREATE TRIGGER update_order_sla_rules_updated_at
  BEFORE UPDATE ON public.order_sla_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.order_sla_rules (status, max_hours) VALUES
  ('pending_payment', 24),
  ('payment_confirmed', 24),
  ('preparing', 48),
  ('shipped', 168)
ON CONFLICT (status) DO NOTHING;

-- 4. admin_audit_log
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  actor_email text,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read audit log" ON public.admin_audit_log
  FOR SELECT TO authenticated USING (is_admin());

CREATE POLICY "Service role inserts audit" ON public.admin_audit_log
  FOR INSERT TO public WITH CHECK (auth.role() = 'service_role' OR is_admin());

CREATE INDEX IF NOT EXISTS idx_admin_audit_created ON public.admin_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_entity ON public.admin_audit_log(entity_type, entity_id);

-- 5. realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.order_status_history;
ALTER PUBLICATION supabase_realtime ADD TABLE public.admin_audit_log;