# 🚀 Deploy Rápido - business-assistant

## ⚡ Passo a Passo Rápido (5 minutos)

### 1. Acesse o Supabase Dashboard
- https://app.supabase.com
- Selecione seu projeto

### 2. Vá em Edge Functions
- Menu lateral → **Edge Functions**

### 3. Criar/Editar a Função
- Se já existe: clique em **business-assistant**
- Se não existe: **Create a new function** → Nome: `business-assistant`

### 4. Copiar o Código
1. Abra o arquivo: `supabase/functions/business-assistant/index.ts`
2. **Selecione TUDO** (Ctrl+A)
3. **Copie** (Ctrl+C)
4. **Cole** no editor do Dashboard (Ctrl+V)
5. Clique em **Deploy** ou **Save**

### 5. Configurar Secret (OBRIGATÓRIO)
1. Após deploy, clique em **Settings** (⚙️) da função
2. Em **Secrets**, clique em **Add new secret**
3. **Nome**: `OPENAI_API_KEY`
4. **Valor**: sua chave da OpenAI (começa com `sk-`)
5. Clique em **Save**

### 6. Testar
1. No Dashboard: **Edge Functions** → **business-assistant** → **Invoke**
2. Cole este JSON:
```json
{
  "message": "Como estão minhas vendas hoje?"
}
```
3. Clique em **Invoke**
4. Deve retornar uma resposta da IA

## ✅ Pronto!

A função deve estar funcionando agora. Teste no frontend (Assistente IA).

## 🔍 Se ainda não funcionar:

1. **Verifique os logs**: Dashboard → Edge Functions → business-assistant → Logs
2. **Verifique a secret**: Settings → Secrets → deve ter `OPENAI_API_KEY`
3. **Redeploy**: Edite a função, salve novamente e faça deploy

## 📝 Nota Importante

- A função foi atualizada para usar `Deno.serve()` (API moderna)
- Os erros de lint no VS Code são normais (TypeScript validando código Deno)
- O código está correto e pronto para deploy

