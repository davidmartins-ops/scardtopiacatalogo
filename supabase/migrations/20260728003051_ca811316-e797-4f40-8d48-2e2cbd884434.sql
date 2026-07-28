CREATE OR REPLACE FUNCTION public.reorder_banners()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Evita recursão quando a própria trigger renumera os banners
  IF pg_trigger_depth() > 1 THEN
    RETURN NULL;
  END IF;

  WITH ranked AS (
    SELECT id,
           (ROW_NUMBER() OVER (ORDER BY sort_order ASC NULLS LAST, created_at ASC, id ASC) - 1)::int AS new_order
    FROM public.banners
  )
  UPDATE public.banners b
  SET sort_order = r.new_order
  FROM ranked r
  WHERE b.id = r.id
    AND b.sort_order IS DISTINCT FROM r.new_order;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_reorder_banners ON public.banners;

CREATE TRIGGER trg_reorder_banners
AFTER INSERT OR DELETE OR UPDATE OF sort_order ON public.banners
FOR EACH STATEMENT
EXECUTE FUNCTION public.reorder_banners();

-- Renumera imediatamente os banners existentes
UPDATE public.banners SET sort_order = sort_order WHERE true;