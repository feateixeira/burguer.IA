# 🔧 Como Corrigir a Edge Function create-user

## ⚠️ PROBLEMA IDENTIFICADO

A Edge Function `create-user` no Supabase Dashboard está com o código **ERRADO** - está usando o código da função `verify-admin-password`!

Isso explica o erro: a função está recebendo dados de criação de usuário (`email`, `password`, `name`, `establishmentName`) mas está tentando processar como se fosse verificação de senha admin.

## ✅ SOLUÇÃO

### Passo 1: Abrir a Edge Function no Supabase

1. Acesse [Supabase Dashboard](https://supabase.com/dashboard)
2. Selecione seu projeto
3. Vá em **Edge Functions** (menu lateral)
4. Encontre e clique em **`create-user`**

### Passo 2: Substituir o Código

1. Clique em **Edit** ou no ícone de edição
2. **DELETE TODO O CÓDIGO ATUAL**
3. **COPIE O CÓDIGO CORRETO** do arquivo `CODIGO_CREATE_USER_CORRETO.txt`
4. Cole o código novo
5. Clique em **Save** ou **Deploy**

### Passo 3: Verificar Variáveis de Ambiente

A Edge Function precisa das seguintes variáveis:

1. No Supabase Dashboard, vá em **Edge Functions** → **`create-user`**
2. Clique em **Settings** ou procure por **Secrets/Environment Variables**
3. Certifique-se de que existem:
   - `SUPABASE_URL` (já deve existir automaticamente)
   - `SUPABASE_SERVICE_ROLE_KEY` ⚠️ **IMPORTANTE**: Precisa ser a SERVICE_ROLE_KEY, não a ANON_KEY!

Para obter a SERVICE_ROLE_KEY:
- Vá em **Settings** → **API**
- Copie a **`service_role` secret key** (não a `anon` public key!)
- Adicione como variável de ambiente na Edge Function

### Passo 4: Testar

1. Faça login como admin no painel
2. Tente criar um novo usuário
3. Deve funcionar agora! ✅

## 🔍 Diferenças entre os Códigos

### Código ERRADO (que está lá agora):
- Usa `SUPABASE_ANON_KEY` 
- Espera apenas `password` no body
- Faz `bcrypt.compare()` para verificar senha
- Não cria usuários

### Código CORRETO:
- Usa `SUPABASE_SERVICE_ROLE_KEY` (bypassa RLS)
- Espera `email`, `password`, `name`, `establishmentName`
- Cria usuário com `auth.admin.createUser()`
- Cria profile e establishment automaticamente

## ⚠️ Atenção

Se a função `create-user` não existir:
1. Crie uma nova Edge Function chamada `create-user`
2. Cole o código correto
3. Configure as variáveis de ambiente

## 📋 Checklist

- [ ] Edge Function `create-user` existe no Supabase
- [ ] Código foi substituído pelo código correto
- [ ] Variável `SUPABASE_URL` está configurada
- [ ] Variável `SUPABASE_SERVICE_ROLE_KEY` está configurada (SERVICE_ROLE, não ANON!)
- [ ] Código foi salvo/deployed
- [ ] Testou criar usuário no painel admin

## 🆘 Se ainda não funcionar

1. Verifique os **Logs** da Edge Function no Supabase Dashboard
2. Abra o **Console do navegador** (F12) e veja mensagens de erro
3. Verifique se o usuário logado é realmente admin (`is_admin = true`)




