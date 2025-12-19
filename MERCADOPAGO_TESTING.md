# 🧪 Guia de Testes - Integração Mercado Pago

## ✅ Pré-requisitos

Antes de testar, verifique se:

- [ ] Migrations foram executadas
- [ ] Edge Functions foram deployadas
- [ ] Secrets configurados no Supabase
- [ ] Webhook configurado no Mercado Pago

---

## 1️⃣ Teste: Criação de Assinatura (Frontend)

### Passo a Passo

1. **Acesse a aplicação e faça login**

2. **Vá para Settings > Pagamento**
   - URL: `http://localhost:5173/settings?tab=payment` (desenvolvimento)
   - Ou: `https://seu-dominio.com/settings?tab=payment` (produção)

3. **Clique em "Assinar Plano Mensal"**

4. **Selecione um plano:**
   - Gold (Standard) - R$ 160,00
   - Platinum (Gold) - R$ 180,00
   - Premium - R$ 220,00

5. **Clique em "Continuar para Pagamento"**

6. **Verifique o redirecionamento:**
   - Você deve ser redirecionado para o checkout do Mercado Pago
   - URL deve começar com: `https://www.mercadopago.com.br/checkout/v1/redirect`

### ✅ O que verificar:

- [ ] Botão de assinatura aparece
- [ ] Dialog de seleção de plano abre
- [ ] Redirecionamento para Mercado Pago funciona
- [ ] URL do checkout contém os dados corretos

### 🔍 Verificar no Banco de Dados:

```sql
-- Verificar se os campos foram atualizados
SELECT 
  user_id,
  plan_type,
  plan_amount,
  subscription_type,
  payment_status,
  mercadopago_init_point,
  mercadopago_status,
  next_payment_date
FROM profiles
WHERE subscription_type = 'monthly'
ORDER BY updated_at DESC
LIMIT 5;
```

**Resultado esperado:**
- `plan_type` preenchido (gold, platinum ou premium)
- `plan_amount` com o valor correto
- `subscription_type` = 'monthly'
- `payment_status` = 'pending'
- `mercadopago_init_point` com URL do checkout
- `mercadopago_status` = 'pending'

---

## 2️⃣ Teste: Pagamento no Mercado Pago (Checkout)

### Passo a Passo

1. **No checkout do Mercado Pago, use cartão de teste:**

   **Cartão de Teste Aprovado:**
   - Número: `5031 4332 1540 6351`
   - CVV: `123`
   - Nome: Qualquer nome
   - Vencimento: Qualquer data futura (ex: 12/25)
   - CPF: `12345678909`

2. **Complete o pagamento**

3. **Você será redirecionado de volta:**
   - Success: `https://[PROJECT_REF].supabase.co/payment/success`
   - Failure: `https://[PROJECT_REF].supabase.co/payment/failure`

### ✅ O que verificar:

- [ ] Pagamento é processado no Mercado Pago
- [ ] Redirecionamento funciona após pagamento
- [ ] Webhook é recebido (ver próximo teste)

### 🔍 Verificar no Banco de Dados:

```sql
-- Verificar pagamento na tabela de histórico
SELECT 
  user_id,
  mercadopago_payment_id,
  status,
  transaction_amount,
  payment_type,
  date_created,
  date_approved,
  webhook_data
FROM mercadopago_payments
ORDER BY created_at DESC
LIMIT 5;
```

**Resultado esperado:**
- Registro criado na tabela `mercadopago_payments`
- `status` = 'approved' (se pagamento aprovado)
- `transaction_amount` com valor correto
- `date_approved` preenchido

```sql
-- Verificar atualização do perfil
SELECT 
  user_id,
  payment_status,
  last_payment_date,
  next_payment_date,
  mercadopago_payment_id,
  mercadopago_status
FROM profiles
WHERE subscription_type = 'monthly'
ORDER BY updated_at DESC
LIMIT 5;
```

**Resultado esperado:**
- `payment_status` = 'paid'
- `last_payment_date` preenchido
- `next_payment_date` = dia 05 do próximo mês
- `mercadopago_status` = 'authorized'

