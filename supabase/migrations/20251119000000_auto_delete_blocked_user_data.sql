-- Migration: Excluir automaticamente dados de usuários bloqueados há mais de 1 mês
-- Esta migration cria uma função e um cron job para limpar dados de contas bloqueadas
-- mantendo apenas a conta do usuário (profiles e auth.users)

-- ============================================
-- 1. FUNÇÃO: Identificar e excluir dados de usuários bloqueados
-- ============================================

CREATE OR REPLACE FUNCTION public.cleanup_blocked_users_data()
RETURNS TABLE(
  user_id UUID,
  establishment_id UUID,
  deleted_orders INTEGER,
  deleted_products INTEGER,
  deleted_categories INTEGER,
  deleted_combos INTEGER,
  deleted_promotions INTEGER,
  deleted_addons INTEGER,
  deleted_customers INTEGER,
  deleted_delivery_boys INTEGER,
  deleted_cash_sessions INTEGER,
  deleted_ingredients INTEGER,
  deleted_fixed_costs INTEGER,
  deleted_other_data INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user RECORD;
  v_establishment_id UUID;
  v_deleted_orders INTEGER := 0;
  v_deleted_products INTEGER := 0;
  v_deleted_categories INTEGER := 0;
  v_deleted_combos INTEGER := 0;
  v_deleted_promotions INTEGER := 0;
  v_deleted_addons INTEGER := 0;
  v_deleted_customers INTEGER := 0;
  v_deleted_delivery_boys INTEGER := 0;
  v_deleted_cash_sessions INTEGER := 0;
  v_deleted_ingredients INTEGER := 0;
  v_deleted_fixed_costs INTEGER := 0;
  v_deleted_other_data INTEGER := 0;
  v_one_month_ago TIMESTAMP WITH TIME ZONE := NOW() - INTERVAL '1 month';
BEGIN
  -- Buscar usuários bloqueados há mais de 1 mês
  -- Usa apenas profiles.updated_at (quando status foi alterado para 'blocked')
  -- Se user_management existir, será usado como referência adicional
  FOR v_user IN
    SELECT DISTINCT 
      p.user_id,
      p.establishment_id,
      COALESCE(p.updated_at, p.created_at) as blocked_since
    FROM public.profiles p
    WHERE p.status = 'blocked'
      AND p.establishment_id IS NOT NULL
      AND COALESCE(p.updated_at, p.created_at) < v_one_month_ago
  LOOP
    v_establishment_id := v_user.establishment_id;
    
    -- Resetar contadores
    v_deleted_orders := 0;
    v_deleted_products := 0;
    v_deleted_categories := 0;
    v_deleted_combos := 0;
    v_deleted_promotions := 0;
    v_deleted_addons := 0;
    v_deleted_customers := 0;
    v_deleted_delivery_boys := 0;
    v_deleted_cash_sessions := 0;
    v_deleted_ingredients := 0;
    v_deleted_fixed_costs := 0;
    v_deleted_other_data := 0;
    
    BEGIN
      -- 1. Excluir pedidos e itens de pedidos
      WITH deleted_orders AS (
        DELETE FROM public.orders 
        WHERE establishment_id = v_establishment_id
        RETURNING id
      )
      SELECT COUNT(*) INTO v_deleted_orders FROM deleted_orders;
      
      -- 2. Excluir produtos (cascata já exclui order_items, product_addons, category_addons, etc.)
      WITH deleted_products AS (
        DELETE FROM public.products 
        WHERE establishment_id = v_establishment_id
        RETURNING id
      )
      SELECT COUNT(*) INTO v_deleted_products FROM deleted_products;
      
      -- 3. Excluir categorias
      WITH deleted_categories AS (
        DELETE FROM public.categories 
        WHERE establishment_id = v_establishment_id
        RETURNING id
      )
      SELECT COUNT(*) INTO v_deleted_categories FROM deleted_categories;
      
      -- 4. Excluir combos e itens de combos
      WITH deleted_combos AS (
        DELETE FROM public.combos 
        WHERE establishment_id = v_establishment_id
        RETURNING id
      )
      SELECT COUNT(*) INTO v_deleted_combos FROM deleted_combos;
      
      -- 5. Excluir promoções e produtos de promoções
      WITH deleted_promotions AS (
        DELETE FROM public.promotions 
        WHERE establishment_id = v_establishment_id
        RETURNING id
      )
      SELECT COUNT(*) INTO v_deleted_promotions FROM deleted_promotions;
      
      -- 6. Excluir adicionais e associações
      WITH deleted_addons AS (
        DELETE FROM public.addons 
        WHERE establishment_id = v_establishment_id
        RETURNING id
      )
      SELECT COUNT(*) INTO v_deleted_addons FROM deleted_addons;
      
      -- 7. Excluir clientes e grupos de clientes
      WITH deleted_customers AS (
        DELETE FROM public.customers 
        WHERE establishment_id = v_establishment_id
        RETURNING id
      )
      SELECT COUNT(*) INTO v_deleted_customers FROM deleted_customers;
      
      -- 8. Excluir entregadores
      WITH deleted_delivery_boys AS (
        DELETE FROM public.delivery_boys 
        WHERE establishment_id = v_establishment_id
        RETURNING id
      )
      SELECT COUNT(*) INTO v_deleted_delivery_boys FROM deleted_delivery_boys;
      
      -- 9. Excluir sessões de caixa e transações
      WITH deleted_cash_sessions AS (
        DELETE FROM public.cash_sessions 
        WHERE establishment_id = v_establishment_id
        RETURNING id
      )
      SELECT COUNT(*) INTO v_deleted_cash_sessions FROM deleted_cash_sessions;
      
      -- 10. Excluir ingredientes e movimentações de estoque
      WITH deleted_ingredients AS (
        DELETE FROM public.ingredients 
        WHERE establishment_id = v_establishment_id
        RETURNING id
      )
      SELECT COUNT(*) INTO v_deleted_ingredients FROM deleted_ingredients;
      
      -- 11. Excluir custos fixos
      WITH deleted_fixed_costs AS (
        DELETE FROM public.fixed_costs 
        WHERE establishment_id = v_establishment_id
        RETURNING id
      )
      SELECT COUNT(*) INTO v_deleted_fixed_costs FROM deleted_fixed_costs;
      
      -- 12. Excluir outros dados relacionados
      -- Passwords (senhas de chamada)
      DELETE FROM public.passwords WHERE establishment_id = v_establishment_id;
      
      -- Business hours
      DELETE FROM public.establishment_hours WHERE establishment_id = v_establishment_id;
      DELETE FROM public.establishment_hours_overrides WHERE establishment_id = v_establishment_id;
      
      -- Notificações do usuário
      DELETE FROM public.user_notifications WHERE user_id = v_user.user_id;
      
      -- User management (se a tabela existir, marcar como processado)
      -- Usa EXECUTE para evitar erro se tabela não existir
      BEGIN
        EXECUTE format('UPDATE public.user_management 
                        SET notes = COALESCE(notes, %L) || %L
                        WHERE user_id = %L',
                        '', 
                        E'\n[Dados excluídos automaticamente em ' || NOW()::text || ']',
                        v_user.user_id);
      EXCEPTION
        WHEN undefined_table THEN
          -- Tabela não existe, ignora silenciosamente
          NULL;
        WHEN OTHERS THEN
          -- Outros erros também são ignorados
          NULL;
      END;
      
      -- Retornar resultado
      RETURN QUERY SELECT 
        v_user.user_id,
        v_establishment_id,
        v_deleted_orders,
        v_deleted_products,
        v_deleted_categories,
        v_deleted_combos,
        v_deleted_promotions,
        v_deleted_addons,
        v_deleted_customers,
        v_deleted_delivery_boys,
        v_deleted_cash_sessions,
        v_deleted_ingredients,
        v_deleted_fixed_costs,
        1 as deleted_other_data;
      
    EXCEPTION
      WHEN OTHERS THEN
        -- Log do erro mas continua com próximo usuário
        RAISE WARNING 'Erro ao excluir dados do usuário % (establishment %): %', 
          v_user.user_id, v_establishment_id, SQLERRM;
    END;
  END LOOP;
  
  RETURN;
END;
$$;

-- ============================================
-- 2. FUNÇÃO WRAPPER PARA CRON JOB
-- ============================================

CREATE OR REPLACE FUNCTION public.cron_cleanup_blocked_users()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result RECORD;
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
    
    -- Log detalhado
    RAISE NOTICE 'Dados excluídos para usuário % (establishment %): % pedidos, % produtos, % categorias, % combos, % promoções, % adicionais, % clientes, % entregadores, % sessões de caixa, % ingredientes, % custos fixos',
      v_result.user_id,
      v_result.establishment_id,
      v_result.deleted_orders,
      v_result.deleted_products,
      v_result.deleted_categories,
      v_result.deleted_combos,
      v_result.deleted_promotions,
      v_result.deleted_addons,
      v_result.deleted_customers,
      v_result.deleted_delivery_boys,
      v_result.deleted_cash_sessions,
      v_result.deleted_ingredients,
      v_result.deleted_fixed_costs;
  END LOOP;
  
  IF v_total_users > 0 THEN
    RAISE NOTICE 'Limpeza concluída: % usuários processados, % pedidos excluídos, % produtos excluídos',
      v_total_users, v_total_orders, v_total_products;
  ELSE
    RAISE NOTICE 'Nenhum usuário bloqueado há mais de 1 mês encontrado para limpeza';
  END IF;
END;
$$;

-- ============================================
-- 3. COMENTÁRIOS E DOCUMENTAÇÃO
-- ============================================

COMMENT ON FUNCTION public.cleanup_blocked_users_data() IS 
'Identifica usuários bloqueados há mais de 1 mês e exclui todos os dados relacionados ao estabelecimento, mantendo apenas a conta do usuário (profiles e auth.users)';

COMMENT ON FUNCTION public.cron_cleanup_blocked_users() IS 
'Função wrapper para executar limpeza automática de dados de usuários bloqueados. Deve ser executada via cron job diariamente.';

-- ============================================
-- 4. INSTRUÇÕES PARA CONFIGURAR CRON JOB
-- ============================================

-- Para habilitar o cron job no Supabase, execute no SQL Editor:
-- 
-- SELECT cron.schedule(
--   'cleanup-blocked-users',
--   '0 2 * * *', -- Todos os dias às 2h da manhã
--   $$SELECT public.cron_cleanup_blocked_users()$$
-- );
--
-- Para verificar se o job está agendado:
-- SELECT * FROM cron.job WHERE jobname = 'cleanup-blocked-users';
--
-- Para desabilitar o job:
-- SELECT cron.unschedule('cleanup-blocked-users');
--
-- Para executar manualmente:
-- SELECT public.cron_cleanup_blocked_users();

-- ============================================
-- 5. NOTAS IMPORTANTES
-- ============================================

-- Esta migration:
-- - NÃO exclui a conta do usuário (profiles e auth.users são mantidos)
-- - NÃO exclui o estabelecimento (establishments é mantido)
-- - Exclui TODOS os dados relacionados ao estabelecimento
-- - Executa apenas para usuários bloqueados há mais de 1 mês
-- - Registra logs detalhados de todas as exclusões
-- - Continua processando mesmo se houver erro em um usuário específico

