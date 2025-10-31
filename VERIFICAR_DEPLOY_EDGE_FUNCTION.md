# 🔍 Como Verificar se o Código da Edge Function foi Deployado

## ⚠️ IMPORTANTE

Se você editou o código da Edge Function **apenas no seu computador**, ele NÃO está rodando no Supabase! Você precisa fazer o deploy manualmente.

## ✅ Opções para Fazer Deploy:

### Opção 1: Deploy Manual via Dashboard (Mais Fácil)

1. **Acesse o Supabase Dashboard:**
   - Vá para https://supabase.com/dashboard
   - Selecione seu projeto

2. **Vá até a Edge Function:**
   - No menu lateral, clique em **Edge Functions**
   - Clique na função **`create-user`**

3. **Edite e Deploy:**
   - Clique no botão **"Edit"** ou no ícone de edição
   - **DELETE TODO O CÓDIGO ATUAL**
   - **COPIE TODO O CÓDIGO** do arquivo `supabase/functions/create-user/index.ts`
   - Cole o código novo na interface
   - Clique em **"Deploy"** ou **"Save and Deploy"**

4. **Aguarde o Deploy:**
   - Aguarde até aparecer mensagem de sucesso
   - Pode levar alguns segundos

### Opção 2: Deploy via Supabase CLI (Se tiver instalado)

```bash
# Certifique-se de estar na pasta do projeto
cd "c:\Users\Felli\OneDrive\Documentos\PROJETO ULTRA SECRETO\burgueria-saas-main"

# Fazer login (se necessário)
supabase login

# Fazer link do projeto (se necessário)
supabase link --project-ref tndiwjznitnualtorbpk

# Deploy da função específica
supabase functions deploy create-user

# Ou deploy de todas as funções
supabase functions deploy
```

## 🔍 Verificar se o Deploy Funcionou:

1. **Verifique os Logs:**
   - Edge Functions → `create-user` → **Logs**
   - Tente criar um usuário
   - Procure por "=== ENVIRONMENT DEBUG START ===" nos logs
   - Se aparecer, o código novo está rodando!

2. **Verifique o Código no Dashboard:**
   - Edge Functions → `create-user` → **Code** ou **Edit**
   - Confirme que o código tem os novos logs de debug que adicionamos

## ⚠️ Problemas Comuns:

- **Código antigo ainda rodando:** Precisa fazer deploy novamente
- **Secrets não disponíveis:** Após adicionar secret, a função precisa ser redeployada
- **Cache:** Pode levar alguns segundos para o novo código estar ativo

## 🎯 Próximos Passos:

1. Faça o deploy do código atualizado
2. Aguarde 10-20 segundos
3. Tente criar um usuário novamente
4. Verifique os logs para ver as variáveis de ambiente disponíveis

