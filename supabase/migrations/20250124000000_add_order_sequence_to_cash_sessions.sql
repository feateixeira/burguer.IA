-- Adicionar campo order_sequence na tabela cash_sessions
-- Este campo armazena o contador sequencial de pedidos por sessão de caixa
ALTER TABLE public.cash_sessions
ADD COLUMN IF NOT EXISTS order_sequence INTEGER NOT NULL DEFAULT 0;

-- Criar índice para melhor performance
CREATE INDEX IF NOT EXISTS idx_cash_sessions_establishment_status 
ON public.cash_sessions(establishment_id, status) 
WHERE status = 'open';

-- Função para gerar o próximo número de pedido sequencial
-- Esta função é thread-safe e garante que não haja duplicatas
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
  -- Buscar sessão de caixa aberta para o estabelecimento
  -- Usar FOR UPDATE para garantir ordem sequencial (não usar SKIP LOCKED para manter sequência)
  SELECT id INTO v_session_id
  FROM public.cash_sessions
  WHERE establishment_id = p_establishment_id
    AND status = 'open'
  ORDER BY opened_at DESC
  LIMIT 1
  FOR UPDATE; -- Lock para evitar race conditions e manter ordem sequencial

  -- Se não houver caixa aberto, retornar número padrão com timestamp
  IF v_session_id IS NULL THEN
    RETURN 'ORD-' || TO_CHAR(EXTRACT(EPOCH FROM NOW())::BIGINT, 'FM9999999999');
  END IF;

  -- Incrementar o contador de forma atômica
  UPDATE public.cash_sessions
  SET order_sequence = order_sequence + 1
  WHERE id = v_session_id
  RETURNING order_sequence INTO v_sequence;

  -- Verificar se a atualização foi bem-sucedida
  IF v_sequence IS NULL THEN
    -- Se por algum motivo não conseguiu incrementar, retornar fallback
    RETURN 'ORD-' || TO_CHAR(EXTRACT(EPOCH FROM NOW())::BIGINT, 'FM9999999999');
  END IF;

  -- Formatar número com 5 dígitos (#00001, #00002, etc)
  v_order_number := '#' || LPAD(v_sequence::TEXT, 5, '0');

  RETURN v_order_number;
END;
$$;

-- Comentário na função
COMMENT ON FUNCTION public.get_next_order_number(UUID) IS 
'Gera o próximo número de pedido sequencial para uma sessão de caixa aberta. Retorna formato #00001, #00002, etc. Se não houver caixa aberto, retorna número com timestamp.';

-- Grant execute para usuários autenticados
GRANT EXECUTE ON FUNCTION public.get_next_order_number(UUID) TO authenticated;

-- Resetar order_sequence quando caixa é fechado (opcional, mas útil para consistência)
CREATE OR REPLACE FUNCTION public.reset_order_sequence_on_close()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Quando caixa é fechado, resetar o contador (opcional)
  -- Se quiser manter histórico, não fazer nada aqui
  -- NEW.order_sequence := 0;
  RETURN NEW;
END;
$$;

-- Trigger para resetar sequência ao fechar caixa (comentado - manter histórico)
-- CREATE TRIGGER reset_sequence_on_close
-- BEFORE UPDATE ON public.cash_sessions
-- FOR EACH ROW
-- WHEN (OLD.status = 'open' AND NEW.status = 'closed')
-- EXECUTE FUNCTION public.reset_order_sequence_on_close();

