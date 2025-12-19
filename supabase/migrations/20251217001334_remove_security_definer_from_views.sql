-- ============================================
-- MIGRATION: Remover SECURITY DEFINER das Views
-- ============================================
-- Esta migração garante que as views v_user_establishments e current_user_roles
-- sejam recriadas SEM a propriedade SECURITY DEFINER.
-- 
-- Views com SECURITY DEFINER executam com as permissões do criador da view,
-- não do usuário que consulta, o que pode ser um risco de segurança.
-- 
-- A segurança é garantida através de:
-- 1. Uso direto de auth.uid() nas cláusulas WHERE
-- 2. RLS (Row Level Security) nas tabelas base (user_roles, profiles, establishments)
-- ============================================

-- ============================================
-- 1. RECRIAR VIEW: current_user_roles
-- ============================================
-- Remove a view existente (com ou sem SECURITY DEFINER) e recria sem SECURITY DEFINER
DROP VIEW IF EXISTS public.current_user_roles CASCADE;

CREATE VIEW public.current_user_roles AS
SELECT 
  ur.id,
  ur.user_id,
  ur.establishment_id,
  ur.role,
  ur.created_at,
  ur.created_by
FROM public.user_roles ur
WHERE ur.user_id = auth.uid();

-- Comentário explicativo
COMMENT ON VIEW public.current_user_roles IS 
'View que retorna os roles do usuário atual. 
NÃO usa SECURITY DEFINER - a segurança é garantida através de:
1. Filtro direto usando auth.uid() na cláusula WHERE
2. RLS (Row Level Security) na tabela base user_roles que já está habilitado';

-- ============================================
-- 2. RECRIAR VIEW: v_user_establishments
-- ============================================
-- Remove a view existente (com ou sem SECURITY DEFINER) e recria sem SECURITY DEFINER
DROP VIEW IF EXISTS public.v_user_establishments CASCADE;

CREATE VIEW public.v_user_establishments AS
SELECT DISTINCT
  e.id,
  e.name,
  e.slug,
  e.pix_key_value,
  e.pix_key_type,
  e.pix_holder_name,
  e.pix_bank_name,
  e.created_at,
  e.updated_at,
  p.user_id
FROM public.establishments e
INNER JOIN public.profiles p ON p.establishment_id = e.id
WHERE p.user_id = auth.uid()
   OR EXISTS (
     SELECT 1 
     FROM public.user_roles ur 
     WHERE ur.user_id = auth.uid() 
       AND ur.establishment_id = e.id
   );

-- Comentário explicativo
COMMENT ON VIEW public.v_user_establishments IS 
'View que retorna os estabelecimentos do usuário atual. 
NÃO usa SECURITY DEFINER - a segurança é garantida através de:
1. Filtro direto usando auth.uid() na cláusula WHERE
2. RLS (Row Level Security) nas tabelas base profiles, user_roles e establishments que já estão habilitados';