---

## 3️⃣ Teste: Webhook do Mercado Pago

### Opção A: Teste Automático (Após Pagamento)

Quando você faz um pagamento de teste, o Mercado Pago automaticamente envia um webhook.

### Verificar Logs da Edge Function:

1. **No Dashboard do Supabase:**
   - Vá em **Edge Functions > mercadopago-webhook**
   - Clique em **Logs**
   - Procure por requisições recentes

2. **Verificar se webhook foi processado:**

```sql
-- Verificar último webhook recebido
SELECT 
  user_id,
  mercadopago_last_webhook_date,
  mercadopago_status,
  payment_status
FROM profiles
WHERE mercadopago_last_webhook_date IS NOT NULL
ORDER BY mercadopago_last_webhook_date DESC
LIMIT 5;
```

### Opção B: Teste Manual (Simular Webhook)

Você pode simular um webhook manualmente:

```bash
# Substitua [PROJECT_REF] e [SERVICE_ROLE_KEY]
curl -X POST https://[PROJECT_REF].supabase.co/functions/v1/mercadopago-webhook \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer [SERVICE_ROLE_KEY]" \
  -d '{
    "type": "payment",
    "data": {
      "id": "1234567890"
    }
  }'
```

**Nota:** Este teste requer um `payment_id` válido do Mercado Pago.

### ✅ O que verificar:

- [ ] Webhook aparece nos logs
- [ ] Status do pagamento é atualizado
- [ ] Notificação é criada para o usuário
- [ ] Histórico é salvo na tabela `mercadopago_payments`

### 🔍 Verificar Notificações:

```sql
-- Verificar notificações criadas
SELECT 
  user_id,
  title,
  message,
  type,
  read,
  created_at
FROM user_notifications
WHERE type = 'payment'
ORDER BY created_at DESC
LIMIT 10;
```

**Resultado esperado:**
- Notificação com título "✅ Pagamento Aprovado"
- Mensagem contendo valor do pagamento
- `type` = 'payment'

---

## 4️⃣ Teste: Alertas de Pagamento (Dia 05)

### Opção A: Teste Manual (SQL)

Execute a função SQL diretamente:

```sql
-- Executar função de alertas manualmente
SELECT public.cron_send_payment_alerts();
```

### Opção B: Teste via Edge Function

```bash
# Chamar Edge Function diretamente
curl -X POST https://[PROJECT_REF].supabase.co/functions/v1/send-payment-alerts \
  -H "Authorization: Bearer [SERVICE_ROLE_KEY]"
```

### Opção C: Teste Automático (Esperar Dia 05)

Se você configurou o cron, ele executará automaticamente no dia 05 às 9h.

### ✅ O que verificar:

```sql
-- Verificar alertas enviados hoje
SELECT 
  user_id,
  title,
  message,
  type,
  created_at
FROM user_notifications
WHERE type = 'payment'
  AND title LIKE '%Alerta de Pagamento%'
  AND DATE(created_at) = CURRENT_DATE
ORDER BY created_at DESC;
```

**Resultado esperado:**
- Notificações criadas para usuários com `subscription_type = 'monthly'`
- Título: "💳 Alerta de Pagamento Mensal"
- Mensagem contendo valor do plano (ex: "R$ 180,00/mês")
- Apenas uma notificação por usuário por dia

### 🔍 Verificar Logs:

```sql
-- Verificar se função foi executada (via logs do Supabase)
-- Ou verificar notificações criadas
SELECT COUNT(*) as total_alertas
FROM user_notifications
WHERE type = 'payment'
  AND title LIKE '%Alerta de Pagamento%'
  AND DATE(created_at) = CURRENT_DATE;
```

---

## 5️⃣ Teste: Interface Frontend

### Verificar Componente de Pagamento

1. **Acesse Settings > Pagamento**

2. **Verifique exibição:**
   - [ ] Plano atual é exibido corretamente
   - [ ] Valor do plano está correto
   - [ ] Status do pagamento está correto
   - [ ] Próxima data de pagamento está correta
   - [ ] Botões aparecem conforme status

