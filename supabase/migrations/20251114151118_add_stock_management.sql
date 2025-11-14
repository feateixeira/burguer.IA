-- ============================================
-- MIGRATION: Sistema de Controle de Estoque de Ingredientes
-- ============================================
-- Esta migration adiciona funcionalidades de controle de estoque
-- integradas ao sistema de custos existente
-- ============================================

-- 1. Adicionar campos de estoque na tabela ingredients
-- ============================================
ALTER TABLE public.ingredients
ADD COLUMN IF NOT EXISTS stock_quantity NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS min_stock_quantity NUMERIC(10,2) DEFAULT 0;

-- Comentários para documentação
COMMENT ON COLUMN public.ingredients.stock_quantity IS 'Quantidade atual em estoque (abatida automaticamente a cada venda)';
COMMENT ON COLUMN public.ingredients.min_stock_quantity IS 'Quantidade mínima para alerta de estoque baixo';

-- 2. Criar tabela de movimentações de estoque (histórico)
-- ============================================
CREATE TABLE IF NOT EXISTS public.ingredient_stock_movements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  establishment_id UUID NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  ingredient_id UUID NOT NULL REFERENCES public.ingredients(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('sale', 'manual_adjustment', 'purchase', 'initial_stock', 'correction')),
  quantity_change NUMERIC(10,2) NOT NULL,
  stock_before NUMERIC(10,2) NOT NULL,
  stock_after NUMERIC(10,2) NOT NULL,
  reason TEXT,
  reference_id UUID, -- ID do pedido, ajuste manual, etc.
  created_by UUID REFERENCES public.profiles(user_id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_ingredient_stock_movements_establishment 
  ON public.ingredient_stock_movements(establishment_id);
CREATE INDEX IF NOT EXISTS idx_ingredient_stock_movements_ingredient 
  ON public.ingredient_stock_movements(ingredient_id);
CREATE INDEX IF NOT EXISTS idx_ingredient_stock_movements_created_at 
  ON public.ingredient_stock_movements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ingredient_stock_movements_type 
  ON public.ingredient_stock_movements(type);
CREATE INDEX IF NOT EXISTS idx_ingredient_stock_movements_reference 
  ON public.ingredient_stock_movements(reference_id) WHERE reference_id IS NOT NULL;

-- Habilitar RLS
ALTER TABLE public.ingredient_stock_movements ENABLE ROW LEVEL SECURITY;

-- Política RLS para movimentações (multi-tenant)
CREATE POLICY "Users can view stock movements in their establishment"
  ON public.ingredient_stock_movements
  FOR SELECT
  USING (
    establishment_id IN (
      SELECT establishment_id FROM public.profiles 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert stock movements in their establishment"
  ON public.ingredient_stock_movements
  FOR INSERT
  WITH CHECK (
    establishment_id IN (
      SELECT establishment_id FROM public.profiles 
      WHERE user_id = auth.uid()
    )
  );

-- 3. Função RPC para abatimento atômico de estoque (venda)
-- ============================================
-- Esta função decrementa o estoque de forma atômica e thread-safe
-- Impede que o estoque fique negativo (deixa em 0 se necessário)
CREATE OR REPLACE FUNCTION public.decrement_ingredient_stock(
  p_establishment_id UUID,
  p_ingredient_id UUID,
  p_quantity_to_decrement NUMERIC,
  p_order_id UUID DEFAULT NULL,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_stock NUMERIC(10,2);
  v_new_stock NUMERIC(10,2);
  v_actual_decremented NUMERIC(10,2);
  v_movement_id UUID;
  v_result JSONB;
BEGIN
  -- Verificar se o ingrediente pertence ao estabelecimento (segurança multi-tenant)
  SELECT stock_quantity INTO v_current_stock
  FROM public.ingredients
  WHERE id = p_ingredient_id
    AND establishment_id = p_establishment_id
    AND active = true;

  IF v_current_stock IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Ingrediente não encontrado ou não pertence ao estabelecimento'
    );
  END IF;

  -- Calcular novo estoque (não permitir negativo)
  v_actual_decremented := LEAST(p_quantity_to_decrement, v_current_stock);
  v_new_stock := GREATEST(0, v_current_stock - p_quantity_to_decrement);

  -- Atualizar estoque de forma atômica
  UPDATE public.ingredients
  SET stock_quantity = v_new_stock,
      updated_at = now()
  WHERE id = p_ingredient_id
    AND establishment_id = p_establishment_id;

  -- Registrar movimentação
  INSERT INTO public.ingredient_stock_movements (
    establishment_id,
    ingredient_id,
    type,
    quantity_change,
    stock_before,
    stock_after,
    reason,
    reference_id,
    created_by
  ) VALUES (
    p_establishment_id,
    p_ingredient_id,
    'sale',
    -v_actual_decremented,
    v_current_stock,
    v_new_stock,
    COALESCE(p_reason, 'Venda de produto'),
    p_order_id,
    auth.uid()
  )
  RETURNING id INTO v_movement_id;

  -- Retornar resultado
  RETURN jsonb_build_object(
    'success', true,
    'stock_before', v_current_stock,
    'stock_after', v_new_stock,
    'quantity_decremented', v_actual_decremented,
    'was_negative', v_new_stock < 0,
    'movement_id', v_movement_id
  );
END;
$$;

-- 4. Função RPC para ajuste manual de estoque
-- ============================================
CREATE OR REPLACE FUNCTION public.adjust_ingredient_stock(
  p_establishment_id UUID,
  p_ingredient_id UUID,
  p_quantity_adjustment NUMERIC, -- Pode ser positivo (entrada) ou negativo (saída)
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_stock NUMERIC(10,2);
  v_new_stock NUMERIC(10,2);
  v_movement_id UUID;
  v_movement_type TEXT;
BEGIN
  -- Verificar se o ingrediente pertence ao estabelecimento
  SELECT stock_quantity INTO v_current_stock
  FROM public.ingredients
  WHERE id = p_ingredient_id
    AND establishment_id = p_establishment_id
    AND active = true;

  IF v_current_stock IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Ingrediente não encontrado ou não pertence ao estabelecimento'
    );
  END IF;

  -- Calcular novo estoque (não permitir negativo)
  v_new_stock := GREATEST(0, v_current_stock + p_quantity_adjustment);

  -- Determinar tipo de movimentação
  IF p_quantity_adjustment > 0 THEN
    v_movement_type := 'purchase';
  ELSE
    v_movement_type := 'manual_adjustment';
  END IF;

  -- Atualizar estoque
  UPDATE public.ingredients
  SET stock_quantity = v_new_stock,
      updated_at = now()
  WHERE id = p_ingredient_id
    AND establishment_id = p_establishment_id;

  -- Registrar movimentação
  INSERT INTO public.ingredient_stock_movements (
    establishment_id,
    ingredient_id,
    type,
    quantity_change,
    stock_before,
    stock_after,
    reason,
    created_by
  ) VALUES (
    p_establishment_id,
    p_ingredient_id,
    v_movement_type,
    p_quantity_adjustment,
    v_current_stock,
    v_new_stock,
    COALESCE(p_reason, 'Ajuste manual de estoque'),
    auth.uid()
  )
  RETURNING id INTO v_movement_id;

  RETURN jsonb_build_object(
    'success', true,
    'stock_before', v_current_stock,
    'stock_after', v_new_stock,
    'quantity_adjusted', p_quantity_adjustment,
    'movement_id', v_movement_id
  );
END;
$$;

-- 5. Função RPC para abatimento em lote (ao finalizar pedido)
-- ============================================
-- Esta função processa todos os itens de um pedido e abate o estoque
-- de todos os ingredientes necessários de forma transacional
CREATE OR REPLACE FUNCTION public.apply_stock_deduction_for_order(
  p_establishment_id UUID,
  p_order_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item RECORD;
  v_ingredient RECORD;
  v_total_used NUMERIC(10,2);
  v_result JSONB;
  v_results JSONB[] := '{}';
  v_success BOOLEAN := true;
  v_errors TEXT[] := '{}';
BEGIN
  -- Para cada item do pedido
  FOR v_item IN
    SELECT 
      oi.product_id,
      oi.quantity as item_quantity
    FROM public.order_items oi
    WHERE oi.order_id = p_order_id
  LOOP
    -- Para cada ingrediente usado nesse produto
    FOR v_ingredient IN
      SELECT 
        pi.ingredient_id,
        pi.quantity_used as quantity_per_unit
      FROM public.product_ingredients pi
      INNER JOIN public.products p ON p.id = pi.product_id
      WHERE pi.product_id = v_item.product_id
        AND p.establishment_id = p_establishment_id
    LOOP
      -- Calcular quantidade total usada
      v_total_used := v_ingredient.quantity_per_unit * v_item.item_quantity;

      -- Abater estoque
      v_result := public.decrement_ingredient_stock(
        p_establishment_id,
        v_ingredient.ingredient_id,
        v_total_used,
        p_order_id,
        format('Venda: %s unidades do produto', v_item.item_quantity)
      );

      -- Verificar se houve erro
      IF (v_result->>'success')::boolean = false THEN
        v_success := false;
        v_errors := array_append(v_errors, v_result->>'error');
      END IF;

      -- Adicionar ao array de resultados
      v_results := array_append(v_results, v_result);
    END LOOP;
  END LOOP;

  -- Retornar resultado consolidado
  RETURN jsonb_build_object(
    'success', v_success,
    'order_id', p_order_id,
    'movements_count', array_length(v_results, 1),
    'results', to_jsonb(v_results),
    'errors', to_jsonb(v_errors)
  );
END;
$$;

-- 6. Conceder permissões
-- ============================================
GRANT EXECUTE ON FUNCTION public.decrement_ingredient_stock(UUID, UUID, NUMERIC, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.adjust_ingredient_stock(UUID, UUID, NUMERIC, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_stock_deduction_for_order(UUID, UUID) TO authenticated;

-- 7. Inicializar estoque para ingredientes existentes (opcional)
-- ============================================
-- Se quantity_purchased existir, usar como estoque inicial
UPDATE public.ingredients
SET stock_quantity = COALESCE(quantity_purchased, 0)
WHERE stock_quantity = 0
  AND quantity_purchased > 0;

-- Registrar movimentações iniciais para ingredientes que tiveram estoque inicializado
INSERT INTO public.ingredient_stock_movements (
  establishment_id,
  ingredient_id,
  type,
  quantity_change,
  stock_before,
  stock_after,
  reason,
  created_by
)
SELECT 
  i.establishment_id,
  i.id,
  'initial_stock',
  i.quantity_purchased,
  0,
  i.quantity_purchased,
  'Estoque inicial migrado de quantity_purchased',
  NULL
FROM public.ingredients i
WHERE i.stock_quantity = i.quantity_purchased
  AND i.quantity_purchased > 0
  AND NOT EXISTS (
    SELECT 1 FROM public.ingredient_stock_movements ism
    WHERE ism.ingredient_id = i.id
      AND ism.type = 'initial_stock'
  );

-- ============================================
-- FIM DA MIGRATION
-- ============================================

