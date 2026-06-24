ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS shipping_service text,
  ADD COLUMN IF NOT EXISTS shipping_cost numeric,
  ADD COLUMN IF NOT EXISTS shipping_label_url text,
  ADD COLUMN IF NOT EXISTS superfrete_order_id text;