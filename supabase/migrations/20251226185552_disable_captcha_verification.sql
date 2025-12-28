-- ============================================
-- Migration: Desabilitar Verificação de Captcha
-- ============================================
-- Este problema ocorre quando o Supabase Auth detecta muitas tentativas de login
-- ou atividade suspeita e exige verificação de captcha.
-- 
-- IMPORTANTE: Esta migration documenta o problema e adiciona configurações
-- que podem ajudar, mas a solução principal deve ser feita no Supabase Dashboard:
--
-- 1. Acesse: Supabase Dashboard → Authentication → Settings
-- 2. Verifique as configurações de "Rate Limiting" e "Captcha"
-- 3. Se houver opção de captcha habilitada, desabilite ou ajuste os limites
-- 4. Aumente os limites de rate limiting se necessário
--
-- O erro "captcha verification process failed" geralmente ocorre quando:
-- - Há muitas tentativas de login em um curto período
-- - O Supabase detecta atividade suspeita
-- - Há configurações de segurança muito restritivas
-- ============================================

-- Criar tabela de configurações de autenticação (se não existir)
CREATE TABLE IF NOT EXISTS public.auth_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT NOT NULL UNIQUE,
  setting_value JSONB NOT NULL DEFAULT '{}'::jsonb,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.auth_settings ENABLE ROW LEVEL SECURITY;

-- Política: Apenas admins podem gerenciar configurações de autenticação
CREATE POLICY "Only admins can manage auth settings"
  ON public.auth_settings
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE user_id = auth.uid() AND is_admin = true
    )
  );

-- Política: Todos podem ler configurações (mas valores sensíveis devem ser filtrados)
CREATE POLICY "Anyone can read auth settings"
  ON public.auth_settings
  FOR SELECT
  TO authenticated, anon
  USING (true);

-- Inserir configuração documentando o problema do captcha
INSERT INTO public.auth_settings (setting_key, setting_value, description)
VALUES (
  'captcha_issue_documented',
  '{
    "issue": "captcha verification process failed",
    "date": "2025-12-26",
    "solution": "Verificar configurações no Supabase Dashboard → Authentication → Settings",
    "notes": "O captcha é controlado pelo Supabase Auth e não pode ser desabilitado via SQL. Ajuste as configurações de rate limiting e captcha no dashboard."
  }'::jsonb,
  'Documentação do problema de captcha e solução'
)
ON CONFLICT (setting_key) DO UPDATE
SET setting_value = EXCLUDED.setting_value,
    updated_at = now();

-- Criar função para obter configurações de autenticação
CREATE OR REPLACE FUNCTION public.get_auth_setting(p_setting_key TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_value JSONB;
BEGIN
  SELECT setting_value INTO v_value
  FROM public.auth_settings
  WHERE setting_key = p_setting_key;
  
  RETURN COALESCE(v_value, '{}'::jsonb);
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.get_auth_setting(TEXT) TO authenticated, anon;

-- Comentários
COMMENT ON TABLE public.auth_settings IS 'Configurações de autenticação e documentação de problemas relacionados';
COMMENT ON FUNCTION public.get_auth_setting IS 'Retorna o valor de uma configuração de autenticação';

-- ============================================
-- NOTA IMPORTANTE:
-- ============================================
-- Esta migration NÃO desabilita o captcha diretamente, pois isso é controlado
-- pelo Supabase Auth no nível da plataforma.
--
-- Para resolver o problema do captcha:
-- 1. Acesse o Supabase Dashboard
-- 2. Vá em Authentication → Settings
-- 3. Procure por "Rate Limiting" ou "Captcha"
-- 4. Ajuste ou desabilite conforme necessário
--
-- Alternativamente, você pode:
-- - Aguardar alguns minutos entre tentativas de login
-- - Limpar o cache do navegador
-- - Usar uma aba anônima
-- ============================================



