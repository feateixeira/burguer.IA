# Mapeamento: Migrations e Edge Functions

## 📋 Ordem de Criação/Execução

### 1️⃣ PRIMEIRO: Executar Migrations (SQL)

As migrations criam a estrutura de dados no banco. Execute-as **ANTES** de fazer deploy das Edge Functions.

#### Migration 1: `20251219120420_add_mercadopago_fields.sql`
**O que faz:**
- Adiciona campos do Mercado Pago na tabela `profiles`
- Cria tabela `mercadopago_payments` para histórico
- Cria índices e políticas RLS

**Dependências:**
- ✅ Nenhuma (pode executar primeiro)

**Edge Functions que dependem desta migration:**
- ✅ `create-mercadopago-subscription` - Usa campos da tabela `profiles`
- ✅ `mercadopago-webhook` - Salva dados na tabela `mercadopago_payments`

---

#### Migration 2: `20251219120602_create_payment_alert_cron.sql`
**O que faz:**
- Cria função SQL `cron_send_payment_alerts()` para enviar alertas no dia 05
- Função pode ser chamada manualmente ou via cron

**Dependências:**
- ✅ Precisa da Migration 1 (usa tabela `profiles` e `user_notifications`)

**Edge Functions que dependem desta migration:**
- ✅ `send-payment-alerts` - Chama a função SQL `cron_send_payment_alerts()`

---

### 2️⃣ SEGUNDO: Fazer Deploy das Edge Functions

#### Edge Function 1: `create-mercadopago-subscription`
**Arquivo:** `supabase/functions/create-mercadopago-subscription/index.ts`

**O que faz:**
- Cria preferência de pagamento no Mercado Pago
- Retorna URL de checkout (`init_point`)
- Atualiza campos do Mercado Pago na tabela `profiles`

**Depende de:**
- ✅ Migration 1 (`20251219120420_add_mercadopago_fields.sql`)
- ✅ Credenciais do Mercado Pago (secrets ou hardcoded)

**Quando usar:**
- Quando usuário clica em "Assinar Plano" no frontend

**Deploy:**
```bash
supabase functions deploy create-mercadopago-subscription
```

---

#### Edge Function 2: `mercadopago-webhook`
**Arquivo:** `supabase/functions/mercadopago-webhook/index.ts`

**O que faz:**
- Recebe webhooks do Mercado Pago quando pagamento é processado
- Atualiza status do pagamento na tabela `profiles`
- Salva histórico na tabela `mercadopago_payments`
- Cria notificações para o usuário

**Depende de:**
- ✅ Migration 1 (`20251219120420_add_mercadopago_fields.sql`)
- ✅ Credenciais do Mercado Pago (secrets ou hardcoded)

**Quando usar:**
- Automaticamente quando Mercado Pago envia webhook após pagamento

**Deploy:**
```bash
supabase functions deploy mercadopago-webhook
```

**Configuração adicional:**
- Configurar URL do webhook no painel do Mercado Pago:
  ```
  https://[SEU_PROJECT_REF].supabase.co/functions/v1/mercadopago-webhook
  ```

---

#### Edge Function 3: `send-payment-alerts`
**Arquivo:** `supabase/functions/send-payment-alerts/index.ts`

**O que faz:**
- Chama a função SQL `cron_send_payment_alerts()`
- Pode ser chamada manualmente ou via cron externo

**Depende de:**
- ✅ Migration 1 (`20251219120420_add_mercadopago_fields.sql`)
- ✅ Migration 2 (`20251219120602_create_payment_alert_cron.sql`)

**Quando usar:**
- Automaticamente no dia 05 de cada mês (via cron)
- Ou manualmente para testes

**Deploy:**
```bash
supabase functions deploy send-payment-alerts
```

**Configuração adicional:**
- Opção 1: Habilitar cron SQL no Supabase (requer superuser)
- Opção 2: Configurar cron externo (Vercel Cron, GitHub Actions, etc.)

---

## 📊 Resumo Visual

```
┌─────────────────────────────────────────────────────────┐
│ MIGRATION 1: add_mercadopago_fields.sql                 │
│ ✅ Cria estrutura de dados                               │
└─────────────────┬───────────────────────────────────────┘
                   │
        ┌──────────┴──────────┐
        │                     │
        ▼                     ▼
┌───────────────────┐  ┌───────────────────┐
│ create-mercadopago│  │ mercadopago-      │
│ -subscription     │  │ webhook           │
│ (Edge Function 1) │  │ (Edge Function 2) │
└───────────────────┘  └───────────────────┘

┌─────────────────────────────────────────────────────────┐
│ MIGRATION 2: create_payment_alert_cron.sql             │
│ ✅ Cria função SQL de alertas                           │
└─────────────────┬───────────────────────────────────────┘
                   │
                   ▼
        ┌───────────────────┐
        │ send-payment-     │
        │ alerts            │
        │ (Edge Function 3) │
        └───────────────────┘
```

---

## 🚀 Ordem de Execução Recomendada

### Passo 1: Executar Migrations
```sql
-- No SQL Editor do Supabase, execute na ordem:
1. 20251219120420_add_mercadopago_fields.sql
2. 20251219120602_create_payment_alert_cron.sql
```

### Passo 2: Configurar Secrets
```
No Supabase Dashboard > Settings > Edge Functions > Secrets:
- MERCADOPAGO_ACCESS_TOKEN
- MERCADOPAGO_PUBLIC_KEY
```

### Passo 3: Deploy das Edge Functions
```bash
# Ordem não importa, mas todas dependem da Migration 1
supabase functions deploy create-mercadopago-subscription
supabase functions deploy mercadopago-webhook
supabase functions deploy send-payment-alerts
```

### Passo 4: Configurar Webhook no Mercado Pago
```
URL: https://[SEU_PROJECT_REF].supabase.co/functions/v1/mercadopago-webhook
```

### Passo 5: (Opcional) Habilitar Cron de Alertas
```sql
SELECT cron.schedule(
  'send-payment-alerts',
  '0 9 5 * *',
  $$SELECT public.cron_send_payment_alerts()$$
);
```

---

## ✅ Checklist de Implementação

- [ ] Executar Migration 1: `20251219120420_add_mercadopago_fields.sql`
- [ ] Executar Migration 2: `20251219120602_create_payment_alert_cron.sql`
- [ ] Configurar secrets no Supabase
- [ ] Deploy Edge Function: `create-mercadopago-subscription`
- [ ] Deploy Edge Function: `mercadopago-webhook`
- [ ] Deploy Edge Function: `send-payment-alerts`
- [ ] Configurar webhook no Mercado Pago
- [ ] (Opcional) Habilitar cron SQL de alertas
- [ ] Testar criação de assinatura
- [ ] Testar webhook
- [ ] Testar alertas

---

## 🔍 Verificação

Para verificar se tudo está funcionando:

1. **Verificar migrations aplicadas:**
   ```sql
   SELECT * FROM supabase_migrations.schema_migrations 
   WHERE name LIKE '%mercadopago%' 
   ORDER BY version;
   ```

2. **Verificar Edge Functions deployadas:**
   - Dashboard do Supabase > Edge Functions
   - Deve mostrar as 3 funções listadas

3. **Verificar estrutura de dados:**
   ```sql
   -- Verificar campos na tabela profiles
   SELECT column_name FROM information_schema.columns 
   WHERE table_name = 'profiles' 
   AND column_name LIKE 'mercadopago%';
   
   -- Verificar se tabela de pagamentos existe
   SELECT * FROM mercadopago_payments LIMIT 1;
   ```

