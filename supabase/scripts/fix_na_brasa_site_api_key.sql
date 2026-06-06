-- Diagnóstico + correção rápida: API key das unidades Na Brasa para o site.
-- Rode no SQL Editor do Supabase (NÃO é TypeScript).

-- 1) Ver chaves atuais das duas unidades
SELECT
  e.id,
  e.name,
  e.site_unit_slug,
  LEFT(e.api_key, 12) || '...' AS api_key_preview,
  e.api_key IS NOT NULL AS tem_chave
FROM public.establishments e
JOIN public.profiles p ON p.establishment_id = e.id
WHERE p.user_id IN (
  '213a8e36-66f8-42b3-901c-6f13418499af'::uuid,
  '7a60f537-83dc-4eae-b3d0-c4c159b452f6'::uuid
);

-- 2) Opcional: usar a MESMA chave da Brazlândia nas duas unidades
-- (o site envia uma chave só; qualquer uma das duas pode autenticar)
/*
WITH master AS (
  SELECT e.api_key
  FROM public.establishments e
  JOIN public.profiles p ON p.establishment_id = e.id
  WHERE p.user_id = '213a8e36-66f8-42b3-901c-6f13418499af'::uuid
    AND e.api_key IS NOT NULL
  LIMIT 1
)
UPDATE public.establishments e
SET api_key = master.api_key
FROM master
JOIN public.profiles p ON p.establishment_id = e.id
WHERE p.user_id = '7a60f537-83dc-4eae-b3d0-c4c159b452f6'::uuid
  AND master.api_key IS NOT NULL;
*/
