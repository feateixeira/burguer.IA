# 🔍 Como Verificar e Corrigir a Edge Function create-user

## ⚠️ ERRO 404 - Edge Function não encontrada

Se você está recebendo erro 404, significa que a Edge Function não está acessível. Siga estes passos:

---

## ✅ VERIFICAÇÃO PASSO A PASSO

### 1. Verificar se a função existe
1. Acesse **Supabase Dashboard** → **Edge Functions**
2. Procure por `create-user` na lista
3. Se NÃO encontrar, crie uma nova função

### 2. Se a função EXISTE mas está dando 404:
1. Clique na função `create-user`
2. Clique em **"Deploy"** ou **"Redeploy"** para garantir que está ativa
3. Verifique se há algum erro de sintaxe mostrado na tela

### 3. Verificar o nome da função
- Deve ser exatamente: `create-user` (com hífen, não underscore)
- NÃO pode ser: `create_user` ou `createUser`
- O nome é case-sensitive

### 4. Verificar variáveis de ambiente
Na função `create-user`:
- Settings → Secrets/Environment Variables
- Deve ter `SUPABASE_SERVICE_ROLE_KEY` configurada
- O valor deve ser a **service_role** key (não a anon key)

---

## 🔧 SOLUÇÃO: Deploy Manual

Se a função não existir ou estiver com problema:

1. **Criar Nova Função**:
   - Supabase Dashboard → Edge Functions → **"New Function"**
   - Nome: `create-user` (exatamente assim)
   - Cole TODO o código do arquivo `supabase/functions/create-user/index.ts`

2. **Configurar Variáveis**:
   - Settings → Add Secret
   - Name: `SUPABASE_SERVICE_ROLE_KEY`
   - Value: (sua service_role key)

3. **Deploy**:
   - Clique em **"Deploy"** ou **"Save and Deploy"**

---

## 🧪 TESTAR

Após deploy, tente criar um usuário novamente. Se ainda der 404:

1. Verifique o nome da função novamente
2. Verifique se está deployada (status "Active")
3. Tente fazer "Redeploy" da função

---

## ⚠️ NOTA IMPORTANTE

Se ainda não funcionar após seguir todos os passos, pode ser que o Supabase esteja com algum problema temporário. Nesse caso, você pode:

1. Deletar a função existente
2. Criar uma nova função com o mesmo nome
3. Colar o código novamente
4. Fazer deploy

