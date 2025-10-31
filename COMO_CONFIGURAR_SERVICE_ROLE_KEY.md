# 🔧 Como Configurar SERVICE_ROLE_KEY no Supabase

## ⚠️ IMPORTANTE

O Supabase **não permite** que secrets de Edge Functions tenham o prefixo `SUPABASE_`. Você precisa usar o nome **`SERVICE_ROLE_KEY`** (sem o prefixo).

## ✅ Passo a Passo:

### 1. Excluir a Variável Antiga (se existir):
   - Na lista de secrets existentes, encontre `SUPABASE_SERVICE_ROLE_KEY`
   - Clique no ícone de **lixeira** 🗑️ para excluir

### 2. Adicionar Nova Variável:

   Na seção **"ADD NEW SECRETS"** (parte superior):
   
   - **Key**: Digite: `SERVICE_ROLE_KEY`
     - ⚠️ **NÃO** use `SUPABASE_SERVICE_ROLE_KEY` (vai dar erro!)
     - ⚠️ **NÃO** use `SUPABASE_` no início
   
   - **Value**: Cole a service_role key:
     ```
     eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRuZGl3anpuaXRudWFsdG9yYnBrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTY3NTI3NSwiZXhwIjoyMDc3MjUxMjc1fQ.OqXrm_90XLULLN1m7-vVjrWA_yMo2cCCAxwNd6j2DVQ
     ```
   
   - Clique no botão verde **"Save"**

### 3. Verificação:
   - Você verá `SERVICE_ROLE_KEY` na lista de secrets existentes
   - O timestamp "UPDATED AT" será atualizado
   - A Edge Function será automaticamente reimplantada

### 4. Aguarde e Teste:
   - Aguarde 10-20 segundos
   - Tente criar um usuário no Admin Panel

## 📋 Resumo:

- ✅ **Nome correto**: `SERVICE_ROLE_KEY`
- ❌ **Nome incorreto**: `SUPABASE_SERVICE_ROLE_KEY` (vai dar erro!)

A Edge Function foi atualizada para procurar por `SERVICE_ROLE_KEY` primeiro.

