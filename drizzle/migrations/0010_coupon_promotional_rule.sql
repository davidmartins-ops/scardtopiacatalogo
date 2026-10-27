-- Regra: cupom não incide sobre itens que já estão em promoção.
-- Exceção: pagamento no cartão, porque o desconto promocional não é aplicado
-- no valor do cartão. O admin pode liberar item promocional por cupom em
-- coupons.allow_on_promotional.
ALTER TABLE public.coupons
  ADD COLUMN IF NOT EXISTS allow_on_promotional boolean NOT NULL DEFAULT false;

DROP FUNCTION IF EXISTS public.evaluate_coupon(text, uuid, text, jsonb, text, boolean);

CREATE OR REPLACE FUNCTION public.evaluate_coupon(
  _code text,
  _user_id uuid,
  _cpf text,
  _lines jsonb,
  _context text,
  _lock boolean DEFAULT false,
  _payment_method text DEFAULT NULL
)
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
  _ln_disc numeric;
  _disc numeric;
  _is_card boolean := lower(trim(COALESCE(_payment_method, ''))) IN ('credit', 'debit', 'card', 'cartao', 'cartão');
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
    -- Item já promocional só participa quando o cupom permite, ou quando o
    -- pagamento é cartão (o desconto promocional não incide no valor do cartão).
    _ln_disc := CASE
      WHEN _ln->>'discount' ~ '^-?[0-9]+([.][0-9]+)?$' THEN (_ln->>'discount')::numeric
      ELSE 0
    END;
    IF _ln_disc > 0 AND NOT _c.allow_on_promotional AND NOT _is_card THEN CONTINUE; END IF;
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
END
$function$;

DROP FUNCTION IF EXISTS public.preview_coupon(text, text, jsonb, text);

CREATE OR REPLACE FUNCTION public.preview_coupon(
  _code text,
  _cpf text,
  _lines jsonb,
  _context text DEFAULT 'catalog',
  _payment_method text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _r record;
  _c public.coupons%ROWTYPE;
BEGIN
  SELECT * INTO _r FROM public.evaluate_coupon(_code, auth.uid(), _cpf, _lines, _context, false, _payment_method);
  SELECT * INTO _c FROM public.coupons WHERE id = _r.coupon_id;
  RETURN jsonb_build_object('ok', true, 'code', _c.code, 'discount_type', _c.discount_type,
    'discount_value', _c.discount_value, 'discount', _r.discount,
    'allowed_categories', _c.allowed_categories, 'blocked_categories', _c.blocked_categories,
    'applies_to_product_type', _c.applies_to_product_type, 'max_discount', _c.max_discount,
    'allow_on_promotional', _c.allow_on_promotional,
    'expires_at', _c.expires_at, 'description', _c.description);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END
$function$;

-- Pedido da loja: passa o desconto promocional de cada item e a forma de pagamento.
CREATE OR REPLACE FUNCTION public.apply_order_coupon()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _lines jsonb;
  _r record;
BEGIN
  IF NEW.coupon_code IS NULL OR trim(NEW.coupon_code) = '' THEN
    NEW.coupon_code := NULL; NEW.coupon_discount := 0; RETURN NEW;
  END IF;
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'category', COALESCE(inv.category, ''),
           'product_type', COALESCE(inv.product_type, 'drop'),
           'discount', COALESCE(inv.discount, 0),
           'amount', COALESCE((it->>'unit_price')::numeric, 0) * COALESCE((it->>'quantity')::int, 0))), '[]'::jsonb)
    INTO _lines
    FROM jsonb_array_elements(NEW.items) it
    LEFT JOIN public.inventory inv ON inv.id = it->>'id';
  SELECT * INTO _r FROM public.evaluate_coupon(
    NEW.coupon_code, NEW.user_id, NEW.customer_info->>'cpf', _lines, 'catalog', true,
    NEW.payment_method::text
  );
  NEW.coupon_code := _r.code;
  NEW.coupon_discount := LEAST(_r.discount, NEW.total);
  NEW.total := round(NEW.total - NEW.coupon_discount, 2);
  IF COALESCE(NEW.credits_applied, 0) > NEW.total + COALESCE(NEW.shipping_cost, 0) THEN
    NEW.credits_applied := NEW.total + COALESCE(NEW.shipping_cost, 0);
  END IF;
  RETURN NEW;
END
$function$;

-- Encomenda: repassa a forma de pagamento escolhida pelo cliente.
CREATE OR REPLACE FUNCTION public.apply_special_order_coupon(_special_order_id uuid, _code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _so public.special_orders%ROWTYPE;
  _lines jsonb;
  _r record;
  _cpf text;
  _disc numeric;
BEGIN
  SELECT * INTO _so FROM public.special_orders WHERE id = _special_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Encomenda não encontrada'; END IF;
  IF _so.user_id <> auth.uid() AND NOT public.is_admin() THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  IF _so.status <> 'approved' THEN RAISE EXCEPTION 'Aprove a cotação e aplique o cupom antes de pagar'; END IF;
  IF _so.coupon_code IS NOT NULL THEN RAISE EXCEPTION 'Esta encomenda já tem um cupom (não acumulativo)'; END IF;
  IF COALESCE(_so.total, 0) <= 0 THEN RAISE EXCEPTION 'Aguarde a cotação para aplicar o cupom'; END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('category', COALESCE(p.category, 'encomenda'), 'amount', COALESCE(i.total_price, 0))), '[]'::jsonb)
    INTO _lines
    FROM public.special_order_items i LEFT JOIN public.special_order_products p ON p.id = i.product_id
   WHERE i.special_order_id = _so.id;
  IF COALESCE((SELECT sum((l->>'amount')::numeric) FROM jsonb_array_elements(_lines) l), 0) <= 0 THEN
    _lines := jsonb_build_array(jsonb_build_object('category', 'encomenda', 'amount', _so.total - COALESCE(_so.shipping_cost, 0)));
  END IF;

  _cpf := COALESCE(NULLIF(_so.customer_info->>'cpf', ''), (SELECT cpf FROM public.customer_profiles WHERE id = _so.user_id));
  SELECT * INTO _r FROM public.evaluate_coupon(_code, _so.user_id, _cpf, _lines, 'special_order', true, _so.payment_method::text);
  _disc := LEAST(_r.discount, _so.total);

  PERFORM set_config('app.coupon_apply', '1', true);
  UPDATE public.special_orders
     SET coupon_code = _r.code, coupon_discount = _disc, total = round(total - _disc, 2)
   WHERE id = _so.id;
  PERFORM set_config('app.coupon_apply', '0', true);

  INSERT INTO public.coupon_redemptions (coupon_id, code, user_id, user_email, cpf, special_order_id, discount_amount)
  VALUES (_r.coupon_id, _r.code, _so.user_id, (SELECT email FROM auth.users WHERE id = _so.user_id),
          regexp_replace(COALESCE(_cpf,''), '\D', '', 'g'), _so.id, _disc);
  UPDATE public.coupons SET uses_count = uses_count + 1 WHERE id = _r.coupon_id;

  RETURN jsonb_build_object('ok', true, 'code', _r.code, 'discount', _disc);
END
$function$;