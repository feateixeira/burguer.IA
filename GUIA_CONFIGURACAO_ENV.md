# 🔧 Guia de Configuração - Arquivo .env

## ❌ Problema Atual

O erro "Missing Supabase environment variables" ocorre porque o arquivo `.env` não existe ou está mal configurado.

**⚠️ PROBLEMA COMUM NO WINDOWS/ONEDRIVE:**
Se o arquivo `.env` fica "bloqueado" quando criado, isso geralmente é causado pelo OneDrive ou pelo sistema de arquivos do Windows. Use a **Solução Alternativa** abaixo.

## ✅ Solução Passo a Passo

### Opção 1: Usar `.env.local` (RECOMENDADO para Windows/OneDrive)

O Vite suporta arquivos `.env.local` que geralmente não têm problemas de bloqueio:

1. Na **raiz do projeto**, crie um arquivo chamado `.env.local` (não `.env`)
2. Adicione as variáveis conforme o passo 3 abaixo
3. O Vite carregará automaticamente este arquivo

**Vantagens:**
- ✅ Não fica bloqueado pelo OneDrive
- ✅ Tem prioridade sobre `.env` (se ambos existirem)
- ✅ Funciona perfeitamente com o Vite

### Opção 2: Usar Script PowerShell

Execute o script fornecido no projeto:

```powershell
.\criar-env.ps1
```

O script irá:
- Solicitar suas credenciais do Supabase
- Criar o arquivo `.env.local` automaticamente
- Evitar problemas de bloqueio

### Opção 3: Criar `.env` manualmente

Na **raiz do projeto** (mesmo nível do `package.json`), crie um arquivo chamado `.env`

**Caminho completo do arquivo:**
```
C:\Users\Felli\OneDrive\Documentos\BURGUER.IA PROJETO\burguer.IA\.env
```

**Se o arquivo ficar bloqueado:**
1. Clique com o botão direito no arquivo → Propriedades
2. Desmarque "Somente leitura" (se estiver marcado)
3. Ou use a Opção 1 (`.env.local`) que é mais confiável

### 2. Obter as credenciais do Supabase

1. Acesse: https://app.supabase.com
2. Selecione seu projeto (ou crie um novo)
3. Vá em **Settings** (⚙️) → **API**
4. Você verá:
   - **Project URL**: `https://tndiwjznitnualtorbpk.supabase.co`
   - **anon public** key: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (chave longa)

### 3. Configurar o arquivo (`.env` ou `.env.local`)

Abra o arquivo `.env` ou `.env.local` e adicione estas linhas:

```env
VITE_SUPABASE_URL=https://tndiwjznitnualtorbpk.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Nota:** Se você criou `.env.local`, use esse arquivo. O Vite carregará automaticamente.

**⚠️ IMPORTANTE:**
- Substitua `https://tndiwjznitnualtorbpk.supabase.co` pela URL real do seu projeto
- Substitua `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` pela chave **anon public** completa
- Use a chave **anon public**, NÃO a **service_role**
- A chave deve ter aproximadamente 200+ caracteres
- Não adicione aspas ao redor dos valores

### 4. Exemplo de arquivo correto (`.env` ou `.env.local`)

```env
# URL do seu projeto Supabase
VITE_SUPABASE_URL=https://tndiwjznitnualtorbpk.supabase.co

# Chave pública anônima (anon public key)
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRuZGl3anpuaXRudWFsdG9yYnBrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDEyMzQ1NjcsImV4cCI6MjAxNjgxMDU2N30.exemplo_completo_da_chave_aqui
```

**Lembrete:** Se estiver usando `.env.local`, o Vite dará prioridade a ele sobre `.env`.

### 5. Verificar se está correto

✅ **URL deve:**
- Começar com `https://`
- Terminar com `.supabase.co`
- Não ter espaços ou caracteres extras

✅ **Chave ANON deve:**
- Começar com `eyJ...`
- Ter aproximadamente 200+ caracteres
- Ser a chave "anon public" (não "service_role")
- Não ter espaços ou quebras de linha

### 6. Reiniciar o servidor

