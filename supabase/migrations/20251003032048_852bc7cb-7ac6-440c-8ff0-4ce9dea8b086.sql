-- Add admin password and protection settings to establishments
ALTER TABLE public.establishments 
ADD COLUMN admin_password_hash TEXT,
ADD COLUMN admin_password_salt TEXT,
ADD COLUMN protected_pages JSONB DEFAULT '[]'::jsonb,
ADD COLUMN protected_actions JSONB DEFAULT '{}'::jsonb,
ADD COLUMN admin_session_timeout INTEGER DEFAULT 900;

COMMENT ON COLUMN public.establishments.admin_password_hash IS 'Hashed admin password (4 digits)';
COMMENT ON COLUMN public.establishments.admin_password_salt IS 'Salt for admin password';
COMMENT ON COLUMN public.establishments.protected_pages IS 'Array of page names that require admin password';
COMMENT ON COLUMN public.establishments.protected_actions IS 'Object mapping pages to protected actions';
COMMENT ON COLUMN public.establishments.admin_session_timeout IS 'Admin session timeout in seconds (default 15 minutes)';