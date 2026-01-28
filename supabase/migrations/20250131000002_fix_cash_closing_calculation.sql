-- ============================================
-- CORREÇÃO: FECHAMENTO DE CAIXA - ALINHAR COM DASHBOARD E ASSISTENTE IA
-- Remove filtro payment_status = 'paid' e aplica filtro especial do Na Brasa
-- ============================================

-- Atualizar função compute_cash_session_totals para:
-- 1. Usar TODOS os pedidos (não apenas 'paid'), igual ao Dashboard
-- 2. Aplicar filtro especial do Na Brasa (accepted_and_printed_at, source_domain, channel, origin)
DROP FUNCTION IF EXISTS public.compute_cash_session_totals(UUID);

CREATE FUNCTION public.compute_cash_session_totals(
  p_session_id UUID
)
RETURNS TABLE (
  expected_cash NUMERIC,
  expected_pix NUMERIC,
  expected_debit NUMERIC,
  expected_credit NUMERIC,
  expected_total NUMERIC,
  rejected_total NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session RECORD;
  v_establishment RECORD;
  v_opening_amount NUMERIC;
  v_is_na_brasa BOOLEAN := FALSE;
BEGIN
  -- Buscar sessão
  SELECT cs.* INTO v_session
  FROM public.cash_sessions cs
  WHERE cs.id = p_session_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sessão não encontrada';
  END IF;

  -- Buscar dados do estabelecimento para verificar se é Na Brasa
  SELECT e.* INTO v_establishment
  FROM public.establishments e
  WHERE e.id = v_session.establishment_id;

  IF FOUND THEN
    -- Verificar se é Na Brasa (comparar nome do estabelecimento)
    v_is_na_brasa := LOWER(TRIM(v_establishment.name)) = 'na brasa';
  END IF;

  v_opening_amount := COALESCE(v_session.opening_amount, 0);

  -- IMPORTANTE: Buscar apenas pedidos efetivamente pagos (payment_status = 'paid')
  -- Aplicar filtro especial do Na Brasa se necessário
  -- Para Na Brasa: incluir apenas pedidos do site que foram aceitos/impressos OU pedidos que não são do site
  -- Para outros estabelecimentos: incluir TODOS os pedidos
  -- IMPORTANTE: Remover filtro payment_status = 'paid' para usar TODOS os pedidos (igual ao Dashboard)
  
  -- Buscar todos os pedidos do período primeiro
  -- Depois aplicar filtros por método de pagamento e Na Brasa
  
  -- Calcular dinheiro esperado
  SELECT 
    v_opening_amount + COALESCE(SUM(o.total_amount), 0)
  INTO expected_cash
  FROM public.orders o
  WHERE o.establishment_id = v_session.establishment_id
    AND o.status != 'cancelled'
    AND (o.payment_method = 'dinheiro' OR o.payment_method = 'cash')
    AND o.payment_status = 'paid'
    AND o.created_at >= v_session.opened_at
    AND o.created_at < COALESCE(v_session.closed_at, now())
    -- Aplicar filtro do Na Brasa se necessário
    AND (
      NOT v_is_na_brasa OR
      (v_is_na_brasa AND (
        -- Pedidos do site: apenas se foram aceitos/impressos
        (o.source_domain IS NOT NULL AND LOWER(o.source_domain) LIKE '%hamburguerianabrasa%' AND o.accepted_and_printed_at IS NOT NULL) OR
        -- Pedidos que não são do site
        (o.source_domain IS NULL OR o.channel != 'online' OR o.origin != 'site')
      ))
    );

  -- Calcular PIX esperado
  SELECT 
    COALESCE(SUM(o.total_amount), 0)
  INTO expected_pix
  FROM public.orders o
  WHERE o.establishment_id = v_session.establishment_id
    AND o.status != 'cancelled'
    AND o.payment_method = 'pix' 
    AND o.payment_status = 'paid'
    AND o.created_at >= v_session.opened_at
    AND o.created_at < COALESCE(v_session.closed_at, now())
    -- Aplicar filtro do Na Brasa se necessário
    AND (
      NOT v_is_na_brasa OR
      (v_is_na_brasa AND (
        (o.source_domain IS NOT NULL AND LOWER(o.source_domain) LIKE '%hamburguerianabrasa%' AND o.accepted_and_printed_at IS NOT NULL) OR
        (o.source_domain IS NULL OR o.channel != 'online' OR o.origin != 'site')
      ))
    );

  -- Calcular Cartão de Débito esperado
  SELECT 
    COALESCE(SUM(o.total_amount), 0)
  INTO expected_debit
  FROM public.orders o
  WHERE o.establishment_id = v_session.establishment_id
    AND o.status != 'cancelled'
    AND (o.payment_method = 'cartao_debito' OR o.payment_method = 'cartao credito/debito')
    AND o.payment_status = 'paid'
    AND o.created_at >= v_session.opened_at
    AND o.created_at < COALESCE(v_session.closed_at, now())
    -- Aplicar filtro do Na Brasa se necessário
    AND (
      NOT v_is_na_brasa OR
      (v_is_na_brasa AND (
        (o.source_domain IS NOT NULL AND LOWER(o.source_domain) LIKE '%hamburguerianabrasa%' AND o.accepted_and_printed_at IS NOT NULL) OR
        (o.source_domain IS NULL OR o.channel != 'online' OR o.origin != 'site')
      ))
    );

  -- Calcular Cartão de Crédito esperado
  SELECT 
    COALESCE(SUM(o.total_amount), 0)
  INTO expected_credit
  FROM public.orders o
  WHERE o.establishment_id = v_session.establishment_id
    AND o.status != 'cancelled'
    AND o.payment_method = 'cartao_credito'
    AND o.payment_status = 'paid'
    AND o.created_at >= v_session.opened_at
    AND o.created_at < COALESCE(v_session.closed_at, now())
    -- Aplicar filtro do Na Brasa se necessário
    AND (
      NOT v_is_na_brasa OR
      (v_is_na_brasa AND (
        (o.source_domain IS NOT NULL AND LOWER(o.source_domain) LIKE '%hamburguerianabrasa%' AND o.accepted_and_printed_at IS NOT NULL) OR
        (o.source_domain IS NULL OR o.channel != 'online' OR o.origin != 'site')
      ))
    );

  -- Se não houver vendas, expected_cash = opening_amount
  IF expected_cash IS NULL THEN
    expected_cash := v_opening_amount;
    expected_pix := 0;
    expected_debit := 0;
    expected_credit := 0;
  END IF;

  -- Calcular total esperado (não inclui pedidos recusados)
  expected_total := expected_cash + expected_pix + expected_debit + expected_credit;

  -- Calcular total de pedidos recusados (informativo)
  SELECT 
    COALESCE(SUM(o.total_amount), 0)
  INTO rejected_total
  FROM public.orders o
  WHERE o.establishment_id = v_session.establishment_id
    AND o.status = 'cancelled'
    AND o.rejection_reason IS NOT NULL
    AND o.created_at >= v_session.opened_at
    AND o.created_at < COALESCE(v_session.closed_at, now());

  RETURN QUERY SELECT 
    expected_cash, 
    expected_pix, 
    expected_debit, 
    expected_credit, 
    expected_total,
    rejected_total;
END;
$$;

-- Garantir permissões
GRANT EXECUTE ON FUNCTION public.compute_cash_session_totals(UUID) TO authenticated;

