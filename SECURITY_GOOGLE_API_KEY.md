# 🔒 Resolução: Chave do Google API Exposta

## ⚠️ Problema Identificado

Uma chave do Google API foi detectada no histórico do Git no commit `03b21a55`, especificamente em um arquivo de cache (`scriptCache`).

**Localização detectada:** `...iptCache/4cb013792b196a35_1#L17929`

## ✅ Ações Imediatas Necessárias

### 1. Rotacionar a Chave do Google API

A chave exposta **DEVE ser rotacionada** no Google Cloud Console:

1. Acesse o [Google Cloud Console](https://console.cloud.google.com/)
2. Navegue até **APIs & Services** > **Credentials**
3. Encontre a chave API exposta
4. Clique em **Rotate** ou **Delete** para revogá-la
5. Crie uma nova chave API se necessário
6. Configure restrições na nova chave:
   - **Application restrictions**: Restrinja por HTTP referrer ou IP
   - **API restrictions**: Limite apenas às APIs necessárias

### 2. Atualizar Variáveis de Ambiente

Se a chave estava hardcoded no código, mova para variáveis de ambiente:

1. Adicione ao arquivo `.env` (não commitado):
   ```env
   VITE_GOOGLE_API_KEY=sua_nova_chave_aqui
   ```

2. Atualize o arquivo `env.example.txt`:
   ```env
   # Google API Key (opcional, se usar Google Maps/Geocoding)
   VITE_GOOGLE_API_KEY=
   ```

3. Use a variável no código:
   ```typescript
   const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_API_KEY;
   ```

### 3. Remover do Histórico do Git (Opcional mas Recomendado)

Se a chave ainda estiver visível no histórico público:

**⚠️ ATENÇÃO:** Isso reescreve o histórico. Só faça se o repositório for privado ou se você tiver certeza do impacto.

```bash
# Usar git-filter-repo ou BFG Repo-Cleaner para remover a chave do histórico
# Exemplo com git-filter-repo:
git filter-repo --replace-text <(echo "AIza[chave_antiga]==>AIza[REMOVIDA]")
```

**Alternativa mais segura:**
- Se o repositório for público, considere criar um novo repositório privado
- Se for privado, a rotação da chave já resolve o problema de segurança

### 4. Verificar Arquivos de Cache

Arquivos de cache já foram adicionados ao `.gitignore`:
- `node_modules/.vite`
- `node_modules/.cache`
- `**/scriptCache`
- `**/*cache*`

**Verifique se há arquivos de cache commitados:**
```bash
git ls-files | grep -i cache
```

Se encontrar, remova-os:
```bash
git rm --cached [arquivo]
git commit -m "Remove arquivos de cache com chaves expostas"
```

## 🛡️ Prevenção Futura

### Checklist de Segurança

- [ ] ✅ Nunca commitar chaves API diretamente no código
- [ ] ✅ Sempre usar variáveis de ambiente para secrets
- [ ] ✅ Verificar `.gitignore` antes de commits
- [ ] ✅ Usar ferramentas como `git-secrets` ou `truffleHog` para scan
- [ ] ✅ Configurar restrições nas chaves API (IP, referrer, etc.)
- [ ] ✅ Revisar commits antes de push (especialmente em repositórios públicos)

### Ferramentas Recomendadas

1. **git-secrets**: Previne commit de secrets
   ```bash
   git secrets --install
   git secrets --register-aws
   ```

2. **truffleHog**: Scan de repositórios por secrets
   ```bash
   trufflehog git https://github.com/user/repo
   ```

3. **GitHub Secret Scanning**: Ativado automaticamente em repositórios GitHub

## 📝 Status

- [x] Padrões de cache adicionados ao `.gitignore`
- [ ] Chave do Google API rotacionada no Google Cloud Console
- [ ] Variáveis de ambiente configuradas (se aplicável)
- [ ] Histórico do Git limpo (opcional)

## 🔗 Links Úteis

- [Google Cloud Console - Credentials](https://console.cloud.google.com/apis/credentials)
- [GitHub - Removing sensitive data](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository)
- [OWASP - Secrets Management](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)

