-- ============================================
-- Migration: Deletar caixas fechados de teste do Na Brasa
-- Data: 2025-11-16
-- ============================================
-- Esta migration remove os 3 registros de teste de cash_sessions
-- do estabelecimento Na Brasa criados em 14/11, 15/11 e 16/11/2025
-- UID do usuário Na Brasa: 213a8e36-66f8-42b3-901c-6f13418499af
-- 
-- IDs dos registros a serem deletados (identificados via diagnóstico):
-- 1. 8e2e439a-b80e-452f-be75-e34b81eaefb3 (16/11/2025 17:31 UTC = 14:31 local)
-- 2. c89053ac-d54d-4758-8e63-16235e0a9340 (15/11/2025 17:54 UTC = 14:54 local)
-- 3. 0bf8202c-2ef2-4236-bc84-9cef6ea5352b (14/11/2025 17:48 UTC = 14:48 local)
-- ============================================

DO $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  -- Deletar diretamente pelos IDs identificados
  DELETE FROM public.cash_sessions
  WHERE id IN (
    '8e2e439a-b80e-452f-be75-e34b81eaefb3',  -- 16/11/2025 17:31 UTC
    'c89053ac-d54d-4758-8e63-16235e0a9340',  -- 15/11/2025 17:54 UTC
    '0bf8202c-2ef2-4236-bc84-9cef6ea5352b'   -- 14/11/2025 17:48 UTC
  );

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  
  RAISE NOTICE 'Registros deletados: %', v_deleted_count;
  
  IF v_deleted_count < 3 THEN
    RAISE WARNING 'Esperava deletar 3 registros, mas deletou apenas %', v_deleted_count;
  END IF;
END $$;

-- Verificação final: confirmar que os registros foram deletados
DO $$
DECLARE
  v_remaining_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_remaining_count
  FROM public.cash_sessions
  WHERE id IN (
    '8e2e439a-b80e-452f-be75-e34b81eaefb3',
    'c89053ac-d54d-4758-8e63-16235e0a9340',
    '0bf8202c-2ef2-4236-bc84-9cef6ea5352b'
  );

  IF v_remaining_count = 0 THEN
    RAISE NOTICE '✓ Sucesso! Todos os 3 registros de teste foram deletados.';
  ELSE
    RAISE WARNING 'Atenção! Ainda restam % registro(s) com esses IDs.', v_remaining_count;
  END IF;
END $$;

