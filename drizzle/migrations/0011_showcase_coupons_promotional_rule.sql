-- Vitrine de cupons do catálogo: expõe o escopo de produto e a regra de itens promocionais
-- para que a prévia no navegador bata com a validação do servidor.
DROP FUNCTION IF EXISTS public.get_showcase_coupons();

CREATE OR REPLACE FUNCTION public.get_showcase_coupons()
RETURNS TABLE(
  code text,
  description text,
  discount_type text,
  discount_value numeric,
  expires_at timestamp with time zone,
  allowed_categories text[],
  blocked_categories text[],
  max_discount numeric,
  applies_to_product_type text,
  allow_on_promotional boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT c.code, c.description, c.discount_type, c.discount_value, c.expires_at,
         c.allowed_categories, c.blocked_categories, c.max_discount,
         c.applies_to_product_type, c.allow_on_promotional
  FROM public.coupons c
  WHERE c.is_active AND c.show_in_catalog
    AND (c.starts_at IS NULL OR now() >= c.starts_at)
    AND (c.expires_at IS NULL OR now() <= c.expires_at)
    AND (c.max_uses IS NULL OR c.uses_count < c.max_uses)
  ORDER BY c.created_at DESC;
END
$function$;