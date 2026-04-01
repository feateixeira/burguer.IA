-- =============================================================================
-- Cardápio Veneza — inserção para UM usuário (por UID)
-- =============================================================================
-- Execute no Supabase: Dashboard → SQL → New query → Run
-- Requer permissão de escrita em public.categories e public.products.
--
-- O UID abaixo pode ser:
--   - auth.users.id  → coluna profiles.user_id
--   - ou o id da linha em public.profiles
--
-- Fluxo para substituir cardápio antigo:
--   1) delete_cardapio_por_uid.sql  (exclui tudo)
--   2) Este arquivo               (insere o cardápio Veneza)
--
-- Só precisa ajustar sort_order sem apagar? use fix_cardapio_sort_order_por_uid.sql
-- =============================================================================

DO $$
DECLARE
  v_uid   uuid := '6fc801f1-5d59-4682-8b42-b88cdb941b19'::uuid;
  v_est   uuid;
  v_c1    uuid;
  v_c2    uuid;
  v_c3    uuid;
  v_c4    uuid;
BEGIN
  SELECT p.establishment_id
    INTO v_est
  FROM public.profiles p
  WHERE (p.user_id = v_uid OR p.id = v_uid)
    AND p.establishment_id IS NOT NULL
  LIMIT 1;

  IF v_est IS NULL THEN
    RAISE EXCEPTION
      'Nenhum establishment_id em profiles para UID %. Confira profiles.user_id ou profiles.id.',
      v_uid;
  END IF;

  -- Categorias (4): ordem no PDV = sort_order (CACHAPAS → HAMBURGUERES → BAGUETES → BEBIDAS)
  INSERT INTO public.categories (name, description, establishment_id, sort_order, active)
  VALUES ('CACHAPAS', 'Cachapas', v_est, 1, true)
  RETURNING id INTO v_c1;

  INSERT INTO public.categories (name, description, establishment_id, sort_order, active)
  VALUES ('HAMBURGUERES', 'Hambúrgueres', v_est, 2, true)
  RETURNING id INTO v_c2;

  INSERT INTO public.categories (name, description, establishment_id, sort_order, active)
  VALUES ('BAGUETES', 'Baguetes', v_est, 3, true)
  RETURNING id INTO v_c3;

  INSERT INTO public.categories (name, description, establishment_id, sort_order, active)
  VALUES (
    'BEBIDAS',
    'Sucos naturais (feitos na hora), sucos especiais, águas e refrigerantes.',
    v_est,
    4,
    true
  )
  RETURNING id INTO v_c4;

  -- Produtos: Cachapas
  INSERT INTO public.products (name, description, price, category_id, establishment_id, active, sort_order, tags, ingredients)
  VALUES
    ('Frango', NULL, 15.99, v_c1, v_est, true, 1, '[]'::jsonb, '[]'::jsonb),
    ('Carne', NULL, 16.99, v_c1, v_est, true, 2, '[]'::jsonb, '[]'::jsonb),
    ('Presunto e queijo', NULL, 17.99, v_c1, v_est, true, 3, '[]'::jsonb, '[]'::jsonb),
    ('Frango e queijo', NULL, 18.99, v_c1, v_est, true, 4, '[]'::jsonb, '[]'::jsonb),
    ('Carne e queijo', NULL, 19.99, v_c1, v_est, true, 5, '[]'::jsonb, '[]'::jsonb),
    ('Frango, Queijo e Bacon', NULL, 19.99, v_c1, v_est, true, 6, '[]'::jsonb, '[]'::jsonb),
    ('Carne, Queijo e Bacon', NULL, 21.99, v_c1, v_est, true, 7, '[]'::jsonb, '[]'::jsonb),
    ('Cachapa Veneza', 'Carne, Frango, Queijo e Bacon', 24.99, v_c1, v_est, true, 8, '[]'::jsonb, '[]'::jsonb);

  -- Baguetes
  INSERT INTO public.products (name, description, price, category_id, establishment_id, active, sort_order, tags, ingredients)
  VALUES
    (
      'Clássico',
      'Pão, Alface, Tomate, Carne, molho da casa, bacon, queijo mussarela',
      19.99,
      v_c3,
      v_est,
      true,
      1,
      '[]'::jsonb,
      '[]'::jsonb
    ),
    (
      'Especial',
      'Pão, Alface, Tomate, Carne, ovo, presunto, molho da casa, queijo mussarela',
      23.99,
      v_c3,
      v_est,
      true,
      2,
      '[]'::jsonb,
      '[]'::jsonb
    ),
    (
      'Frango',
      'Pão, Alface, Tomate, molho da casa, bacon, queijo mussarela',
      19.99,
      v_c3,
      v_est,
      true,
      3,
      '[]'::jsonb,
      '[]'::jsonb
    ),
    (
      'Super Mista Veneza',
      'Pão, Alface, Tomate, Carne, Frango, bacon, Calabresa, molho da casa, queijo mussarela',
      24.99,
      v_c3,
      v_est,
      true,
      4,
      '[]'::jsonb,
      '[]'::jsonb
    );

  -- Hambúrgueres
  INSERT INTO public.products (name, description, price, category_id, establishment_id, active, sort_order, tags, ingredients)
  VALUES
    (
      'Clássica',
      'Pão Brioche, Blend Artesanal (150g), Alface, queijo cheddar, tomate, molho da casa',
      14.99,
      v_c2,
      v_est,
      true,
      1,
      '[]'::jsonb,
      '[]'::jsonb
    ),
    (
      'Especial',
      'Pão Brioche, Blend Artesanal (150g), Alface, queijo cheddar, tomate, Ovo, bacon, molho da casa',
      21.99,
      v_c2,
      v_est,
      true,
      2,
      '[]'::jsonb,
      '[]'::jsonb
    ),
    (
      'Super Especial',
      'Pão Brioche, Blend Artesanal (150g), Alface, queijo cheddar, tomate, Ovo, bacon, cebola caramelizada, molho da casa',
      24.99,
      v_c2,
      v_est,
      true,
      3,
      '[]'::jsonb,
      '[]'::jsonb
    ),
    (
      'Frango',
      'Pão Brioche, filé de frango, queijo cheddar, alface, tomate, cebola, molho da casa',
      21.99,
      v_c2,
      v_est,
      true,
      4,
      '[]'::jsonb,
      '[]'::jsonb
    ),
    (
      'Frango Especial',
      'Pão Brioche, filé de frango, queijo cheddar, alface, tomate, cebola caramelizada, bacon, Ovo, molho da casa',
      24.99,
      v_c2,
      v_est,
      true,
      5,
      '[]'::jsonb,
      '[]'::jsonb
    );

  -- BEBIDAS: sucos naturais, especiais, água e refrigerantes (uma única categoria)
  INSERT INTO public.products (name, description, price, category_id, establishment_id, active, sort_order, tags, ingredients)
  VALUES
    (
      'Suco natural — Copo 500ml',
      'Feito na hora. Sabores: Laranja, Abacaxi, Maracujá, Morango',
      9.99,
      v_c4,
      v_est,
      true,
      1,
      '[]'::jsonb,
      '[]'::jsonb
    ),
    (
      'Suco natural — Jarra 1 litro',
      'Feito na hora. Sabores: Laranja, Abacaxi, Maracujá, Morango',
      17.99,
      v_c4,
      v_est,
      true,
      2,
      '[]'::jsonb,
      '[]'::jsonb
    ),
    (
      'Suco especial — Copo 500ml',
      'Sabores: Laranja com Morango, Frutas Vermelhas, Abacaxi com Hortelã, Frutas Vermelhas com Laranja, Laranja com Cenoura e Beterraba',
      14.00,
      v_c4,
      v_est,
      true,
      3,
      '[]'::jsonb,
      '[]'::jsonb
    ),
    (
      'Suco especial — Jarra 1 litro',
      'Sabores: Laranja com Morango, Frutas Vermelhas, Abacaxi com Hortelã, Frutas Vermelhas com Laranja, Laranja com Cenoura e Beterraba',
      22.00,
      v_c4,
      v_est,
      true,
      4,
      '[]'::jsonb,
      '[]'::jsonb
    ),
    ('Água sem gás 500ml', NULL, 2.99, v_c4, v_est, true, 5, '[]'::jsonb, '[]'::jsonb),
    ('Água com gás 500ml', NULL, 3.99, v_c4, v_est, true, 6, '[]'::jsonb, '[]'::jsonb),
    ('Coca-Cola lata 310ml', NULL, 4.99, v_c4, v_est, true, 7, '[]'::jsonb, '[]'::jsonb),
    ('Coca-Cola Zero 310ml', NULL, 4.99, v_c4, v_est, true, 8, '[]'::jsonb, '[]'::jsonb),
    ('Guaraná lata 350ml', NULL, 4.99, v_c4, v_est, true, 9, '[]'::jsonb, '[]'::jsonb),
    ('Guaraná Zero lata 350ml', NULL, 4.99, v_c4, v_est, true, 10, '[]'::jsonb, '[]'::jsonb),
    ('Sprite lata 350ml', NULL, 4.99, v_c4, v_est, true, 11, '[]'::jsonb, '[]'::jsonb),
    ('Coca-Cola 2L', NULL, 11.99, v_c4, v_est, true, 12, '[]'::jsonb, '[]'::jsonb),
    ('Coca-Cola Zero 2L', NULL, 11.99, v_c4, v_est, true, 13, '[]'::jsonb, '[]'::jsonb),
    ('Sprite 2L', NULL, 11.99, v_c4, v_est, true, 14, '[]'::jsonb, '[]'::jsonb),
    ('Fanta Laranja 2L', NULL, 11.99, v_c4, v_est, true, 15, '[]'::jsonb, '[]'::jsonb);

  RAISE NOTICE 'Cardápio inserido para establishment_id %', v_est;
END $$;
