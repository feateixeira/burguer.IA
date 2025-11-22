-- Migration: Corrigir trigger de updated_at para evitar loops infinitos
-- O problema: O trigger atualiza updated_at mesmo quando apenas updated_at muda,
-- causando notificações Realtime desnecessárias e loops infinitos

-- Remover o trigger antigo
DROP TRIGGER IF EXISTS update_products_updated_at ON public.products;

-- Criar função melhorada que só atualiza updated_at se outros campos mudaram
CREATE OR REPLACE FUNCTION public.update_products_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  -- Só atualiza updated_at se algum campo REALMENTE mudou (exceto updated_at)
  -- Isso evita loops infinitos quando apenas updated_at é atualizado
  IF (
    OLD.name IS DISTINCT FROM NEW.name OR
    OLD.description IS DISTINCT FROM NEW.description OR
    OLD.price IS DISTINCT FROM NEW.price OR
    OLD.image_url IS DISTINCT FROM NEW.image_url OR
    OLD.sku IS DISTINCT FROM NEW.sku OR
    OLD.ingredients IS DISTINCT FROM NEW.ingredients OR
    OLD.tags IS DISTINCT FROM NEW.tags OR
    OLD.active IS DISTINCT FROM NEW.active OR
    OLD.sort_order IS DISTINCT FROM NEW.sort_order OR
    OLD.category_id IS DISTINCT FROM NEW.category_id OR
    OLD.establishment_id IS DISTINCT FROM NEW.establishment_id OR
    OLD.is_combo IS DISTINCT FROM NEW.is_combo OR
    (OLD.variable_cost IS DISTINCT FROM NEW.variable_cost AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'variable_cost')) OR
    (OLD.profit_margin IS DISTINCT FROM NEW.profit_margin AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'profit_margin')) OR
    (OLD.suggested_price IS DISTINCT FROM NEW.suggested_price AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'suggested_price'))
  ) THEN
    NEW.updated_at = now();
  ELSE
    -- Se nenhum campo mudou, manter o updated_at original para evitar notificação Realtime desnecessária
    NEW.updated_at = OLD.updated_at;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recriar o trigger com a função melhorada
CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.update_products_updated_at();

-- Fazer o mesmo para categories para evitar problemas similares
DROP TRIGGER IF EXISTS update_categories_updated_at ON public.categories;

CREATE OR REPLACE FUNCTION public.update_categories_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  IF (
    OLD.name IS DISTINCT FROM NEW.name OR
    OLD.description IS DISTINCT FROM NEW.description OR
    OLD.image_url IS DISTINCT FROM NEW.image_url OR
    OLD.sort_order IS DISTINCT FROM NEW.sort_order OR
    OLD.active IS DISTINCT FROM NEW.active OR
    OLD.establishment_id IS DISTINCT FROM NEW.establishment_id
  ) THEN
    NEW.updated_at = now();
  ELSE
    NEW.updated_at = OLD.updated_at;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_categories_updated_at
  BEFORE UPDATE ON public.categories
  FOR EACH ROW
  EXECUTE FUNCTION public.update_categories_updated_at();

-- Fazer o mesmo para combos
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'combos') THEN
    DROP TRIGGER IF EXISTS update_combos_updated_at ON public.combos;
  END IF;
END $$;

-- Criar função para combos (fora do bloco DO para evitar conflito de delimitadores)
CREATE OR REPLACE FUNCTION public.update_combos_updated_at()
RETURNS TRIGGER AS $combos_func$
BEGIN
  IF (
    OLD.name IS DISTINCT FROM NEW.name OR
    OLD.description IS DISTINCT FROM NEW.description OR
    OLD.price IS DISTINCT FROM NEW.price OR
    OLD.image_url IS DISTINCT FROM NEW.image_url OR
    OLD.sort_order IS DISTINCT FROM NEW.sort_order OR
    OLD.active IS DISTINCT FROM NEW.active OR
    OLD.establishment_id IS DISTINCT FROM NEW.establishment_id
  ) THEN
    NEW.updated_at = now();
  ELSE
    NEW.updated_at = OLD.updated_at;
  END IF;
  RETURN NEW;
END;
$combos_func$ LANGUAGE plpgsql;

-- Criar trigger para combos (se a tabela existir)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'combos') THEN
    CREATE TRIGGER update_combos_updated_at
      BEFORE UPDATE ON public.combos
      FOR EACH ROW
      EXECUTE FUNCTION public.update_combos_updated_at();
  END IF;
END $$;

-- Fazer o mesmo para promotions
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'promotions') THEN
    DROP TRIGGER IF EXISTS update_promotions_updated_at ON public.promotions;
  END IF;
END $$;

-- Criar função para promotions (fora do bloco DO para evitar conflito de delimitadores)
CREATE OR REPLACE FUNCTION public.update_promotions_updated_at()
RETURNS TRIGGER AS $promotions_func$
BEGIN
  IF (
    OLD.name IS DISTINCT FROM NEW.name OR
    OLD.description IS DISTINCT FROM NEW.description OR
    OLD.type IS DISTINCT FROM NEW.type OR
    OLD.target_id IS DISTINCT FROM NEW.target_id OR
    OLD.discount_type IS DISTINCT FROM NEW.discount_type OR
    OLD.discount_value IS DISTINCT FROM NEW.discount_value OR
    OLD.start_date IS DISTINCT FROM NEW.start_date OR
    OLD.end_date IS DISTINCT FROM NEW.end_date OR
    OLD.start_time IS DISTINCT FROM NEW.start_time OR
    OLD.end_time IS DISTINCT FROM NEW.end_time OR
    OLD.active IS DISTINCT FROM NEW.active OR
    OLD.establishment_id IS DISTINCT FROM NEW.establishment_id
  ) THEN
    NEW.updated_at = now();
  ELSE
    NEW.updated_at = OLD.updated_at;
  END IF;
  RETURN NEW;
END;
$promotions_func$ LANGUAGE plpgsql;

-- Criar trigger para promotions (se a tabela existir)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'promotions') THEN
    CREATE TRIGGER update_promotions_updated_at
      BEFORE UPDATE ON public.promotions
      FOR EACH ROW
      EXECUTE FUNCTION public.update_promotions_updated_at();
  END IF;
END $$;

-- Comentário explicativo
COMMENT ON FUNCTION public.update_products_updated_at() IS 
'Atualiza updated_at apenas quando campos realmente mudam, evitando loops infinitos com Realtime subscriptions';

