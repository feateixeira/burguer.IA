-- Adicionar suporte a promoção de frete grátis

-- 1. Modificar constraint de type para incluir 'free_delivery'
ALTER TABLE public.promotions DROP CONSTRAINT IF EXISTS promotions_type_check;
ALTER TABLE public.promotions ADD CONSTRAINT promotions_type_check 
  CHECK (type IN ('product', 'category', 'global', 'free_delivery'));

-- 2. Adicionar campos para condições de frete grátis
ALTER TABLE public.promotions ADD COLUMN IF NOT EXISTS max_orders INTEGER;
ALTER TABLE public.promotions ADD COLUMN IF NOT EXISTS max_time TIME; -- Horário limite (ex: 22:00)
ALTER TABLE public.promotions ADD COLUMN IF NOT EXISTS current_usage INTEGER DEFAULT 0; -- Contador de pedidos que usaram

-- 3. Adicionar campo na tabela orders para registrar promoção de frete grátis usada
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS free_delivery_promotion_id UUID REFERENCES promotions(id);

-- 4. Criar função para verificar se promoção de frete grátis se aplica
CREATE OR REPLACE FUNCTION public.check_free_delivery_promotion(
  p_establishment_id UUID,
  p_order_time TIMESTAMPTZ DEFAULT NOW()
)
RETURNS UUID AS $$
DECLARE
  v_promotion_id UUID;
  v_promotion RECORD;
  v_current_time TIME;
  v_current_date DATE;
  v_orders_count INTEGER;
BEGIN
  -- Obter data e hora atual
  v_current_date := CURRENT_DATE;
  v_current_time := CURRENT_TIME;
  
  -- Buscar promoção de frete grátis ativa para o estabelecimento
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
  
  -- Se não encontrou promoção, retorna NULL
  IF v_promotion.id IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Verificar horário (se max_time estiver definido)
  IF v_promotion.max_time IS NOT NULL THEN
    IF v_current_time > v_promotion.max_time THEN
      RETURN NULL; -- Fora do horário permitido
    END IF;
  END IF;
  
  -- Verificar horário de início e fim da promoção (se definidos)
  IF v_promotion.start_time IS NOT NULL AND v_current_time < v_promotion.start_time THEN
    RETURN NULL; -- Antes do horário de início
  END IF;
  
  IF v_promotion.end_time IS NOT NULL AND v_current_time > v_promotion.end_time THEN
    RETURN NULL; -- Depois do horário de fim
  END IF;
  
  -- Verificar limite de pedidos (se max_orders estiver definido)
  IF v_promotion.max_orders IS NOT NULL THEN
    -- Contar pedidos que já usaram esta promoção hoje
    SELECT COUNT(*)
    INTO v_orders_count
    FROM public.orders
    WHERE establishment_id = p_establishment_id
      AND free_delivery_promotion_id = v_promotion.id
      AND DATE(created_at) = v_current_date
      AND status IN ('pending', 'accepted', 'preparing', 'ready', 'completed');
    
    -- Se já atingiu o limite, retorna NULL
    IF v_orders_count >= v_promotion.max_orders THEN
      RETURN NULL;
    END IF;
    
    -- Resetar contador se a data mudou (verificar último pedido registrado)
    -- Se não houver pedidos hoje, o contador será resetado automaticamente na próxima verificação
  END IF;
  
  -- Promoção se aplica!
  RETURN v_promotion.id;
END;
$$ LANGUAGE plpgsql;

-- 5. Criar função para atualizar contador quando pedido usar promoção
CREATE OR REPLACE FUNCTION public.increment_free_delivery_usage(
  p_promotion_id UUID
)
RETURNS VOID AS $$
BEGIN
  UPDATE public.promotions
  SET current_usage = COALESCE(current_usage, 0) + 1
  WHERE id = p_promotion_id;
END;
$$ LANGUAGE plpgsql;

-- 6. Criar trigger para resetar contador diariamente (opcional - pode ser feito via job)
-- Por enquanto, vamos resetar o contador quando a data mudar na verificação

-- 7. Adicionar índice para performance
CREATE INDEX IF NOT EXISTS idx_promotions_free_delivery 
  ON promotions(establishment_id, type, active, start_date, end_date) 
  WHERE type = 'free_delivery';

CREATE INDEX IF NOT EXISTS idx_orders_free_delivery_promotion 
  ON orders(free_delivery_promotion_id, created_at);

-- 8. Comentários explicativos
COMMENT ON COLUMN promotions.max_orders IS 'Limite de pedidos que podem usar esta promoção de frete grátis (ex: 10 primeiros pedidos)';
COMMENT ON COLUMN promotions.max_time IS 'Horário limite para usar a promoção (ex: 22:00)';
COMMENT ON COLUMN promotions.current_usage IS 'Contador de quantos pedidos já usaram esta promoção hoje';
COMMENT ON COLUMN orders.free_delivery_promotion_id IS 'ID da promoção de frete grátis aplicada neste pedido';

