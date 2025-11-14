-- Migration para garantir que fellipe_1693@outlook.com seja admin
-- Esta migration verifica se o usuário existe e configura como admin

-- Garantir que o profile existe e está marcado como admin
DO $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Buscar o ID do usuário pelo email
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = 'fellipe_1693@outlook.com'
  LIMIT 1;

  -- Se o usuário existe, garantir que o profile está configurado como admin
  IF v_user_id IS NOT NULL THEN
    INSERT INTO public.profiles (user_id, full_name, is_admin, status)
    VALUES (
      v_user_id,
      'Administrador',
      true,
      'active'
    )
    ON CONFLICT (user_id) 
    DO UPDATE SET 
      is_admin = true,
      status = 'active',
      full_name = COALESCE(profiles.full_name, 'Administrador');
    
    RAISE NOTICE 'Perfil do admin fellipe_1693@outlook.com configurado com sucesso';
  ELSE
    RAISE NOTICE 'Usuário fellipe_1693@outlook.com não encontrado no auth.users. Crie o usuário primeiro pelo Supabase Dashboard.';
  END IF;
END $$;

