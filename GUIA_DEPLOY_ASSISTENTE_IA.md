# 🚀 Guia de Deploy do Assistente IA

## 📋 Pré-requisitos

1. Conta no Supabase
2. Chave da OpenAI (OPENAI_API_KEY)
3. Projeto Supabase criado

## 🎯 OPÇÃO 1: Deploy via Dashboard (MAIS FÁCIL - RECOMENDADO)

### Passo 1: Acessar o Dashboard

1. Acesse https://app.supabase.com
2. Selecione seu projeto
3. No menu lateral, clique em **Edge Functions**

### Passo 2: Criar Nova Função

1. Clique em **Create a new function**
2. Nome da função: `business-assistant`
3. Clique em **Create function**

### Passo 3: Copiar o Código

1. Abra o arquivo: `supabase/functions/business-assistant/index.ts`
2. Copie TODO o conteúdo
3. Cole no editor do Dashboard
4. Clique em **Deploy**

### Passo 4: Configurar Secrets

1. Após o deploy, vá em **Settings** (⚙️) da função
2. Em **Secrets**, adicione:
   - Nome: `OPENAI_API_KEY`
   - Valor: sua chave da OpenAI
3. Clique em **Save**

**IMPORTANTE:** As variáveis `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` são injetadas automaticamente pelo Supabase, não precisa configurar.

## 🛠️ OPÇÃO 2: Deploy via CLI

### Passo 1: Instalar Supabase CLI

**Windows (PowerShell como Administrador):**
```powershell
# Opção 1: Via Scoop (recomendado)
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase

# Opção 2: Via npm
npm install -g supabase

# Opção 3: Download direto
irm https://github.com/supabase/cli/releases/latest/download/supabase_windows_amd64.zip -OutFile supabase.zip
Expand-Archive supabase.zip -DestinationPath $env:USERPROFILE\.local\bin
# Adicione ao PATH: $env:USERPROFILE\.local\bin
```

### Passo 2: Login no Supabase

```bash
supabase login
```

### Passo 3: Linkar o Projeto

```bash
supabase link --project-ref seu-project-ref
```

**Para encontrar o project-ref:**
- Acesse https://app.supabase.com
- Selecione seu projeto
- O project-ref está na URL: `https://app.supabase.com/project/[PROJECT-REF]`
- Ou vá em Settings → General → Reference ID

### Passo 4: Deploy da Função

```bash
cd "C:\Users\Felli\OneDrive\Documentos\BURGUER.IA PROJETO\burguer.IA"
supabase functions deploy business-assistant
```

### Passo 5: Configurar Secrets

```bash
supabase secrets set OPENAI_API_KEY=sua-chave-openai-aqui
```

### 6. Testar a Função

No Dashboard do Supabase:
1. Vá em **Edge Functions** → **business-assistant**
2. Clique em **Invoke**
3. Use este JSON de teste:
```json
{
  "message": "Como estão minhas vendas hoje?"
}
```

## ✅ Verificação

Após o deploy, a função deve estar acessível em:
```
https://[seu-project-ref].supabase.co/functions/v1/business-assistant
```

## 🔍 Troubleshooting

### Erro: "Function not found"
- Verifique se o deploy foi concluído com sucesso
- Verifique se está usando o nome correto: `business-assistant`

### Erro: "OPENAI_API_KEY não configurada"
- Configure a secret no Supabase Dashboard ou via CLI
- Verifique se o nome está correto: `OPENAI_API_KEY` (sem espaços)

### Erro: "Invalid authentication"
- Verifique se está enviando o token de autenticação no header
- O frontend usa `supabase.functions.invoke()` que faz isso automaticamente

## 📝 Comandos Úteis

```bash
# Ver logs da função
supabase functions logs business-assistant

# Ver todas as funções deployadas
supabase functions list

# Deletar uma função (se necessário)
supabase functions delete business-assistant
```

