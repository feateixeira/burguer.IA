-- ============================================
-- Migration: Excluir usuários específicos e todas suas dependências
-- ============================================
-- Esta migration exclui completamente dois usuários específicos:
-- - 0158ac47-af0e-41af-9d24-77f78fcb6320
-- - 5e38e713-aa55-47b9-ae7b-4c7bc605e2d3
-- ============================================

DO $$
DECLARE
  user_id_1 UUID := '0158ac47-af0e-41af-9d24-77f78fcb6320';
  user_id_2 UUID := '5e38e713-aa55-47b9-ae7b-4c7bc605e2d3';
  deleted_count INTEGER;
BEGIN
  -- ============================================
  -- Excluir dados relacionados ao primeiro usuário
  -- ============================================
  
  -- 1. Excluir audit_logs onde o usuário é actor_id
  DELETE FROM public.audit_logs WHERE actor_id = user_id_1;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'Excluídos % registros de audit_logs para usuário 1', deleted_count;
  
  -- 2. Excluir team_members onde o usuário está relacionado
  DELETE FROM public.team_members WHERE user_id = user_id_1;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'Excluídos % registros de team_members para usuário 1', deleted_count;
  
  -- 3. Excluir cash_transactions relacionados primeiro
  DELETE FROM public.cash_transactions ct
  WHERE EXISTS (
    SELECT 1 FROM public.cash_sessions cs
    WHERE cs.id = ct.cash_session_id
    AND (cs.opened_by = user_id_1 OR cs.closed_by = user_id_1)
  );
  
  -- Também excluir cash_transactions onde created_by = user_id_1
  DELETE FROM public.cash_transactions WHERE created_by = user_id_1;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'Excluídos % registros de cash_transactions para usuário 1', deleted_count;
  
  -- 4. Excluir cash_sessions onde o usuário abriu (opened_by é NOT NULL, precisa deletar)
  DELETE FROM public.cash_sessions WHERE opened_by = user_id_1;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'Excluídas % sessões de caixa abertas pelo usuário 1', deleted_count;
  
  -- 4b. Se existir cash_registers (pode ser um alias ou nome alternativo)
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'cash_registers') THEN
    DELETE FROM public.cash_registers WHERE opened_by = user_id_1;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'Excluídos % registros de cash_registers para usuário 1', deleted_count;
  END IF;
  
  -- 5. Atualizar closed_by para NULL onde o usuário fechou
  UPDATE public.cash_sessions SET closed_by = NULL WHERE closed_by = user_id_1;
  
  -- 5b. Se existir cash_registers, atualizar também
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'cash_registers') THEN
    UPDATE public.cash_registers SET closed_by = NULL WHERE closed_by = user_id_1;
  END IF;
  
  -- 5c. Se existir pix_key_audit, excluir registros (changed_by é NOT NULL)
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'pix_key_audit') THEN
    DELETE FROM public.pix_key_audit WHERE changed_by = user_id_1;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'Excluídos % registros de pix_key_audit para usuário 1', deleted_count;
  END IF;
  
  -- 6. Excluir profiles (cascade deve lidar com outras dependências)
  DELETE FROM public.profiles WHERE user_id = user_id_1;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'Excluído profile para usuário 1: %', deleted_count;
  
  -- 7. Excluir do auth.users (requer SECURITY DEFINER)
  DELETE FROM auth.users WHERE id = user_id_1;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'Usuário 1 excluído do auth.users: %', deleted_count;
  
  -- ============================================
  -- Excluir dados relacionados ao segundo usuário
  -- ============================================
  
  -- 1. Excluir audit_logs onde o usuário é actor_id
  DELETE FROM public.audit_logs WHERE actor_id = user_id_2;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'Excluídos % registros de audit_logs para usuário 2', deleted_count;
  
  -- 2. Excluir team_members onde o usuário está relacionado
  DELETE FROM public.team_members WHERE user_id = user_id_2;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'Excluídos % registros de team_members para usuário 2', deleted_count;
  
  -- 3. Excluir cash_transactions relacionados primeiro
  DELETE FROM public.cash_transactions ct
  WHERE EXISTS (
    SELECT 1 FROM public.cash_sessions cs
    WHERE cs.id = ct.cash_session_id
    AND (cs.opened_by = user_id_2 OR cs.closed_by = user_id_2)
  );
  
  -- Também excluir cash_transactions onde created_by = user_id_2
  DELETE FROM public.cash_transactions WHERE created_by = user_id_2;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'Excluídos % registros de cash_transactions para usuário 2', deleted_count;
  
  -- 4. Excluir cash_sessions onde o usuário abriu (opened_by é NOT NULL, precisa deletar)
  DELETE FROM public.cash_sessions WHERE opened_by = user_id_2;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'Excluídas % sessões de caixa abertas pelo usuário 2', deleted_count;
  
  -- 4b. Se existir cash_registers (pode ser um alias ou nome alternativo)
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'cash_registers') THEN
    DELETE FROM public.cash_registers WHERE opened_by = user_id_2;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'Excluídos % registros de cash_registers para usuário 2', deleted_count;
  END IF;
  
  -- 5. Atualizar closed_by para NULL onde o usuário fechou
  UPDATE public.cash_sessions SET closed_by = NULL WHERE closed_by = user_id_2;
  
  -- 5b. Se existir cash_registers, atualizar também
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'cash_registers') THEN
    UPDATE public.cash_registers SET closed_by = NULL WHERE closed_by = user_id_2;
  END IF;
  
  -- 5c. Se existir pix_key_audit, excluir registros (changed_by é NOT NULL)
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'pix_key_audit') THEN
    DELETE FROM public.pix_key_audit WHERE changed_by = user_id_2;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'Excluídos % registros de pix_key_audit para usuário 2', deleted_count;
  END IF;
  
  -- 6. Excluir profiles
  DELETE FROM public.profiles WHERE user_id = user_id_2;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'Excluído profile para usuário 2: %', deleted_count;
  
  -- 7. Excluir do auth.users
  DELETE FROM auth.users WHERE id = user_id_2;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'Usuário 2 excluído do auth.users: %', deleted_count;
  
  RAISE NOTICE 'Processo de exclusão concluído para ambos os usuários';
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Erro ao excluir usuários: %', SQLERRM;
END $$;

