CREATE OR REPLACE FUNCTION public.normalize_inventory_id()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.id IS NOT NULL THEN
    NEW.id := upper(regexp_replace(NEW.id, '[-\s]+', '', 'g'));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_normalize_inventory_id ON public.inventory;
CREATE TRIGGER trg_normalize_inventory_id
BEFORE INSERT OR UPDATE OF id ON public.inventory
FOR EACH ROW EXECUTE FUNCTION public.normalize_inventory_id();