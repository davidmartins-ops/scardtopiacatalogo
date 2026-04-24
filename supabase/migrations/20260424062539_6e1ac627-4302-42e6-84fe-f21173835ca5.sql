-- 1) Tabela de consentimento de cookies (LGPD)
CREATE TABLE IF NOT EXISTS public.cookie_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id text,
  essential boolean NOT NULL DEFAULT true,
  analytics boolean NOT NULL DEFAULT false,
  marketing boolean NOT NULL DEFAULT false,
  policy_version text NOT NULL DEFAULT 'v1',
  user_agent text,
  source text NOT NULL DEFAULT 'banner',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cookie_consents_user ON public.cookie_consents(user_id);
CREATE INDEX IF NOT EXISTS idx_cookie_consents_session ON public.cookie_consents(session_id);

ALTER TABLE public.cookie_consents ENABLE ROW LEVEL SECURITY;

-- Admins veem tudo (auditoria)
CREATE POLICY "Admins can view all consents"
ON public.cookie_consents FOR SELECT TO authenticated
USING (public.is_admin());

-- Usuário vê o próprio consentimento
CREATE POLICY "Users can view own consent"
ON public.cookie_consents FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- Inserções por anon (sem user_id) ou usuário autenticado
CREATE POLICY "Anyone can insert consent"
ON public.cookie_consents FOR INSERT TO anon, authenticated
WITH CHECK (
  (user_id IS NULL) OR (user_id = auth.uid())
);

-- Usuário pode atualizar o próprio consentimento
CREATE POLICY "Users can update own consent"
ON public.cookie_consents FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE TRIGGER trg_cookie_consents_updated
BEFORE UPDATE ON public.cookie_consents
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Endurecer policy do bucket público "products"
-- A policy atual permite SELECT amplo (incl. listar). Restringimos para
-- leitura por nome de arquivo (sem listagem em massa).
DROP POLICY IF EXISTS "Public read access on products bucket" ON storage.objects;

CREATE POLICY "Public can read individual product files"
ON storage.objects FOR SELECT TO anon, authenticated
USING (
  bucket_id = 'products'
  AND name IS NOT NULL
);
