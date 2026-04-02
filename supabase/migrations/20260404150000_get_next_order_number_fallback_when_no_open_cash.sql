-- Cardápio online: pedido pode ser registrado mesmo sem caixa aberto (número fallback com timestamp).
-- Mantém sequência #00001 quando há sessão aberta; caso contrário ORD-<epoch>.

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
    RETURN 'ORD-' || TO_CHAR(EXTRACT(EPOCH FROM NOW())::BIGINT, 'FM9999999999');
  END IF;

  UPDATE public.cash_sessions
  SET order_sequence = order_sequence + 1
  WHERE id = v_session_id
  RETURNING order_sequence INTO v_sequence;

  IF v_sequence IS NULL THEN
    RETURN 'ORD-' || TO_CHAR(EXTRACT(EPOCH FROM NOW())::BIGINT, 'FM9999999999');
  END IF;

  v_order_number := '#' || LPAD(v_sequence::TEXT, 5, '0');
  RETURN v_order_number;
END;
$$;

COMMENT ON FUNCTION public.get_next_order_number(UUID) IS
'Gera o próximo número na sessão de caixa aberta (#00001). Sem caixa aberto, retorna ORD-<epoch>.';

GRANT EXECUTE ON FUNCTION public.get_next_order_number(UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.get_next_order_number(UUID) TO authenticated;
