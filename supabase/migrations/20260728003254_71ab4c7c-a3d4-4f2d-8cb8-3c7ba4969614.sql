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

  -- Serializa a renumeração entre transações concorrentes.
  -- Liberada automaticamente ao fim da transação.
  PERFORM pg_advisory_xact_lock(7700000000000010);

  WITH ranked AS (
    SELECT id,
           (ROW_NUMBER() OVER (ORDER BY sort_order ASC NULLS LAST, created_at ASC, id ASC) - 1)::int AS new_order
    FROM public.banners
    FOR UPDATE
  )
  UPDATE public.banners b
  SET sort_order = r.new_order
  FROM ranked r
  WHERE b.id = r.id
    AND b.sort_order IS DISTINCT FROM r.new_order;

  RETURN NULL;
END;
$$;