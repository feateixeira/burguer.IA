# Migration: Criar Bucket de Storage para Personalização do Cardápio

## 📋 Instruções para Executar a Migration

### ⚡ Opção Rápida: Criação Automática

O sistema agora tenta criar o bucket automaticamente quando você faz upload de uma imagem. Se isso não funcionar, siga os passos manuais abaixo.

### Passo 1: Deploy da Edge Function (Recomendado)

A Edge Function `create-storage-bucket` cria o bucket automaticamente quando necessário.

**Para fazer deploy:**

1. No terminal, execute:
```bash
supabase functions deploy create-storage-bucket
```

2. Configure a variável de ambiente `SERVICE_ROLE_KEY`:
   - No Dashboard do Supabase, vá em **Project Settings** > **API**
   - Copie a **service_role key** (secret)
   - No Dashboard, vá em **Edge Functions** > **create-storage-bucket** > **Settings**
   - Adicione a variável: `SERVICE_ROLE_KEY` com o valor da service_role key

### Passo 2: Criar o Bucket no Dashboard do Supabase (Alternativa Manual)

**IMPORTANTE:** O bucket precisa ser criado manualmente antes de executar a migration SQL.

1. Acesse o Dashboard do Supabase: https://supabase.com/dashboard
2. Selecione seu projeto
3. No menu lateral, clique em **Storage**
4. Clique no botão **New bucket**
5. Configure o bucket:
   - **Name**: `establishments` (exatamente este nome)
   - **Public bucket**: ✅ **Marque como PÚBLICO** (necessário para o cardápio online acessar as imagens)
   - **File size limit**: 5 MB (ou conforme sua necessidade)
   - **Allowed MIME types**: `image/*` (ou deixe vazio para permitir todos os tipos)
6. Clique em **Create bucket**

### Passo 3: Executar a Migration SQL

1. No Dashboard do Supabase, vá em **SQL Editor**
2. Clique em **New query**
3. Abra o arquivo: `supabase/migrations/20251116123904_create_establishments_storage_bucket.sql`
4. Copie todo o conteúdo do arquivo
5. Cole no editor SQL do Supabase
6. Clique em **Run** ou pressione `Ctrl+Enter` (Windows) / `Cmd+Enter` (Mac)

### Passo 4: Verificar se Funcionou

Após executar a migration, você pode testar:

1. Vá em **Storage** > **Policies**
2. Selecione o bucket `establishments`
3. Você deve ver 4 políticas criadas:
   - Public can view establishment images (SELECT)
   - Users can upload to their establishment folder (INSERT)
   - Users can update their establishment images (UPDATE)
   - Users can delete their establishment images (DELETE)

## ✅ Como Funciona

### Estrutura de Armazenamento

As imagens são organizadas por estabelecimento:
```
establishments/
  └── {establishment_id}/
      └── menu-background-{timestamp}.{ext}
```

### Segurança

- **Leitura (SELECT)**: Pública - qualquer pessoa pode ver as imagens (necessário para o cardápio online)
- **Upload/Update/Delete**: Apenas usuários autenticados podem modificar imagens do seu próprio estabelecimento
- Cada estabelecimento só acessa suas próprias imagens através do `establishment_id`

### Personalizações por Estabelecimento

As personalizações do cardápio são salvas no campo `settings` da tabela `establishments`:

```json
{
  "menuCustomization": {
    "primaryColor": "#3b82f6",
    "secondaryColor": "#8b5cf6",
    "backgroundColor": "#ffffff",
    "backgroundImage": "https://...",
    "backgroundBlur": 10,
    "cardOpacity": 0.95,
    "headerStyle": "default"
  }
}
```

Cada estabelecimento tem seu próprio `settings`, então:
- ✅ Estabelecimento X pode ter cores diferentes do Estabelecimento Y
- ✅ Cada um tem suas próprias imagens de fundo
- ✅ As personalizações são independentes entre estabelecimentos

## 🔧 Solução de Problemas

### Erro: "Bucket not found"
- Certifique-se de que criou o bucket `establishments` no Dashboard antes de executar a migration
- Verifique se o nome do bucket está exatamente como `establishments` (sem espaços, minúsculas)

### Erro ao fazer upload
- Verifique se o bucket está marcado como **Público**
- Verifique se as políticas foram criadas corretamente
- Tente usar a opção "Usar URL Externa" como alternativa temporária

### Imagens não aparecem no cardápio
- Verifique se o bucket está público
- Verifique se a URL da imagem está correta
- Verifique o console do navegador para erros de CORS

## 📝 Notas Importantes

1. **Bucket Público**: O bucket DEVE ser público para que as imagens apareçam no cardápio online público
2. **Segurança**: As políticas garantem que cada estabelecimento só modifique suas próprias imagens
3. **Alternativa**: Se não quiser configurar o bucket agora, você pode usar URLs externas de imagens

