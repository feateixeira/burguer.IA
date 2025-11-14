-- Migration: Atribuir categorias "Combos" e "Adicionais" para produtos existentes
-- Esta migration garante que todos os produtos existentes tenham as categorias corretas
-- antes de ir para produção

-- 1. Criar categoria "Combos" para todos os estabelecimentos que não têm
INSERT INTO public.categories (establishment_id, name, description, active, sort_order)
SELECT DISTINCT e.id, 'Combos', 'Combos e promoções', true, 999
FROM public.establishments e
WHERE NOT EXISTS (
  SELECT 1 FROM public.categories c
  WHERE c.establishment_id = e.id
  AND c.name = 'Combos'
  AND c.active = true
);

-- 2. Criar categoria "Adicionais" para todos os estabelecimentos que não têm
INSERT INTO public.categories (establishment_id, name, description, active, sort_order)
SELECT DISTINCT e.id, 'Adicionais', 'Adicionais e complementos', true, 998
FROM public.establishments e
WHERE NOT EXISTS (
  SELECT 1 FROM public.categories c
  WHERE c.establishment_id = e.id
  AND c.name = 'Adicionais'
  AND c.active = true
);

-- 3. Atualizar produtos com is_combo = true que não têm categoria
UPDATE public.products p
SET category_id = (
  SELECT c.id
  FROM public.categories c
  WHERE c.establishment_id = p.establishment_id
  AND c.name = 'Combos'
  AND c.active = true
  LIMIT 1
)
WHERE p.is_combo = true
AND p.category_id IS NULL;

-- 4. Atualizar produtos que correspondem a adicionais e não têm categoria
-- (produtos cujo nome corresponde exatamente a um adicional no mesmo estabelecimento)
UPDATE public.products p
SET category_id = (
  SELECT c.id
  FROM public.categories c
  WHERE c.establishment_id = p.establishment_id
  AND c.name = 'Adicionais'
  AND c.active = true
  LIMIT 1
)
WHERE p.category_id IS NULL
AND p.is_combo IS NOT TRUE
AND EXISTS (
  SELECT 1
  FROM public.addons a
  WHERE a.establishment_id = p.establishment_id
  AND LOWER(TRIM(a.name)) = LOWER(TRIM(p.name))
);

-- Nota: Esta migration é idempotente e pode ser executada múltiplas vezes sem problemas
-- O código frontend continuará funcionando normalmente, mas esta migration garante
-- que todos os dados existentes sejam atualizados de uma vez

