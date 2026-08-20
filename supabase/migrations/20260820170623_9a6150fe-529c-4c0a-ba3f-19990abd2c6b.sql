CREATE OR REPLACE FUNCTION public.requeue_dlq_emails(
  _queue text,
  _limit integer DEFAULT 100,
  _new_from text DEFAULT NULL,
  _new_sender_domain text DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pgmq'
AS $function$
DECLARE
  _rec record;
  _payload jsonb;
  _count integer := 0;
BEGIN
  IF _queue NOT IN ('transactional_emails', 'auth_emails') THEN
    RAISE EXCEPTION 'Fila inválida: %', _queue;
  END IF;

  FOR _rec IN
    EXECUTE format('SELECT msg_id, message FROM pgmq.q_%I_dlq ORDER BY msg_id LIMIT %s', _queue, GREATEST(1, LEAST(_limit, 500)))
  LOOP
    _payload := _rec.message;
    IF _new_from IS NOT NULL THEN
      _payload := jsonb_set(_payload, '{from}', to_jsonb(_new_from));
    END IF;
    IF _new_sender_domain IS NOT NULL THEN
      _payload := jsonb_set(_payload, '{sender_domain}', to_jsonb(_new_sender_domain));
    END IF;
    -- Refresh queued_at so the TTL check does not immediately expire the message again.
    _payload := jsonb_set(_payload, '{queued_at}', to_jsonb(now()));

    PERFORM pgmq.send(_queue, _payload);
    PERFORM pgmq.delete(_queue || '_dlq', _rec.msg_id);
    _count := _count + 1;
  END LOOP;

  RETURN _count;
END;
$function$;

REVOKE ALL ON FUNCTION public.requeue_dlq_emails(text, integer, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.requeue_dlq_emails(text, integer, text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.email_queue_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pgmq'
AS $function$
DECLARE
  _res jsonb;
BEGIN
  SELECT jsonb_build_object(
    'transactional_pending', (SELECT count(*) FROM pgmq.q_transactional_emails),
    'transactional_dlq', (SELECT count(*) FROM pgmq.q_transactional_emails_dlq),
    'auth_pending', (SELECT count(*) FROM pgmq.q_auth_emails),
    'auth_dlq', (SELECT count(*) FROM pgmq.q_auth_emails_dlq)
  ) INTO _res;
  RETURN _res;
END;
$function$;

REVOKE ALL ON FUNCTION public.email_queue_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.email_queue_stats() TO service_role;