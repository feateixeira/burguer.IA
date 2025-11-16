-- Migration: Criar bucket 'establishments' no Supabase Storage
-- Este bucket é usado para armazenar imagens de personalização do cardápio online
-- Cada estabelecimento terá sua própria pasta dentro do bucket

-- ============================================
-- 1. CRIAR BUCKET (se não existir)
-- ============================================
-- Nota: Buckets são criados via API ou Dashboard do Supabase
-- Esta migration apenas configura as políticas de acesso
-- O bucket deve ser criado manualmente no Dashboard do Supabase:
-- Storage > New bucket > Name: "establishments" > Public: true

-- ============================================
-- 2. POLÍTICAS DE ACESSO (RLS) PARA O BUCKET
-- ============================================

-- Política de Leitura (SELECT) - Público
-- Permite que qualquer pessoa visualize as imagens (necessário para o cardápio online)
DROP POLICY IF EXISTS "Public can view establishment images" ON storage.objects;
CREATE POLICY "Public can view establishment images"
ON storage.objects FOR SELECT
USING (bucket_id = 'establishments');

-- Política de Upload (INSERT)
-- Permite que usuários autenticados façam upload apenas na pasta do seu estabelecimento
DROP POLICY IF EXISTS "Users can upload to their establishment folder" ON storage.objects;
CREATE POLICY "Users can upload to their establishment folder"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'establishments' AND
  auth.role() = 'authenticated' AND
  -- Verificar se o primeiro segmento do caminho corresponde ao establishment_id do usuário
  (storage.foldername(name))[1] IN (
    SELECT establishment_id::text 
    FROM public.profiles 
    WHERE user_id = auth.uid()
  )
);

-- Política de Atualização (UPDATE)
-- Permite que usuários atualizem apenas imagens do seu estabelecimento
DROP POLICY IF EXISTS "Users can update their establishment images" ON storage.objects;
CREATE POLICY "Users can update their establishment images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'establishments' AND
  auth.role() = 'authenticated' AND
  (storage.foldername(name))[1] IN (
    SELECT establishment_id::text 
    FROM public.profiles 
    WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  bucket_id = 'establishments' AND
  auth.role() = 'authenticated' AND
  (storage.foldername(name))[1] IN (
    SELECT establishment_id::text 
    FROM public.profiles 
    WHERE user_id = auth.uid()
  )
);

-- Política de Exclusão (DELETE)
-- Permite que usuários excluam apenas imagens do seu estabelecimento
DROP POLICY IF EXISTS "Users can delete their establishment images" ON storage.objects;
CREATE POLICY "Users can delete their establishment images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'establishments' AND
  auth.role() = 'authenticated' AND
  (storage.foldername(name))[1] IN (
    SELECT establishment_id::text 
    FROM public.profiles 
    WHERE user_id = auth.uid()
  )
);

-- ============================================
-- 3. COMENTÁRIOS E DOCUMENTAÇÃO
-- ============================================
-- Estrutura de pastas esperada:
-- establishments/
--   └── {establishment_id}/
--       └── menu-background-{timestamp}.{ext}
--
-- Exemplo:
-- establishments/
--   └── 123e4567-e89b-12d3-a456-426614174000/
--       └── menu-background-1700000000000.jpg
--
-- IMPORTANTE: 
-- 1. Crie o bucket 'establishments' no Dashboard do Supabase antes de executar esta migration
-- 2. Configure o bucket como PÚBLICO para permitir acesso às imagens no cardápio online
-- 3. As políticas acima garantem que cada estabelecimento só acesse suas próprias imagens

