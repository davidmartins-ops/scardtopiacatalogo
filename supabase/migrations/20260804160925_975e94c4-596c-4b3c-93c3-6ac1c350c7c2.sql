select cron.schedule(
  'poll-pending-payments',
  '*/10 * * * *',
  $$
    SELECT net.http_post(
      url := 'https://uonzprmsnctldppgrcxo.supabase.co/functions/v1/poll-pending-payments',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Lovable-Context', 'cron',
        'Authorization', 'Bearer ' || (
          SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY'
        )
      ),
      body := '{"source":"cron"}'::jsonb
    );
  $$
);