-- ============================================
-- Migration: Controle de Sessão Única por Usuário
-- ============================================
-- Garante que apenas 1 dispositivo pode estar logado por usuário
-- Se um novo login for feito, a sessão anterior é invalidada
-- ============================================

-- Criar tabela para rastrear sessões ativas
CREATE TABLE IF NOT EXISTS public.user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_token TEXT NOT NULL, -- Access token do Supabase Auth
  device_info TEXT, -- Informações do dispositivo/navegador
  ip_address TEXT,
  user_agent TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_activity TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  
  UNIQUE(user_id, session_token)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON public.user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON public.user_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_user_sessions_active ON public.user_sessions(user_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires ON public.user_sessions(expires_at) WHERE expires_at IS NOT NULL;

-- Habilitar RLS
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
DROP POLICY IF EXISTS "Users can view their own sessions" ON public.user_sessions;
CREATE POLICY "Users can view their own sessions"
  ON public.user_sessions FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert their own sessions" ON public.user_sessions;
CREATE POLICY "Users can insert their own sessions"
  ON public.user_sessions FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own sessions" ON public.user_sessions;
CREATE POLICY "Users can update their own sessions"
  ON public.user_sessions FOR UPDATE
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete their own sessions" ON public.user_sessions;
CREATE POLICY "Users can delete their own sessions"
  ON public.user_sessions FOR DELETE
  USING (user_id = auth.uid());

-- ============================================
-- Função para criar/invalidar sessão
-- ============================================
-- Esta função:
-- 1. Invalida todas as sessões anteriores do usuário (is_active = false)
-- 2. Cria uma nova sessão ativa
-- 3. Retorna o ID da nova sessão
-- ============================================

CREATE OR REPLACE FUNCTION public.create_user_session(
  p_user_id UUID,
  p_session_token TEXT,
  p_device_info TEXT DEFAULT NULL,
  p_ip_address TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_expires_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session_id UUID;
  v_invalidated_count INTEGER;
BEGIN
  -- Invalidar todas as sessões anteriores do usuário
  UPDATE public.user_sessions
  SET is_active = false,
      last_activity = now()
  WHERE user_id = p_user_id
    AND is_active = true;
  
  GET DIAGNOSTICS v_invalidated_count = ROW_COUNT;
  
  -- Se houver sessões invalidadas, logar (opcional, para auditoria)
  IF v_invalidated_count > 0 THEN
    RAISE NOTICE 'Invalidated % previous session(s) for user %', v_invalidated_count, p_user_id;
  END IF;
  
  -- Criar nova sessão ativa
  INSERT INTO public.user_sessions (
    user_id,
    session_token,
    device_info,
    ip_address,
    user_agent,
    is_active,
    expires_at
  ) VALUES (
    p_user_id,
    p_session_token,
    p_device_info,
    p_ip_address,
    p_user_agent,
    true,
    p_expires_at
  )
  ON CONFLICT (user_id, session_token) DO UPDATE
  SET is_active = true,
      last_activity = now(),
      device_info = EXCLUDED.device_info,
      ip_address = EXCLUDED.ip_address,
      user_agent = EXCLUDED.user_agent,
      expires_at = EXCLUDED.expires_at
  RETURNING id INTO v_session_id;
  
  RETURN v_session_id;
END;
$$;

-- ============================================
-- Função para verificar se uma sessão é válida
-- ============================================

CREATE OR REPLACE FUNCTION public.is_session_valid(
  p_user_id UUID,
  p_session_token TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_valid BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM public.user_sessions
    WHERE user_id = p_user_id
      AND session_token = p_session_token
      AND is_active = true
      AND (expires_at IS NULL OR expires_at > now())
  ) INTO v_is_valid;
  
  RETURN COALESCE(v_is_valid, false);
END;
$$;

-- ============================================
-- Função para atualizar última atividade
-- ============================================

CREATE OR REPLACE FUNCTION public.update_session_activity(
  p_user_id UUID,
  p_session_token TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.user_sessions
  SET last_activity = now()
  WHERE user_id = p_user_id
    AND session_token = p_session_token
    AND is_active = true;
  
  RETURN FOUND;
END;
$$;

-- ============================================
-- Função para invalidar sessão (logout)
-- ============================================

CREATE OR REPLACE FUNCTION public.invalidate_user_session(
  p_user_id UUID,
  p_session_token TEXT
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
    AND session_token = p_session_token;
  
  RETURN FOUND;
END;
$$;

-- ============================================
-- Função para limpar sessões expiradas
-- ============================================

CREATE OR REPLACE FUNCTION public.cleanup_expired_sessions()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  DELETE FROM public.user_sessions
  WHERE expires_at IS NOT NULL
    AND expires_at < now()
    AND is_active = false;
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  
  RETURN v_deleted_count;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.create_user_session(UUID, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_session_valid(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_session_activity(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.invalidate_user_session(UUID, TEXT) TO authenticated;

-- ============================================
-- Trigger para limpar sessões expiradas periodicamente
-- ============================================
-- Nota: Você pode criar um cron job para chamar cleanup_expired_sessions()
-- ============================================

COMMENT ON TABLE public.user_sessions IS 'Rastreia sessões ativas de usuários para garantir apenas 1 dispositivo logado por vez';
COMMENT ON FUNCTION public.create_user_session IS 'Cria uma nova sessão e invalida sessões anteriores do mesmo usuário';
COMMENT ON FUNCTION public.is_session_valid IS 'Verifica se uma sessão é válida e ativa';
COMMENT ON FUNCTION public.update_session_activity IS 'Atualiza o timestamp de última atividade de uma sessão';
COMMENT ON FUNCTION public.invalidate_user_session IS 'Invalida uma sessão específica (logout)';
COMMENT ON FUNCTION public.cleanup_expired_sessions IS 'Remove sessões expiradas e inativas da base de dados';

