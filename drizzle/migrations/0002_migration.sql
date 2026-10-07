CREATE TABLE public.inventory_price_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_id text NOT NULL,
  item_name text NOT NULL,
  old_price numeric, new_price numeric,
  old_price_pix numeric, new_price_pix numeric,
  old_discount numeric, new_discount numeric,
  changed_by uuid DEFAULT auth.uid(),
  changed_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.inventory_price_history TO authenticated;
GRANT ALL ON public.inventory_price_history TO service_role;
ALTER TABLE public.inventory_price_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read price history" ON public.inventory_price_history FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE INDEX ON public.inventory_price_history (inventory_id, changed_at DESC);

CREATE OR REPLACE FUNCTION public.log_inventory_price_change() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.price IS DISTINCT FROM OLD.price OR NEW.price_pix IS DISTINCT FROM OLD.price_pix OR NEW.discount IS DISTINCT FROM OLD.discount THEN
    INSERT INTO public.inventory_price_history(inventory_id,item_name,old_price,new_price,old_price_pix,new_price_pix,old_discount,new_discount)
    VALUES (NEW.id::text, NEW.name, OLD.price, NEW.price, OLD.price_pix, NEW.price_pix, OLD.discount, NEW.discount);
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.log_inventory_price_change() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_inventory_price_history AFTER UPDATE ON public.inventory FOR EACH ROW EXECUTE FUNCTION public.log_inventory_price_change();

CREATE TABLE public.backup_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  source text NOT NULL DEFAULT 'cron',
  ok boolean,
  error text,
  details jsonb
);
GRANT SELECT ON public.backup_attempts TO authenticated;
GRANT ALL ON public.backup_attempts TO service_role;
ALTER TABLE public.backup_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read backup attempts" ON public.backup_attempts FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

ALTER PUBLICATION supabase_realtime ADD TABLE public.inventory, public.payment_events, public.inventory_price_history;