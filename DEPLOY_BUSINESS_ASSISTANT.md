# 🚀 Deploy da Edge Function: business-assistant

## ⚠️ IMPORTANTE: A função precisa ser deployada no Supabase

A Edge Function `business-assistant` existe no código, mas precisa ser deployada no Supabase para funcionar.

## 📍 Localização da Função

```
supabase/functions/business-assistant/
├── index.ts      (código principal - 994 linhas)
└── deno.json     (configuração)
```

## 🎯 OPÇÃO 1: Deploy via Dashboard (MAIS FÁCIL - RECOMENDADO)

### Passo 1: Acessar Dashboard
1. Acesse https://app.supabase.com
2. Selecione seu projeto
3. No menu lateral, clique em **Edge Functions**

### Passo 2: Criar/Editar Função
1. Se a função já existe, clique em **business-assistant**
2. Se não existe, clique em **Create a new function** → Nome: `business-assistant`
3. Abra o arquivo: `supabase/functions/business-assistant/index.ts` no seu editor
4. **Copie TODO o conteúdo** (Ctrl+A, Ctrl+C)
5. Cole no editor do Dashboard (Ctrl+V)
6. Clique em **Deploy** ou **Save**

### Passo 3: Configurar Secrets (OBRIGATÓRIO)
1. Após o deploy, vá em **Settings** (⚙️) da função `business-assistant`
2. Em **Secrets**, clique em **Add new secret**
3. Adicione:
   - **Nome**: `OPENAI_API_KEY`
   - **Valor**: sua chave da OpenAI (ex: `sk-...`)
4. Clique em **Save**

**⚠️ IMPORTANTE:** 
- `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` são injetadas automaticamente pelo Supabase
- Você só precisa configurar `OPENAI_API_KEY`

### Passo 4: Verificar Deploy
1. Após configurar a secret, a função deve estar disponível
2. Teste no Dashboard: **Edge Functions** → **business-assistant** → **Invoke**
3. Use este JSON de teste:
```json
{
  "message": "Como estão minhas vendas hoje?"
}
```

## 🛠️ OPÇÃO 2: Deploy via CLI

### Pré-requisitos: Instalar Supabase CLI

**Windows (PowerShell como Administrador):**
```powershell
# Opção 1: Via npm (recomendado)
npm install -g supabase

# Opção 2: Via Scoop
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
```

### Passo 1: Login no Supabase
```bash
supabase login
```
Isso abrirá o navegador para autenticação.

### Passo 2: Linkar o Projeto
```bash
cd "C:\Users\Felli\OneDrive\Documentos\BURGUER.IA PROJETO\burguer.IA"
supabase link --project-ref seu-project-ref
```

**Para encontrar o project-ref:**
- Acesse https://app.supabase.com
- Selecione seu projeto
- O project-ref está na URL: `https://app.supabase.com/project/[PROJECT-REF]`
- Ou vá em **Settings** → **General** → **Reference ID**

### Passo 3: Deploy da Função
```bash
supabase functions deploy business-assistant
```

### Passo 4: Configurar Secret
```bash
supabase secrets set OPENAI_API_KEY=sua-chave-openai-aqui
```

**Exemplo:**
```bash
supabase secrets set OPENAI_API_KEY=sk-proj-abc123xyz...
```

## ✅ Verificação

Após o deploy, a função deve estar acessível em:
```
https://[seu-project-ref].supabase.co/functions/v1/business-assistant
```

## 🔍 Troubleshooting

### ❌ Erro: "Function not found"
- Verifique se o deploy foi concluído com sucesso
- Verifique se está usando o nome correto: `business-assistant` (com hífen)
- Aguarde alguns segundos após o deploy

### ❌ Erro: "OPENAI_API_KEY não configurada"
- Configure a secret no Supabase Dashboard ou via CLI
- Verifique se o nome está correto: `OPENAI_API_KEY` (sem espaços, maiúsculas)
- Após configurar, aguarde alguns segundos

### ❌ Erro: "Invalid authentication"
- Verifique se está enviando o token de autenticação no header
- O frontend usa `supabase.functions.invoke()` que faz isso automaticamente
- Verifique se o usuário está logado

### ❌ Erro: "Acesso negado. Esta funcionalidade requer Plano Platinum ou Premium"
- Verifique se o usuário tem plano Platinum, Premium ou está em Trial
- A função verifica o `plan_type` e `subscription_type` do perfil

## 📝 Comandos Úteis (CLI)

```bash
# Ver logs da função
supabase functions logs business-assistant

# Ver todas as funções deployadas
supabase functions list

# Ver secrets configuradas
supabase secrets list

# Deletar uma função (se necessário)
supabase functions delete business-assistant

# Redeploy (atualizar função)
supabase functions deploy business-assistant --no-verify-jwt
```

## 🎯 Checklist de Deploy

- [ ] Função `business-assistant` criada no Supabase Dashboard
- [ ] Código copiado e colado no editor do Dashboard
- [ ] Deploy realizado com sucesso
- [ ] Secret `OPENAI_API_KEY` configurada
- [ ] Função testada via Dashboard (Invoke)
- [ ] Frontend consegue chamar a função sem erros

## 📞 Próximos Passos

Após o deploy:
1. Teste a função no Dashboard do Supabase
2. Teste no frontend (Assistente IA)
3. Verifique os logs se houver erros
4. A função deve funcionar corretamente após o deploy
