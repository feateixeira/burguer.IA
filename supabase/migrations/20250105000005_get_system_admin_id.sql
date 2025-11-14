-- Função RPC para obter o user_id do admin do sistema (fellipe_1693@outlook.com)
-- Usa SECURITY DEFINER para contornar RLS
CREATE OR REPLACE FUNCTION public.get_system_admin_id()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  admin_user_id uuid;
BEGIN
  -- Buscar o user_id do fellipe_1693@outlook.com
  SELECT u.id INTO admin_user_id
  FROM auth.users u
  WHERE u.email = 'fellipe_1693@outlook.com'
  LIMIT 1;
  
  RETURN admin_user_id;
END;
$$;

-- Garante que usuários autenticados podem executar a função
GRANT EXECUTE ON FUNCTION public.get_system_admin_id() TO authenticated;

