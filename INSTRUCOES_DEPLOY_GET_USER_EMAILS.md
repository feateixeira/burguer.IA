# 📋 Instruções para Configurar Busca de Emails de Usuários

## ⚠️ PROBLEMA ATUAL
O painel Admin está mostrando UUID ao invés de emails e "N/A" ao invés do nome do estabelecimento.

## ✅ SOLUÇÃO

Existem duas formas de resolver isso. Siga as instruções abaixo:

---

## OPÇÃO 1: Edge Function (Recomendado)

### Passo 1: Deploy da Edge Function

1. Acesse o **Supabase Dashboard** → **Edge Functions**
2. Clique em **"Create a new function"** ou **"New Function"**
3. Nome da função: `get-user-emails`
4. Cole o código do arquivo `supabase/functions/get-user-emails/index.ts`
5. Clique em **"Deploy"**

### Passo 2: Configurar Variáveis de Ambiente

1. Na Edge Function `get-user-emails`, vá em **Settings**
2. Certifique-se de que existem as seguintes variáveis:
   - `SUPABASE_URL` (deve existir automaticamente)
   - `SUPABASE_SERVICE_ROLE_KEY` ⚠️ **IMPORTANTE**: Use a SERVICE_ROLE_KEY, não a ANON_KEY!
     - Para obter: **Settings** → **API** → Copie a **`service_role` secret key**

### Passo 3: Testar

1. Acesse o painel Admin
2. A lista de usuários deve mostrar os emails reais e nomes dos estabelecimentos

---

## OPÇÃO 2: Função RPC (Alternativa)

Se preferir usar uma função RPC ao invés de Edge Function:

### Passo 1: Executar a Migration

1. Acesse o **Supabase Dashboard** → **SQL Editor**
2. Execute o conteúdo do arquivo `supabase/migrations/20250105000000_create_get_user_emails_function.sql`

Ou execute este SQL:

```sql
-- Function to get user emails from auth.users
CREATE OR REPLACE FUNCTION public.get_user_emails(user_ids uuid[])
RETURNS TABLE(user_id uuid, email text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  -- Only admins can call this function
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = auth.uid() AND is_admin = true
  ) THEN
    RAISE EXCEPTION 'Access denied. Only admins can call this function.';
  END IF;

  RETURN QUERY
  SELECT 
    u.id::uuid as user_id,
    u.email::text as email
  FROM auth.users u
  WHERE u.id = ANY(user_ids);
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_user_emails(uuid[]) TO authenticated;
```

### Passo 2: Testar

O código já tenta primeiro a Edge Function e depois a RPC como fallback, então qualquer uma das duas funciona!

---

## 🔍 VERIFICAÇÃO

Depois de configurar, abra o **Console do Navegador** (F12) e verifique:

1. Se aparecer `email_found: true` nos logs = ✅ Funcionando!
2. Se aparecer `email_found: false` = ❌ Ainda precisa configurar

---

## ❓ TROUBLESHOOTING

### Problema: Ainda mostra UUID
**Solução**: Verifique se a Edge Function foi deployada corretamente e se tem a SERVICE_ROLE_KEY configurada.

### Problema: Mostra "N/A" para estabelecimento
**Possíveis causas**:
1. O profile não tem `establishment_id` definido
2. O estabelecimento foi deletado
3. Problema com RLS (Row Level Security)

**Solução**: Execute este SQL para verificar:

```sql
SELECT 
  p.user_id,
  p.establishment_id,
  e.name as establishment_name
FROM profiles p
LEFT JOIN establishments e ON e.id = p.establishment_id
WHERE p.is_admin = false
LIMIT 10;
```

---

## ✅ CHECKLIST

- [ ] Edge Function `get-user-emails` criada e deployada
- [ ] Variável `SUPABASE_SERVICE_ROLE_KEY` configurada na Edge Function
- [ ] Ou função RPC `get_user_emails` criada no banco
- [ ] Testado no painel Admin e emails aparecem corretamente
- [ ] Estabelecimentos aparecem corretamente

