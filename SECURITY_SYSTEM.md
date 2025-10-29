# Sistema de Segurança Administrativo - Burguer.IA

## Visão Geral

Sistema de controle de acesso interno com PIN de 4 dígitos para proteger recursos sensíveis sem alterar o fluxo de login.

## Componentes Principais

### 1. AdminPasswordModal
Modal para entrada do PIN administrativo.

```tsx
import { AdminPasswordModal } from '@/components/AdminPasswordModal';

<AdminPasswordModal
  open={showModal}
  onClose={() => setShowModal(false)}
  onSuccess={() => handleSuccess()}
  onAuthenticate={authenticateAdmin}
  title="Autenticação Necessária"
  description="Esta ação requer PIN administrativo"
/>
```

### 2. AdminStatusIndicator
Indicador visual do status administrativo (já integrado no Sidebar).

Mostra:
- "Modo Operacional" quando não autenticado
- "Admin Ativo (Xmin)" quando autenticado com timer

### 3. ProtectedAction
Wrapper para proteger ações específicas.

```tsx
import { ProtectedAction } from '@/components/ProtectedAction';

<ProtectedAction
  action="cancelar_pedido"
  onSuccess={() => cancelOrder(orderId)}
>
  {(execute) => (
    <Button onClick={execute} variant="destructive">
      Cancelar Pedido
    </Button>
  )}
</ProtectedAction>
```

### 4. ProtectedRoute
Wrapper para proteger páginas inteiras.

```tsx
import { ProtectedRoute } from '@/components/ProtectedRoute';

function DashboardPage() {
  return (
    <ProtectedRoute pageName="Dashboard" fallbackRoute="/pdv">
      <div>Conteúdo sensível do dashboard...</div>
    </ProtectedRoute>
  );
}
```

### 5. CashSessionModal
Modal para abertura de caixa com dois modos.

```tsx
import { CashSessionModal } from '@/components/CashSessionModal';

<CashSessionModal
  open={showCashModal}
  onClose={() => setShowCashModal(false)}
  onOpen={(isAdmin, amount) => {
    // isAdmin: true = Caixa Administrativo, false = Caixa Operacional
    // amount: valor de abertura
    openCashSession(isAdmin, amount);
  }}
/>
```

## Hook useAdminAuth

### Propriedades Disponíveis

```tsx
const {
  isAdminAuthenticated,      // Boolean: está autenticado como admin?
  adminSessionExpiry,         // Number: timestamp de expiração
  remainingMinutes,           // Number: minutos restantes da sessão
  authenticateAdmin,          // Function: autentica com PIN
  clearAdminSession,          // Function: limpa sessão admin
  checkPageProtection,        // Function: verifica se página está protegida
  checkActionProtection,      // Function: verifica se ação está protegida
  hasPasswordConfigured,      // Boolean: tem PIN configurado?
  logAdminAction              // Function: registra ação nos logs
} = useAdminAuth();
```

### Exemplos de Uso

#### Proteger ação de cancelamento:
```tsx
const { isAdminAuthenticated, logAdminAction } = useAdminAuth();

const handleCancelOrder = async () => {
  if (!isAdminAuthenticated) {
    toast.error('Requer autenticação administrativa');
    return;
  }
  
  await cancelOrder();
  await logAdminAction('cancelar_pedido', { order_id: orderId });
};
```

#### Proteger página inteira:
```tsx
const { isAdminAuthenticated, checkPageProtection } = useAdminAuth();

useEffect(() => {
  if (checkPageProtection('Settings') && !isAdminAuthenticated) {
    navigate('/dashboard');
  }
}, [isAdminAuthenticated]);
```

## Configuração do Sistema

### 1. Definir PIN Administrativo
Vá em **Configurações > Segurança** e configure:
- PIN de 4 dígitos
- Tempo de sessão (em minutos)
- Páginas protegidas
- Ações protegidas por página

### 2. Páginas que Podem Ser Protegidas
- Dashboard
- Configurações
- Fornecedores
- Custos
- PIX Payments

### 3. Ações que Podem Ser Protegidas

#### PDV:
- cancelar_pedido
- desconto_manual
- fechar_caixa
- estorno_pagamento

#### Produtos:
- editar_preco
- editar_ficha_tecnica
- excluir_produto

#### Financeiro:
- excluir_transacao
- editar_transacao

## Fluxo de Caixa

### Abertura de Caixa
Duas opções disponíveis:

1. **Caixa Administrativo**
   - Requer PIN
   - Acesso completo a todas funcionalidades
   - Pode cancelar pedidos, dar descontos, etc.

2. **Caixa Operacional**
   - Sem PIN
   - Funcionalidades limitadas
   - Apenas vendas básicas

### Fechamento de Caixa
- Sempre requer PIN administrativo
- Registra logs de auditoria

## Logs de Auditoria

Todas as ações administrativas são registradas na tabela `audit_logs`:
- Login administrativo
- Cancelamentos
- Alterações de preço
- Fechamento de caixa
- Configurações alteradas

### Consultar Logs:
```sql
SELECT * FROM audit_logs 
WHERE establishment_id = 'seu_id'
ORDER BY created_at DESC;
```

## Segurança

### Boas Práticas
1. Configure um PIN forte (evite 0000, 1234, etc.)
2. Defina tempo de sessão adequado (15-30 minutos recomendado)
3. Proteja ações financeiras críticas
4. Revise os logs regularmente

### O que NÃO Fazer
- ❌ Não compartilhe o PIN com todos os funcionários
- ❌ Não desabilite proteções sem necessidade
- ❌ Não use o mesmo PIN para diferentes estabelecimentos
- ❌ Não deixe sessão admin ativa sem supervisão

## Troubleshooting

### Sessão Expira Muito Rápido
- Aumente o tempo em Configurações > Segurança
- Padrão: 30 minutos

### PIN Não Funciona
- Verifique se o PIN está configurado corretamente
- Tente recriar o PIN nas configurações

### Ação Não Protegida
- Verifique se está marcada em Configurações > Segurança
- Recarregue a página após alterar configurações
