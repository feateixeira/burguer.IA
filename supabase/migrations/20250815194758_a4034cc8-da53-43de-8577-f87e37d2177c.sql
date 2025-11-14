-- Insert default user establishment and profile
-- Note: We cannot insert directly into auth.users as it's managed by Supabase
-- The user will need to be created through the signup process first
-- But we can prepare the establishment data

-- Insert default establishment for NABRASA_BRAZ
INSERT INTO public.establishments (id, name, email, slug, phone, address, subscription_plan, subscription_status)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'NABRASA BRAZ',
  'nabrasa@braz.com',
  'nabrasa-braz',
  '(11) 99999-9999',
  'Rua das Flores, 123 - São Paulo, SP',
  'premium',
  'active'
) ON CONFLICT (id) DO NOTHING;