# Deploy da Edge Function: create-storage-bucket

## 🚀 Deploy Rápido

### 1. Fazer Deploy da Function

No terminal, na raiz do projeto:

```bash
supabase functions deploy create-storage-bucket
```

### 2. Configurar Variável de Ambiente

A Edge Function precisa da `SERVICE_ROLE_KEY` para criar buckets.

**No Dashboard do Supabase:**

1. Vá em **Project Settings** > **API**
2. Copie a **service_role key** (é um secret, mantenha seguro)
3. Vá em **Edge Functions** no menu lateral
4. Clique em **create-storage-bucket**
5. Vá em **Settings** > **Secrets**
6. Adicione:
   - **Key**: `SERVICE_ROLE_KEY`
   - **Value**: Cole a service_role key copiada

### 3. Testar

Após o deploy, quando você tentar fazer upload de uma imagem no cardápio online:

1. Se o bucket não existir, a function será chamada automaticamente
2. O bucket será criado automaticamente
3. O upload será feito normalmente

## 🔍 Verificar se Funcionou

1. Vá em **Storage** no Dashboard do Supabase
2. Você deve ver o bucket `establishments` criado
3. Tente fazer upload de uma imagem no cardápio online
4. Deve funcionar sem erros

## ⚠️ Nota de Segurança

A `SERVICE_ROLE_KEY` tem acesso total ao projeto. Mantenha-a segura e nunca a exponha no frontend ou em repositórios públicos.

## 🆘 Solução de Problemas

### Erro: "Function not found"
- Certifique-se de que fez o deploy: `supabase functions deploy create-storage-bucket`
- Verifique se está no projeto correto do Supabase

### Erro: "SERVICE_ROLE_KEY not configured"
- Verifique se adicionou a variável de ambiente no Dashboard
- Verifique se o nome está exatamente como `SERVICE_ROLE_KEY` (case-sensitive)

### Bucket ainda não é criado
- Verifique os logs da Edge Function no Dashboard
- Verifique se a service_role key está correta
- Tente criar o bucket manualmente no Dashboard como alternativa

