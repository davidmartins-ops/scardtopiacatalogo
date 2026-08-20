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
  _new_msg_id text;
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

    -- A fresh identity is required: the email API rejects a retry that reuses an
    -- idempotency key from a failed run (409 run_failed), and the retry counter
    -- in email_send_log is keyed by message_id.
    _new_msg_id := gen_random_uuid()::text;
    _payload := jsonb_set(_payload, '{previous_message_id}', COALESCE(_payload->'message_id', 'null'::jsonb));
    _payload := jsonb_set(_payload, '{message_id}', to_jsonb(_new_msg_id));
    _payload := jsonb_set(_payload, '{idempotency_key}', to_jsonb('requeue-' || _new_msg_id));
    _payload := _payload - 'run_id';
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

-- Repair the messages already re-queued with stale idempotency keys.
UPDATE pgmq.q_transactional_emails q
SET message = jsonb_set(
      jsonb_set(
        jsonb_set(q.message, '{message_id}', to_jsonb(gen_random_uuid()::text)),
        '{idempotency_key}', to_jsonb('requeue-' || gen_random_uuid()::text)
      ),
      '{queued_at}', to_jsonb(now())
    ) - 'run_id',
    vt = now()
WHERE q.message->>'idempotency_key' NOT LIKE 'requeue-%';

SELECT public.requeue_dlq_emails('transactional_emails', 500, 'scardtopiacatalogo <noreply@spencerscardtopia.com.br>', 'notify.spencerscardtopia.com.br');