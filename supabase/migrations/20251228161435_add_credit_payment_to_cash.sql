-- ============================================
-- FUNÇÃO: REGISTRAR RECEBIMENTO DE FIADO NO CAIXA
-- ============================================

CREATE OR REPLACE FUNCTION public.register_credit_payment(
  p_order_id UUID,
  p_payment_method TEXT,
  p_amount NUMERIC,
  p_received_by UUID,
  p_interest_amount NUMERIC DEFAULT 0
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
  v_session RECORD;
  v_transaction_id UUID;
  v_total_amount NUMERIC;
BEGIN
  -- Buscar dados do pedido
  SELECT 
    o.*,
    cs.id as cash_session_id,
    cs.status as cash_session_status
  INTO v_order
  FROM public.orders o
  LEFT JOIN public.cash_sessions cs ON cs.establishment_id = o.establishment_id 
    AND cs.status = 'open'
    AND cs.opened_at <= now()
  WHERE o.id = p_order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido não encontrado';
  END IF;

  IF v_order.is_credit_sale = false THEN
    RAISE EXCEPTION 'Pedido não é uma venda fiado';
  END IF;

  IF v_order.credit_received_at IS NOT NULL THEN
    RAISE EXCEPTION 'Pedido já foi recebido';
  END IF;

  -- Calcular valor total (original + juros)
  v_total_amount := COALESCE(p_amount, v_order.total_amount + p_interest_amount);

  -- Atualizar pedido
  UPDATE public.orders
  SET 
    credit_received_at = now(),
    credit_received_by = p_received_by,
    credit_interest_amount = p_interest_amount,
    credit_total_with_interest = v_total_amount,
    payment_status = 'paid',
    payment_method = p_payment_method,
    updated_at = now()
  WHERE id = p_order_id;

  -- Se há sessão de caixa aberta, criar transação
  IF v_order.cash_session_id IS NOT NULL THEN
    -- Criar transação de recebimento de fiado (tipo 'deposit' pois é entrada de dinheiro)
    INSERT INTO public.cash_transactions (
      cash_session_id,
      establishment_id,
      type,
      amount,
      description,
      created_by
    ) VALUES (
      v_order.cash_session_id,
      v_order.establishment_id,
      'deposit',
      v_total_amount,
      format('Recebimento pedido fiado %s (Juros: R$ %s)', v_order.order_number, to_char(p_interest_amount, 'FM999999999.00')),
      p_received_by
    )
    RETURNING id INTO v_transaction_id;
  END IF;

  RETURN v_transaction_id;
END;
$$;

COMMENT ON FUNCTION public.register_credit_payment IS 'Registra recebimento de pedido fiado e cria transação no caixa se houver sessão aberta';

