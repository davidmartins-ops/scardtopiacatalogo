CREATE TABLE public.coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  description text,
  discount_type text NOT NULL DEFAULT 'percent' CHECK (discount_type IN ('percent','fixed')),
  discount_value numeric NOT NULL CHECK (discount_value > 0),
  starts_at timestamptz,
  expires_at timestamptz,
  max_uses integer,
  uses_count integer NOT NULL DEFAULT 0,
  per_cpf_limit integer NOT NULL DEFAULT 1,
  min_purchase numeric NOT NULL DEFAULT 0,
  allowed_categories text[] NOT NULL DEFAULT '{}',
  blocked_categories text[] NOT NULL DEFAULT '{}',
  blocked_cpfs text[] NOT NULL DEFAULT '{}',
  blocked_emails text[] NOT NULL DEFAULT '{}',
  applies_to_catalog boolean NOT NULL DEFAULT true,
  applies_to_special_orders boolean NOT NULL DEFAULT true,
  show_in_catalog boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.coupons TO authenticated;
GRANT ALL ON public.coupons TO service_role;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage coupons" ON public.coupons FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE TRIGGER trg_coupons_updated BEFORE UPDATE ON public.coupons
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.normalize_coupon_code()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  NEW.code := upper(regexp_replace(NEW.code, '\s+', '', 'g'));
  NEW.blocked_cpfs := ARRAY(SELECT regexp_replace(c, '\D', '', 'g') FROM unnest(NEW.blocked_cpfs) c WHERE regexp_replace(c, '\D', '', 'g') <> '');
  NEW.blocked_emails := ARRAY(SELECT lower(trim(e)) FROM unnest(NEW.blocked_emails) e WHERE trim(e) <> '');
  RETURN NEW;
END $$;
CREATE TRIGGER trg_normalize_coupon_code BEFORE INSERT OR UPDATE ON public.coupons
  FOR EACH ROW EXECUTE FUNCTION public.normalize_coupon_code();

CREATE TABLE public.coupon_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id uuid NOT NULL REFERENCES public.coupons(id) ON DELETE CASCADE,
  code text NOT NULL,
  user_id uuid,
  user_email text,
  cpf text,
  order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE,
  special_order_id uuid REFERENCES public.special_orders(id) ON DELETE CASCADE,
  discount_amount numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_coupon_redemptions_coupon ON public.coupon_redemptions(coupon_id, cpf);
GRANT SELECT ON public.coupon_redemptions TO authenticated;
GRANT ALL ON public.coupon_redemptions TO service_role;
ALTER TABLE public.coupon_redemptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read redemptions" ON public.coupon_redemptions FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "Users read own redemptions" ON public.coupon_redemptions FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.release_coupon_use()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  UPDATE public.coupons SET uses_count = GREATEST(0, uses_count - 1) WHERE id = OLD.coupon_id;
  RETURN OLD;
END $$;
CREATE TRIGGER trg_release_coupon_use AFTER DELETE ON public.coupon_redemptions
  FOR EACH ROW EXECUTE FUNCTION public.release_coupon_use();

ALTER TABLE public.orders ADD COLUMN coupon_code text, ADD COLUMN coupon_discount numeric NOT NULL DEFAULT 0;
ALTER TABLE public.special_orders ADD COLUMN coupon_code text, ADD COLUMN coupon_discount numeric NOT NULL DEFAULT 0;

-- Core evaluation. _lines: [{category, amount}]. Raises on invalid coupon.
CREATE OR REPLACE FUNCTION public.evaluate_coupon(_code text, _user_id uuid, _cpf text, _lines jsonb, _context text, _lock boolean DEFAULT false)
RETURNS TABLE(coupon_id uuid, code text, discount numeric, eligible_subtotal numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  _c public.coupons%ROWTYPE;
  _cpf_clean text := regexp_replace(COALESCE(_cpf, ''), '\D', '', 'g');
  _email text;
  _used integer;
  _eligible numeric := 0;
  _total numeric := 0;
  _ln jsonb;
  _cat text;
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

  RETURN QUERY SELECT _c.id, _c.code, _disc, _eligible;
END $$;
REVOKE ALL ON FUNCTION public.evaluate_coupon(text, uuid, text, jsonb, text, boolean) FROM PUBLIC, anon, authenticated;

-- Preview for the logged-in customer (cart / special order)
CREATE OR REPLACE FUNCTION public.preview_coupon(_code text, _cpf text, _lines jsonb, _context text DEFAULT 'catalog')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  _r record;
  _c public.coupons%ROWTYPE;
BEGIN
  SELECT * INTO _r FROM public.evaluate_coupon(_code, auth.uid(), _cpf, _lines, _context, false);
  SELECT * INTO _c FROM public.coupons WHERE id = _r.coupon_id;
  RETURN jsonb_build_object('ok', true, 'code', _c.code, 'discount_type', _c.discount_type,
    'discount_value', _c.discount_value, 'discount', _r.discount,
    'allowed_categories', _c.allowed_categories, 'blocked_categories', _c.blocked_categories,
    'expires_at', _c.expires_at, 'description', _c.description);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END $$;
REVOKE ALL ON FUNCTION public.preview_coupon(text, text, jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.preview_coupon(text, text, jsonb, text) TO authenticated;

-- Public showcase for the catalog banner (no sensitive fields)
CREATE OR REPLACE FUNCTION public.get_showcase_coupons()
RETURNS TABLE(code text, description text, discount_type text, discount_value numeric, expires_at timestamptz, allowed_categories text[], blocked_categories text[])
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT c.code, c.description, c.discount_type, c.discount_value, c.expires_at, c.allowed_categories, c.blocked_categories
  FROM public.coupons c
  WHERE c.is_active AND c.show_in_catalog AND c.applies_to_catalog
    AND (c.starts_at IS NULL OR c.starts_at <= now())
    AND (c.expires_at IS NULL OR c.expires_at > now())
    AND (c.max_uses IS NULL OR c.uses_count < c.max_uses)
  ORDER BY c.created_at DESC LIMIT 5;
$$;
GRANT EXECUTE ON FUNCTION public.get_showcase_coupons() TO anon, authenticated;

-- Orders: apply coupon after price validation (trigger names fire alphabetically)
CREATE OR REPLACE FUNCTION public.apply_order_coupon()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  _lines jsonb;
  _r record;
BEGIN
  IF NEW.coupon_code IS NULL OR trim(NEW.coupon_code) = '' THEN
    NEW.coupon_code := NULL; NEW.coupon_discount := 0; RETURN NEW;
  END IF;
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'category', COALESCE(inv.category, ''),
           'amount', COALESCE((it->>'unit_price')::numeric, 0) * COALESCE((it->>'quantity')::int, 0))), '[]'::jsonb)
    INTO _lines
    FROM jsonb_array_elements(NEW.items) it
    LEFT JOIN public.inventory inv ON inv.id = it->>'id';
  SELECT * INTO _r FROM public.evaluate_coupon(NEW.coupon_code, NEW.user_id, NEW.customer_info->>'cpf', _lines, 'catalog', true);
  NEW.coupon_code := _r.code;
  NEW.coupon_discount := LEAST(_r.discount, NEW.total);
  NEW.total := round(NEW.total - NEW.coupon_discount, 2);
  IF COALESCE(NEW.credits_applied, 0) > NEW.total + COALESCE(NEW.shipping_cost, 0) THEN
    NEW.credits_applied := NEW.total + COALESCE(NEW.shipping_cost, 0);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_zz_apply_order_coupon BEFORE INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.apply_order_coupon();

