CREATE OR REPLACE FUNCTION public.log_admin_access_attempt(_path text, _granted boolean, _metadata jsonb DEFAULT '{}'::jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _email text;
BEGIN
  IF _uid IS NOT NULL THEN
    SELECT email INTO _email FROM auth.users WHERE id = _uid;
  END IF;

  INSERT INTO public.admin_audit_log (actor_id, actor_email, action, entity_type, entity_id, metadata)
  VALUES (
    _uid,
    _email,
    CASE WHEN _granted THEN 'admin_access_granted' ELSE 'admin_access_denied' END,
    'admin_route',
    COALESCE(NULLIF(_path, ''), '/admin'),
    COALESCE(_metadata, '{}'::jsonb) || jsonb_build_object('granted', _granted, 'logged_at', now())
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.log_admin_access_attempt(text, boolean, jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.log_admin_access_attempt(text, boolean, jsonb) TO anon, authenticated, service_role;