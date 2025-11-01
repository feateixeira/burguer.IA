# Instruções: Exclusão Automática de Pedidos Antigos

## 📋 O que foi implementado

1. **Função SQL**: `delete_old_orders()` - criada na migration
2. **Edge Function**: `delete-old-orders` - para ser executada periodicamente
3. **Filtro Frontend**: A página já filtra pedidos com mais de 3 meses automaticamente

## 🚀 Passo a Passo no Supabase

### Opção 1: Executar Manualmente (Teste Inicial)

1. **Acesse o Supabase Dashboard**
   - Vá em: **SQL Editor** → **New Query**

2. **Execute a função diretamente**:
   ```sql
   SELECT public.delete_old_orders();
   ```

3. **Verifique o resultado**:
   - A função retorna um JSON com o número de pedidos deletados

### Opção 2: Configurar Execução Automática via Edge Function (Recomendado)

#### Passo 1: Fazer deploy da Edge Function

No terminal do seu projeto:

```bash
# Fazer deploy da função
supabase functions deploy delete-old-orders
```

Ou faça o deploy manualmente pelo Supabase Dashboard:
- Vá em: **Edge Functions** → **Create a new function**
- Nome: `delete-old-orders`
- Cole o conteúdo do arquivo `supabase/functions/delete-old-orders/index.ts`

#### Passo 2: Configurar Cron Job no Supabase

**Método A - Via Supabase Dashboard (se disponível):**
1. Vá em: **Database** → **Cron Jobs** (ou **Scheduled Functions**)
2. Crie um novo cron job:
   - **Nome**: `delete-old-orders-daily`
   - **Schedule**: `0 2 * * *` (todo dia às 2h da manhã)
   - **Function**: `delete-old-orders`
   - **HTTP Method**: `POST`

**Método B - Via pg_cron (requer acesso ao banco):**
1. No **SQL Editor**, execute:
```sql
-- Habilitar pg_cron (se ainda não estiver habilitado)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Criar job para executar diariamente às 2h da manhã
SELECT cron.schedule(
  'delete-old-orders-daily',
  '0 2 * * *',  -- Todo dia às 2h da manhã (formato: minuto hora dia mês dia-da-semana)
  $$
  SELECT net.http_post(
    url := 'https://tndiwjznitnualtorbpk.supabase.co/functions/v1/delete-old-orders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer SEU_SERVICE_ROLE_KEY_AQUI'
    )
  );
  $$
);
```

**Método C - Via Serviço Externo (GitHub Actions, Vercel Cron, etc.):**
- Configure um webhook/cron job externo para chamar:
  ```
  POST https://tndiwjznitnualtorbpk.supabase.co/functions/v1/delete-old-orders
  Headers:
    Authorization: Bearer SEU_SERVICE_ROLE_KEY
  ```

#### Passo 3: Testar a Edge Function

No **Supabase Dashboard**:
1. Vá em: **Edge Functions** → **delete-old-orders** → **Invoke**
2. Clique em **Invoke Function**
3. Verifique os logs para confirmar a execução

### Opção 3: Usar Vercel Cron (Se o projeto estiver no Vercel)

Crie um arquivo `vercel.json` na raiz do projeto:

```json
{
  "crons": [{
    "path": "/api/cron/delete-old-orders",
    "schedule": "0 2 * * *"
  }]
}
```

E crie a rota `api/cron/delete-old-orders.ts` (se for Next.js) ou configure um webhook.

## ✅ Verificação

Para verificar se está funcionando:

1. **Ver quantos pedidos serão deletados** (sem deletar):
```sql
SELECT COUNT(*) as total_pedidos_antigos
FROM public.orders
WHERE created_at < NOW() - INTERVAL '3 months';
```

2. **Verificar logs da função**:
   - No Supabase Dashboard: **Edge Functions** → **delete-old-orders** → **Logs**

## 📝 Importante

- ⚠️ **Backup**: Antes de ativar a exclusão automática, faça um backup dos dados
- ⏰ **Horário**: Configure para executar em horário de baixo tráfego (recomendado: madrugada)
- 📊 **Monitoramento**: Acompanhe os logs para garantir que está funcionando corretamente
- 🔒 **Segurança**: A Edge Function usa SERVICE_ROLE_KEY (já configurada)

## 🎯 Resultado Esperado

Após configurar:
- ✅ Pedidos com mais de 3 meses serão excluídos automaticamente
- ✅ A performance do sistema melhorará (menos dados para carregar)
- ✅ O frontend já não carrega pedidos antigos (implementado no código)

