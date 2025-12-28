-- ============================================
-- AJUSTAR CÁLCULO DE CAIXA: EXCLUIR FIADO NÃO RECEBIDO
-- ============================================

-- Primeiro, vamos ler a função atual para entender sua estrutura
-- Depois vamos criar uma nova versão que exclui fiado não recebido

-- Função auxiliar para verificar se um pedido deve ser contado no caixa
CREATE OR REPLACE FUNCTION public.should_count_order_in_cash(
  p_order_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
BEGIN
  SELECT 
    is_credit_sale,
    credit_received_at,
    payment_status
  INTO v_order
  FROM public.orders
  WHERE id = p_order_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Se é venda fiado e ainda não foi recebida, não contar
  IF v_order.is_credit_sale = true AND v_order.credit_received_at IS NULL THEN
    RETURN false;
  END IF;

  -- Se é venda fiado e foi recebida, contar apenas se foi recebida no período da sessão
  -- (isso será verificado na função compute_cash_session_totals)

  -- Para pedidos normais, seguir lógica existente
  RETURN true;
END;
$$;

-- Agora vamos modificar a função compute_cash_session_totals
-- Primeiro, vamos ler a versão atual para fazer o ajuste correto
-- A função está em: supabase/migrations/20250131000002_fix_cash_closing_calculation.sql

-- Vamos criar uma função que será usada para filtrar pedidos no cálculo de caixa
CREATE OR REPLACE FUNCTION public.filter_orders_for_cash_calculation(
  p_session_id UUID
)
RETURNS TABLE (order_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session RECORD;
BEGIN
  -- Buscar dados da sessão
  SELECT * INTO v_session
  FROM public.cash_sessions
  WHERE id = p_session_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sessão não encontrada';
  END IF;

  -- Retornar IDs de pedidos que devem ser contados:
  -- 1. Pedidos normais (não fiado) criados no período da sessão
  -- 2. Pedidos fiado recebidos no período da sessão
  RETURN QUERY
  SELECT o.id
  FROM public.orders o
  WHERE o.establishment_id = v_session.establishment_id
    AND (
      -- Pedidos normais criados durante a sessão
      (
        o.is_credit_sale = false
        AND o.created_at >= v_session.opened_at
        AND (v_session.closed_at IS NULL OR o.created_at <= v_session.closed_at)
      )
      OR
      -- Pedidos fiado recebidos durante a sessão
      (
        o.is_credit_sale = true
        AND o.credit_received_at IS NOT NULL
        AND o.credit_received_at >= v_session.opened_at
        AND (v_session.closed_at IS NULL OR o.credit_received_at <= v_session.closed_at)
      )
    );
END;
$$;

COMMENT ON FUNCTION public.filter_orders_for_cash_calculation IS 'Retorna IDs de pedidos que devem ser contados no cálculo de caixa da sessão';

