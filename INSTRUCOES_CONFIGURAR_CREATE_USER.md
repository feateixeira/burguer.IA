# Instruções para Configurar a Edge Function create-user

## Erro Atual
O erro indica que a variável de ambiente `SUPABASE_SERVICE_ROLE_KEY` não está configurada na Edge Function.

## Solução: Configurar o Secret

### Passo 1: Obter a Service Role Key
1. Acesse o **Supabase Dashboard**: https://supabase.com/dashboard
2. Selecione seu projeto
3. Vá em **Settings** → **API**
4. Copie a **`service_role` key** (não use a `anon` key!)
   - ⚠️ **IMPORTANTE**: Esta key tem permissões totais. Mantenha-a segura e não a compartilhe.

### Passo 2: Configurar o Secret na Edge Function
1. No **Supabase Dashboard**, vá em **Edge Functions** (no menu lateral)
2. Clique na função **`create-user`**
3. Vá na aba **Settings** ou **Secrets**
4. Clique em **Add new secret** ou **New Secret**
5. Configure:
   - **Nome**: `SUPABASE_SERVICE_ROLE_KEY`
   - **Valor**: Cole a `service_role` key que você copiou no Passo 1
6. Clique em **Save** ou **Add**

### Passo 3: Verificar a Configuração
1. Após adicionar o secret, a Edge Function será automaticamente reimplantada
2. Aguarde alguns segundos
3. Tente criar um usuário novamente no Admin Panel

### Passo 4: Verificar Logs (se ainda houver erro)
1. Na página da Edge Function `create-user`, vá na aba **Logs**
2. Tente criar um usuário novamente
3. Verifique os logs para ver se há outros erros

## Notas Importantes

- ⚠️ A `service_role` key tem **acesso total** ao banco de dados, ignorando RLS policies
- 🔒 **NUNCA** exponha esta key no código frontend ou em repositórios públicos
- ✅ Edge Functions são o lugar seguro para usar esta key
- 🔄 Após adicionar o secret, pode levar alguns segundos para a função ser atualizada

## Verificação Rápida

Se você usar a CLI do Supabase localmente, também pode verificar os secrets:
```bash
supabase secrets list
```

Para adicionar via CLI:
```bash
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=sua_service_role_key_aqui
```

