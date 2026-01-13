-- ============================================
-- FUNÇÃO DE DEBUG: Comparar pedidos do caixa vs página de pedidos
-- ============================================

CREATE OR REPLACE FUNCTION public.debug_cash_vs_orders(
  p_session_id UUID,
  p_date DATE DEFAULT NULL,
  p_payment_method TEXT DEFAULT NULL
)
RETURNS TABLE (
  order_id UUID,
  order_number TEXT,
  created_at TIMESTAMPTZ,
  status TEXT,
  payment_status TEXT,
  payment_method TEXT,
  total_amount NUMERIC,
  source_domain TEXT,
  channel TEXT,
  origin TEXT,
  accepted_and_printed_at TIMESTAMPTZ,
  included_in_cash BOOLEAN,
  included_in_orders_page BOOLEAN,
  reason_cash TEXT,
  reason_orders TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session RECORD;
  v_establishment RECORD;
  v_is_na_brasa BOOLEAN := FALSE;
  v_order_date DATE;
BEGIN
  -- Buscar sessão
  SELECT cs.* INTO v_session
  FROM public.cash_sessions cs
  WHERE cs.id = p_session_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sessão não encontrada';
  END IF;

  -- Buscar dados do estabelecimento
  SELECT e.* INTO v_establishment
  FROM public.establishments e
  WHERE e.id = v_session.establishment_id;

  IF FOUND THEN
    v_is_na_brasa := LOWER(TRIM(v_establishment.name)) = 'na brasa';
  END IF;

  -- Se não especificou data, usar data de abertura da sessão
  IF p_date IS NULL THEN
    v_order_date := DATE(v_session.opened_at);
  ELSE
    v_order_date := p_date;
  END IF;

  -- Retornar todos os pedidos do período da sessão
  RETURN QUERY
  SELECT 
    o.id as order_id,
    o.order_number,
    o.created_at,
    o.status,
    o.payment_status,
    o.payment_method,
    o.total_amount,
    o.source_domain,
    o.channel,
    o.origin,
    o.accepted_and_printed_at,
    -- Verificar se está incluído no cálculo do caixa
    (
      o.status != 'cancelled'
      AND o.payment_method = COALESCE(p_payment_method, o.payment_method)
      AND o.created_at >= v_session.opened_at
      AND o.created_at < COALESCE(v_session.closed_at, now())
      AND (
        NOT v_is_na_brasa OR
        (v_is_na_brasa AND (
          (o.source_domain IS NOT NULL AND LOWER(o.source_domain) LIKE '%hamburguerianabrasa%' AND o.accepted_and_printed_at IS NOT NULL) OR
          (o.source_domain IS NULL OR o.channel != 'online' OR o.origin != 'site')
        ))
      )
    ) as included_in_cash,
    -- Verificar se está incluído na página de pedidos (aba "all")
    (
      o.status != 'cancelled'
      AND o.status IN ('completed', 'ready')
      AND o.payment_status = 'paid'
      AND o.payment_method = COALESCE(p_payment_method, o.payment_method)
      AND DATE(o.created_at) = v_order_date
      AND (
        -- PDV: sem source_domain, não é Na Brasa, não é online, não é totem
        (
          (o.source_domain IS NULL OR TRIM(o.source_domain) = '')
          AND NOT (o.source_domain IS NOT NULL AND LOWER(o.source_domain) LIKE '%hamburguerianabrasa%')
          AND o.channel != 'online'
          AND o.origin != 'site'
          AND o.channel != 'totem'
          AND o.origin != 'totem'
        ) OR
        -- Site Na Brasa ou Online Menu
        (
          (o.source_domain IS NOT NULL AND LOWER(o.source_domain) LIKE '%hamburguerianabrasa%') OR
          ((o.channel = 'online' OR o.origin = 'site' OR (o.source_domain IS NOT NULL AND TRIM(o.source_domain) != '')) 
           AND NOT (o.source_domain IS NOT NULL AND LOWER(o.source_domain) LIKE '%hamburguerianabrasa%'))
        )
      )
      AND NOT (o.is_credit_sale = true AND o.credit_received_at IS NULL)
    ) as included_in_orders_page,
    -- Razão para estar/estar no caixa
    CASE 
      WHEN o.status = 'cancelled' THEN 'Pedido cancelado'
      WHEN o.payment_method != COALESCE(p_payment_method, o.payment_method) THEN 'Método de pagamento diferente'
      WHEN o.created_at < v_session.opened_at THEN 'Antes da abertura do caixa'
      WHEN o.created_at >= COALESCE(v_session.closed_at, now()) THEN 'Depois do fechamento do caixa'
      WHEN v_is_na_brasa AND o.source_domain IS NOT NULL AND LOWER(o.source_domain) LIKE '%hamburguerianabrasa%' AND o.accepted_and_printed_at IS NULL THEN 'Pedido do site Na Brasa não aceito/impresso'
      ELSE 'Incluído no caixa'
    END as reason_cash,
    -- Razão para estar/não estar na página de pedidos
    CASE 
      WHEN o.status = 'cancelled' THEN 'Pedido cancelado'
      WHEN o.status NOT IN ('completed', 'ready') THEN 'Status não é completed/ready: ' || o.status
      WHEN o.payment_status != 'paid' THEN 'Payment status não é paid: ' || o.payment_status
      WHEN o.payment_method != COALESCE(p_payment_method, o.payment_method) THEN 'Método de pagamento diferente'
      WHEN DATE(o.created_at) != v_order_date THEN 'Data diferente: ' || DATE(o.created_at)::TEXT || ' != ' || v_order_date::TEXT
      WHEN o.is_credit_sale = true AND o.credit_received_at IS NULL THEN 'Pedido fiado não recebido'
      ELSE 'Incluído na página de pedidos'
    END as reason_orders
  FROM public.orders o
  WHERE o.establishment_id = v_session.establishment_id
    AND o.created_at >= v_session.opened_at
    AND o.created_at < COALESCE(v_session.closed_at, now())
    AND (p_payment_method IS NULL OR o.payment_method = p_payment_method)
  ORDER BY o.created_at DESC;
END;
$$;

-- Garantir permissões
GRANT EXECUTE ON FUNCTION public.debug_cash_vs_orders(UUID, DATE, TEXT) TO authenticated;

COMMENT ON FUNCTION public.debug_cash_vs_orders IS 'Função de debug para comparar quais pedidos estão sendo contados no caixa vs página de pedidos';
