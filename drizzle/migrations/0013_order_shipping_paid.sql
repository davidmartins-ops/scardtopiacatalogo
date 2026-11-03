ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS shipping_paid boolean NOT NULL DEFAULT false;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS shipping_paid_at timestamptz;