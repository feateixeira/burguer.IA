-- ============================================
-- Migration: Corrigir problemas de segurança RLS
-- ============================================
-- Problema: Algumas tabelas podem não ter RLS habilitado
-- Solução: Habilitar RLS em todas as tabelas do schema público
-- ============================================

-- ============================================
-- 1. HABILITAR RLS EM TODAS AS TABELAS DO SCHEMA PÚBLICO
-- ============================================
-- Garante que todas as tabelas expostas ao PostgREST tenham RLS habilitado

DO $$
DECLARE
  tbl_record RECORD;
BEGIN
  -- Iterar sobre todas as tabelas no schema público
  FOR tbl_record IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename NOT LIKE 'pg_%'
      AND tablename NOT LIKE '_realtime%'
      AND tablename NOT LIKE 'storage%'
  LOOP
    -- Verificar se RLS já está habilitado
    IF NOT EXISTS (
      SELECT 1
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname = tbl_record.tablename
        AND c.relrowsecurity = true
    ) THEN
      -- Habilitar RLS na tabela
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl_record.tablename);
      RAISE NOTICE 'RLS habilitado na tabela: %', tbl_record.tablename;
    END IF;
  END LOOP;
END $$;

-- ============================================
-- 2. VERIFICAR E GARANTIR RLS EM TABELAS ESPECÍFICAS
-- ============================================

-- Garantir que user_sessions tem RLS habilitado (já deve ter, mas garantir)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'user_sessions') THEN
    ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- ============================================
-- 3. DOCUMENTAÇÃO SOBRE FUNÇÕES SECURITY DEFINER
-- ============================================
-- NOTA: As funções SECURITY DEFINER são necessárias para:
-- 1. Criar/invalidar sessões de usuários (create_user_session, invalidate_user_session)
-- 2. Verificar validade de sessões (is_session_valid)
-- 3. Atualizar tokens de sessão (update_session_token, update_session_activity)
--
-- Essas funções precisam de SECURITY DEFINER porque:
-- - Precisam contornar RLS para invalidar sessões de outros usuários
-- - Precisam verificar sessões sem passar por políticas RLS
-- - São chamadas apenas por usuários autenticados (GRANT EXECUTE TO authenticated)
--
-- Isso é seguro porque:
-- - As funções verificam que o usuário autenticado é o dono da sessão
-- - Apenas usuários autenticados podem executar essas funções
-- - As funções não expõem dados sensíveis além do necessário

-- ============================================
-- 4. VERIFICAR SE HÁ VIEWS NO SCHEMA PÚBLICO
-- ============================================
-- Views no Supabase não devem usar SECURITY DEFINER diretamente
-- Se houver views, elas devem usar funções SECURITY DEFINER apenas quando necessário

DO $$
DECLARE
  view_count INTEGER;
BEGIN
  -- Contar views no schema público
  SELECT COUNT(*)
  INTO view_count
  FROM pg_views
  WHERE schemaname = 'public';
  
  IF view_count > 0 THEN
    RAISE NOTICE 'Encontradas % view(s) no schema público. Verifique se estão usando SECURITY DEFINER corretamente.', view_count;
  END IF;
END $$;

-- ============================================
-- 5. GARANTIR QUE POLÍTICAS RLS ESTÃO CRIADAS PARA user_sessions
-- ============================================

-- Verificar e criar políticas se a tabela existir
DO $$
BEGIN
  -- Verificar se a tabela existe antes de criar políticas
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'user_sessions') THEN
    -- Política de SELECT
    DROP POLICY IF EXISTS "Users can view their own sessions" ON public.user_sessions;
    CREATE POLICY "Users can view their own sessions"
      ON public.user_sessions FOR SELECT
      USING (user_id = auth.uid());

    -- Política de INSERT
    DROP POLICY IF EXISTS "Users can insert their own sessions" ON public.user_sessions;
    CREATE POLICY "Users can insert their own sessions"
      ON public.user_sessions FOR INSERT
      WITH CHECK (user_id = auth.uid());

    -- Política de UPDATE
    DROP POLICY IF EXISTS "Users can update their own sessions" ON public.user_sessions;
    CREATE POLICY "Users can update their own sessions"
      ON public.user_sessions FOR UPDATE
      USING (user_id = auth.uid());

    -- Política de DELETE
    DROP POLICY IF EXISTS "Users can delete their own sessions" ON public.user_sessions;
    CREATE POLICY "Users can delete their own sessions"
      ON public.user_sessions FOR DELETE
      USING (user_id = auth.uid());
  END IF;
