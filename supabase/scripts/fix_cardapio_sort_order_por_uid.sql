-- =============================================================================
-- Corrigir ORDEM no PDV (sort_order) quando o cardápio JÁ EXISTE no banco
-- =============================================================================
-- Rode no Supabase SQL Editor. Ajuste v_uid se for outro cliente.
--
-- Ordem aplicada: 1 CACHAPAS → 2 HAMBURGUERES → 3 BAGUETES → 4 BEBIDAS
--
-- Depois: rode um refresh forte no navegador (Ctrl+F5) e confira se o front
-- em produção já tem a alteração do PDV que ordena por sort_order.
-- =============================================================================

DO $$
DECLARE
  v_uid uuid := '6fc801f1-5d59-4682-8b42-b88cdb941b19'::uuid;
  v_est uuid;
BEGIN
  SELECT p.establishment_id INTO v_est
  FROM public.profiles p
  WHERE (p.user_id = v_uid OR p.id = v_uid)
    AND p.establishment_id IS NOT NULL
  LIMIT 1;

  IF v_est IS NULL THEN
    RAISE EXCEPTION 'establishment_id não encontrado para este UID.';
  END IF;

  -- Nomes exatos do script Veneza (maiúsculas)
  UPDATE public.categories SET sort_order = 1, updated_at = now()
  WHERE establishment_id = v_est AND name = 'CACHAPAS';

  UPDATE public.categories SET sort_order = 2, updated_at = now()
  WHERE establishment_id = v_est AND name = 'HAMBURGUERES';

  UPDATE public.categories SET sort_order = 3, updated_at = now()
  WHERE establishment_id = v_est AND name = 'BAGUETES';

  UPDATE public.categories SET sort_order = 4, updated_at = now()
  WHERE establishment_id = v_est AND name = 'BEBIDAS';

  -- Se o cardápio antigo usou outra capitalização / acento
  UPDATE public.categories SET sort_order = 1, updated_at = now()
  WHERE establishment_id = v_est AND trim(name) ILIKE 'cachapas' AND name <> 'CACHAPAS';

  UPDATE public.categories SET sort_order = 2, updated_at = now()
  WHERE establishment_id = v_est AND (trim(name) ILIKE 'hambúrgueres' OR trim(name) ILIKE 'hamburguers');

  UPDATE public.categories SET sort_order = 3, updated_at = now()
  WHERE establishment_id = v_est AND trim(name) ILIKE 'baguetes' AND name <> 'BAGUETES';

  UPDATE public.categories SET sort_order = 4, updated_at = now()
  WHERE establishment_id = v_est AND trim(name) ILIKE 'bebidas' AND name <> 'BEBIDAS';

  RAISE NOTICE 'sort_order atualizado para establishment_id %', v_est;
END $$;
