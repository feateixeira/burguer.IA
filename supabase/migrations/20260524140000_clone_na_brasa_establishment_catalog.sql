-- Clona cardápio, adicionais, combos, promoções e configs operacionais
-- de um estabelecimento (usuário origem) para outro (usuário destino).
--
-- Uso (após aplicar migration):
-- SELECT public.clone_establishment_catalog(
--   '213a8e36-66f8-42b3-901c-6f13418499af'::uuid,  -- Na Brasa (origem)
--   '7a60f537-83dc-4eae-b3d0-c4c159b452f6'::uuid,  -- nova loja (destino)
--   'Na Brasa - Nova Unidade',                       -- nome (opcional; NULL = origem + " (cópia)")
--   true                                            -- limpar cardápio atual do destino antes
-- );

CREATE OR REPLACE FUNCTION public.clone_establishment_catalog(
  p_source_user_id UUID,
  p_target_user_id UUID,
  p_target_establishment_name TEXT DEFAULT NULL,
  p_clear_target_catalog BOOLEAN DEFAULT TRUE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_src_est UUID;
  v_tgt_est UUID;
  v_src_est_name TEXT;
  v_src_slug TEXT;
  v_new_slug TEXT;
  v_cat_count INT := 0;
  v_prod_count INT := 0;
  v_addon_count INT := 0;
  v_combo_count INT := 0;
  v_promo_count INT := 0;
BEGIN
  IF p_source_user_id IS NULL OR p_target_user_id IS NULL THEN
    RAISE EXCEPTION 'source_user_id e target_user_id são obrigatórios';
  END IF;

  IF p_source_user_id = p_target_user_id THEN
    RAISE EXCEPTION 'Origem e destino não podem ser o mesmo usuário';
  END IF;

  SELECT establishment_id INTO v_src_est
  FROM public.profiles
  WHERE user_id = p_source_user_id;

  IF v_src_est IS NULL THEN
    RAISE EXCEPTION 'Usuário origem % sem establishment_id no profile', p_source_user_id;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = p_target_user_id) THEN
    RAISE EXCEPTION 'Profile do usuário destino % não encontrado', p_target_user_id;
  END IF;

  SELECT establishment_id INTO v_tgt_est
  FROM public.profiles
  WHERE user_id = p_target_user_id;

  IF v_tgt_est IS NULL THEN
    SELECT name, slug INTO v_src_est_name, v_src_slug
    FROM public.establishments
    WHERE id = v_src_est;

    v_new_slug := lower(regexp_replace(
      COALESCE(v_src_slug, 'loja') || '-' || substring(replace(gen_random_uuid()::text, '-', '') FROM 1 FOR 8),
      '[^a-z0-9-]+', '-', 'g'
    ));

    INSERT INTO public.establishments (
      name,
      slug,
      address,
      phone,
      email,
      settings,
      pix_key_value,
      pix_key_type,
      pix_holder_name,
      pix_bank_name,
      pix_key_locked,
      daily_goal,
      weekly_goal,
      monthly_goal,
      api_key
    )
    SELECT
      COALESCE(p_target_establishment_name, e.name || ' (cópia)'),
      v_new_slug,
      e.address,
      e.phone,
      e.email,
      e.settings,
      e.pix_key_value,
      e.pix_key_type,
      e.pix_holder_name,
      e.pix_bank_name,
      e.pix_key_locked,
      e.daily_goal,
      e.weekly_goal,
      e.monthly_goal,
      encode(gen_random_bytes(24), 'hex')
    FROM public.establishments e
    WHERE e.id = v_src_est
    RETURNING id INTO v_tgt_est;

    UPDATE public.profiles
    SET establishment_id = v_tgt_est,
        updated_at = now()
    WHERE user_id = p_target_user_id;
  ELSE
    IF v_tgt_est = v_src_est THEN
      RAISE EXCEPTION 'Usuário destino já está no mesmo establishment_id da origem';
    END IF;

    IF p_target_establishment_name IS NOT NULL THEN
      UPDATE public.establishments
      SET name = p_target_establishment_name,
          updated_at = now()
      WHERE id = v_tgt_est;
    END IF;

    UPDATE public.establishments tgt
    SET
      address = src.address,
      phone = src.phone,
      email = src.email,
      settings = src.settings,
      daily_goal = src.daily_goal,
      weekly_goal = src.weekly_goal,
      monthly_goal = src.monthly_goal,
      updated_at = now()
    FROM public.establishments src
    WHERE tgt.id = v_tgt_est
      AND src.id = v_src_est;
  END IF;

  IF p_clear_target_catalog THEN
    DELETE FROM public.printer_routing WHERE establishment_id = v_tgt_est;
    DELETE FROM public.promotion_products pp
    USING public.promotions p
    WHERE pp.promotion_id = p.id AND p.establishment_id = v_tgt_est;
    DELETE FROM public.combo_items ci
    USING public.combos c
    WHERE ci.combo_id = c.id AND c.establishment_id = v_tgt_est;
    DELETE FROM public.product_complement_links pcl
    USING public.products pr
    WHERE pcl.product_id = pr.id AND pr.establishment_id = v_tgt_est;
    DELETE FROM public.product_addons pa
    USING public.products pr
    WHERE pa.product_id = pr.id AND pr.establishment_id = v_tgt_est;
    DELETE FROM public.category_addons ca
    USING public.categories cat
    WHERE ca.category_id = cat.id AND cat.establishment_id = v_tgt_est;
    DELETE FROM public.product_ingredients pi
    USING public.products pr
    WHERE pi.product_id = pr.id AND pr.establishment_id = v_tgt_est;
    DELETE FROM public.products WHERE establishment_id = v_tgt_est;
    DELETE FROM public.combos WHERE establishment_id = v_tgt_est;
    DELETE FROM public.promotions WHERE establishment_id = v_tgt_est;
    DELETE FROM public.coupons WHERE establishment_id = v_tgt_est;
    DELETE FROM public.addons WHERE establishment_id = v_tgt_est;
    DELETE FROM public.product_complements WHERE establishment_id = v_tgt_est;
    DELETE FROM public.ingredients WHERE establishment_id = v_tgt_est;
    DELETE FROM public.categories WHERE establishment_id = v_tgt_est;
    DELETE FROM public.printers WHERE establishment_id = v_tgt_est;
    DELETE FROM public.payment_methods WHERE establishment_id = v_tgt_est;
    DELETE FROM public.card_brands WHERE establishment_id = v_tgt_est;
  END IF;

  CREATE TEMP TABLE tmp_cat_map (old_id UUID PRIMARY KEY, new_id UUID NOT NULL) ON COMMIT DROP;
  CREATE TEMP TABLE tmp_prod_map (old_id UUID PRIMARY KEY, new_id UUID NOT NULL) ON COMMIT DROP;
  CREATE TEMP TABLE tmp_addon_map (old_id UUID PRIMARY KEY, new_id UUID NOT NULL) ON COMMIT DROP;
  CREATE TEMP TABLE tmp_ing_map (old_id UUID PRIMARY KEY, new_id UUID NOT NULL) ON COMMIT DROP;
  CREATE TEMP TABLE tmp_comp_map (old_id UUID PRIMARY KEY, new_id UUID NOT NULL) ON COMMIT DROP;
  CREATE TEMP TABLE tmp_combo_map (old_id UUID PRIMARY KEY, new_id UUID NOT NULL) ON COMMIT DROP;
  CREATE TEMP TABLE tmp_promo_map (old_id UUID PRIMARY KEY, new_id UUID NOT NULL) ON COMMIT DROP;
  CREATE TEMP TABLE tmp_printer_map (old_id UUID PRIMARY KEY, new_id UUID NOT NULL) ON COMMIT DROP;

  INSERT INTO tmp_cat_map (old_id, new_id)
  SELECT id, gen_random_uuid()
  FROM public.categories
  WHERE establishment_id = v_src_est;

  INSERT INTO public.categories (
    id, establishment_id, name, description, image_url, sort_order, active, created_at, updated_at
  )
  SELECT
    m.new_id, v_tgt_est, c.name, c.description, c.image_url, c.sort_order, c.active, now(), now()
  FROM public.categories c
  JOIN tmp_cat_map m ON m.old_id = c.id;

  GET DIAGNOSTICS v_cat_count = ROW_COUNT;

  INSERT INTO tmp_prod_map (old_id, new_id)
  SELECT id, gen_random_uuid()
  FROM public.products
  WHERE establishment_id = v_src_est;

  INSERT INTO public.products (
    id, establishment_id, category_id, name, description, price, image_url, active, sort_order,
    sku, tags, ingredients, is_combo, variable_cost, profit_margin, suggested_price,
    created_at, updated_at
  )
  SELECT
    pm.new_id,
    v_tgt_est,
    cm.new_id,
    p.name,
    p.description,
    p.price,
    p.image_url,
    p.active,
    p.sort_order,
    p.sku,
    p.tags,
    p.ingredients,
    p.is_combo,
    p.variable_cost,
    p.profit_margin,
    p.suggested_price,
    now(),
    now()
  FROM public.products p
  JOIN tmp_prod_map pm ON pm.old_id = p.id
  LEFT JOIN tmp_cat_map cm ON cm.old_id = p.category_id;

  GET DIAGNOSTICS v_prod_count = ROW_COUNT;

  INSERT INTO tmp_ing_map (old_id, new_id)
  SELECT id, gen_random_uuid()
  FROM public.ingredients
  WHERE establishment_id = v_src_est;

  INSERT INTO public.ingredients (
    id, establishment_id, name, unit_measure, quantity, cost, active,
    purchase_unit_measure, quantity_purchased, total_cost, unit_cost, created_at, updated_at
  )
  SELECT
    im.new_id, v_tgt_est, i.name, i.unit_measure, i.quantity, i.cost, i.active,
    i.purchase_unit_measure, i.quantity_purchased, i.total_cost, i.unit_cost, now(), now()
  FROM public.ingredients i
  JOIN tmp_ing_map im ON im.old_id = i.id;

  INSERT INTO public.product_ingredients (product_id, ingredient_id, quantity_used)
  SELECT pm.new_id, im.new_id, pi.quantity_used
  FROM public.product_ingredients pi
  JOIN tmp_prod_map pm ON pm.old_id = pi.product_id
  JOIN tmp_ing_map im ON im.old_id = pi.ingredient_id;

  INSERT INTO tmp_addon_map (old_id, new_id)
  SELECT id, gen_random_uuid()
  FROM public.addons
  WHERE establishment_id = v_src_est;

  INSERT INTO public.addons (
    id, establishment_id, name, description, price, active, sort_order, created_at, updated_at
  )
  SELECT
    am.new_id, v_tgt_est, a.name, a.description, a.price, a.active, a.sort_order, now(), now()
  FROM public.addons a
  JOIN tmp_addon_map am ON am.old_id = a.id;

  GET DIAGNOSTICS v_addon_count = ROW_COUNT;

  INSERT INTO public.category_addons (category_id, addon_id)
  SELECT cm.new_id, am.new_id
  FROM public.category_addons ca
  JOIN tmp_cat_map cm ON cm.old_id = ca.category_id
  JOIN tmp_addon_map am ON am.old_id = ca.addon_id;

  INSERT INTO public.product_addons (product_id, addon_id)
  SELECT pm.new_id, am.new_id
  FROM public.product_addons pa
  JOIN tmp_prod_map pm ON pm.old_id = pa.product_id
  JOIN tmp_addon_map am ON am.old_id = pa.addon_id;

  INSERT INTO tmp_comp_map (old_id, new_id)
  SELECT id, gen_random_uuid()
  FROM public.product_complements
  WHERE establishment_id = v_src_est;

  INSERT INTO public.product_complements (
    id, establishment_id, name, description, price, category, required, active, created_at, updated_at
  )
  SELECT
    cm.new_id, v_tgt_est, c.name, c.description, c.price, c.category, c.required, c.active, now(), now()
  FROM public.product_complements c
  JOIN tmp_comp_map cm ON cm.old_id = c.id;

  INSERT INTO public.product_complement_links (product_id, complement_id)
  SELECT pm.new_id, cm.new_id
  FROM public.product_complement_links pcl
  JOIN tmp_prod_map pm ON pm.old_id = pcl.product_id
  JOIN tmp_comp_map cm ON cm.old_id = pcl.complement_id;

  INSERT INTO tmp_combo_map (old_id, new_id)
  SELECT id, gen_random_uuid()
  FROM public.combos
  WHERE establishment_id = v_src_est;

  INSERT INTO public.combos (
    id, establishment_id, name, description, price, image_url, active, sort_order, created_at, updated_at
  )
  SELECT
    cm.new_id, v_tgt_est, c.name, c.description, c.price, c.image_url, c.active, c.sort_order, now(), now()
  FROM public.combos c
  JOIN tmp_combo_map cm ON cm.old_id = c.id;

  GET DIAGNOSTICS v_combo_count = ROW_COUNT;

  INSERT INTO public.combo_items (combo_id, product_id, quantity)
  SELECT cm.new_id, pm.new_id, ci.quantity
  FROM public.combo_items ci
  JOIN tmp_combo_map cm ON cm.old_id = ci.combo_id
  JOIN tmp_prod_map pm ON pm.old_id = ci.product_id;

  INSERT INTO tmp_promo_map (old_id, new_id)
  SELECT id, gen_random_uuid()
  FROM public.promotions
  WHERE establishment_id = v_src_est;

  INSERT INTO public.promotions (
    id, establishment_id, name, description, type, target_id,
    discount_type, discount_value, start_date, end_date, start_time, end_time,
    active, max_orders, max_time, current_usage, created_at, updated_at
  )
  SELECT
    pm.new_id,
    v_tgt_est,
    p.name,
    p.description,
    p.type,
    CASE
      WHEN p.type = 'category' THEN (SELECT cm.new_id FROM tmp_cat_map cm WHERE cm.old_id = p.target_id)
      WHEN p.type = 'product' THEN (SELECT prm.new_id FROM tmp_prod_map prm WHERE prm.old_id = p.target_id)
      ELSE p.target_id
    END,
    p.discount_type,
    p.discount_value,
    p.start_date,
    p.end_date,
    p.start_time,
    p.end_time,
    p.active,
    p.max_orders,
    p.max_time,
    0,
    now(),
    now()
  FROM public.promotions p
  JOIN tmp_promo_map pm ON pm.old_id = p.id;

  GET DIAGNOSTICS v_promo_count = ROW_COUNT;

  INSERT INTO public.promotion_products (promotion_id, product_id, fixed_price)
  SELECT prm.new_id, pm.new_id, pp.fixed_price
  FROM public.promotion_products pp
  JOIN tmp_promo_map prm ON prm.old_id = pp.promotion_id
  JOIN tmp_prod_map pm ON pm.old_id = pp.product_id;

  INSERT INTO public.coupons (
    establishment_id, code, description, type, value, max_uses, uses_count,
    valid_from, valid_until, active, created_at, updated_at
  )
  SELECT
    v_tgt_est, code, description, type, value, max_uses, 0,
    valid_from, valid_until, active, now(), now()
  FROM public.coupons
  WHERE establishment_id = v_src_est;

  INSERT INTO public.payment_methods (
    establishment_id, name, type, requires_card_brand, is_active, created_at, updated_at
  )
  SELECT
    v_tgt_est, name, type, requires_card_brand, is_active, now(), now()
  FROM public.payment_methods
  WHERE establishment_id = v_src_est;

  INSERT INTO public.card_brands (
    establishment_id, name, is_active, created_at, updated_at
  )
  SELECT
    v_tgt_est, name, is_active, now(), now()
  FROM public.card_brands
  WHERE establishment_id = v_src_est;

  INSERT INTO tmp_printer_map (old_id, new_id)
  SELECT id, gen_random_uuid()
  FROM public.printers
  WHERE establishment_id = v_src_est;

  INSERT INTO public.printers (
    id, establishment_id, name, type, location, paper_width, font_size, font_family,
    ip_address, port, bluetooth_address, print_all, active, created_at, updated_at
  )
  SELECT
    pm.new_id, v_tgt_est, pr.name, pr.type, pr.location, pr.paper_width, pr.font_size, pr.font_family,
    pr.ip_address, pr.port, pr.bluetooth_address, pr.print_all, pr.active, now(), now()
  FROM public.printers pr
  JOIN tmp_printer_map pm ON pm.old_id = pr.id;

  INSERT INTO public.printer_routing (establishment_id, printer_id, category_id, product_id)
  SELECT
    v_tgt_est,
    prm.new_id,
    cm.new_id,
    pm.new_id
  FROM public.printer_routing rt
  JOIN tmp_printer_map prm ON prm.old_id = rt.printer_id
  LEFT JOIN tmp_cat_map cm ON cm.old_id = rt.category_id
  LEFT JOIN tmp_prod_map pm ON pm.old_id = rt.product_id
  WHERE rt.establishment_id = v_src_est;

  INSERT INTO public.app_settings (
    establishment_id, totem_enabled, password_panel_enabled, password_prefix,
    counters_count, settings, created_at, updated_at
  )
  SELECT
    v_tgt_est, s.totem_enabled, s.password_panel_enabled, s.password_prefix,
    s.counters_count, s.settings, now(), now()
  FROM public.app_settings s
  WHERE s.establishment_id = v_src_est
  ON CONFLICT (establishment_id) DO UPDATE SET
    totem_enabled = EXCLUDED.totem_enabled,
    password_panel_enabled = EXCLUDED.password_panel_enabled,
    password_prefix = EXCLUDED.password_prefix,
    counters_count = EXCLUDED.counters_count,
    settings = EXCLUDED.settings,
    updated_at = now();

  INSERT INTO public.user_roles (user_id, establishment_id, role, created_by)
  SELECT p_target_user_id, v_tgt_est, ur.role, p_source_user_id
  FROM public.user_roles ur
  WHERE ur.user_id = p_source_user_id
    AND ur.establishment_id = v_src_est
  ON CONFLICT (user_id, establishment_id) DO UPDATE SET role = EXCLUDED.role;

  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = p_target_user_id AND establishment_id = v_tgt_est
  ) THEN
    INSERT INTO public.user_roles (user_id, establishment_id, role, created_by)
    VALUES (p_target_user_id, v_tgt_est, 'admin', p_source_user_id);
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'team_members') THEN
    INSERT INTO public.team_members (establishment_id, user_id, name, role, pin, active)
    SELECT
      v_tgt_est,
      CASE WHEN tm.role = 'master' THEN p_target_user_id ELSE NULL END,
      tm.name,
      tm.role,
      tm.pin,
      tm.active
    FROM public.team_members tm
    WHERE tm.establishment_id = v_src_est
      AND tm.active = true
      AND NOT EXISTS (
        SELECT 1 FROM public.team_members t2
        WHERE t2.establishment_id = v_tgt_est
          AND t2.role = tm.role
          AND t2.name = tm.name
      );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'source_establishment_id', v_src_est,
    'target_establishment_id', v_tgt_est,
    'source_user_id', p_source_user_id,
    'target_user_id', p_target_user_id,
    'categories_copied', v_cat_count,
    'products_copied', v_prod_count,
    'addons_copied', v_addon_count,
    'combos_copied', v_combo_count,
    'promotions_copied', v_promo_count
  );
END;
$$;

COMMENT ON FUNCTION public.clone_establishment_catalog IS
  'Duplica cardápio e configurações de PDV/totem de um estabelecimento para outro usuário/loja.';

REVOKE ALL ON FUNCTION public.clone_establishment_catalog(UUID, UUID, TEXT, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.clone_establishment_catalog(UUID, UUID, TEXT, BOOLEAN) TO service_role;

-- Execução: Na Brasa → nova loja
SELECT public.clone_establishment_catalog(
  '213a8e36-66f8-42b3-901c-6f13418499af'::uuid,
  '7a60f537-83dc-4eae-b3d0-c4c159b452f6'::uuid,
  NULL,
  true
);
