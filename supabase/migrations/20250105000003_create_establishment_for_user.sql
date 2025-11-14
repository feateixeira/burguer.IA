-- Função RPC para criar estabelecimento e vincular ao usuário
-- Permite que usuários sem establishment_id criem seu próprio estabelecimento
CREATE OR REPLACE FUNCTION public.create_establishment_for_user(
  establishment_name TEXT,
  master_name TEXT
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid;
  new_establishment_id uuid;
  establishment_slug TEXT;
  base_slug TEXT;
  counter INTEGER := 0;
  slug_exists BOOLEAN;
BEGIN
  -- Verifica se o usuário está autenticado
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  -- Verifica se o usuário já tem um establishment_id
  IF EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = current_user_id 
    AND establishment_id IS NOT NULL
  ) THEN
    -- Retorna o establishment_id existente
    SELECT establishment_id INTO new_establishment_id
    FROM public.profiles
    WHERE user_id = current_user_id
    LIMIT 1;
    
    RETURN json_build_object(
      'success', true,
      'establishment_id', new_establishment_id,
      'message', 'Usuário já possui estabelecimento vinculado'
    );
  END IF;

  -- Gera o slug base
  base_slug := lower(regexp_replace(establishment_name, '[^a-z0-9]+', '-', 'g'));
  base_slug := regexp_replace(base_slug, '^-+|-+$', '', 'g'); -- Remove traços no início e fim
  base_slug := substring(base_slug, 1, 45); -- Deixa espaço para o sufixo numérico
  
  -- Gera slug único adicionando contador se necessário
  establishment_slug := base_slug;
  LOOP
    -- Verifica se o slug já existe
    SELECT EXISTS (
      SELECT 1 FROM public.establishments WHERE slug = establishment_slug
    ) INTO slug_exists;
    
    IF NOT slug_exists THEN
      EXIT; -- Slug único encontrado
    END IF;
    
    -- Incrementa contador e gera novo slug
    counter := counter + 1;
    establishment_slug := base_slug || '-' || counter;
    
    -- Previne loop infinito (máximo 9999)
    IF counter > 9999 THEN
      -- Usa UUID como fallback
      establishment_slug := base_slug || '-' || substring(replace(gen_random_uuid()::text, '-', ''), 1, 8);
      EXIT;
    END IF;
  END LOOP;

  -- Cria o estabelecimento
  INSERT INTO public.establishments (name, slug)
  VALUES (establishment_name, establishment_slug)
  RETURNING id INTO new_establishment_id;

  IF new_establishment_id IS NULL THEN
    RAISE EXCEPTION 'Erro ao criar estabelecimento';
  END IF;

  -- Atualiza o profile do usuário com o establishment_id
  UPDATE public.profiles
  SET establishment_id = new_establishment_id
  WHERE user_id = current_user_id;

  RETURN json_build_object(
    'success', true,
    'establishment_id', new_establishment_id,
    'message', 'Estabelecimento criado com sucesso'
  );

EXCEPTION
  WHEN unique_violation THEN
    -- Se ainda houver violação única (caso raro de race condition), tenta novamente com UUID
    BEGIN
      establishment_slug := base_slug || '-' || substring(replace(gen_random_uuid()::text, '-', ''), 1, 8);
      INSERT INTO public.establishments (name, slug)
      VALUES (establishment_name, establishment_slug)
      RETURNING id INTO new_establishment_id;
      
      UPDATE public.profiles
      SET establishment_id = new_establishment_id
      WHERE user_id = current_user_id;
      
      RETURN json_build_object(
        'success', true,
        'establishment_id', new_establishment_id,
        'message', 'Estabelecimento criado com sucesso'
      );
    EXCEPTION
      WHEN OTHERS THEN
        RETURN json_build_object(
          'success', false,
          'error', 'Erro ao criar estabelecimento: ' || SQLERRM
        );
    END;
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- Garante que usuários autenticados podem executar a função
GRANT EXECUTE ON FUNCTION public.create_establishment_for_user(TEXT, TEXT) TO authenticated;

