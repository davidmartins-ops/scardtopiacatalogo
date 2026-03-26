ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS discount numeric NOT NULL DEFAULT 0;

INSERT INTO public.inventory (id, name, description, price, quantity, category, discount)
VALUES
  ('SLDDP01', 'Secret Lair x Deadpool: I Fixed It (You''re Welcome)', 'Foil', 700, 1, 'Deadpool', 0),
  ('SLDDP02', 'Secret Lair x Deadpool: I Fixed It (You''re Welcome)', 'Non-Foil', 550, 1, 'Deadpool', 0)
ON CONFLICT (id) DO NOTHING;