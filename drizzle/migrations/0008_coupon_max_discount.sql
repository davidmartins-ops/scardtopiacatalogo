ALTER TABLE public.coupons ADD COLUMN max_discount numeric;
COMMENT ON COLUMN public.coupons.max_discount IS 'Teto do desconto em R$; NULL = sem limite';

CREATE OR REPLACE FUNCTION public.evaluate_coupon(_code text, _user_id uuid, _cpf text, _lines jsonb, _context text, _lock boolean DEFAULT false)
 RETURNS TABLE(coupon_id uuid, code text, discount numeric, eligible_subtotal numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _c public.coupons%ROWTYPE;
  _cpf_clean text := regexp_replace(COALESCE(_cpf, ''), '\D', '', 'g');
  _email text;
  _used integer;
  _eligible numeric := 0;
  _total numeric := 0;
  _ln jsonb;
  _cat text;
  _ptype text;
  _amt numeric;
  _disc numeric;
BEGIN
  IF _code IS NULL OR trim(_code) = '' THEN RAISE EXCEPTION 'Informe um cupom'; END IF;
  IF _lock THEN
    SELECT * INTO _c FROM public.coupons WHERE coupons.code = upper(regexp_replace(_code, '\s+', '', 'g')) FOR UPDATE;
  ELSE
    SELECT * INTO _c FROM public.coupons WHERE coupons.code = upper(regexp_replace(_code, '\s+', '', 'g'));
  END IF;
  IF NOT FOUND OR NOT _c.is_active THEN RAISE EXCEPTION 'Cupom inválido ou inativo'; END IF;
  IF _c.starts_at IS NOT NULL AND now() < _c.starts_at THEN RAISE EXCEPTION 'Cupom ainda não está válido'; END IF;
  IF _c.expires_at IS NOT NULL AND now() > _c.expires_at THEN RAISE EXCEPTION 'Cupom expirado'; END IF;
  IF _context = 'catalog' AND NOT _c.applies_to_catalog THEN RAISE EXCEPTION 'Cupom não vale para a loja'; END IF;
  IF _context = 'special_order' AND NOT _c.applies_to_special_orders THEN RAISE EXCEPTION 'Cupom não vale para encomendas'; END IF;
  IF _c.max_uses IS NOT NULL AND _c.uses_count >= _c.max_uses THEN RAISE EXCEPTION 'Cupom esgotado'; END IF;
  IF _user_id IS NULL THEN RAISE EXCEPTION 'Faça login para usar cupom'; END IF;
  IF length(_cpf_clean) <> 11 THEN RAISE EXCEPTION 'Informe um CPF válido para usar o cupom'; END IF;
  IF _cpf_clean = ANY(_c.blocked_cpfs) THEN RAISE EXCEPTION 'Cupom indisponível para este cliente'; END IF;
  SELECT lower(email) INTO _email FROM auth.users WHERE id = _user_id;
  IF _email IS NOT NULL AND _email = ANY(_c.blocked_emails) THEN RAISE EXCEPTION 'Cupom indisponível para este cliente'; END IF;

  SELECT count(*) INTO _used FROM public.coupon_redemptions r
   WHERE r.coupon_id = _c.id AND (r.cpf = _cpf_clean OR r.user_id = _user_id);
  IF _used >= GREATEST(1, _c.per_cpf_limit) THEN RAISE EXCEPTION 'Este cupom já foi usado neste CPF'; END IF;

  FOR _ln IN SELECT * FROM jsonb_array_elements(COALESCE(_lines, '[]'::jsonb)) LOOP
    _cat := lower(trim(COALESCE(_ln->>'category', '')));
    _amt := COALESCE((_ln->>'amount')::numeric, 0);
    _total := _total + _amt;
    IF _c.applies_to_product_type <> 'all' THEN
      _ptype := lower(trim(COALESCE(_ln->>'product_type', '')));
      IF _ptype = '' OR _ptype <> _c.applies_to_product_type THEN CONTINUE; END IF;
    END IF;
    IF EXISTS (SELECT 1 FROM unnest(_c.blocked_categories) b WHERE lower(trim(b)) = _cat) THEN CONTINUE; END IF;
    IF cardinality(_c.allowed_categories) > 0
       AND NOT EXISTS (SELECT 1 FROM unnest(_c.allowed_categories) a WHERE lower(trim(a)) = _cat) THEN CONTINUE; END IF;
    _eligible := _eligible + _amt;
  END LOOP;

  IF _eligible <= 0 THEN RAISE EXCEPTION 'Nenhum item do pedido é elegível para este cupom'; END IF;
  IF _total < _c.min_purchase THEN
    RAISE EXCEPTION 'Compra mínima de R$ % para este cupom', to_char(_c.min_purchase, 'FM999G990D00');
  END IF;

  IF _c.discount_type = 'percent' THEN
    _disc := round(_eligible * LEAST(_c.discount_value, 100) / 100.0, 2);
  ELSE
    _disc := round(LEAST(_c.discount_value, _eligible), 2);
  END IF;
  IF _c.max_discount IS NOT NULL AND _c.max_discount > 0 THEN
    _disc := LEAST(_disc, _c.max_discount);
  END IF;

  RETURN QUERY SELECT _c.id, _c.code, _disc, _eligible;
END $function$;

CREATE OR REPLACE FUNCTION public.preview_coupon(_code text, _cpf text, _lines jsonb, _context text DEFAULT 'catalog'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _r record;
  _c public.coupons%ROWTYPE;
BEGIN
  SELECT * INTO _r FROM public.evaluate_coupon(_code, auth.uid(), _cpf, _lines, _context, false);
  SELECT * INTO _c FROM public.coupons WHERE id = _r.coupon_id;
  RETURN jsonb_build_object('ok', true, 'code', _c.code, 'discount_type', _c.discount_type,
    'discount_value', _c.discount_value, 'discount', _r.discount,
    'allowed_categories', _c.allowed_categories, 'blocked_categories', _c.blocked_categories,
    'applies_to_product_type', _c.applies_to_product_type, 'max_discount', _c.max_discount,
    'expires_at', _c.expires_at, 'description', _c.description);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END $function$;