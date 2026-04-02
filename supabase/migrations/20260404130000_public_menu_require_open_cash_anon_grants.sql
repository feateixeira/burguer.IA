-- Cardápio público (anon): exige caixa aberto para número de pedido e libera RPCs necessárias.

-- 1) Número sequencial só com sessão de caixa aberta (sem fallback com timestamp)
CREATE OR REPLACE FUNCTION public.get_next_order_number(
  p_establishment_id UUID
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session_id UUID;
  v_sequence INTEGER;
  v_order_number TEXT;
BEGIN
  SELECT id INTO v_session_id
  FROM public.cash_sessions
  WHERE establishment_id = p_establishment_id
    AND status = 'open'
  ORDER BY opened_at DESC
  LIMIT 1
  FOR UPDATE;

  IF v_session_id IS NULL THEN
    RAISE EXCEPTION 'CAIXA_FECHADO'
      USING HINT = 'Abra o caixa no PDV para receber pedidos pelo cardápio online.';
  END IF;

  UPDATE public.cash_sessions
  SET order_sequence = order_sequence + 1
  WHERE id = v_session_id
  RETURNING order_sequence INTO v_sequence;

  IF v_sequence IS NULL THEN
    RAISE EXCEPTION 'CAIXA_SEQUENCIA'
      USING HINT = 'Não foi possível atualizar a sequência do caixa. Tente novamente.';
  END IF;

  v_order_number := '#' || LPAD(v_sequence::TEXT, 5, '0');
  RETURN v_order_number;
END;
$$;

COMMENT ON FUNCTION public.get_next_order_number(UUID) IS
'Gera o próximo número (#00001) na sessão de caixa aberta do estabelecimento. Exige caixa aberto (senão CAIXA_FECHADO).';

GRANT EXECUTE ON FUNCTION public.get_next_order_number(UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.get_next_order_number(UUID) TO authenticated;

-- 2) Cliente anônimo pode consultar se há caixa aberto (já é SECURITY DEFINER)
GRANT EXECUTE ON FUNCTION public.has_open_cash_session(UUID) TO anon;

-- 3) Abatimento de estoque após pedido público (já é SECURITY DEFINER)
GRANT EXECUTE ON FUNCTION public.apply_stock_deduction_for_order(UUID, UUID) TO anon;

-- 4) Promoção frete grátis: rodar com privilégios da função (leitura/escrita sem depender de RLS do role)
CREATE OR REPLACE FUNCTION public.check_free_delivery_promotion(
  p_establishment_id UUID,
  p_order_time TIMESTAMPTZ DEFAULT NOW()
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_promotion RECORD;
  v_current_time TIME;
  v_current_date DATE;
  v_orders_count INTEGER;
BEGIN
  v_current_date := CURRENT_DATE;
  v_current_time := CURRENT_TIME;

  SELECT id, max_orders, max_time, start_date, end_date, start_time, end_time, current_usage
  INTO v_promotion
  FROM public.promotions
  WHERE establishment_id = p_establishment_id
    AND type = 'free_delivery'
    AND active = true
    AND start_date <= v_current_date
    AND end_date >= v_current_date
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_promotion.id IS NULL THEN
    RETURN NULL;
  END IF;

  IF v_promotion.max_time IS NOT NULL THEN
    IF v_current_time > v_promotion.max_time THEN
      RETURN NULL;
    END IF;
  END IF;

  IF v_promotion.start_time IS NOT NULL AND v_current_time < v_promotion.start_time THEN
    RETURN NULL;
  END IF;

  IF v_promotion.end_time IS NOT NULL AND v_current_time > v_promotion.end_time THEN
    RETURN NULL;
  END IF;

  IF v_promotion.max_orders IS NOT NULL THEN
    SELECT COUNT(*)
    INTO v_orders_count
    FROM public.orders
    WHERE establishment_id = p_establishment_id
      AND free_delivery_promotion_id = v_promotion.id
      AND DATE(created_at) = v_current_date
      AND status IN ('pending', 'accepted', 'preparing', 'ready', 'completed');

    IF v_orders_count >= v_promotion.max_orders THEN
      RETURN NULL;
    END IF;
  END IF;

  RETURN v_promotion.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_free_delivery_usage(
  p_promotion_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.promotions
  SET current_usage = COALESCE(current_usage, 0) + 1
  WHERE id = p_promotion_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_free_delivery_promotion(UUID, TIMESTAMPTZ) TO anon;
GRANT EXECUTE ON FUNCTION public.check_free_delivery_promotion(UUID, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_free_delivery_usage(UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.increment_free_delivery_usage(UUID) TO authenticated;
