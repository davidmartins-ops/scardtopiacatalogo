DO $migration$
DECLARE
  _definition text;
BEGIN
  SELECT pg_get_functiondef('public.evaluate_coupon(text,uuid,text,jsonb,text,boolean,text)'::regprocedure) INTO _definition;
  IF position('IF length(_cpf_clean) <> 11 THEN RAISE EXCEPTION' IN _definition) = 0 THEN
    RAISE EXCEPTION 'Unexpected coupon validation definition';
  END IF;
  _definition := replace(_definition,
    '  IF length(_cpf_clean) <> 11 THEN RAISE EXCEPTION ''Informe um CPF válido para usar o cupom''; END IF;',
    '  -- Account identity is mandatory; a saved CPF is optional and authoritative when present.
  SELECT COALESCE(NULLIF(regexp_replace(COALESCE(p.cpf, ''''), ''\D'', '''', ''g''), ''''), _cpf_clean)
    INTO _cpf_clean FROM public.customer_profiles p WHERE p.id = _user_id;
  _cpf_clean := COALESCE(_cpf_clean, regexp_replace(COALESCE(_cpf, ''''), ''\D'', '''', ''g''));
  IF length(_cpf_clean) <> 11 THEN _cpf_clean := ''''; END IF;');
  _definition := replace(_definition,
    'IF _cpf_clean = ANY(_c.blocked_cpfs)',
    'IF _cpf_clean <> '''' AND _cpf_clean = ANY(_c.blocked_cpfs)');
  _definition := replace(_definition,
    '(r.cpf = _cpf_clean OR r.user_id = _user_id)',
    '(r.user_id = _user_id OR (_cpf_clean <> '''' AND r.cpf = _cpf_clean))');
  _definition := replace(_definition,
    'Este cupom já foi usado neste CPF',
    'Limite de uso deste cupom atingido para este cliente');
  EXECUTE _definition;
END
$migration$;
COMMENT ON FUNCTION public.evaluate_coupon(text,uuid,text,jsonb,text,boolean,text) IS 'Validates coupons by required customer account and optional saved CPF; retains all eligibility, blocking and usage limits.';