-- ============================================
-- Migration: Excluir usuários específicos e todas suas dependências
-- ============================================
-- Esta migration exclui completamente dois usuários específicos:
-- - 88780969-23e9-4b94-bb68-dd1eb8a4f176
-- - c18dc198-1640-4a63-8b3f-3d71f781e161
-- ============================================
-- ATENÇÃO: Esta migration é irreversível. Execute apenas se tiver certeza.
-- ============================================

DO $$
DECLARE
  user_id_1 UUID := '88780969-23e9-4b94-bb68-dd1eb8a4f176';
  user_id_2 UUID := 'c18dc198-1640-4a63-8b3f-3d71f781e161';
  deleted_count INTEGER;
BEGIN
  -- ============================================
  -- Excluir dados relacionados ao primeiro usuário
  -- ============================================
  
  -- 1. Excluir user_notifications
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'user_notifications') THEN
    DELETE FROM public.user_notifications WHERE user_id = user_id_1;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'Excluídos % registros de user_notifications para usuário 1', deleted_count;
  END IF;
  
  -- 2. Excluir mercadopago_payments
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'mercadopago_payments') THEN
    DELETE FROM public.mercadopago_payments WHERE user_id = user_id_1;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'Excluídos % registros de mercadopago_payments para usuário 1', deleted_count;
  END IF;
  
  -- 3. Excluir audit_logs onde o usuário é actor_id
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'audit_logs') THEN
    DELETE FROM public.audit_logs WHERE actor_id = user_id_1;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'Excluídos % registros de audit_logs para usuário 1', deleted_count;
  END IF;
  
  -- 4. Excluir user_roles
  DELETE FROM public.user_roles WHERE user_id = user_id_1;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'Excluídos % registros de user_roles para usuário 1', deleted_count;
  
  -- 5. Excluir team_members onde o usuário está relacionado
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'team_members') THEN
    DELETE FROM public.team_members WHERE user_id = user_id_1;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'Excluídos % registros de team_members para usuário 1', deleted_count;
  END IF;
  
  -- 6. Excluir cash_transactions relacionados primeiro
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'cash_transactions') THEN
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
  END IF;
  
  -- 7. Excluir cash_sessions onde o usuário abriu (opened_by é NOT NULL, precisa deletar)
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'cash_sessions') THEN
    DELETE FROM public.cash_sessions WHERE opened_by = user_id_1;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'Excluídas % sessões de caixa abertas pelo usuário 1', deleted_count;
    
    -- Atualizar closed_by para NULL onde o usuário fechou
    UPDATE public.cash_sessions SET closed_by = NULL WHERE closed_by = user_id_1;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'Atualizadas % sessões de caixa (closed_by) para usuário 1', deleted_count;
  END IF;
  
  -- 8. Se existir cash_registers (pode ser um alias ou nome alternativo)
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'cash_registers') THEN
    DELETE FROM public.cash_registers WHERE opened_by = user_id_1;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'Excluídos % registros de cash_registers para usuário 1', deleted_count;
    
    UPDATE public.cash_registers SET closed_by = NULL WHERE closed_by = user_id_1;
  END IF;
  
  -- 9. Se existir pix_key_audit, excluir registros (changed_by é NOT NULL)
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'pix_key_audit') THEN
    DELETE FROM public.pix_key_audit WHERE changed_by = user_id_1;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'Excluídos % registros de pix_key_audit para usuário 1', deleted_count;
  END IF;
  
  -- 10. Excluir profiles (cascade deve lidar com outras dependências)
  DELETE FROM public.profiles WHERE user_id = user_id_1;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'Excluído profile para usuário 1: %', deleted_count;
  
  -- 11. Excluir do auth.users (requer permissões adequadas)
  DELETE FROM auth.users WHERE id = user_id_1;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'Usuário 1 excluído do auth.users: %', deleted_count;
  
  -- ============================================
  -- Excluir dados relacionados ao segundo usuário
  -- ============================================
  
  -- 1. Excluir user_notifications
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'user_notifications') THEN
    DELETE FROM public.user_notifications WHERE user_id = user_id_2;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'Excluídos % registros de user_notifications para usuário 2', deleted_count;
  END IF;
  
  -- 2. Excluir mercadopago_payments
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'mercadopago_payments') THEN
    DELETE FROM public.mercadopago_payments WHERE user_id = user_id_2;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'Excluídos % registros de mercadopago_payments para usuário 2', deleted_count;
  END IF;
  
  -- 3. Excluir audit_logs onde o usuário é actor_id
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'audit_logs') THEN
    DELETE FROM public.audit_logs WHERE actor_id = user_id_2;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'Excluídos % registros de audit_logs para usuário 2', deleted_count;
  END IF;
  
  -- 4. Excluir user_roles
  DELETE FROM public.user_roles WHERE user_id = user_id_2;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'Excluídos % registros de user_roles para usuário 2', deleted_count;
  
  -- 5. Excluir team_members onde o usuário está relacionado
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'team_members') THEN
    DELETE FROM public.team_members WHERE user_id = user_id_2;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'Excluídos % registros de team_members para usuário 2', deleted_count;
  END IF;
  
  -- 6. Excluir cash_transactions relacionados primeiro
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'cash_transactions') THEN
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
  END IF;
  
  -- 7. Excluir cash_sessions onde o usuário abriu (opened_by é NOT NULL, precisa deletar)
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'cash_sessions') THEN
    DELETE FROM public.cash_sessions WHERE opened_by = user_id_2;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'Excluídas % sessões de caixa abertas pelo usuário 2', deleted_count;
    
    -- Atualizar closed_by para NULL onde o usuário fechou
    UPDATE public.cash_sessions SET closed_by = NULL WHERE closed_by = user_id_2;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'Atualizadas % sessões de caixa (closed_by) para usuário 2', deleted_count;
  END IF;
  
  -- 8. Se existir cash_registers (pode ser um alias ou nome alternativo)
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'cash_registers') THEN
    DELETE FROM public.cash_registers WHERE opened_by = user_id_2;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'Excluídos % registros de cash_registers para usuário 2', deleted_count;
    
    UPDATE public.cash_registers SET closed_by = NULL WHERE closed_by = user_id_2;
  END IF;
  
  -- 9. Se existir pix_key_audit, excluir registros (changed_by é NOT NULL)
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'pix_key_audit') THEN
    DELETE FROM public.pix_key_audit WHERE changed_by = user_id_2;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'Excluídos % registros de pix_key_audit para usuário 2', deleted_count;
  END IF;
  
  -- 10. Excluir profiles
  DELETE FROM public.profiles WHERE user_id = user_id_2;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'Excluído profile para usuário 2: %', deleted_count;
  
  -- 11. Excluir do auth.users
  DELETE FROM auth.users WHERE id = user_id_2;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'Usuário 2 excluído do auth.users: %', deleted_count;
  
  RAISE NOTICE 'Processo de exclusão concluído para ambos os usuários';
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Erro ao excluir usuários: %', SQLERRM;
END $$;

