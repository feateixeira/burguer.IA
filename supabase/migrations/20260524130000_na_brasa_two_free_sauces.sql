-- Na Brasa: 2 molhos grátis em todos os hambúrgueres (exceto sem molho / Nutella).
-- products: tags + description (não existe coluna customizations em products).

UPDATE public.products p
SET
  tags = CASE
    WHEN p.tags IS NULL THEN '["molhos-opcoes", "molhos-gratis-2"]'::jsonb
    WHEN p.tags @> '["molhos-gratis-2"]'::jsonb THEN p.tags
    WHEN p.tags @> '["molhos-opcoes"]'::jsonb THEN p.tags || '["molhos-gratis-2"]'::jsonb
    ELSE p.tags
  END,
  description = regexp_replace(
    regexp_replace(
      COALESCE(p.description, ''),
      'pode escolher 1 molho grátis',
      'pode escolher 2 molhos grátis',
      'gi'
    ),
    '1 molho[s]? grátis',
    '2 molhos grátis',
    'gi'
  )
FROM public.establishments e
WHERE p.establishment_id = e.id
  AND (
    lower(trim(e.name)) LIKE '%na brasa%'
    OR lower(trim(e.name)) LIKE '%nabrasa%'
    OR lower(trim(e.name)) = 'hamburgueria na brasa'
  )
  AND COALESCE(p.tags, '[]'::jsonb) @> '["molhos-opcoes"]'::jsonb
  AND NOT COALESCE(p.tags, '[]'::jsonb) @> '["molhos-gratis-2"]'::jsonb
  AND NOT (
    lower(p.name) LIKE '%nutella%'
    OR COALESCE(p.tags, '[]'::jsonb) @> '["sem-molhos"]'::jsonb
  );

-- Descrições antigas sem tag molhos-opcoes (texto “1 molho grátis”)
UPDATE public.products p
SET
  description = regexp_replace(
    regexp_replace(
      COALESCE(p.description, ''),
      'pode escolher 1 molho grátis',
      'pode escolher 2 molhos grátis',
      'gi'
    ),
    '1 molho[s]? grátis',
    '2 molhos grátis',
    'gi'
  ),
  tags = CASE
    WHEN p.tags IS NULL THEN '["molhos-opcoes", "molhos-gratis-2"]'::jsonb
    WHEN p.tags @> '["molhos-gratis-2"]'::jsonb THEN p.tags
    WHEN p.tags @> '["molhos-opcoes"]'::jsonb THEN p.tags || '["molhos-gratis-2"]'::jsonb
    ELSE p.tags || '["molhos-gratis-2"]'::jsonb
  END
FROM public.establishments e
WHERE p.establishment_id = e.id
  AND (
    lower(trim(e.name)) LIKE '%na brasa%'
    OR lower(trim(e.name)) LIKE '%nabrasa%'
    OR lower(trim(e.name)) = 'hamburgueria na brasa'
  )
  AND (
    p.description ILIKE '%1 molho%grátis%'
    OR p.description ILIKE '%pode escolher 1 molho%'
  )
  AND NOT (
    lower(p.name) LIKE '%nutella%'
    OR COALESCE(p.tags, '[]'::jsonb) @> '["sem-molhos"]'::jsonb
  );
