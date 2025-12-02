-- ============================================
-- MIGRATION: Corrigir problemas de segurança
-- ============================================
-- 1. Remover SECURITY DEFINER das views
-- 2. Habilitar RLS na tabela promotion_products
-- ============================================

-- ============================================
-- 1. CORRIGIR VIEW: current_user_roles
-- ============================================
-- Recriar a view sem SECURITY DEFINER
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

-- Habilitar RLS na view (se suportado) ou criar políticas na tabela base
-- Como views não suportam RLS diretamente, as políticas devem estar na tabela user_roles
-- que já tem RLS habilitado

-- Comentário explicativo
COMMENT ON VIEW public.current_user_roles IS 'View que retorna os roles do usuário atual. RLS é aplicado através da tabela base user_roles.';

-- ============================================
-- 2. CORRIGIR VIEW: v_user_establishments
-- ============================================
-- Recriar a view sem SECURITY DEFINER
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
COMMENT ON VIEW public.v_user_establishments IS 'View que retorna os estabelecimentos do usuário atual. RLS é aplicado através das tabelas base profiles e user_roles.';

-- ============================================
-- 3. HABILITAR RLS NA TABELA: promotion_products
-- ============================================
ALTER TABLE public.promotion_products ENABLE ROW LEVEL SECURITY;

-- Política: Usuários podem ver produtos de promoções do seu estabelecimento
DROP POLICY IF EXISTS "Users can view promotion products from their establishment" ON public.promotion_products;
CREATE POLICY "Users can view promotion products from their establishment"
  ON public.promotion_products FOR SELECT
  USING (
    EXISTS (
      SELECT 1 
      FROM public.promotions p
      WHERE p.id = promotion_products.promotion_id
        AND p.establishment_id IN (
          SELECT establishment_id 
          FROM public.profiles 
          WHERE user_id = auth.uid()
        )
    )
  );

-- Política: Usuários podem inserir produtos de promoções do seu estabelecimento
DROP POLICY IF EXISTS "Users can insert promotion products in their establishment" ON public.promotion_products;
CREATE POLICY "Users can insert promotion products in their establishment"
  ON public.promotion_products FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 
      FROM public.promotions p
      WHERE p.id = promotion_products.promotion_id
        AND p.establishment_id IN (
          SELECT establishment_id 
          FROM public.profiles 
          WHERE user_id = auth.uid()
        )
    )
  );

-- Política: Usuários podem atualizar produtos de promoções do seu estabelecimento
DROP POLICY IF EXISTS "Users can update promotion products in their establishment" ON public.promotion_products;
CREATE POLICY "Users can update promotion products in their establishment"
  ON public.promotion_products FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 
      FROM public.promotions p
      WHERE p.id = promotion_products.promotion_id
        AND p.establishment_id IN (
          SELECT establishment_id 
          FROM public.profiles 
          WHERE user_id = auth.uid()
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 
      FROM public.promotions p
      WHERE p.id = promotion_products.promotion_id
        AND p.establishment_id IN (
          SELECT establishment_id 
          FROM public.profiles 
          WHERE user_id = auth.uid()
        )
    )
  );

-- Política: Usuários podem deletar produtos de promoções do seu estabelecimento
DROP POLICY IF EXISTS "Users can delete promotion products from their establishment" ON public.promotion_products;
CREATE POLICY "Users can delete promotion products from their establishment"
  ON public.promotion_products FOR DELETE
  USING (
    EXISTS (
      SELECT 1 
      FROM public.promotions p
      WHERE p.id = promotion_products.promotion_id
        AND p.establishment_id IN (
          SELECT establishment_id 
          FROM public.profiles 
          WHERE user_id = auth.uid()
        )
    )
  );

-- Comentário explicativo
COMMENT ON TABLE public.promotion_products IS 'Tabela que relaciona múltiplos produtos com uma promoção. RLS habilitado para garantir que usuários só acessem dados do seu estabelecimento.';

