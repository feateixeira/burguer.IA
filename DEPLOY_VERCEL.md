# 🚀 Guia de Deploy no Vercel

Este guia mostra como fazer deploy do sistema na Vercel com todas as configurações necessárias.

## 📋 Pré-requisitos

1. Conta no Vercel (gratuita): https://vercel.com
2. Conta no Supabase: https://supabase.com
3. Projeto conectado ao GitHub

## 🔧 Passo a Passo para Deploy

### 1. Configurar Variáveis de Ambiente no Vercel

**⚠️ IMPORTANTE:** As variáveis de ambiente devem ser configuradas no painel do Vercel, não apenas no arquivo `.env` local.

#### Como configurar:

1. Acesse o [Dashboard do Vercel](https://vercel.com/dashboard)
2. Selecione seu projeto (ou crie um novo conectando ao GitHub)
3. Vá em **Settings** → **Environment Variables**
4. Adicione as seguintes variáveis:

| Nome da Variável | Valor | Onde encontrar |
|-----------------|-------|----------------|
| `VITE_SUPABASE_URL` | URL do seu projeto Supabase | Supabase Dashboard → Settings → API → Project URL |
| `VITE_SUPABASE_ANON_KEY` | Chave anon do Supabase | Supabase Dashboard → Settings → API → anon public key |

#### Exemplo de valores:

```
VITE_SUPABASE_URL=https://tndiwjznitnualtorbpk.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 2. Configuração do Ambiente

No painel do Vercel, certifique-se de que as variáveis estão configuradas para:
- ✅ **Production**
- ✅ **Preview** (opcional, mas recomendado)
- ✅ **Development** (opcional)

### 3. Como Obter as Credenciais do Supabase

1. Acesse [Supabase Dashboard](https://app.supabase.com)
2. Selecione seu projeto
3. Vá em **Settings** (⚙️) → **API**
4. Copie:
   - **Project URL** → use como `VITE_SUPABASE_URL`
   - **anon public** key → use como `VITE_SUPABASE_ANON_KEY`

### 4. Fazer Deploy

#### Opção A: Via GitHub (Recomendado)

1. Conecte seu repositório ao Vercel:
   - Vercel Dashboard → **Add New Project**
   - Importe do GitHub
   - Configure as variáveis de ambiente (passo 1)
   - Clique em **Deploy**

2. O Vercel irá:
   - Detectar automaticamente que é um projeto Vite
   - Executar `npm install`
   - Executar `npm run build`
   - Fazer deploy da pasta `dist`

#### Opção B: Via CLI

```bash
# Instalar Vercel CLI
npm i -g vercel

# Login
vercel login

# Fazer deploy
vercel --prod
```

### 5. Verificar Deploy

Após o deploy:

1. Acesse a URL fornecida pela Vercel (ex: `seu-projeto.vercel.app`)
2. Verifique se o site carrega sem erros
3. Teste o login e funcionalidades principais

### 6. Troubleshooting

#### ❌ Erro: "Missing Supabase environment variables"

**Causa:** Variáveis não configuradas no Vercel ou valores incorretos.

**Solução:**
1. Vá em Settings → Environment Variables no Vercel
2. Verifique se `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` existem
3. Verifique se os valores estão corretos (sem espaços extras)
4. **Redeploy** o projeto após adicionar/modificar variáveis:
   - Vá em **Deployments**
   - Clique nos três pontos (⋯) do último deployment
   - Selecione **Redeploy**

#### ❌ Erro: "Build failed"

**Causa comum:** Erro de sintaxe ou dependências faltando.

**Solução:**
1. Teste localmente: `npm run build`
2. Verifique os logs de build no Vercel
3. Corrija os erros e faça push novamente

#### ❌ Site funciona localmente mas não na Vercel

**Causa:** Variáveis de ambiente não configuradas no Vercel.

**Solução:** Siga o passo 1 acima para configurar as variáveis.

## 🔄 Atualizações Futuras

Após fazer push no GitHub:

1. O Vercel detecta automaticamente as mudanças
2. Faz deploy automático para Preview
3. Você pode fazer deploy para Production manualmente ou configurar auto-deploy

## ✅ Checklist de Deploy

- [ ] Variáveis de ambiente configuradas no Vercel
- [ ] `VITE_SUPABASE_URL` adicionada
- [ ] `VITE_SUPABASE_ANON_KEY` adicionada
- [ ] Valores copiados corretamente do Supabase
- [ ] Variáveis configuradas para Production
- [ ] Primeiro deploy realizado
- [ ] Site testado e funcionando

## 📞 Suporte

Se ainda tiver problemas:

1. Verifique os logs de build no Vercel
2. Verifique os logs do browser (F12 → Console)
3. Certifique-se de que as migrations do Supabase foram executadas
4. Verifique se as credenciais do Supabase estão corretas

---

**Última atualização:** Janeiro 2025

