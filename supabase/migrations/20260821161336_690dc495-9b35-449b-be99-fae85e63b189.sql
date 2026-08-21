ALTER TABLE public.special_order_products
  ADD COLUMN IF NOT EXISTS shipping_starts_at date,
  ADD COLUMN IF NOT EXISTS shipping_start_note text;