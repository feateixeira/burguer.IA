# Configuração do Supabase Storage para Cardápio Online

## Problema
Ao tentar fazer upload de imagens para personalização do cardápio online, você pode receber o erro:
```
Bucket not found
```

## Solução

### Opção 1: Criar o Bucket no Supabase (Recomendado)

1. Acesse o painel do Supabase: https://supabase.com/dashboard
2. Selecione seu projeto
3. Vá em **Storage** no menu lateral
4. Clique em **New bucket**
5. Configure o bucket:
   - **Name**: `establishments`
   - **Public bucket**: ✅ Marque como público (para permitir acesso às imagens)
   - **File size limit**: Configure conforme necessário (ex: 5MB)
   - **Allowed MIME types**: `image/*` (ou deixe vazio para permitir todos)
6. Clique em **Create bucket**

### Opção 2: Usar URL Externa (Alternativa)

Se você não quiser configurar o bucket agora, pode usar URLs externas de imagens:

1. Hospede sua imagem em um serviço externo (Imgur, Cloudinary, etc.)
2. Na personalização do cardápio, clique em **"Usar URL Externa"**
3. Cole a URL da imagem
4. Clique em **"Usar esta URL"**

## Políticas de Acesso (RLS)

Após criar o bucket, configure as políticas de acesso:

1. No painel do Supabase, vá em **Storage** > **Policies**
2. Selecione o bucket `establishments`
3. Adicione as seguintes políticas:

### Política de Upload (INSERT)
```sql
CREATE POLICY "Users can upload to their establishment folder"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'establishments' AND
  (storage.foldername(name))[1] = auth.uid()::text
);
```

### Política de Leitura (SELECT) - Público
```sql
CREATE POLICY "Public can view establishment images"
ON storage.objects FOR SELECT
USING (bucket_id = 'establishments');
```

### Política de Atualização (UPDATE)
```sql
CREATE POLICY "Users can update their establishment images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'establishments' AND
  (storage.foldername(name))[1] = auth.uid()::text
);
```

### Política de Exclusão (DELETE)
```sql
CREATE POLICY "Users can delete their establishment images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'establishments' AND
  (storage.foldername(name))[1] = auth.uid()::text
);
```

## Estrutura de Pastas

As imagens serão organizadas da seguinte forma:
```
establishments/
  └── {establishment_id}/
      └── menu-background-{timestamp}.{ext}
```

## Nota

Se você usar URLs externas, não precisa configurar o bucket. No entanto, o upload direto oferece melhor integração e controle sobre as imagens.

