-- =============================================================================
-- EXCLUIR cardápio inteiro (produtos + categorias) de UM estabelecimento
-- =============================================================================
-- Ajuste v_uid abaixo (auth user id ou profiles.id).
-- Rode no Supabase: SQL Editor → Run
--
-- Ordem: primeiro produtos, depois categorias (FK).
--
-- AVISO: Se existirem pedidos antigos ligados a esses produtos, o banco pode
-- apagar linhas em order_items em cascata (depende das FKs do projeto).
-- Use só quando puder zerar o cardápio desse cliente.
--
-- Depois rode: insert_cardapio_veneza_user.sql
-- =============================================================================

DO $$
DECLARE
  v_uid uuid := '6fc801f1-5d59-4682-8b42-b88cdb941b19'::uuid;
  v_est uuid;
  n_prod int;
  n_cat  int;
BEGIN
  SELECT p.establishment_id INTO v_est
  FROM public.profiles p
  WHERE (p.user_id = v_uid OR p.id = v_uid)
    AND p.establishment_id IS NOT NULL
  LIMIT 1;

  IF v_est IS NULL THEN
    RAISE EXCEPTION 'establishment_id não encontrado para este UID.';
  END IF;

  DELETE FROM public.products WHERE establishment_id = v_est;
  GET DIAGNOSTICS n_prod = ROW_COUNT;

  DELETE FROM public.categories WHERE establishment_id = v_est;
  GET DIAGNOSTICS n_cat = ROW_COUNT;

  RAISE NOTICE 'Removidos % produto(s) e % categoria(s) — establishment_id %',
    n_prod, n_cat, v_est;
END $$;
