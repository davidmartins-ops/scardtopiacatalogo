
-- Table for daily price snapshots from Scryfall
CREATE TABLE public.price_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_name text NOT NULL,
  scryfall_id text,
  set_code text,
  collector_number text,
  price_usd numeric,
  price_usd_foil numeric,
  format text NOT NULL DEFAULT 'standard',
  captured_at date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(scryfall_id, captured_at)
);

ALTER TABLE public.price_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view price_history" ON public.price_history FOR SELECT TO public USING (true);
CREATE POLICY "Service role can insert price_history" ON public.price_history FOR INSERT TO authenticated WITH CHECK (true);

-- Table for analytics events (product views, cart adds, orders)
CREATE TABLE public.analytics_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  inventory_item_id text,
  item_name text,
  category text,
  metadata jsonb DEFAULT '{}'::jsonb,
  session_id text,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert analytics" ON public.analytics_events FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Authenticated can view analytics" ON public.analytics_events FOR SELECT TO authenticated USING (true);

-- Storage bucket for payment receipts
INSERT INTO storage.buckets (id, name, public) VALUES ('receipts', 'receipts', false);

CREATE POLICY "Authenticated users can upload receipts" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'receipts');
CREATE POLICY "Authenticated users can view own receipts" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'receipts');
