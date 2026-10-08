DO $$ BEGIN
  EXECUTE replace(pg_get_functiondef('public.apply_special_order_coupon(uuid,text)'::regprocedure),
    'IF _so.status NOT IN (''quoted'',''approved'') THEN RAISE EXCEPTION ''Cupom só pode ser aplicado antes do pagamento''',
    'IF _so.status <> ''approved'' THEN RAISE EXCEPTION ''Aprove a cotação e aplique o cupom antes de pagar''');
END $$;