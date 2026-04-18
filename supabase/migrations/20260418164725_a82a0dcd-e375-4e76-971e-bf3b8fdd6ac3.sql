-- Drop legacy admin allowlist table; admin access is now managed via public.user_roles
DROP TABLE IF EXISTS public.authorized_emails;