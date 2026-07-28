ALTER TABLE public.inventory
  ADD COLUMN IF NOT EXISTS availability text NOT NULL DEFAULT 'pronta_entrega';

ALTER TABLE public.inventory
  DROP CONSTRAINT IF EXISTS inventory_availability_check;

ALTER TABLE public.inventory
  ADD CONSTRAINT inventory_availability_check
  CHECK (availability IN ('pronta_entrega', 'encomenda'));