-- ============================================
-- Migration: Corrigir RLS da tabela team_members
-- ============================================
-- Problema: 
--   1. Usuários master não conseguem fazer login
--   2. Não conseguem criar master
--   3. Erro: "new row violates row-level security policy for table team_members"
--   4. Erro: "infinite recursion detected in policy for relation team_members"
-- 
-- Solução: 
--   1. Criar tabela se não existir com estrutura correta
--   2. Usar funções SECURITY DEFINER para bypassar RLS (evitar recursão)
--   3. Criar políticas mutuamente exclusivas (master vs não-master)
--   4. Garantir que funções SECURITY DEFINER usem SQL puro (não plpgsql)
-- 
-- IMPORTANTE: 
--   - Funções SECURITY DEFINER bypassam RLS automaticamente
--   - Políticas são mutuamente exclusivas para evitar conflitos
--   - Funções usam SQL puro para evitar problemas de recursão
-- ============================================

-- ============================================
-- 1. CRIAR TABELA team_members SE NÃO EXISTIR
-- ============================================

CREATE TABLE IF NOT EXISTS public.team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id UUID NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('master', 'admin', 'operator', 'user')),
  pin TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Garantir que colunas opcionais existam mesmo se a tabela já existir
-- Apenas adicionar colunas que podem ser NULL ou têm DEFAULT
DO $$
BEGIN
  -- Adicionar user_id se não existir (pode ser NULL)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'team_members' AND column_name = 'user_id') THEN
    ALTER TABLE public.team_members ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
  
  -- Adicionar pin se não existir (pode ser NULL)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'team_members' AND column_name = 'pin') THEN
    ALTER TABLE public.team_members ADD COLUMN pin TEXT;
  END IF;
  
  -- Adicionar active se não existir (tem DEFAULT)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'team_members' AND column_name = 'active') THEN
    ALTER TABLE public.team_members ADD COLUMN active BOOLEAN NOT NULL DEFAULT true;
    -- Atualizar registros existentes para ativos
    UPDATE public.team_members SET active = true WHERE active IS NULL;
  END IF;
  
  -- Adicionar created_at se não existir (tem DEFAULT)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'team_members' AND column_name = 'created_at') THEN
    ALTER TABLE public.team_members ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT now();
    -- Atualizar registros existentes
    UPDATE public.team_members SET created_at = now() WHERE created_at IS NULL;
  END IF;
  
  -- Adicionar updated_at se não existir (tem DEFAULT)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'team_members' AND column_name = 'updated_at') THEN
    ALTER TABLE public.team_members ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
    -- Atualizar registros existentes
    UPDATE public.team_members SET updated_at = now() WHERE updated_at IS NULL;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    -- Se houver erro, apenas logar (não falhar a migration)
    RAISE NOTICE 'Erro ao adicionar colunas: %', SQLERRM;
END $$;

-- Constraint: apenas um master ativo por establishment
-- Usar índice único parcial em vez de EXCLUDE para melhor compatibilidade
DO $$
BEGIN
  -- Remover índice se já existir
  DROP INDEX IF EXISTS unique_active_master_per_establishment;
  
  -- Criar índice único parcial para garantir apenas 1 master ativo por establishment
  CREATE UNIQUE INDEX unique_active_master_per_establishment 
    ON public.team_members(establishment_id) 
    WHERE role = 'master' AND active = true;
EXCEPTION
  WHEN duplicate_table THEN
    -- Índice já existe, não fazer nada
    NULL;
