ALTER TABLE public.special_order_products
  ADD COLUMN IF NOT EXISTS sku text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS image_urls text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

ALTER TABLE public.special_order_products
  DROP CONSTRAINT IF EXISTS special_order_products_status_check;
ALTER TABLE public.special_order_products
  ADD CONSTRAINT special_order_products_status_check
  CHECK (status IN ('active', 'inactive', 'featured'));

CREATE UNIQUE INDEX IF NOT EXISTS special_order_products_sku_key
  ON public.special_order_products (sku) WHERE sku IS NOT NULL;

UPDATE public.special_order_products
SET status = CASE WHEN is_active THEN 'active' ELSE 'inactive' END;

CREATE OR REPLACE FUNCTION public.sync_special_order_product_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS NULL THEN
    NEW.status := CASE WHEN COALESCE(NEW.is_active, true) THEN 'active' ELSE 'inactive' END;
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.is_active := NEW.status <> 'inactive';
  ELSIF TG_OP = 'UPDATE' AND NEW.is_active IS DISTINCT FROM OLD.is_active THEN
    NEW.status := CASE WHEN NEW.is_active THEN
        CASE WHEN OLD.status = 'featured' THEN 'featured' ELSE 'active' END
      ELSE 'inactive' END;
  ELSIF TG_OP = 'INSERT' THEN
    NEW.is_active := NEW.status <> 'inactive';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_special_order_product_status ON public.special_order_products;
CREATE TRIGGER trg_sync_special_order_product_status
BEFORE INSERT OR UPDATE ON public.special_order_products
FOR EACH ROW EXECUTE FUNCTION public.sync_special_order_product_status();

CREATE TABLE IF NOT EXISTS public.special_order_product_variants (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id uuid NOT NULL REFERENCES public.special_order_products(id) ON DELETE CASCADE,
  label text NOT NULL,
  sku text,
  price numeric NOT NULL DEFAULT 0,
  price_pix numeric NOT NULL DEFAULT 0,
  image_url text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.special_order_product_variants TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.special_order_product_variants TO authenticated;
GRANT ALL ON public.special_order_product_variants TO service_role;

ALTER TABLE public.special_order_product_variants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active variants of visible products"
ON public.special_order_product_variants
FOR SELECT
USING (
  is_active = true
  AND EXISTS (
    SELECT 1 FROM public.special_order_products p
    WHERE p.id = product_id AND p.is_active = true
  )
);

CREATE POLICY "Admins can view all variants"
ON public.special_order_product_variants
FOR SELECT TO authenticated
USING (public.is_admin());

CREATE POLICY "Admins can manage variants"
ON public.special_order_product_variants
FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE UNIQUE INDEX IF NOT EXISTS special_order_product_variants_sku_key
  ON public.special_order_product_variants (sku) WHERE sku IS NOT NULL;

CREATE INDEX IF NOT EXISTS special_order_product_variants_product_idx
  ON public.special_order_product_variants (product_id);

CREATE TRIGGER trg_special_order_product_variants_updated_at
BEFORE UPDATE ON public.special_order_product_variants
FOR EACH ROW EXECUTE FUNCTION public.update_special_order_updated_at();