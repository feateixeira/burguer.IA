-- ============================================
-- Migration: Corrigir sistema de sessão única
-- ============================================
-- Problema: access_token muda quando renovado, causando logout falso
-- Solução: Usar refresh_token que é mais estável
-- ============================================

-- Adicionar coluna refresh_token se não existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'user_sessions' 
    AND column_name = 'refresh_token'
  ) THEN
    ALTER TABLE public.user_sessions 
    ADD COLUMN refresh_token TEXT;
    
    -- Criar índice para refresh_token
    CREATE INDEX IF NOT EXISTS idx_user_sessions_refresh_token 
    ON public.user_sessions(refresh_token);
  END IF;
END $$;

-- Atualizar constraint UNIQUE para incluir refresh_token
-- Primeiro, remover constraint antiga se existir
DO $$
BEGIN
  IF EXISTS (
    SELECT FROM pg_constraint 
    WHERE conname = 'user_sessions_user_id_session_token_key'
  ) THEN
    ALTER TABLE public.user_sessions 
    DROP CONSTRAINT user_sessions_user_id_session_token_key;
  END IF;
END $$;

-- Criar índice parcial único para garantir apenas 1 sessão ativa por usuário
-- Nota: PostgreSQL permite índices únicos parciais com WHERE
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT FROM pg_indexes 
    WHERE indexname = 'user_sessions_user_id_active_key'
  ) THEN
    -- Criar índice único parcial para garantir apenas 1 sessão ativa por usuário
    CREATE UNIQUE INDEX user_sessions_user_id_active_key 
    ON public.user_sessions(user_id) 
    WHERE is_active = true;
  END IF;
END $$;

-- ============================================
-- Atualizar função create_user_session para usar refresh_token
-- ============================================

CREATE OR REPLACE FUNCTION public.create_user_session(
  p_user_id UUID,
  p_session_token TEXT,
  p_refresh_token TEXT DEFAULT NULL,
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
  -- Como todas as sessões anteriores foram invalidadas, sempre criamos uma nova
  INSERT INTO public.user_sessions (
    user_id,
    session_token,
    refresh_token,
    device_info,
    ip_address,
    user_agent,
    is_active,
    expires_at
  ) VALUES (
    p_user_id,
    p_session_token,
    p_refresh_token,
    p_device_info,
    p_ip_address,
    p_user_agent,
    true,
    p_expires_at
  )
  RETURNING id INTO v_session_id;
  
  RETURN v_session_id;
END;
$$;

-- ============================================
-- Atualizar função is_session_valid para usar refresh_token
-- ============================================

-- Remover função antiga se existir (para permitir mudança de parâmetros)
-- Importante: DROP com todas as variações possíveis da assinatura
DROP FUNCTION IF EXISTS public.is_session_valid(UUID, TEXT) CASCADE;

-- Criar nova versão da função com refresh_token
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
  SELECT EXISTS (
    SELECT 1
    FROM public.user_sessions
    WHERE user_id = p_user_id
      AND refresh_token = p_refresh_token
      AND is_active = true
      AND (expires_at IS NULL OR expires_at > now())
  ) INTO v_is_valid;
  
  RETURN COALESCE(v_is_valid, false);
END;
$$;

-- ============================================
-- Atualizar função update_session_activity para aceitar refresh_token
-- E também atualizar access_token quando renovado
-- ============================================

-- Remover função antiga se existir (para permitir mudança de parâmetros)
-- Importante: DROP com todas as variações possíveis da assinatura
DROP FUNCTION IF EXISTS public.update_session_activity(UUID, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.update_session_activity(UUID, TEXT, TEXT) CASCADE;

-- Criar nova versão da função
CREATE OR REPLACE FUNCTION public.update_session_activity(
  p_user_id UUID,
  p_refresh_token TEXT,
  p_session_token TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.user_sessions
  SET last_activity = now(),
      session_token = COALESCE(p_session_token, session_token) -- Atualiza access_token se fornecido
  WHERE user_id = p_user_id
    AND refresh_token = p_refresh_token
    AND is_active = true;
  
  RETURN FOUND;
END;
$$;

-- ============================================
-- Atualizar função invalidate_user_session para usar refresh_token
-- ============================================

-- Remover função antiga se existir (para permitir mudança de parâmetros)
-- Importante: DROP com todas as variações possíveis da assinatura
DROP FUNCTION IF EXISTS public.invalidate_user_session(UUID, TEXT) CASCADE;

-- Criar nova versão da função
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

-- ============================================
-- Nova função: atualizar token quando renovado
-- ============================================

CREATE OR REPLACE FUNCTION public.update_session_token(
  p_user_id UUID,
  p_refresh_token TEXT,
  p_new_session_token TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.user_sessions
  SET session_token = p_new_session_token,
      last_activity = now()
  WHERE user_id = p_user_id
    AND refresh_token = p_refresh_token
    AND is_active = true;
  
  RETURN FOUND;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.create_user_session(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_session_valid(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_session_activity(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.invalidate_user_session(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_session_token(UUID, TEXT, TEXT) TO authenticated;

COMMENT ON FUNCTION public.update_session_token IS 'Atualiza o access_token quando ele é renovado pelo Supabase';

