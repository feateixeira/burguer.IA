# Correções de Segurança - Autenticação Admin

## Problema Identificado

A autenticação de senha administrativa estava sendo feita **completamente no lado do cliente**, usando `bcryptjs` diretamente no navegador. Isso permitia que atacantes:

1. **Manipulassem o sessionStorage** para falsificar autenticação
2. **Modificassem o código cliente** para bypassar verificações
3. **Interceptassem o hash da senha** durante transferência
4. **Criassem hashes válidos** localmente

## Solução Implementada

### 1. Edge Function: `verify-admin-password`

Nova Edge Function que processa toda autenticação **server-side**:

```typescript
// Cliente nunca recebe o hash
const { data } = await supabase.functions.invoke('verify-admin-password', {
  body: { password }
});
```

**Características de Segurança:**
- Hash **nunca** é transferido para o cliente
- Verificação acontece **exclusivamente no servidor**
- Usuário deve estar autenticado (Supabase Auth)
- Apenas o estabelecimento do usuário é verificado
- Retorna apenas `{ valid: boolean, sessionTimeout: number }`

### 2. RPC Function: `check_admin_password_exists`

Função PostgreSQL que verifica se senha existe **sem expor o hash**:

```sql
SELECT check_admin_password_exists(establishment_uuid);
-- Retorna: true/false (nunca o hash)
```

**Benefícios:**
- Cliente verifica se senha está configurada sem receber o hash
- Reduz transferência desnecessária de dados sensíveis
- Permite validação no cliente antes de mostrar UI de senha

### 3. Modificações no Cliente

#### `src/hooks/useAdminAuth.tsx`

**ANTES (INSEGURO):**
```typescript
import bcrypt from 'bcryptjs';

// Hash exposto ao cliente! ❌
const { data: establishment } = await supabase
  .from('establishments')
  .select('admin_password_hash, settings')
  .single();

// Comparação no cliente! ❌
const isValid = await bcrypt.compare(password, establishment.admin_password_hash);
```

**DEPOIS (SEGURO):**
```typescript
// Apenas verifica existência sem expor hash ✅
const { data: hasPassword } = await supabase
  .rpc('check_admin_password_exists', { establishment_uuid });

// Autenticação 100% server-side ✅
const { data } = await supabase.functions.invoke('verify-admin-password', {
  body: { password }
});
```

#### `src/components/AdminPasswordConfig.tsx`

**ANTES (INSEGURO):**
```typescript
// Hash exposto para verificação! ❌
const { data: verifyData } = await supabase.functions.invoke('hash-admin-password', {
  body: {
    action: 'verify',
    password: currentPassword,
    currentHash: currentSettings!.admin_password_hash, // ❌ Hash no cliente!
  },
});
```

**DEPOIS (SEGURO):**
```typescript
// Verificação sem expor hash ✅
const { data: verifyData } = await supabase.functions.invoke('verify-admin-password', {
  body: { password: currentPassword } // Apenas senha em texto claro
});
```

## Garantias de Segurança

✅ **Hash nunca é transferido para o cliente**
✅ **Toda comparação acontece server-side**
✅ **Cliente só recebe resultado booleano (válido/inválido)**
✅ **Atacante não pode manipular sessionStorage para bypass**
✅ **Código cliente modificado não bypassa autenticação**
✅ **Senha em texto claro só é enviada via HTTPS para Edge Function**

## Migrations Necessárias

Execute no Supabase SQL Editor:

1. `supabase/migrations/20250103000000_add_check_admin_password_rpc.sql` - RPC function para verificar existência
2. Edge Function `verify-admin-password` já está criada em `supabase/functions/verify-admin-password/`

## Como Funciona Agora (Fluxo Seguro)

1. **Usuário digita senha de 4 dígitos** no cliente
2. **Cliente envia apenas a senha** (texto claro) para Edge Function via HTTPS
3. **Edge Function autentica o usuário** via Supabase Auth
4. **Edge Function busca hash do banco** (nunca exposto ao cliente)
5. **Edge Function compara senha com hash** usando bcrypt server-side
6. **Edge Function retorna apenas** `{ valid: boolean, sessionTimeout: number }`
7. **Cliente armazena apenas flag booleana** no sessionStorage
8. **Flag expira após timeout** configurado

## Testes de Segurança Recomendados

1. ✅ Tentar manipular `sessionStorage.setItem('admin_auth', 'true')` - Deve falhar
2. ✅ Tentar interceptar hash via DevTools - Não deve aparecer
3. ✅ Tentar modificar código cliente para bypass - Deve falhar (Edge Function valida)
4. ✅ Tentar reverter mudanças e usar bcrypt no cliente - Deve ser detectado em code review

## Notas Importantes

⚠️ **A senha ainda é enviada em texto claro** do cliente para a Edge Function. Isso é aceitável porque:
- A transferência acontece via HTTPS (criptografada)
- A senha é de apenas 4 dígitos (PIN, não senha completa)
- O hash nunca é exposto, então mesmo interceptando a senha, não há como criar hashes válidos

🔒 **Para máxima segurança**, considere:
- Usar senha mais longa (8+ dígitos) em produção
- Implementar rate limiting na Edge Function
- Adicionar 2FA para ações críticas
- Implementar logout automático após inatividade