END $$;

-- ============================================
-- 6. REMOVER FUNÇÕES ANTIGAS COM ASSINATURAS DIFERENTES
-- ============================================
-- Remover versões antigas conhecidas que podem causar ambiguidade
-- A versão atual de create_user_session tem 7 parâmetros (com refresh_token)

-- Remover versão antiga de create_user_session sem refresh_token (6 parâmetros)
DROP FUNCTION IF EXISTS public.create_user_session(UUID, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ) CASCADE;

-- Remover versões antigas de update_session_token (3 parâmetros)
-- A versão atual tem 4 parâmetros incluindo expires_at
DROP FUNCTION IF EXISTS public.update_session_token(UUID, TEXT, TEXT) CASCADE;

-- Remover versões antigas de update_session_activity
DROP FUNCTION IF EXISTS public.update_session_activity(UUID, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.update_session_activity(UUID, TEXT, TEXT) CASCADE;

-- ============================================
-- 7. COMENTÁRIOS DE DOCUMENTAÇÃO
-- ============================================
-- Após remover versões antigas, adicionar comentários com assinatura completa

COMMENT ON TABLE public.user_sessions IS 
'Rastreia sessões ativas de usuários para garantir apenas 1 dispositivo logado por vez. RLS habilitado com políticas que permitem usuários gerenciarem apenas suas próprias sessões.';

-- Adicionar comentários usando EXECUTE para evitar ambiguidade
DO $$
BEGIN
  -- Comentar create_user_session com assinatura completa (7 parâmetros)
  -- Usar EXECUTE para evitar erro de ambiguidade
  BEGIN
    EXECUTE 'COMMENT ON FUNCTION public.create_user_session(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ) IS 
      ''Cria uma nova sessão e invalida sessões anteriores do mesmo usuário. Usa SECURITY DEFINER para contornar RLS e invalidar sessões de outros dispositivos. Seguro porque apenas usuários autenticados podem executar.''';
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE 'Não foi possível adicionar comentário em create_user_session: %', SQLERRM;
  END;

  -- Comentar is_session_valid (2 parâmetros: UUID, TEXT)
  BEGIN
    EXECUTE 'COMMENT ON FUNCTION public.is_session_valid(UUID, TEXT) IS 
      ''Verifica se uma sessão está ativa usando refresh_token. Usa SECURITY DEFINER para verificar sessões sem passar por políticas RLS. Seguro porque apenas usuários autenticados podem executar.''';
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE 'Não foi possível adicionar comentário em is_session_valid: %', SQLERRM;
  END;

  -- Comentar update_session_token (4 parâmetros)
  BEGIN
    EXECUTE 'COMMENT ON FUNCTION public.update_session_token(UUID, TEXT, TEXT, TIMESTAMPTZ) IS 
      ''Atualiza o access_token quando renovado pelo Supabase. Usa SECURITY DEFINER para atualizar tokens sem passar por políticas RLS. Seguro porque apenas usuários autenticados podem executar.''';
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE 'Não foi possível adicionar comentário em update_session_token: %', SQLERRM;
  END;

  -- Comentar update_session_activity (4 parâmetros)
  BEGIN
    EXECUTE 'COMMENT ON FUNCTION public.update_session_activity(UUID, TEXT, TEXT, TIMESTAMPTZ) IS 
      ''Atualiza última atividade da sessão. Usa SECURITY DEFINER para atualizar atividades sem passar por políticas RLS. Seguro porque apenas usuários autenticados podem executar.''';
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE 'Não foi possível adicionar comentário em update_session_activity: %', SQLERRM;
  END;

  -- Comentar invalidate_user_session (2 parâmetros: UUID, TEXT)
  BEGIN
    EXECUTE 'COMMENT ON FUNCTION public.invalidate_user_session(UUID, TEXT) IS 
      ''Invalida uma sessão específica usando refresh_token (logout). Usa SECURITY DEFINER para invalidar sessões sem passar por políticas RLS. Seguro porque apenas usuários autenticados podem executar.''';
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE 'Não foi possível adicionar comentário em invalidate_user_session: %', SQLERRM;
  END;
END $$;

-- ============================================
-- FIM DA MIGRATION
-- ============================================

