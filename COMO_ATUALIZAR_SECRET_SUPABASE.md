# 🔧 Como Atualizar um Secret no Supabase (Sem Botão de Editar)

## ✅ Solução: Adicionar Novamente Sobrescreve

No Supabase, **não existe botão de "editar"** diretamente. Para atualizar um secret existente, você precisa **adicionar novamente com o mesmo nome**, e isso vai **sobrescrever** o valor anterior.

## 📋 Passo a Passo:

### 1. Na seção "ADD NEW SECRETS" (parte superior):
   - No campo **Key**: Digite: `SERVICE_ROLE_KEY`
     - ⚠️ **IMPORTANTE**: O Supabase NÃO permite prefixo `SUPABASE_` em secrets
     - ⚠️ Use `SERVICE_ROLE_KEY` (sem o prefixo)
   - No campo **Value**: Cole a nova key:
     ```
     eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRuZGl3anpuaXRudWFsdG9yYnBrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTY3NTI3NSwiZXhwIjoyMDc3MjUxMjc1fQ.OqXrm_90XLULLN1m7-vVjrWA_yMo2cCCAxwNd6j2DVQ
     ```

### 2. Clique no botão verde "Save"

### 3. Confirmação:
   - O Supabase vai **sobrescrever** o valor antigo com o novo
   - Pode aparecer uma mensagem de confirmação ou você verá o timestamp "UPDATED AT" mudar na lista

### 4. Aguarde:
   - Após salvar, a Edge Function será automaticamente reimplantada
   - Aguarde 10-20 segundos antes de testar

## ✅ Verificação:

1. Após salvar, você pode verificar:
   - O timestamp "UPDATED AT" da variável `SUPABASE_SERVICE_ROLE_KEY` deve ter mudado para agora
   - Você pode clicar no ícone de **olho** 👁️ para verificar se o valor foi atualizado (mas não vai mostrar o valor completo por segurança)

2. Teste criando um usuário no Admin Panel

## ⚠️ Importante:

- O nome da Key deve ser **exatamente igual** ao existente: `SUPABASE_SERVICE_ROLE_KEY`
- Copie e cole o valor completo da key (começa com `eyJ...`)
- Não adicione espaços extras no início ou fim do valor
- Após salvar, aguarde alguns segundos antes de testar

