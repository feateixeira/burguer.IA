-- ============================================
-- Migration: Remover expiração automática de sessões
-- ============================================
-- Problema: Sessões estavam sendo invalidadas por tempo de expiração
-- Solução: Remover verificação de expires_at - sessões só expiram quando:
-- 1. Outro dispositivo faz login
-- 2. Usuário fecha navegador (logout explícito)
-- 3. Usuário faz logout manual
-- ============================================

-- Atualizar função is_session_valid para NÃO verificar expires_at
-- Sessões nunca expiram por tempo - apenas por invalidação explícita
CREATE OR REPLACE FUNCTION public.is_session_valid(
  p_user_id UUID,
  p_refresh_token TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_valid BOOLEAN;
BEGIN
  -- Verificar se há uma sessão ativa para este usuário com este refresh_token
  -- REMOVIDO: verificação de expires_at - sessões não expiram por tempo
  -- Sessões só são invalidadas explicitamente (novo login em outro dispositivo, logout, etc)
  SELECT EXISTS (
    SELECT 1
    FROM public.user_sessions
    WHERE user_id = p_user_id
      AND refresh_token = p_refresh_token
      AND is_active = true
      -- REMOVIDO: AND (expires_at IS NULL OR expires_at > now())
      -- Sessões nunca expiram automaticamente por tempo
  ) INTO v_is_valid;
  
  RETURN COALESCE(v_is_valid, false);
END;
$$;

-- Atualizar função update_session_token para também atualizar expires_at quando fornecido
-- Primeiro, remover a função antiga (com 3 parâmetros) para evitar conflito
DROP FUNCTION IF EXISTS public.update_session_token(UUID, TEXT, TEXT) CASCADE;

-- Criar nova versão com 4 parâmetros (adicionando p_expires_at)
CREATE OR REPLACE FUNCTION public.update_session_token(
  p_user_id UUID,
  p_refresh_token TEXT,
  p_new_session_token TEXT,
  p_expires_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.user_sessions
  SET session_token = p_new_session_token,
      expires_at = COALESCE(p_expires_at, expires_at), -- Atualiza expires_at se fornecido
      last_activity = now()
  WHERE user_id = p_user_id
    AND refresh_token = p_refresh_token
    AND is_active = true;
  
  RETURN FOUND;
END;
$$;

-- Atualizar função update_session_activity para também atualizar expires_at se necessário
-- Primeiro, remover as funções antigas (com 2 e 3 parâmetros) para evitar conflito
DROP FUNCTION IF EXISTS public.update_session_activity(UUID, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.update_session_activity(UUID, TEXT, TEXT) CASCADE;

-- Criar nova versão com 4 parâmetros (adicionando p_expires_at)
CREATE OR REPLACE FUNCTION public.update_session_activity(
  p_user_id UUID,
  p_refresh_token TEXT,
  p_session_token TEXT DEFAULT NULL,
  p_expires_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.user_sessions
  SET last_activity = now(),
      session_token = COALESCE(p_session_token, session_token),
      expires_at = COALESCE(p_expires_at, expires_at) -- Atualiza expires_at se fornecido
  WHERE user_id = p_user_id
    AND refresh_token = p_refresh_token
    AND is_active = true;
  
  RETURN FOUND;
END;
$$;

-- Atualizar função invalidate_user_session para usar refresh_token (garantir consistência)
-- Remover função antiga se existir (com session_token)
DROP FUNCTION IF EXISTS public.invalidate_user_session(UUID, TEXT) CASCADE;

-- Criar nova versão usando refresh_token
CREATE OR REPLACE FUNCTION public.invalidate_user_session(
  p_user_id UUID,
  p_refresh_token TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.user_sessions
  SET is_active = false,
      last_activity = now()
  WHERE user_id = p_user_id
    AND refresh_token = p_refresh_token;
  
  RETURN FOUND;
END;
$$;

-- Comentários atualizados
COMMENT ON FUNCTION public.is_session_valid IS 'Verifica se uma sessão está ativa. Sessões NÃO expiram por tempo - apenas por invalidação explícita.';
COMMENT ON FUNCTION public.update_session_token IS 'Atualiza o access_token e expires_at quando renovado pelo Supabase';
COMMENT ON FUNCTION public.update_session_activity IS 'Atualiza última atividade da sessão e opcionalmente atualiza access_token e expires_at';
COMMENT ON FUNCTION public.invalidate_user_session IS 'Invalida uma sessão específica usando refresh_token (logout)';

-- Grant permissions (já devem estar concedidos, mas garantindo)
GRANT EXECUTE ON FUNCTION public.is_session_valid(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_session_token(UUID, TEXT, TEXT, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_session_activity(UUID, TEXT, TEXT, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.invalidate_user_session(UUID, TEXT) TO authenticated;