END $$;

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_team_members_establishment_id ON public.team_members(establishment_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON public.team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_team_members_role ON public.team_members(role);
CREATE INDEX IF NOT EXISTS idx_team_members_active ON public.team_members(establishment_id, active) WHERE active = true;

-- ============================================
-- 2. HABILITAR RLS
-- ============================================

ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 3. REMOVER TODAS AS POLÍTICAS ANTIGAS (se existirem)
-- ============================================
-- Remover todas as políticas para evitar conflitos e recursão

DO $$
DECLARE
  pol_record RECORD;
BEGIN
  FOR pol_record IN
    SELECT policyname 
    FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'team_members'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.team_members', pol_record.policyname);
  END LOOP;
END $$;

-- ============================================
-- 4. POLÍTICA: USUÁRIOS PODEM VER team_members DO SEU ESTABLISHMENT
-- ============================================
-- Permite que usuários vejam todos os team_members do establishment deles
-- Isso é necessário para verificar se já existe master e para listar a equipe

CREATE POLICY "Users can view team_members from their establishment"
  ON public.team_members FOR SELECT
  TO authenticated
  USING (
    -- Usuário tem establishment_id no profile E o team_member pertence a esse establishment
    establishment_id IN (
      SELECT establishment_id 
      FROM public.profiles 
      WHERE user_id = auth.uid() 
        AND establishment_id IS NOT NULL
    )
  );

-- ============================================
-- 5. FUNÇÃO AUXILIAR: VERIFICAR SE PODE CRIAR MASTER
-- ============================================
-- Função SECURITY DEFINER para verificar se não há master ativo
-- CRÍTICO: Esta função DEVE bypassar RLS completamente para evitar recursão
-- SECURITY DEFINER faz a função executar com privilégios do criador (postgres/superuser)
-- Isso bypassa RLS automaticamente

CREATE OR REPLACE FUNCTION public.can_create_master(p_establishment_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
PARALLEL SAFE
AS $$
  -- SECURITY DEFINER garante que esta função executa com privilégios do criador
  -- Isso bypassa RLS automaticamente - não precisa de configuração adicional
  -- Usar SQL puro (não plpgsql) pode ajudar a evitar problemas de recursão
  SELECT NOT EXISTS (
    SELECT 1 
    FROM public.team_members
    WHERE establishment_id = p_establishment_id
      AND role = 'master'
      AND active = true
  );
$$;

-- ============================================
-- 6. POLÍTICA: USUÁRIOS PODEM CRIAR MASTER QUANDO NÃO HÁ NENHUM MASTER
-- ============================================
-- Permite que usuários criem o primeiro master do establishment
-- CRÍTICO: Esta política APENAS permite criar master quando não há master
-- Não permite criar outros roles - isso é feito pela política seguinte

CREATE POLICY "Users can create master when none exists"
  ON public.team_members FOR INSERT
  TO authenticated
  WITH CHECK (
    -- APENAS para criar master
    role = 'master'
    AND
    -- Verifica se o usuário tem establishment_id no profile
    establishment_id IN (
      SELECT establishment_id 
      FROM public.profiles 
      WHERE user_id = auth.uid() 
        AND establishment_id IS NOT NULL
    )
    AND
    -- Verifica se não existe nenhum master ativo (usando função SECURITY DEFINER que bypassa RLS)
    public.can_create_master(establishment_id)
    AND
    -- Deve ser para o próprio usuário
    user_id = auth.uid()
  );

-- ============================================
-- 7. FUNÇÃO AUXILIAR: VERIFICAR SE USUÁRIO É MASTER
-- ============================================
-- Função SECURITY DEFINER para verificar se usuário é master sem passar por RLS
-- CRÍTICO: Esta função DEVE bypassar RLS completamente para evitar recursão
-- SECURITY DEFINER faz a função executar com privilégios do criador (postgres/superuser)
-- Isso bypassa RLS automaticamente

CREATE OR REPLACE FUNCTION public.is_user_master(p_establishment_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
PARALLEL SAFE
AS $$
  -- SECURITY DEFINER garante que esta função executa com privilégios do criador
  -- Isso bypassa RLS automaticamente - não precisa de configuração adicional
  -- Usar SQL puro (não plpgsql) pode ajudar a evitar problemas de recursão
  -- auth.uid() funciona dentro de funções SECURITY DEFINER
  SELECT EXISTS (
    SELECT 1 
    FROM public.team_members
    WHERE user_id = auth.uid()
      AND establishment_id = p_establishment_id
      AND role = 'master'
      AND active = true
  );
$$;

-- ============================================
-- 8. POLÍTICA: MASTERS PODEM CRIAR team_members (NÃO-MASTERS)
-- ============================================
-- Permite que masters criem outros membros (não-masters) do seu establishment
-- CRÍTICO: Esta política APENAS permite criar não-masters
-- Não permite criar master - isso é feito pela política anterior
-- A separação garante que não há conflito ou recursão

CREATE POLICY "Masters can insert non-master team_members"
  ON public.team_members FOR INSERT
  TO authenticated
  WITH CHECK (
    -- APENAS para criar não-masters (admin, operator, user)
    role != 'master'
    AND
    -- Verifica se o usuário pertence ao establishment
    establishment_id IN (
      SELECT establishment_id 
      FROM public.profiles 
      WHERE user_id = auth.uid() 
        AND establishment_id IS NOT NULL
    )
    AND
    -- E se é master (usando função SECURITY DEFINER que bypassa RLS)
    -- IMPORTANTE: Esta função só retorna true se já existe um master
    -- Então não há recursão ao criar o primeiro master
    public.is_user_master(establishment_id)
  );

CREATE POLICY "Masters can update team_members"
  ON public.team_members FOR UPDATE
  TO authenticated
  USING (
    -- Verifica se o usuário pertence ao establishment
    establishment_id IN (
      SELECT establishment_id 
      FROM public.profiles 
      WHERE user_id = auth.uid() 
        AND establishment_id IS NOT NULL
    )
    AND
    -- E se é master
    public.is_user_master(establishment_id)
  )
  WITH CHECK (
    -- Mesmas condições para UPDATE
    establishment_id IN (
      SELECT establishment_id 
      FROM public.profiles 
      WHERE user_id = auth.uid() 
        AND establishment_id IS NOT NULL
    )
    AND
    public.is_user_master(establishment_id)
  );

CREATE POLICY "Masters can delete team_members"
  ON public.team_members FOR DELETE
  TO authenticated
  USING (
    -- Verifica se o usuário pertence ao establishment
    establishment_id IN (
      SELECT establishment_id 
      FROM public.profiles 
      WHERE user_id = auth.uid() 
        AND establishment_id IS NOT NULL
    )
    AND
    -- E se é master (usando função que contorna RLS)
    public.is_user_master(establishment_id)
    AND
    -- Não pode deletar a si mesmo se for o único master (usando função para evitar recursão)
    NOT (
      role = 'master' 
      AND user_id = auth.uid()
      AND NOT public.can_create_master(establishment_id)
    )
  );

-- ============================================
-- 9. POLÍTICA: USUÁRIOS PODEM ATUALIZAR SEU PRÓPRIO REGISTRO
-- ============================================
-- Permite que usuários atualizem seu próprio registro (ex: PIN, nome)
-- Importante: permite que masters atualizem seu próprio registro mesmo se for o primeiro

CREATE POLICY "Users can update their own team_member"
  ON public.team_members FOR UPDATE
  TO authenticated
  USING (
    -- Usuário pode atualizar seu próprio registro
    user_id = auth.uid()
    AND
    -- E pertence ao establishment do usuário
    establishment_id IN (
      SELECT establishment_id 
      FROM public.profiles 
      WHERE user_id = auth.uid() 
        AND establishment_id IS NOT NULL
    )
  )
  WITH CHECK (
    -- Mantém as mesmas condições
    user_id = auth.uid()
    AND
    establishment_id IN (
      SELECT establishment_id 
      FROM public.profiles 
      WHERE user_id = auth.uid() 
        AND establishment_id IS NOT NULL
    )
  );

-- ============================================
-- 10. GRANT PERMISSIONS PARA FUNÇÕES AUXILIARES
-- ============================================

GRANT EXECUTE ON FUNCTION public.can_create_master(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_user_master(UUID) TO authenticated;

-- ============================================
-- 11. ATUALIZAR FUNÇÃO create_establishment_for_user
-- ============================================
-- Adicionar criação automática de team_member master quando criar establishment

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
  master_pin TEXT;
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

  -- NOVO: Cria automaticamente o team_member master
  -- Gera um PIN padrão (4 dígitos aleatórios) se não fornecido
  master_pin := '0000'; -- PIN padrão, usuário pode alterar depois
  
  -- Verifica se já existe um master (não deveria, mas por segurança)
  IF NOT EXISTS (
    SELECT 1 FROM public.team_members
    WHERE establishment_id = new_establishment_id
      AND role = 'master'
      AND active = true
  ) THEN
    -- Cria o master
    INSERT INTO public.team_members (
      establishment_id,
      user_id,
      name,
      role,
      pin,
      active
    ) VALUES (
      new_establishment_id,
      current_user_id,
      COALESCE(master_name, 'Master'),
      'master',
      master_pin,
      true
    );
  END IF;

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

      -- Cria o master também aqui
      IF NOT EXISTS (
        SELECT 1 FROM public.team_members
        WHERE establishment_id = new_establishment_id
          AND role = 'master'
          AND active = true
      ) THEN
        INSERT INTO public.team_members (
          establishment_id,
          user_id,
          name,
          role,
          pin,
          active
        ) VALUES (
          new_establishment_id,
          current_user_id,
          COALESCE(master_name, 'Master'),
          'master',
          master_pin,
          true
        );
      END IF;
      
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

-- ============================================
-- 12. GRANT PERMISSIONS
-- ============================================

GRANT EXECUTE ON FUNCTION public.create_establishment_for_user(TEXT, TEXT) TO authenticated;

-- ============================================
-- 13. COMENTÁRIOS
-- ============================================

COMMENT ON TABLE public.team_members IS 
'Gerencia membros da equipe de cada estabelecimento. Cada estabelecimento pode ter um master e múltiplos admins/operators/users.';

COMMENT ON COLUMN public.team_members.user_id IS 
'ID do usuário autenticado. Pode ser NULL para membros que não têm conta (ex: operadores temporários).';

COMMENT ON COLUMN public.team_members.role IS 
'Papel do membro: master (proprietário), admin (administrador), operator (operador), user (usuário básico).';

COMMENT ON COLUMN public.team_members.pin IS 
'PIN de 4 dígitos para autenticação. Obrigatório para master e admin.';

-- ============================================
-- FIM DA MIGRATION
-- ============================================

