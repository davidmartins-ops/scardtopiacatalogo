CREATE OR REPLACE FUNCTION public.reorder_banners()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF pg_trigger_depth() > 1 THEN
    RETURN NULL;
  END IF;

  PERFORM pg_advisory_xact_lock(7700000000000010);

  -- Trava as linhas antes de renumerar (FOR UPDATE não é permitido junto com window functions).
  PERFORM 1 FROM public.banners ORDER BY id FOR UPDATE;

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