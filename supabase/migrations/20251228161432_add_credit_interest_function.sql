-- ============================================
-- FUNÇÃO: CALCULAR JUROS AUTOMATICAMENTE
-- ============================================

CREATE OR REPLACE FUNCTION public.calculate_credit_interest(
  p_order_id UUID,
  p_due_date DATE,
  p_interest_rate_per_day NUMERIC
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
  v_days_overdue INTEGER;
  v_interest_amount NUMERIC;
BEGIN
  -- Buscar dados do pedido
  SELECT 
    total_amount,
    credit_received_at,
    credit_interest_rate_per_day
  INTO v_order
  FROM public.orders
  WHERE id = p_order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido não encontrado';
  END IF;

  -- Se já foi recebido, retornar juros já calculados
  IF v_order.credit_received_at IS NOT NULL THEN
    RETURN COALESCE(v_order.credit_interest_amount, 0);
  END IF;

  -- Usar taxa do pedido se fornecida, senão usar a do parâmetro
  DECLARE
    v_rate NUMERIC := COALESCE(v_order.credit_interest_rate_per_day, p_interest_rate_per_day, 0);
  BEGIN
    -- Se não há taxa de juros, retornar 0
    IF v_rate = 0 THEN
      RETURN 0;
    END IF;

    -- Calcular dias de atraso (se houver)
    v_days_overdue := GREATEST(0, CURRENT_DATE - p_due_date);

    -- Se não há atraso, não há juros
    IF v_days_overdue = 0 THEN
      RETURN 0;
    END IF;

    -- Calcular juros: total_amount * taxa * dias
    -- A taxa é em decimal (ex: 0.01 = 1% por dia)
    v_interest_amount := v_order.total_amount * v_rate * v_days_overdue;

    RETURN ROUND(v_interest_amount, 2);
  END;
END;
$$;

COMMENT ON FUNCTION public.calculate_credit_interest IS 'Calcula juros de pedido fiado baseado em dias de atraso e taxa configurada';

