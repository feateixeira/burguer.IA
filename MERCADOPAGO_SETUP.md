# Configuração do Mercado Pago

## Credenciais Fornecidas

- **Public Key**: `APP_USR-66642fb9-8e7e-4445-9f2e-a7f8f0e2e315`
- **Access Token**: `APP_USR-1420249389711899-121909-c07b8fc1940242b66013075f5383a488-208727634`

## Configuração no Supabase

### 1. Configurar Variáveis de Ambiente (Secrets)

No dashboard do Supabase, vá em **Settings > Edge Functions > Secrets** e adicione:

```
MERCADOPAGO_ACCESS_TOKEN=APP_USR-1420249389711899-121909-c07b8fc1940242b66013075f5383a488-208727634
MERCADOPAGO_PUBLIC_KEY=APP_USR-66642fb9-8e7e-4445-9f2e-a7f8f0e2e315
```

**Nota**: As credenciais também estão hardcoded nas Edge Functions como fallback, mas é recomendado usar secrets para maior segurança.

### 2. Configurar Webhook no Mercado Pago

1. Acesse o [Painel do Mercado Pago](https://www.mercadopago.com.br/developers/panel)
2. Vá em **Webhooks** ou **Notificações**
3. Configure a URL do webhook:
   ```
   https://[SEU_PROJECT_REF].supabase.co/functions/v1/mercadopago-webhook
   ```
   Substitua `[SEU_PROJECT_REF]` pelo ID do seu projeto Supabase.

4. Selecione os eventos para notificar:
   - `payment` (pagamentos)
   - `subscription` (assinaturas, se usar)

### 3. Configurar URLs de Retorno

As URLs de retorno já estão configuradas nas Edge Functions:
- **Success**: `https://[SEU_PROJECT_REF].supabase.co/payment/success`
- **Failure**: `https://[SEU_PROJECT_REF].supabase.co/payment/failure`
- **Pending**: `https://[SEU_PROJECT_REF].supabase.co/payment/pending`

Você pode criar páginas de retorno no frontend se desejar.

### 4. Habilitar Cron Job de Alertas

Para habilitar o envio automático de alertas no dia 05:

1. Acesse o SQL Editor no Supabase
2. Execute o seguinte comando (requer permissões de superuser):

```sql
SELECT cron.schedule(
  'send-payment-alerts',
  '0 9 5 * *', -- Todo dia 05 às 9h da manhã
  $$SELECT public.cron_send_payment_alerts()$$
);
```

**Alternativa**: Você pode configurar um cron externo (ex: Vercel Cron, GitHub Actions) para chamar a Edge Function `send-payment-alerts` no dia 05 de cada mês.

### 5. Deploy das Edge Functions

Execute os seguintes comandos para fazer deploy das Edge Functions:

```bash
# Deploy da função de criar assinatura
supabase functions deploy create-mercadopago-subscription

# Deploy da função de webhook
supabase functions deploy mercadopago-webhook

# Deploy da função de alertas
supabase functions deploy send-payment-alerts
```

## Estrutura de Dados

### Tabela `profiles` - Novos Campos

- `mercadopago_subscription_id`: ID da assinatura no Mercado Pago
- `mercadopago_payer_id`: ID do pagador
- `mercadopago_payment_id`: ID do último pagamento
- `mercadopago_preapproval_id`: ID do pré-aprovamento
- `mercadopago_status`: Status da assinatura (pending, authorized, paused, cancelled, completed)
- `mercadopago_init_point`: URL de inicialização do pagamento
- `mercadopago_last_webhook_date`: Data do último webhook recebido

### Tabela `mercadopago_payments`

Armazena histórico de todos os pagamentos processados pelo Mercado Pago.

## Fluxo de Pagamento

1. **Usuário seleciona plano** → Frontend chama `create-mercadopago-subscription`
2. **Edge Function cria preferência** → Retorna `init_point` (URL do checkout)
3. **Usuário é redirecionado** → Para o checkout do Mercado Pago
4. **Usuário realiza pagamento** → No Mercado Pago
5. **Mercado Pago envia webhook** → Para `mercadopago-webhook`
6. **Edge Function processa** → Atualiza status do pagamento e cria notificação
7. **Sistema envia alerta** → No dia 05 de cada mês (via cron job)

## Testes

> 📋 **Guia completo de testes:** Veja `MERCADOPAGO_TESTING.md` para instruções detalhadas passo a passo.

### Teste Rápido: Criação de Assinatura

1. Acesse a página de Settings > Pagamento
2. Clique em "Assinar Plano Mensal"
3. Selecione um plano
4. Você será redirecionado para o checkout do Mercado Pago

### Teste Rápido: Webhook

Após fazer um pagamento de teste, verifique se o webhook foi processado:

```sql
-- Verificar último pagamento
SELECT * FROM mercadopago_payments 
ORDER BY created_at DESC LIMIT 1;

-- Verificar status atualizado
SELECT payment_status, mercadopago_status 
FROM profiles 
WHERE subscription_type = 'monthly'
ORDER BY updated_at DESC LIMIT 1;
```

### Teste Rápido: Alertas

```sql
-- Executar manualmente
SELECT public.cron_send_payment_alerts();

-- Verificar notificações criadas
SELECT * FROM user_notifications 
WHERE type = 'payment' 
  AND title LIKE '%Alerta%'
ORDER BY created_at DESC LIMIT 5;
```

## Planos Disponíveis

- **Gold (Standard)**: R$ 160,00/mês
- **Platinum (Gold)**: R$ 180,00/mês
- **Premium**: R$ 220,00/mês

## Próximos Passos

### Ordem de Execução

1. **Executar Migrations (SQL Editor do Supabase):**
   - `20251219120420_add_mercadopago_fields.sql` (PRIMEIRO)
   - `20251219120602_create_payment_alert_cron.sql` (SEGUNDO)

2. **Configurar secrets no Supabase**

3. **Fazer deploy das Edge Functions:**
   - `create-mercadopago-subscription`
   - `mercadopago-webhook`
   - `send-payment-alerts`

4. **Configurar webhook no Mercado Pago**

5. **Habilitar cron job de alertas** (opcional)

6. ⏳ Criar páginas de retorno (success/failure/pending) no frontend (opcional)
7. ⏳ Testar fluxo completo de pagamento
8. ⏳ Monitorar logs e webhooks

> 📋 **Veja o mapeamento completo em:** `MERCADOPAGO_MAPPING.md`

## Suporte

Em caso de problemas:
- Verifique os logs das Edge Functions no dashboard do Supabase
- Verifique os webhooks recebidos na tabela `mercadopago_payments`
- Consulte a [documentação do Mercado Pago](https://www.mercadopago.com.br/developers/pt/docs)


