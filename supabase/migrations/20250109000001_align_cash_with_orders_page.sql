-- ============================================
-- ALINHAR CÁLCULO DE CAIXA COM PÁGINA DE PEDIDOS
-- Adicionar filtros por payment_status = 'paid' e status = 'completed'/'ready'
-- ============================================

DROP FUNCTION IF EXISTS public.compute_cash_session_totals(UUID);

CREATE FUNCTION public.compute_cash_session_totals(
  p_session_id UUID
)
RETURNS TABLE (
  expected_cash NUMERIC,
  expected_pix NUMERIC,
  expected_debit NUMERIC,
  expected_credit NUMERIC,
  expected_total NUMERIC
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

  -- IMPORTANTE: Alinhar com critérios da página de pedidos (aba "all")
  -- Filtros aplicados:
  -- 1. status != 'cancelled'
  -- 2. status IN ('completed', 'ready')
  -- 3. payment_status = 'paid'
  -- 4. Excluir fiado não recebido (is_credit_sale = true AND credit_received_at IS NULL)
  -- 5. Para Na Brasa: pedidos do site apenas se accepted_and_printed_at IS NOT NULL
  
  -- Calcular dinheiro esperado
  SELECT 
    v_opening_amount + COALESCE(SUM(
      CASE 
        WHEN o.is_credit_sale = true AND o.credit_received_at IS NOT NULL 
        THEN o.credit_total_with_interest
        ELSE o.total_amount
      END
    ), 0)
  INTO expected_cash
  FROM public.orders o
  WHERE o.establishment_id = v_session.establishment_id
    AND o.status != 'cancelled'
    AND o.status IN ('completed', 'ready')
    AND o.payment_status = 'paid'
    AND (o.payment_method = 'dinheiro' OR o.payment_method = 'cash')
    -- Filtrar fiado: apenas pedidos normais ou fiado recebido
    AND (
      (o.is_credit_sale = false AND o.created_at >= v_session.opened_at AND o.created_at < COALESCE(v_session.closed_at, now()))
      OR
      (o.is_credit_sale = true AND o.credit_received_at IS NOT NULL 
        AND o.credit_received_at >= v_session.opened_at 
        AND o.credit_received_at < COALESCE(v_session.closed_at, now()))
    )
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
    COALESCE(SUM(
      CASE 
        WHEN o.is_credit_sale = true AND o.credit_received_at IS NOT NULL 
        THEN o.credit_total_with_interest
        ELSE o.total_amount
      END
    ), 0)
  INTO expected_pix
  FROM public.orders o
  WHERE o.establishment_id = v_session.establishment_id
    AND o.status != 'cancelled'
    AND o.status IN ('completed', 'ready')
    AND o.payment_status = 'paid'
    AND o.payment_method = 'pix'
    -- Filtrar fiado: apenas pedidos normais ou fiado recebido
    AND (
      (o.is_credit_sale = false AND o.created_at >= v_session.opened_at AND o.created_at < COALESCE(v_session.closed_at, now()))
      OR
      (o.is_credit_sale = true AND o.credit_received_at IS NOT NULL 
        AND o.credit_received_at >= v_session.opened_at 
        AND o.credit_received_at < COALESCE(v_session.closed_at, now()))
    )
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
    COALESCE(SUM(
      CASE 
        WHEN o.is_credit_sale = true AND o.credit_received_at IS NOT NULL 
        THEN o.credit_total_with_interest
        ELSE o.total_amount
      END
    ), 0)
  INTO expected_debit
  FROM public.orders o
  WHERE o.establishment_id = v_session.establishment_id
    AND o.status != 'cancelled'
    AND o.status IN ('completed', 'ready')
    AND o.payment_status = 'paid'
    AND (o.payment_method = 'cartao_debito' OR o.payment_method = 'cartao credito/debito')
    -- Filtrar fiado: apenas pedidos normais ou fiado recebido
    AND (
      (o.is_credit_sale = false AND o.created_at >= v_session.opened_at AND o.created_at < COALESCE(v_session.closed_at, now()))
      OR
      (o.is_credit_sale = true AND o.credit_received_at IS NOT NULL 
        AND o.credit_received_at >= v_session.opened_at 
        AND o.credit_received_at < COALESCE(v_session.closed_at, now()))
    )
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
    COALESCE(SUM(
      CASE 
        WHEN o.is_credit_sale = true AND o.credit_received_at IS NOT NULL 
        THEN o.credit_total_with_interest
        ELSE o.total_amount
      END
    ), 0)
  INTO expected_credit
  FROM public.orders o
  WHERE o.establishment_id = v_session.establishment_id
    AND o.status != 'cancelled'
    AND o.status IN ('completed', 'ready')
    AND o.payment_status = 'paid'
    AND o.payment_method = 'cartao_credito'
    -- Filtrar fiado: apenas pedidos normais ou fiado recebido
    AND (
      (o.is_credit_sale = false AND o.created_at >= v_session.opened_at AND o.created_at < COALESCE(v_session.closed_at, now()))
      OR
      (o.is_credit_sale = true AND o.credit_received_at IS NOT NULL 
        AND o.credit_received_at >= v_session.opened_at 
        AND o.credit_received_at < COALESCE(v_session.closed_at, now()))
    )
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

  -- Calcular total esperado
  expected_total := expected_cash + expected_pix + expected_debit + expected_credit;

  RETURN QUERY SELECT expected_cash, expected_pix, expected_debit, expected_credit, expected_total;
END;
$$;

-- Garantir permissões
GRANT EXECUTE ON FUNCTION public.compute_cash_session_totals(UUID) TO authenticated;

COMMENT ON FUNCTION public.compute_cash_session_totals IS 'Calcula totais esperados da sessão de caixa alinhado com critérios da página de pedidos (status completed/ready e payment_status paid)';