**CRÍTICO:** Após criar ou alterar o arquivo (`.env` ou `.env.local`), você DEVE reiniciar o servidor:

1. Pare o servidor atual (pressione `Ctrl+C` no terminal)
2. Inicie novamente:
   ```bash
   npm run dev
   ```

**Por que reiniciar?** O Vite carrega as variáveis de ambiente apenas na inicialização. Mudanças no arquivo `.env` ou `.env.local` só são aplicadas após reiniciar.

### 7. Verificar se funcionou

1. Abra o console do navegador (F12)
2. Tente fazer login novamente
3. Se ainda houver erro, verifique:
   - O arquivo `.env` está na raiz do projeto?
   - Os valores estão corretos?
   - O servidor foi reiniciado?

## 🔒 Problema: Arquivo .env Bloqueado no Windows/OneDrive

### Sintomas
- Arquivo `.env` fica "somente leitura" ou "bloqueado"
- Não consegue editar o arquivo
- Erro de permissão ao salvar

### Soluções

**Solução 1: Usar `.env.local` (MAIS FÁCIL)**
- Crie um arquivo chamado `.env.local` em vez de `.env`
- O Vite suporta ambos e `.env.local` tem prioridade
- Geralmente não tem problemas de bloqueio

**Solução 2: Desbloquear arquivo**
1. Clique com botão direito no arquivo `.env`
2. Selecione "Propriedades"
3. Desmarque "Somente leitura"
4. Clique em "OK"

**Solução 3: Usar Script PowerShell**
```powershell
.\criar-env.ps1
```
O script cria o arquivo `.env.local` automaticamente, evitando problemas de bloqueio.

**Solução 4: Excluir do OneDrive**
Se o projeto está na pasta OneDrive:
1. Mova o projeto para fora do OneDrive, OU
2. Configure o OneDrive para não sincronizar arquivos `.env*`

## 🔍 Troubleshooting

### Erro: "Missing Supabase environment variables"

**Causa:** O arquivo `.env` ou `.env.local` não existe ou as variáveis não estão configuradas.

**Solução:** 
1. Crie o arquivo `.env.local` (recomendado) ou `.env` seguindo o passo 1 acima
2. Se o arquivo `.env` ficar bloqueado, use `.env.local` ou execute `.\criar-env.ps1`
3. Certifique-se de que o servidor foi reiniciado após criar o arquivo

### Erro: "Invalid API key"

**Causa:** A chave está incorreta ou é a chave errada.

**Solução:**
- Verifique se está usando a chave **anon public** (não service_role)
- Copie a chave completa do Supabase Dashboard
- Certifique-se de que não há espaços extras
- Reinicie o servidor

### Variáveis não carregam

**Causa:** O servidor não foi reiniciado após criar/alterar o `.env`.

**Solução:** 
- Pare o servidor (Ctrl+C)
- Inicie novamente: `npm run dev`

### Como verificar se as variáveis estão carregadas

No console do navegador, você verá logs mostrando:
- Se a URL está configurada
- Se a chave está configurada
- Tamanho da chave
- Preview dos primeiros caracteres

## 📝 Notas Importantes

1. **Os arquivos `.env` e `.env.local` estão no `.gitignore`** - eles não serão commitados no Git (segurança)
2. **Não compartilhe sua chave** - ela é pública mas deve ser mantida privada
3. **Use diferentes chaves** para desenvolvimento e produção
4. **A chave anon é segura** para uso no frontend (ela tem permissões limitadas)
5. **Prioridade do Vite:** `.env.local` > `.env` - se ambos existirem, o `.env.local` será usado
6. **Para desenvolvimento local:** Use `.env.local` (mais confiável no Windows)
7. **Para produção (Vercel):** As variáveis já estão configuradas no painel da Vercel

## 🆘 Ainda com problemas?

Se após seguir todos os passos o erro persistir:

1. Verifique o console do navegador para mais detalhes
2. Confirme que está usando a URL correta do projeto
3. Certifique-se de que copiou a chave **anon public** completa
4. Tente recriar a chave no Supabase Dashboard (Settings → API → Reset anon key)

