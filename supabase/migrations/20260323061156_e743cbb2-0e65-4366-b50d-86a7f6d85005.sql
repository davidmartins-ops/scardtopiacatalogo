
CREATE TABLE public.authorized_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.authorized_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read authorized_emails"
  ON public.authorized_emails
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Authenticated users can manage authorized_emails"
  ON public.authorized_emails
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
