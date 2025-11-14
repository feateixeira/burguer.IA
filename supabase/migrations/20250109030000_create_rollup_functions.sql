-- ============================================
-- FUNÇÕES PARA CÁLCULO DE ROLLUPS
-- Processam dados raw e geram agregações
-- ============================================

-- ============================================
-- FUNÇÃO: CALCULAR ROLLUP DIÁRIO DE VENDAS
-- ============================================
CREATE OR REPLACE FUNCTION public.calculate_daily_sales_rollup(
  p_establishment_id UUID,
  p_date DATE
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_channel TEXT;
  v_metrics RECORD;
BEGIN
  -- Processa por canal
  FOR v_channel IN SELECT DISTINCT COALESCE(channel, 'unknown') FROM public.orders 
    WHERE establishment_id = p_establishment_id 
    AND DATE(created_at) = p_date
  LOOP
    SELECT 
      COUNT(*) FILTER (WHERE status != 'cancelled') as total_orders,
      COALESCE(SUM(total_amount) FILTER (WHERE status != 'cancelled'), 0) as total_revenue,
      COALESCE(SUM(discount_amount) FILTER (WHERE status != 'cancelled'), 0) as total_discounts,
      COALESCE(SUM(delivery_fee) FILTER (WHERE status != 'cancelled'), 0) as total_delivery_fee,
      COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled_orders,
      COALESCE(SUM(total_amount) FILTER (WHERE status = 'cancelled'), 0) as cancelled_revenue,
      COALESCE(SUM(total_amount) FILTER (WHERE payment_method = 'dinheiro' AND status != 'cancelled'), 0) as payment_cash,
      COALESCE(SUM(total_amount) FILTER (WHERE payment_method = 'pix' AND status != 'cancelled'), 0) as payment_pix,
      COALESCE(SUM(total_amount) FILTER (WHERE payment_method = 'cartao_debito' AND status != 'cancelled'), 0) as payment_card_debit,
      COALESCE(SUM(total_amount) FILTER (WHERE payment_method = 'cartao_credito' AND status != 'cancelled'), 0) as payment_card_credit,
      COALESCE(SUM(total_amount) FILTER (WHERE payment_method = 'online' AND status != 'cancelled'), 0) as payment_online,
      CASE 
        WHEN COUNT(*) FILTER (WHERE status != 'cancelled') > 0 
        THEN COALESCE(SUM(total_amount) FILTER (WHERE status != 'cancelled'), 0) / COUNT(*) FILTER (WHERE status != 'cancelled')
        ELSE 0
      END as average_ticket,
      -- Calcular CMV junto com outras métricas
      COALESCE((
        SELECT SUM(oi.quantity * COALESCE(p.cost, oi.price * 0.30))
        FROM public.order_items oi
        INNER JOIN public.orders o2 ON o2.id = oi.order_id
        LEFT JOIN public.products p ON p.id = oi.product_id
        WHERE o2.establishment_id = p_establishment_id
          AND DATE(o2.created_at) = p_date
          AND o2.status != 'cancelled'
          AND COALESCE(o2.channel, 'unknown') = v_channel
      ), 0) as total_cost_of_goods
    INTO v_metrics
    FROM public.orders
    WHERE establishment_id = p_establishment_id
      AND DATE(created_at) = p_date
      AND COALESCE(channel, 'unknown') = v_channel;

    -- Calcular margem bruta
    v_metrics.gross_margin := v_metrics.total_revenue - v_metrics.total_cost_of_goods;

    -- Upsert na tabela fact
    INSERT INTO public.fact_daily_sales (
      establishment_id,
      date,
      channel,
      total_orders,
      total_revenue,
      total_discounts,
      total_delivery_fee,
      total_cost_of_goods,
      gross_margin,
      average_ticket,
      cancelled_orders,
      cancelled_revenue,
      payment_cash,
      payment_pix,
      payment_card_debit,
      payment_card_credit,
      payment_online
    ) VALUES (
      p_establishment_id,
      p_date,
      v_channel,
      v_metrics.total_orders,
      v_metrics.total_revenue,
      v_metrics.total_discounts,
      v_metrics.total_delivery_fee,
      v_metrics.total_cost_of_goods,
      v_metrics.gross_margin,
      v_metrics.average_ticket,
      v_metrics.cancelled_orders,
      v_metrics.cancelled_revenue,
      v_metrics.payment_cash,
      v_metrics.payment_pix,
      v_metrics.payment_card_debit,
      v_metrics.payment_card_credit,
      v_metrics.payment_online
    )
    ON CONFLICT (establishment_id, date, channel)
    DO UPDATE SET
      total_orders = EXCLUDED.total_orders,
      total_revenue = EXCLUDED.total_revenue,
      total_discounts = EXCLUDED.total_discounts,
      total_delivery_fee = EXCLUDED.total_delivery_fee,
      total_cost_of_goods = EXCLUDED.total_cost_of_goods,
      gross_margin = EXCLUDED.gross_margin,
      average_ticket = EXCLUDED.average_ticket,
      cancelled_orders = EXCLUDED.cancelled_orders,
      cancelled_revenue = EXCLUDED.cancelled_revenue,
      payment_cash = EXCLUDED.payment_cash,
      payment_pix = EXCLUDED.payment_pix,
      payment_card_debit = EXCLUDED.payment_card_debit,
      payment_card_credit = EXCLUDED.payment_card_credit,
      payment_online = EXCLUDED.payment_online,
      updated_at = now();
  END LOOP;
END;
$$;

-- ============================================
-- FUNÇÃO: CALCULAR ROLLUP DIÁRIO DE PRODUTOS
-- ============================================
CREATE OR REPLACE FUNCTION public.calculate_daily_products_rollup(
  p_establishment_id UUID,
  p_date DATE
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_product RECORD;
BEGIN
  -- Deleta rollups do dia para reprocessar
  DELETE FROM public.fact_daily_products
  WHERE establishment_id = p_establishment_id
    AND date = p_date;

  -- Processa cada produto vendido no dia
  FOR v_product IN
    SELECT 
      oi.product_id,
      p.name as product_name,
      SUM(oi.quantity) as quantity_sold,
      SUM(oi.price * oi.quantity) as total_revenue,
      SUM(oi.price * oi.quantity * 0.30) as total_cost -- CMV estimado 30%
    FROM public.order_items oi
    INNER JOIN public.orders o ON o.id = oi.order_id
    LEFT JOIN public.products p ON p.id = oi.product_id
    WHERE o.establishment_id = p_establishment_id
      AND DATE(o.created_at) = p_date
      AND o.status != 'cancelled'
    GROUP BY oi.product_id, p.name
  LOOP
    INSERT INTO public.fact_daily_products (
      establishment_id,
      product_id,
      product_name,
      date,
      quantity_sold,
      total_revenue,
      total_cost,
      gross_margin,
      average_price
    ) VALUES (
      p_establishment_id,
      v_product.product_id,
      v_product.product_name,
      p_date,
      v_product.quantity_sold,
      v_product.total_revenue,
      v_product.total_cost,
      v_product.total_revenue - v_product.total_cost,
      CASE 
        WHEN v_product.quantity_sold > 0 
        THEN v_product.total_revenue / v_product.quantity_sold
        ELSE 0
      END
    );
  END LOOP;
END;
$$;

-- ============================================
-- FUNÇÃO: CALCULAR ROLLUP DIÁRIO DE CLIENTES
-- ============================================
CREATE OR REPLACE FUNCTION public.calculate_daily_customers_rollup(
  p_establishment_id UUID,
  p_date DATE
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer RECORD;
BEGIN
  -- Deleta rollups do dia para reprocessar
  DELETE FROM public.fact_daily_customers
  WHERE establishment_id = p_establishment_id
    AND date = p_date;

  -- Processa cada cliente que fez pedido no dia
  FOR v_customer IN
    SELECT 
      c.id as customer_id,
      c.phone as customer_phone,
      COUNT(DISTINCT o.id) as total_orders,
      SUM(o.total_amount) as total_revenue,
      CASE 
        WHEN COUNT(DISTINCT o.id) > 0 
        THEN SUM(o.total_amount) / COUNT(DISTINCT o.id)
        ELSE 0
      END as average_ticket,
      -- LTV parcial (soma de todos os pedidos até a data)
      (
        SELECT COALESCE(SUM(o2.total_amount), 0)
        FROM public.orders o2
        WHERE o2.establishment_id = p_establishment_id
          AND o2.customer_phone = c.phone
          AND DATE(o2.created_at) <= p_date
          AND o2.status != 'cancelled'
      ) as ltv_partial
    FROM public.orders o
    LEFT JOIN public.customers c ON c.phone = o.customer_phone AND c.establishment_id = p_establishment_id
    WHERE o.establishment_id = p_establishment_id
      AND DATE(o.created_at) = p_date
      AND o.status != 'cancelled'
    GROUP BY c.id, c.phone
  LOOP
    INSERT INTO public.fact_daily_customers (
      establishment_id,
      customer_id,
      customer_phone,
      date,
      total_orders,
      total_revenue,
      average_ticket,
      ltv_partial
    ) VALUES (
      p_establishment_id,
      v_customer.customer_id,
      v_customer.customer_phone,
      p_date,
      v_customer.total_orders,
      v_customer.total_revenue,
      v_customer.average_ticket,
      v_customer.ltv_partial
    )
    ON CONFLICT (establishment_id, customer_id, date)
    DO UPDATE SET
      total_orders = EXCLUDED.total_orders,
      total_revenue = EXCLUDED.total_revenue,
      average_ticket = EXCLUDED.average_ticket,
      ltv_partial = EXCLUDED.ltv_partial,
      updated_at = now();
  END LOOP;
END;
$$;

-- ============================================
-- FUNÇÃO: CALCULAR ROLLUP DIÁRIO DE CAIXA
-- ============================================
CREATE OR REPLACE FUNCTION public.calculate_daily_cash_rollup(
  p_establishment_id UUID,
  p_date DATE
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_metrics RECORD;
  v_payment_counts JSONB;
BEGIN
  -- Calcula métricas do caixa do dia
  SELECT 
    COUNT(*) FILTER (WHERE status = 'open') as sessions_opened,
    COUNT(*) FILTER (WHERE status = 'closed' AND DATE(closed_at) = p_date) as sessions_closed,
    COALESCE(SUM(opening_amount) FILTER (WHERE DATE(opened_at) = p_date), 0) as opening_amount,
    COALESCE(SUM(closing_amount) FILTER (WHERE DATE(closed_at) = p_date), 0) as closing_amount,
    COALESCE(SUM(expected_amount) FILTER (WHERE DATE(closed_at) = p_date), 0) as expected_amount,
    COALESCE(SUM(difference_amount) FILTER (WHERE DATE(closed_at) = p_date), 0) as difference_amount,
    (
      SELECT COALESCE(SUM(amount), 0)
      FROM public.cash_transactions ct
      INNER JOIN public.cash_sessions cs ON cs.id = ct.cash_session_id
      WHERE cs.establishment_id = p_establishment_id
        AND ct.type = 'deposit'
        AND DATE(ct.created_at) = p_date
    ) as total_deposits,
    (
      SELECT COUNT(*)
      FROM public.cash_transactions ct
      INNER JOIN public.cash_sessions cs ON cs.id = ct.cash_session_id
      WHERE cs.establishment_id = p_establishment_id
        AND ct.type = 'deposit'
        AND DATE(ct.created_at) = p_date
    ) as deposit_count,
    (
      SELECT COALESCE(SUM(amount), 0)
      FROM public.cash_transactions ct
      INNER JOIN public.cash_sessions cs ON cs.id = ct.cash_session_id
      WHERE cs.establishment_id = p_establishment_id
        AND ct.type = 'withdraw'
        AND DATE(ct.created_at) = p_date
    ) as total_withdraws,
    (
      SELECT COUNT(*)
      FROM public.cash_transactions ct
      INNER JOIN public.cash_sessions cs ON cs.id = ct.cash_session_id
      WHERE cs.establishment_id = p_establishment_id
        AND ct.type = 'withdraw'
        AND DATE(ct.created_at) = p_date
    ) as withdraw_count
  INTO v_metrics
  FROM public.cash_sessions
  WHERE establishment_id = p_establishment_id
    AND (DATE(opened_at) = p_date OR DATE(closed_at) = p_date);

  -- Extrai contagens de pagamento do último fechamento do dia
  SELECT payment_method_counts INTO v_payment_counts
  FROM public.cash_sessions
  WHERE establishment_id = p_establishment_id
    AND DATE(closed_at) = p_date
    AND payment_method_counts IS NOT NULL
  ORDER BY closed_at DESC
  LIMIT 1;

  -- Upsert na tabela fact
  INSERT INTO public.fact_cash_daily (
    establishment_id,
    date,
    opening_amount,
    closing_amount,
    expected_amount,
    difference_amount,
    total_deposits,
    total_withdraws,
    deposit_count,
    withdraw_count,
    payment_cash,
    payment_pix,
    payment_card_debit,
    payment_card_credit,
    sessions_opened,
    sessions_closed
  ) VALUES (
    p_establishment_id,
    p_date,
    v_metrics.opening_amount,
    v_metrics.closing_amount,
    v_metrics.expected_amount,
    v_metrics.difference_amount,
    v_metrics.total_deposits,
    v_metrics.total_withdraws,
    v_metrics.deposit_count,
    v_metrics.withdraw_count,
    COALESCE((v_payment_counts->>'dinheiro')::DECIMAL, 0),
    COALESCE((v_payment_counts->>'pix')::DECIMAL, 0),
    COALESCE((v_payment_counts->>'cartao_debito')::DECIMAL, 0),
    COALESCE((v_payment_counts->>'cartao_credito')::DECIMAL, 0),
    v_metrics.sessions_opened,
    v_metrics.sessions_closed
  )
  ON CONFLICT (establishment_id, date)
  DO UPDATE SET
    opening_amount = EXCLUDED.opening_amount,
    closing_amount = EXCLUDED.closing_amount,
    expected_amount = EXCLUDED.expected_amount,
    difference_amount = EXCLUDED.difference_amount,
    total_deposits = EXCLUDED.total_deposits,
    total_withdraws = EXCLUDED.total_withdraws,
    deposit_count = EXCLUDED.deposit_count,
    withdraw_count = EXCLUDED.withdraw_count,
    payment_cash = EXCLUDED.payment_cash,
    payment_pix = EXCLUDED.payment_pix,
    payment_card_debit = EXCLUDED.payment_card_debit,
    payment_card_credit = EXCLUDED.payment_card_credit,
    sessions_opened = EXCLUDED.sessions_opened,
    sessions_closed = EXCLUDED.sessions_closed,
    updated_at = now();
END;
$$;

-- ============================================
-- FUNÇÃO: PROCESSAR ROLLUP DIÁRIO COMPLETO
-- ============================================
CREATE OR REPLACE FUNCTION public.process_daily_rollup(
  p_establishment_id UUID,
  p_date DATE DEFAULT CURRENT_DATE - 1
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Processa todos os rollups do dia
  PERFORM public.calculate_daily_sales_rollup(p_establishment_id, p_date);
  PERFORM public.calculate_daily_products_rollup(p_establishment_id, p_date);
  PERFORM public.calculate_daily_customers_rollup(p_establishment_id, p_date);
  PERFORM public.calculate_daily_cash_rollup(p_establishment_id, p_date);
  
  RAISE NOTICE 'Rollup diário processado para estabelecimento % no dia %', p_establishment_id, p_date;
END;
$$;

-- ============================================
-- GRANTS
-- ============================================
GRANT EXECUTE ON FUNCTION public.calculate_daily_sales_rollup(UUID, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_daily_products_rollup(UUID, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_daily_customers_rollup(UUID, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_daily_cash_rollup(UUID, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_daily_rollup(UUID, DATE) TO authenticated;

