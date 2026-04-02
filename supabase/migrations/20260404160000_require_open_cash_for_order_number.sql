-- Pedidos precisam de sessão de caixa aberta para número sequencial e contabilização no caixa.
-- Sem caixa aberto: exceção CAIXA_FECHADO (sem fallback ORD-/ONLINE-).

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
      USING HINT = 'Abra o caixa no PDV para contabilizar pedidos (incluindo cardápio online).';
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
'Próximo número (#00001) na sessão de caixa aberta. Exige caixa aberto (CAIXA_FECHADO se não houver).';

GRANT EXECUTE ON FUNCTION public.get_next_order_number(UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.get_next_order_number(UUID) TO authenticated;
