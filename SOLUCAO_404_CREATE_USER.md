# 🔧 Solução para Erro 404 - Edge Function não encontrada

## ⚠️ Erro Atual
```
POST https://tndiwjznitnualtorbpk.supabase.co/functions/v1/create-user 404 (Not Found)
```

Isso significa que a Edge Function `create-user` **não está deployada** ou **não existe** no Supabase.

## ✅ Solução: Criar/Deployar a Edge Function

### Opção 1: Verificar se a Função Existe

1. **Acesse o Supabase Dashboard:**
   - Vá para https://supabase.com/dashboard
   - Selecione seu projeto
   - No menu lateral, clique em **Edge Functions**

2. **Verifique se `create-user` existe:**
   - Procure por `create-user` na lista
   - Se **NÃO encontrar**, você precisa criar
   - Se encontrar, precisa fazer **Redeploy**

### Opção 2: Criar Nova Edge Function (Se não existir)

1. **No Dashboard → Edge Functions:**
   - Clique em **"New Function"** ou **"Create Function"**
   - Nome: `create-user` (exatamente assim, com hífen)
   - Não use: `create_user` ou `createUser`

2. **Cole o código:**
   - Abra o arquivo `supabase/functions/create-user/index.ts`
   - **COPIE TODO O CÓDIGO**
   - Cole na interface do Supabase (substitua qualquer código padrão)
   - Clique em **"Deploy"** ou **"Save and Deploy"**

3. **Configure os Secrets:**
   - Após deploy, vá em **Settings** ou **Secrets**
   - Adicione o secret:
     - **Key**: `SERVICE_ROLE_KEY`
     - **Value**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRuZGl3anpuaXRudWFsdG9yYnBrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTY3NTI3NSwiZXhwIjoyMDc3MjUxMjc1fQ.OqXrm_90XLULLN1m7-vVjrWA_yMo2cCCAxwNd6j2DVQ`

4. **Faça Redeploy:**
   - Após adicionar o secret, clique em **"Redeploy"** ou **"Deploy"** novamente

### Opção 3: Redeployar (Se a função já existe)

1. **No Dashboard → Edge Functions → `create-user`:**
   - Clique em **"Edit"** ou **"Code"**
   - Verifique se o código está atualizado (deve ter os logs de debug que adicionamos)
   - Se não estiver, cole o código do arquivo `supabase/functions/create-user/index.ts`
   - Clique em **"Deploy"** ou **"Redeploy"**

2. **Verifique os Secrets:**
   - Vá em **Settings** → **Secrets**
   - Certifique-se de que `SERVICE_ROLE_KEY` está configurada
   - Se não estiver, adicione conforme Opção 2, passo 3

### Opção 4: Deploy via CLI (Recomendado)

Se você tem o Supabase CLI instalado:

```bash
# Certifique-se de estar na pasta do projeto
cd "c:\Users\Felli\OneDrive\Documentos\PROJETO ULTRA SECRETO\burgueria-saas-main"

# Fazer login (se necessário)
supabase login

# Fazer link do projeto
supabase link --project-ref tndiwjznitnualtorbpk

# Deploy da função específica
supabase functions deploy create-user
```

Após o deploy via CLI, você ainda precisa adicionar o secret no Dashboard:
- Edge Functions → `create-user` → Settings → Secrets
- Adicione `SERVICE_ROLE_KEY` com o valor da service_role key

## 🔍 Verificar se Funcionou

Após fazer o deploy:

1. **Verifique o status:**
   - A função deve aparecer como **"Active"** ou **"Deployed"**
   - Não deve ter erros de sintaxe

2. **Teste:**
   - Tente criar um usuário no Admin Panel
   - Se funcionar: ✅ Pronto!
   - Se ainda der 404: Verifique o nome da função (deve ser `create-user` exatamente)

3. **Verifique os logs:**
   - Edge Functions → `create-user` → **Logs**
   - Tente criar um usuário
   - Deve aparecer logs recentes

## ⚠️ Notas Importantes

- O nome da função é **case-sensitive** e **sensitive a hífens/underscores**
- Deve ser exatamente: `create-user` (com hífen, minúsculas)
- NÃO pode ser: `create_user`, `CreateUser`, `createUser`, etc.
- Após criar/deployar, pode levar alguns segundos para estar ativa
- Sempre adicione o secret `SERVICE_ROLE_KEY` após criar a função