CREATE OR REPLACE FUNCTION public.record_order_coupon()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _cid uuid;
BEGIN
  IF NEW.coupon_code IS NULL OR NEW.coupon_discount <= 0 THEN RETURN NEW; END IF;
  SELECT id INTO _cid FROM public.coupons WHERE code = NEW.coupon_code;
  IF _cid IS NULL THEN RETURN NEW; END IF;
  INSERT INTO public.coupon_redemptions (coupon_id, code, user_id, user_email, cpf, order_id, discount_amount)
  VALUES (_cid, NEW.coupon_code, NEW.user_id, (SELECT email FROM auth.users WHERE id = NEW.user_id),
          regexp_replace(COALESCE(NEW.customer_info->>'cpf',''), '\D', '', 'g'), NEW.id, NEW.coupon_discount);
  UPDATE public.coupons SET uses_count = uses_count + 1 WHERE id = _cid;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_record_order_coupon AFTER INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.record_order_coupon();

-- Prevent coupon fields being changed on orders by non-admins
CREATE OR REPLACE FUNCTION public.protect_order_coupon_fields()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF current_setting('role', true) = 'service_role' OR auth.role() = 'service_role' OR public.is_admin() THEN
    RETURN NEW;
  END IF;
  NEW.coupon_code := OLD.coupon_code;
  NEW.coupon_discount := OLD.coupon_discount;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_protect_order_coupon_fields BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.protect_order_coupon_fields();

-- Special orders: allow coupon fields through when applied by the RPC
CREATE OR REPLACE FUNCTION public.protect_special_order_fields()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _coupon_apply boolean := current_setting('app.coupon_apply', true) = '1';
BEGIN
  IF current_setting('role', true) = 'service_role'
     OR auth.role() = 'service_role'
     OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  NEW.user_id                 := OLD.user_id;
  NEW.status                  := OLD.status;
  NEW.status_updated_at       := OLD.status_updated_at;
  NEW.source                  := OLD.source;
  IF NOT _coupon_apply THEN
    NEW.total                 := OLD.total;
    NEW.coupon_code           := OLD.coupon_code;
    NEW.coupon_discount       := OLD.coupon_discount;
  END IF;
  NEW.shipping_cost           := OLD.shipping_cost;
  NEW.payment_method          := OLD.payment_method;
  NEW.payment_transaction_id  := OLD.payment_transaction_id;
  NEW.payment_invoice_slug    := OLD.payment_invoice_slug;
  NEW.paid_amount             := OLD.paid_amount;
  NEW.paid_at                 := OLD.paid_at;
  NEW.tracking_code           := OLD.tracking_code;
  NEW.shipping_label_url      := OLD.shipping_label_url;
  NEW.superfrete_order_id     := OLD.superfrete_order_id;
  NEW.shipping_label_status   := OLD.shipping_label_status;
  NEW.created_at              := OLD.created_at;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.apply_special_order_coupon(_special_order_id uuid, _code text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
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
  IF _so.status NOT IN ('quoted','approved') THEN RAISE EXCEPTION 'Cupom só pode ser aplicado antes do pagamento'; END IF;
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
  SELECT * INTO _r FROM public.evaluate_coupon(_code, _so.user_id, _cpf, _lines, 'special_order', true);
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
END $$;
REVOKE ALL ON FUNCTION public.apply_special_order_coupon(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_special_order_coupon(uuid, text) TO authenticated;