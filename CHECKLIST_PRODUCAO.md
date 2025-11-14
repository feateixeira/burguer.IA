# ✅ Checklist para Produção

## 📋 Arquivos que NÃO devem ir para produção (já no .gitignore)

- ✅ `.env` e `.env.local` - Variáveis de ambiente locais
- ✅ `node_modules/` - Dependências (instaladas no servidor)
- ✅ `dist/` e `build/` - Arquivos de build (gerados no deploy)
- ✅ `.vscode/` - Configurações do editor (exceto extensions.json)
- ✅ `*.log` - Arquivos de log
- ✅ `supabase/.temp/` - Arquivos temporários do Supabase

## 🔍 Console.log/error/warn encontrados

### ⚠️ Frontend (src/) - Considerar remover ou reduzir:
1. `src/pages/finance/Reports.tsx` - linha 330: `console.error`
2. `src/components/AddonsManager.tsx` - linhas 101, 252, 302, 352, 659: `console.error`
3. `src/components/CombosManager.tsx` - linhas 112, 332: `console.error`
4. `src/pages/Orders.tsx` - linhas 514, 548, 584, 620, 1285: `console.error/warn`

### ✅ Edge Functions (supabase/functions/) - Pode manter:
- Os `console.log/error` nas Edge Functions são úteis para debug em produção
- Eles aparecem nos logs do Supabase e ajudam a diagnosticar problemas

## 📝 Arquivos importantes que DEVEM ir para produção

- ✅ `package.json` e `package-lock.json` - Dependências
- ✅ `vite.config.ts` - Configuração do Vite
- ✅ `tailwind.config.ts` - Configuração do Tailwind
- ✅ `tsconfig.json` - Configuração do TypeScript
- ✅ `vercel.json` - Configuração do Vercel
- ✅ `supabase/migrations/` - **TODAS as migrations** (incluindo a nova)
- ✅ `supabase/functions/` - Todas as Edge Functions
- ✅ `src/` - Todo o código fonte
- ✅ `public/` - Arquivos públicos
- ✅ `index.html` - Ponto de entrada
- ✅ `README.md` - Documentação

## 🚀 Antes de fazer deploy

### 1. Variáveis de Ambiente na Vercel
Certifique-se de que as seguintes variáveis estão configuradas:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

### 2. Executar Migration no Supabase
Execute a migration antes ou logo após o deploy:
```sql
-- Arquivo: supabase/migrations/20251114145919_assign_combos_and_addons_categories.sql
```

### 3. Verificar Build
```bash
npm run build
```
Certifique-se de que o build funciona sem erros.

### 4. Testar Localmente
```bash
npm run preview
```
Teste a versão de produção localmente antes de fazer deploy.

## ⚡ Comandos úteis

```bash
# Verificar se há arquivos que não devem estar no git
git status

# Verificar tamanho do repositório
git count-objects -vH

# Build de produção
npm run build

# Preview da build
npm run preview
```

## 📌 Notas Importantes

1. **Migration**: A migration `20251114145919_assign_combos_and_addons_categories.sql` deve ser executada no Supabase antes de ir para produção para garantir que todos os dados existentes tenham as categorias corretas.

2. **Console.logs**: Os console.log/error no frontend podem ser removidos se desejar, mas não são críticos. Nas Edge Functions, são úteis para debug.

3. **.gitignore**: Já está configurado corretamente para ignorar arquivos sensíveis e temporários.

4. **Variáveis de Ambiente**: NUNCA commite arquivos `.env` com valores reais. Use apenas `.env.example` ou configure diretamente na Vercel.

