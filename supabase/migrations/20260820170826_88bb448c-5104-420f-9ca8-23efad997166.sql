DO $$
DECLARE
  _t integer;
  _a integer;
BEGIN
  _t := public.requeue_dlq_emails('transactional_emails', 500, 'scardtopiacatalogo <noreply@spencerscardtopia.com.br>', 'notify.spencerscardtopia.com.br');
  _a := public.requeue_dlq_emails('auth_emails', 500, 'scardtopiacatalogo <noreply@spencerscardtopia.com.br>', 'notify.spencerscardtopia.com.br');
  RAISE NOTICE 'requeued transactional=% auth=%', _t, _a;
END $$;