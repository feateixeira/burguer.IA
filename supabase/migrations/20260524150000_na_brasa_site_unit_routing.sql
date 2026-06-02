-- Roteamento de pedidos do site por unidade (mesmo site, várias lojas).
-- O site envia estabelecimento_slug no JSON; a edge function resolve o establishment_id.

ALTER TABLE public.establishments
  ADD COLUMN IF NOT EXISTS site_unit_slug TEXT;

COMMENT ON COLUMN public.establishments.site_unit_slug IS
  'Slug da unidade no site (ex: brazlandia, vicente-pires). Usado pelo online-order-intake.';

CREATE UNIQUE INDEX IF NOT EXISTS establishments_site_unit_slug_unique
  ON public.establishments (site_unit_slug)
  WHERE site_unit_slug IS NOT NULL AND site_unit_slug <> '';

-- Marca as duas unidades Na Brasa (ajuste os slugs se o site usar outros valores)
UPDATE public.establishments e
SET
  site_unit_slug = 'brazlandia',
  settings = COALESCE(e.settings, '{}'::jsonb) || jsonb_build_object(
    'site_brand', 'na-brasa',
    'site_unit_label', 'Brazlândia'
  )
FROM public.profiles p
WHERE p.establishment_id = e.id
  AND p.user_id = '213a8e36-66f8-42b3-901c-6f13418499af'::uuid;

UPDATE public.establishments e
SET
  site_unit_slug = 'vicente-pires',
  settings = COALESCE(e.settings, '{}'::jsonb) || jsonb_build_object(
    'site_brand', 'na-brasa',
    'site_unit_label', 'Vicente Pires'
  )
FROM public.profiles p
WHERE p.establishment_id = e.id
  AND p.user_id = '7a60f537-83dc-4eae-b3d0-c4c159b452f6'::uuid;

CREATE OR REPLACE FUNCTION public.normalize_site_unit_slug(p_raw TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v TEXT;
BEGIN
  IF p_raw IS NULL OR trim(p_raw) = '' THEN
    RETURN '';
  END IF;

  v := lower(trim(p_raw));
  v := translate(
    v,
    'áàâãäéèêëíìîïóòôõöúùûüçñ',
    'aaaaaeeeeiiiiooooouuuucn'
  );
  v := regexp_replace(v, '[^a-z0-9]+', '-', 'g');
  v := trim(both '-' from v);
  RETURN v;
END;
$$;

CREATE OR REPLACE FUNCTION public.resolve_site_unit_establishment(
  p_auth_establishment_id UUID,
  p_unit_slug TEXT
)
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_brand TEXT;
  v_norm TEXT;
  v_auth_norm TEXT;
  v_target UUID;
BEGIN
  v_norm := public.normalize_site_unit_slug(p_unit_slug);

  IF v_norm = '' OR v_norm IS NULL THEN
    RETURN p_auth_establishment_id;
  END IF;

  SELECT public.normalize_site_unit_slug(
    COALESCE(site_unit_slug, slug, '')
  )
  INTO v_auth_norm
  FROM public.establishments
  WHERE id = p_auth_establishment_id;

  IF v_auth_norm = v_norm THEN
    RETURN p_auth_establishment_id;
  END IF;

  SELECT COALESCE(NULLIF(trim(settings->>'site_brand'), ''), 'na-brasa')
  INTO v_brand
  FROM public.establishments
  WHERE id = p_auth_establishment_id;

  SELECT e.id
  INTO v_target
  FROM public.establishments e
  WHERE COALESCE(NULLIF(trim(e.settings->>'site_brand'), ''), 'na-brasa') = v_brand
    AND (
      public.normalize_site_unit_slug(e.site_unit_slug) = v_norm
      OR public.normalize_site_unit_slug(e.slug) = v_norm
      OR public.normalize_site_unit_slug(e.name) = v_norm
    )
  ORDER BY
    CASE WHEN public.normalize_site_unit_slug(e.site_unit_slug) = v_norm THEN 0 ELSE 1 END
  LIMIT 1;

  RETURN v_target;
END;
$$;

COMMENT ON FUNCTION public.resolve_site_unit_establishment IS
  'Dado o establishment autenticado pela API key e o slug da unidade do site, retorna o establishment_id de destino.';

GRANT EXECUTE ON FUNCTION public.normalize_site_unit_slug(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.resolve_site_unit_establishment(UUID, TEXT) TO service_role;
