# 🔐 Como Configurar Admin no Supabase

## Problema Atual
- Email: `fellipe_1693@outlook.com`
- Erro: "Invalid login credentials"
- Precisa: Acesso admin para gerenciar usuários

---

## ✅ SOLUÇÃO COMPLETA

### PASSO 1: Verificar/Criar o Usuário

**Opção A - Se o usuário JÁ existe:**

1. Acesse **Supabase Dashboard** → **Authentication** → **Users**
2. Procure por `fellipe_1693@outlook.com`
3. Se encontrar: clique nele e **"Send password reset email"** ou defina uma nova senha

**Opção B - Se o usuário NÃO existe:**

1. Vá em **Authentication** → **Users** → **Add User**
2. Preencha:
   - **Email**: `fellipe_1693@outlook.com`
   - **Password**: (defina uma senha forte)
   - **Auto Confirm User**: ✅ (marcado)
3. Clique em **Create user**

---

### PASSO 2: Configurar como Admin (SQL Editor)

1. No Supabase Dashboard, vá em **SQL Editor**
2. Execute este script completo:

```sql
-- ============================================
-- CONFIGURAR ADMIN: fellipe_1693@outlook.com
-- ============================================

-- 1. Primeiro, verificar se o usuário existe
SELECT 
  id,
  email,
  confirmed_at,
  created_at
FROM auth.users 
WHERE email = 'fellipe_1693@outlook.com';

-- 2. Criar/Atualizar o profile como ADMIN
-- Nota: A tabela profiles NÃO tem coluna 'email', o email fica em auth.users
INSERT INTO public.profiles (user_id, full_name, is_admin, status)
SELECT 
  u.id,
  COALESCE(u.raw_user_meta_data->>'name', 'Administrador') as full_name,
  true as is_admin,
  'active' as status
FROM auth.users u
WHERE u.email = 'fellipe_1693@outlook.com'
ON CONFLICT (user_id) 
DO UPDATE SET 
  is_admin = true,
  status = 'active',
  full_name = COALESCE(EXCLUDED.full_name, profiles.full_name, 'Administrador');

-- 3. Verificar se foi aplicado corretamente
SELECT 
  u.email,
  u.confirmed_at as "Email Confirmado",
  p.full_name as "Nome",
  p.is_admin as "É Admin?",
  p.status as "Status"
FROM auth.users u
LEFT JOIN public.profiles p ON p.user_id = u.id
WHERE u.email = 'fellipe_1693@outlook.com';
```

---

### PASSO 3: Se precisar resetar a senha

**Método 1 - Via Dashboard:**
- Authentication → Users → Selecionar `fellipe_1693@outlook.com`
- Clique em "Send password reset email" ou "Reset password"

**Método 2 - Via SQL (se tiver Service Role):**
```sql
-- Nota: Isso requer permissões de service role
-- Geralmente é feito pelo Dashboard mesmo
```

---

### PASSO 4: Testar o Login

1. Vá para a página de login do seu sistema
2. Clique na aba **"Admin"**
3. Digite:
   - **Email**: `fellipe_1693@outlook.com`
   - **Senha**: (a senha que você definiu)
4. Deve redirecionar para `/admin`

---

## ⚠️ POSSÍVEIS PROBLEMAS

### Problema 1: "Usuário não encontrado" no SQL
**Solução**: Crie o usuário primeiro pelo Dashboard (PASSO 1 - Opção B)

### Problema 2: "Invalid login credentials" depois de criar
**Soluções**:
- Verifique se marcou "Auto Confirm User"
- Verifique se a senha está correta
- Tente fazer "Reset Password" no Dashboard

### Problema 3: Login funciona mas não vai para /admin
**Solução**: Execute o SQL do PASSO 2 novamente para garantir `is_admin = true`

### Problema 4: Profile não existe
**Solução**: O SQL do PASSO 2 cria o profile automaticamente. Se não criar, pode ser RLS. Nesse caso, desabilite temporariamente RLS na tabela `profiles` ou use service role.

---

## 🔍 VERIFICAÇÃO FINAL

Execute este SQL para verificar tudo:

```sql
-- Status completo do usuário admin
SELECT 
  u.id as "User ID",
  u.email as "Email",
  u.confirmed_at as "Confirmado?",
  u.created_at as "Criado em",
  p.user_id as "Profile existe?",
  p.is_admin as "É Admin?",
  p.status as "Status",
  p.full_name as "Nome",
  p.establishment_id as "Estabelecimento"
FROM auth.users u
LEFT JOIN public.profiles p ON p.user_id = u.id
WHERE u.email = 'fellipe_1693@outlook.com';
```

**Resultado esperado**:
- ✅ `confirmed_at` não deve ser NULL
- ✅ `is_admin` deve ser `true`
- ✅ `status` deve ser `'active'`

---

## 📝 PRÓXIMOS PASSOS APÓS CONSEGUIR ACESSO

Uma vez logado como admin, você poderá:

1. **Ver todos os usuários**: Lista completa na página `/admin`
2. **Criar novos usuários**: Botão "Criar Usuário" no painel admin
3. **Gerenciar status**: Ativar, bloquear ou cancelar usuários
4. **Enviar notificações**: Como lembretes de pagamento
5. **Conceder dias de teste**: Para novos clientes

---

## 💡 DICA

Se continuar com problemas, verifique:
- Se o email está escrito exatamente: `fellipe_1693@outlook.com` (sem espaços)
- Se o usuário está confirmado (`confirmed_at` não é NULL)
- Se há políticas RLS bloqueando (RLS pode impedir criação de profiles)

