# 🚀 Deploy da Edge Function: business-assistant

## 📍 Localização da Função

A Edge Function está em:
```
supabase/functions/business-assistant/
├── index.ts      (código principal)
└── deno.json     (configuração)
```

## ✅ O que a função faz

- ✅ **APENAS LÊ** dados existentes (não modifica nada)
- ✅ **Multi-tenant**: usa `establishment_id` de cada usuário
- ✅ Busca dados de: `orders`, `order_items`, `products`
- ✅ Retorna respostas via OpenAI usando os dados reais

## 🎯 OPÇÃO 1: Deploy via Dashboard (MAIS FÁCIL)

### Passo 1: Acessar Dashboard
1. Acesse https://app.supabase.com
2. Selecione seu projeto
3. No menu lateral: **Edge Functions**

### Passo 2: Criar/Editar Função
1. Se já existe, clique em **business-assistant**
2. Se não existe, clique em **Create a new function** → Nome: `business-assistant`
3. Abra o arquivo: `supabase/functions/business-assistant/index.ts`
4. **Copie TODO o conteúdo** e cole no editor do Dashboard
5. Clique em **Deploy**

### Passo 3: Configurar Secrets
1. Após deploy, vá em **Settings** (⚙️) da função
2. Em **Secrets**, adicione:
   - **Nome**: `OPENAI_API_KEY`
   - **Valor**: sua chave da OpenAI
3. Clique em **Save**

**Nota**: `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` são injetadas automaticamente.

## 🛠️ OPÇÃO 2: Deploy via CLI

### Pré-requisitos
```bash
# Instalar Supabase CLI (se não tiver)
npm install -g supabase

# Ou via Scoop (Windows)
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
```

### Deploy
```bash
# 1. Login
supabase login

# 2. Linkar projeto (se ainda não linkou)
supabase link --project-ref seu-project-ref

# 3. Deploy da função
supabase functions deploy business-assistant

# 4. Configurar secret
supabase secrets set OPENAI_API_KEY=sua-chave-openai-aqui
```

## ✅ Verificação

Após deploy, teste no Dashboard:
1. Vá em **Edge Functions** → **business-assistant**
2. Clique em **Invoke**
3. Use este JSON:
```json
{
  "message": "Qual é meu produto mais lucrativo?"
}
```

## 🔍 Troubleshooting

### Erro: "OPENAI_API_KEY não configurada"
- Configure a secret no Dashboard ou via CLI
- Nome exato: `OPENAI_API_KEY` (sem espaços)

### Erro: "Function not found"
- Verifique se o deploy foi concluído
- Nome correto: `business-assistant` (com hífen)

### Erro: "Invalid authentication"
- O frontend usa `supabase.functions.invoke()` que envia o token automaticamente
- Verifique se o usuário está logado

## 📝 Estrutura da Função

A função:
1. ✅ Verifica autenticação do usuário
2. ✅ Verifica se tem plano Gold
3. ✅ Obtém `establishment_id` do perfil (multi-tenant)
4. ✅ **LÊ** dados de vendas e produtos (sem modificar)
5. ✅ Envia dados para OpenAI
6. ✅ Retorna resposta ao frontend

**NÃO MODIFICA** nenhuma tabela do sistema!

