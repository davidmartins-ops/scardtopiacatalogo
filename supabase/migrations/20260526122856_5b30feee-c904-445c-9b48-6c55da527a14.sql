
-- 1) Hash email_unsubscribe_tokens at rest
ALTER TABLE public.email_unsubscribe_tokens
  ADD COLUMN IF NOT EXISTS token_hash text;

-- Backfill: hash existing plaintext tokens
UPDATE public.email_unsubscribe_tokens
SET token_hash = encode(digest(token, 'sha256'), 'hex')
WHERE token_hash IS NULL AND token IS NOT NULL;

-- Remove plaintext token column
ALTER TABLE public.email_unsubscribe_tokens
  DROP COLUMN IF EXISTS token;

ALTER TABLE public.email_unsubscribe_tokens
  ALTER COLUMN token_hash SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS email_unsubscribe_tokens_token_hash_key
  ON public.email_unsubscribe_tokens(token_hash);

-- 2) Add admin SELECT policy on suppressed_emails for auditability
CREATE POLICY "Admins can view suppressed emails"
ON public.suppressed_emails
FOR SELECT
TO authenticated
USING (public.is_admin());

-- 3) Remove admin_notifications from realtime publication to prevent
--    unauthorized subscribers from receiving admin-only broadcasts.
ALTER PUBLICATION supabase_realtime DROP TABLE public.admin_notifications;
