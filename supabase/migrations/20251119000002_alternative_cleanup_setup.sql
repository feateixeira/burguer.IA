-- Migration: Configuração alternativa para limpeza automática sem pg_cron
-- Como pg_cron pode não estar disponível no Supabase, esta migration oferece alternativas

-- ============================================
-- OPÇÃO 1: Executar manualmente via SQL Editor
-- ============================================

-- Execute este comando periodicamente (diariamente) no SQL Editor:
-- SELECT public.cron_cleanup_blocked_users();

-- ============================================
-- OPÇÃO 2: Usar Edge Function (recomendado)
-- ============================================

-- A Edge Function foi criada em: supabase/functions/cleanup-blocked-users/index.ts
-- 
-- Para agendar via serviços externos:
-- 1. Use um serviço como cron-job.org, EasyCron, ou GitHub Actions
-- 2. Configure para chamar a URL da Edge Function diariamente às 2h da manhã
-- 3. URL: https://[seu-projeto].supabase.co/functions/v1/cleanup-blocked-users
-- 4. Headers necessários:
--    - Authorization: Bearer [SUPABASE_ANON_KEY]
--    - apikey: [SUPABASE_ANON_KEY]

-- ============================================
-- OPÇÃO 3: Criar função que pode ser chamada via webhook
-- ============================================

-- Criar função pública que pode ser chamada via HTTP
CREATE OR REPLACE FUNCTION public.cleanup_blocked_users_webhook()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result RECORD;
  v_summary JSON;
  v_total_users INTEGER := 0;
  v_total_orders INTEGER := 0;
  v_total_products INTEGER := 0;
BEGIN
  -- Executar limpeza
  FOR v_result IN
    SELECT * FROM public.cleanup_blocked_users_data()
  LOOP
    v_total_users := v_total_users + 1;
    v_total_orders := v_total_orders + COALESCE(v_result.deleted_orders, 0);
    v_total_products := v_total_products + COALESCE(v_result.deleted_products, 0);
  END LOOP;
  
  -- Retornar resumo em JSON
  v_summary := json_build_object(
    'success', true,
    'timestamp', NOW(),
    'total_users_processed', v_total_users,
    'total_orders_deleted', v_total_orders,
    'total_products_deleted', v_total_products
  );
  
  RETURN v_summary;
END;
$$;

-- Permitir execução pública (para webhook)
GRANT EXECUTE ON FUNCTION public.cleanup_blocked_users_webhook() TO anon;
GRANT EXECUTE ON FUNCTION public.cleanup_blocked_users_webhook() TO authenticated;

-- ============================================
-- OPÇÃO 4: Usar Supabase Database Webhooks (se disponível)
-- ============================================

-- Configure um webhook no Supabase Dashboard:
-- 1. Vá em Database → Webhooks
-- 2. Crie um novo webhook
-- 3. Configure para chamar a Edge Function ou uma URL externa
-- 4. Configure o trigger (exemplo: quando um usuário é bloqueado)

-- ============================================
-- INSTRUÇÕES PARA CONFIGURAR CRON EXTERNO
-- ============================================

-- Exemplo usando cron-job.org:
-- 1. Acesse https://cron-job.org
-- 2. Crie uma conta gratuita
-- 3. Adicione novo job:
--    - URL: https://[seu-projeto].supabase.co/functions/v1/cleanup-blocked-users
--    - Método: POST
--    - Headers:
--      Authorization: Bearer [SUPABASE_ANON_KEY]
--      apikey: [SUPABASE_ANON_KEY]
--    - Schedule: Diariamente às 2h da manhã (0 2 * * *)
--
-- Exemplo usando GitHub Actions (se o código estiver no GitHub):
-- Crie .github/workflows/cleanup-blocked-users.yml:
-- 
-- name: Cleanup Blocked Users
-- on:
--   schedule:
--     - cron: '0 2 * * *'  # Diariamente às 2h UTC
--   workflow_dispatch:  # Permite execução manual
-- jobs:
--   cleanup:
--     runs-on: ubuntu-latest
--     steps:
--       - name: Call Supabase Function
--         run: |
--           curl -X POST \
--             -H "Authorization: Bearer ${{ secrets.SUPABASE_ANON_KEY }}" \
--             -H "apikey: ${{ secrets.SUPABASE_ANON_KEY }}" \
--             https://[seu-projeto].supabase.co/functions/v1/cleanup-blocked-users

-- ============================================
-- TESTE MANUAL
-- ============================================

-- Para testar a função manualmente:
-- SELECT public.cron_cleanup_blocked_users();

-- Para testar a função webhook:
-- SELECT public.cleanup_blocked_users_webhook();

-- ============================================
-- NOTAS IMPORTANTES
-- ============================================

-- 1. A função pode ser executada manualmente a qualquer momento
-- 2. Recomenda-se executar diariamente, preferencialmente em horário de baixo tráfego
-- 3. A função é idempotente - pode ser executada múltiplas vezes sem problemas
-- 4. A função registra logs detalhados de todas as operações
-- 5. Em caso de erro em um usuário específico, a função continua processando os demais

