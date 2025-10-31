# 🔧 Como Atualizar um Secret Existente no Supabase

## Problema
Você já tem uma variável `SUPABASE_SERVICE_ROLE_KEY` configurada, mas precisa atualizar o valor. **Não há botão de editar** - você precisa adicionar novamente com o mesmo nome.

## ✅ Solução: Sobrescrever o Secret Existente

### Passo a Passo:

1. **Acesse o Supabase Dashboard:**
   - Vá para https://supabase.com/dashboard
   - Selecione seu projeto

2. **Navegue até a Edge Function:**
   - No menu lateral, clique em **Edge Functions**
   - Clique na função **`create-user`**
   - Vá na aba **Settings** ou procure por **Secrets**

3. **Na seção "ADD NEW SECRETS" (parte superior da página):**
   - No campo **Key**: Digite `SERVICE_ROLE_KEY`
     - ⚠️ **IMPORTANTE**: O Supabase não permite prefixo `SUPABASE_` em secrets
     - Se você tinha `SUPABASE_SERVICE_ROLE_KEY`, exclua-a e crie uma nova com nome `SERVICE_ROLE_KEY`
   - No campo **Value**: Cole a key correta:
     ```
     eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRuZGl3anpuaXRudWFsdG9yYnBrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTY3NTI3NSwiZXhwIjoyMDc3MjUxMjc1fQ.OqXrm_90XLULLN1m7-vVjrWA_yMo2cCCAxwNd6j2DVQ
     ```
   - Clique no botão verde **"Save"**

4. **O Supabase vai automaticamente:**
   - Sobrescrever o valor antigo com o novo
   - Reimplantar a Edge Function
   - Você verá o timestamp "UPDATED AT" mudar na lista

5. **Aguarde e Teste:**
   - Aguarde 10-20 segundos
   - Tente criar um usuário no Admin Panel

### Opção 2: Via Supabase CLI (Se tiver instalado)

```bash
# Listar secrets atuais
supabase secrets list

# Atualizar o secret
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRuZGl3anpuaXRudWFsdG9yYnBrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTY3NTI3NSwiZXhwIjoyMDc3MjUxMjc1fQ.OqXrm_90XLULLN1m7-vVjrWA_yMo2cCCAxwNd6j2DVQ

# Fazer deploy novamente
supabase functions deploy create-user
```

### Opção 3: Criar com Nome Diferente (Se não conseguir editar)

Se realmente não conseguir editar a variável existente, você pode:

1. Criar uma nova variável com nome diferente (ex: `SUPABASE_SERVICE_KEY`)
2. Eu atualizo o código para aceitar ambos os nomes

## 🔍 Como Verificar se Está Funcionando

1. Após editar o secret, aguarde 10-20 segundos
2. Tente criar um usuário no Admin Panel
3. Se ainda der erro, verifique os logs:
   - Edge Functions → `create-user` → **Logs**
   - Procure por mensagens de erro recentes

## ⚠️ Notas Importantes

- A variável deve ter o nome **exato**: `SUPABASE_SERVICE_ROLE_KEY` (case-sensitive)
- O valor deve ser a **service_role key completa** (começa com `eyJ...`)
- Após editar, pode levar alguns segundos para a função ser atualizada
- Se não funcionar, verifique se copiou a key completa (sem espaços extras)

