ALTER TABLE public.customer_profiles
ADD COLUMN IF NOT EXISTS email_preferences jsonb NOT NULL DEFAULT jsonb_build_object(
  'order_received', true,
  'order_updates', true,
  'pix_receipt', true
);