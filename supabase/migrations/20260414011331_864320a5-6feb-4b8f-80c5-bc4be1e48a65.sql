-- Fix the CHECK constraint on description to accept all foil types
ALTER TABLE public.inventory DROP CONSTRAINT inventory_description_check;
ALTER TABLE public.inventory ADD CONSTRAINT inventory_description_check 
  CHECK (description = ANY (ARRAY['Foil', 'Non-Foil', 'Surge Foil', 'Rainbow Foil', 'Holo Foil', 'Galaxy Foil', 'Confetti Foil']));

-- Add price_pix column for PIX pricing
ALTER TABLE public.inventory ADD COLUMN price_pix numeric NOT NULL DEFAULT 0;

-- Ensure pg_cron extension and schedule for price collection
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

SELECT cron.schedule(
  'collect-prices-daily',
  '0 6 * * *',
  $$SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/collect-prices',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );$$
);