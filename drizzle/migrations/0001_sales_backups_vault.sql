CREATE POLICY "Admins with 2FA read sales backups"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'sales-backups'
  AND public.is_admin()
  AND coalesce(auth.jwt()->>'aal', 'aal1') = 'aal2'
);

CREATE TABLE public.backup_runner (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  token text NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  last_run_at timestamptz,
  last_result jsonb
);
GRANT ALL ON public.backup_runner TO service_role;
REVOKE ALL ON public.backup_runner FROM anon, authenticated;
ALTER TABLE public.backup_runner ENABLE ROW LEVEL SECURITY;
INSERT INTO public.backup_runner (id) VALUES (1);

SELECT cron.schedule(
  'daily-sales-backup',
  '0 6 * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://uonzprmsnctldppgrcxo.supabase.co/functions/v1/sales-backup',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-backup-token', (SELECT token FROM public.backup_runner WHERE id = 1)
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
  $cron$
);