3. **Teste alteração de plano:**
   - [ ] Dialog de seleção abre
   - [ ] Planos são exibidos corretamente
   - [ ] Seleção funciona
   - [ ] Botão "Continuar" habilita após seleção

4. **Teste link de pagamento:**
   - [ ] Se `payment_status = 'pending'`, botão "Finalizar Pagamento" aparece
   - [ ] Link redireciona para Mercado Pago

---

## 6️⃣ Teste: Fluxo Completo End-to-End

### Cenário Completo:

1. **Usuário sem assinatura:**
   - [ ] Vê botão "Assinar Plano Mensal"
   - [ ] Seleciona plano
   - [ ] É redirecionado para checkout
   - [ ] Faz pagamento
   - [ ] É redirecionado de volta
   - [ ] Status muda para "Pago"
   - [ ] Recebe notificação de pagamento aprovado

2. **Usuário com assinatura ativa:**
   - [ ] Vê informações do plano atual
   - [ ] Vê status "Pago"
   - [ ] Vê próxima data de pagamento
   - [ ] Pode alterar plano

3. **Usuário com pagamento pendente:**
   - [ ] Vê status "Pendente"
   - [ ] Vê botão "Finalizar Pagamento"
   - [ ] Recebe alerta no dia 05

---

## 🐛 Troubleshooting

### Problema: Edge Function não responde

**Verificar:**
```bash
# Verificar se função está deployada
supabase functions list

# Verificar logs
supabase functions logs create-mercadopago-subscription
```

### Problema: Webhook não é recebido

**Verificar:**
1. URL do webhook no Mercado Pago está correta
2. Edge Function `mercadopago-webhook` está deployada
3. Logs da Edge Function para erros

### Problema: Pagamento não atualiza status

**Verificar:**
```sql
-- Verificar se webhook foi recebido
SELECT * FROM mercadopago_payments 
WHERE user_id = '[SEU_USER_ID]'
ORDER BY created_at DESC
LIMIT 1;

-- Verificar perfil
SELECT * FROM profiles 
WHERE user_id = '[SEU_USER_ID]';
```

### Problema: Alertas não são enviados

**Verificar:**
```sql
-- Verificar se função existe
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_name = 'cron_send_payment_alerts';

-- Testar função manualmente
SELECT public.cron_send_payment_alerts();

-- Verificar se há usuários elegíveis
SELECT COUNT(*) 
FROM profiles 
WHERE subscription_type = 'monthly'
  AND payment_status IN ('pending', 'paid');
```

---

## 📊 Checklist de Testes

### Testes Básicos
- [ ] Criação de assinatura funciona
- [ ] Redirecionamento para Mercado Pago funciona
- [ ] Pagamento de teste é processado
- [ ] Webhook é recebido e processado
- [ ] Status do pagamento é atualizado
- [ ] Notificação é criada após pagamento

### Testes de Interface
- [ ] Componente de pagamento exibe dados corretos
- [ ] Seleção de plano funciona
- [ ] Botões aparecem conforme status
- [ ] Links de pagamento funcionam

### Testes de Alertas
- [ ] Função SQL de alertas funciona
- [ ] Edge Function de alertas funciona
- [ ] Notificações são criadas corretamente
- [ ] Valor proporcional é exibido

### Testes de Integração
- [ ] Fluxo completo end-to-end funciona
- [ ] Múltiplos usuários podem ter assinaturas
- [ ] Histórico de pagamentos é salvo
- [ ] Dados são consistentes entre tabelas

---

## 🎯 Próximos Passos Após Testes

1. ✅ Se todos os testes passarem → Sistema pronto para produção
2. ⚠️ Se algum teste falhar → Verificar logs e corrigir
3. 📝 Documentar casos de uso específicos
4. 🔔 Configurar monitoramento de webhooks
5. 📊 Criar dashboard de pagamentos (opcional)

---

## 📞 Suporte

Se encontrar problemas:
1. Verifique os logs das Edge Functions
2. Verifique os logs do Supabase
3. Consulte a documentação do Mercado Pago
4. Verifique as queries SQL acima para diagnosticar

