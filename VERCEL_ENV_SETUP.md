# Configuração de Variáveis de Ambiente no Vercel

## ⚠️ PROBLEMA CRÍTICO

O cardápio online não funciona em produção porque as variáveis de ambiente do Supabase **DEVEM** estar disponíveis durante o **BUILD**, não apenas em runtime.

No Vite, as variáveis `import.meta.env.VITE_*` são substituídas durante o build. Se não estiverem disponíveis, serão strings vazias no código final.

## ✅ SOLUÇÃO

### 1. Acesse o Vercel Dashboard
- Vá para: https://vercel.com
- Selecione seu projeto

### 2. Configure as Variáveis de Ambiente
- Vá em **Settings** → **Environment Variables**
- Adicione as seguintes variáveis:

| Nome | Valor | Ambiente |
|------|-------|----------|
| `VITE_SUPABASE_URL` | `https://seu-projeto.supabase.co` | Production, Preview, Development |
| `VITE_SUPABASE_ANON_KEY` | `sua-chave-anon-aqui` | Production, Preview, Development |

### 3. IMPORTANTE: Marque TODOS os ambientes
- ✅ Production
- ✅ Preview  
- ✅ Development

### 4. Faça um Novo Deploy
- Após adicionar/atualizar as variáveis, **FAÇA UM NOVO DEPLOY**
- Vá em **Deployments** → Selecione o último deploy → **Redeploy**
- OU faça um novo commit e push

## 🔍 Verificação

### Opção 1: Página de Debug
Após fazer o deploy, acesse:
```
https://burgueria.shop/debug-env
```

Esta página mostrará se as variáveis estão configuradas corretamente.

### Opção 2: Verificar Logs do Build
No Vercel Dashboard:
1. Vá em **Deployments**
2. Clique no deploy mais recente
3. Veja os **Build Logs**
4. Procure por mensagens do script `check-env.js`

Se aparecer:
- ✅ `Todas as variáveis de ambiente estão configuradas!` → Tudo OK
- ❌ `ERRO: Variáveis de ambiente obrigatórias não encontradas` → Variáveis não estão configuradas

## 🐛 Troubleshooting

### Problema: Variáveis configuradas mas ainda não funciona

1. **Verifique se fez redeploy após adicionar variáveis**
   - Variáveis adicionadas após o build não são aplicadas automaticamente
   - É necessário fazer um novo deploy

2. **Verifique se marcou todos os ambientes**
   - Production, Preview e Development devem estar marcados

3. **Verifique os valores**
   - `VITE_SUPABASE_URL` deve começar com `https://` e terminar com `.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` deve ser a chave "anon public" (não a service_role key)

4. **Verifique os logs do build**
   - Se o script `check-env.js` falhar, o build será interrompido
   - Isso garante que você saiba imediatamente se há problema

### Problema: Build falha com erro de variáveis

Se o build falhar com:
```
❌ ERRO: Variáveis de ambiente obrigatórias não encontradas
```

Isso significa que as variáveis não estão disponíveis durante o build. Verifique:
1. Se as variáveis estão configuradas no Vercel
2. Se estão marcadas para "Production"
3. Se os nomes estão corretos (exatamente como mostrado acima)

## 📝 Notas Técnicas

- O Vite substitui `import.meta.env.VITE_*` durante o build
- Variáveis devem estar disponíveis no momento do build, não em runtime
- O script `check-env.js` verifica as variáveis antes do build
- Se faltar alguma variável em produção, o build falhará (isso é intencional)

## 🆘 Ainda com Problemas?

1. Acesse `/debug-env` para ver o status das variáveis
2. Verifique os logs do build no Vercel
3. Confirme que fez redeploy após configurar as variáveis
4. Verifique se os valores das variáveis estão corretos

