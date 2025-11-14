# Sistema de Arquivamento e Rollups

Este sistema substitui a exclusão automática de dados a cada 3 meses por um sistema inteligente de arquivamento e agregação.

## 📊 Estrutura

### Tabelas Fact (Rollups Agregados)

**Mantidas no Postgres para performance:**

- `fact_daily_sales` - Vendas diárias por estabelecimento e canal
- `fact_daily_products` - Produtos vendidos por dia
- `fact_daily_customers` - Clientes e LTV parcial
- `fact_cash_daily` - Movimentações de caixa diárias
- `fact_marketing_campaigns` - Campanhas e promoções

### Tabelas de Controle

- `archive_jobs` - Controla jobs de exportação
- `archive_config` - Configurações por estabelecimento

### Dados Raw

**Armazenados em R2/Blob Storage (barato):**
- JSON/CSV com detalhes completos de pedidos antigos (90+ dias)
- Sessões de caixa completas
- Transações detalhadas

## 🔄 Jobs Automáticos

### 1. Rollup Near Real-Time (5 minutos)
- **Cron:** `*/5 * * * *`
- **Função:** `cron_daily_rollup_realtime()`
- Processa rollups do dia atual a cada 5 minutos

### 2. Fechamento Diário (03:00)
- **Cron:** `0 3 * * *`
- **Função:** `cron_daily_close()`
- Consolida dados do dia anterior (D-1)

### 3. Arquivamento (04:00)
- **Cron:** `0 4 * * *`
- **Função:** `cron_archive_old_data()`
- Exporta dados com 90+ dias para R2/Blob

### 4. Fechamento Mensal (Dia 1, 05:00)
- **Cron:** `0 5 1 * *`
- **Função:** `cron_monthly_close()`
- Gera snapshot mensal de DRE

## 🚀 Como Configurar

### 1. Executar Migrations

```bash
supabase db push
```

### 2. Configurar pg_cron (Supabase)

No SQL Editor do Supabase, execute:

```sql
-- Habilitar extensão pg_cron (pode requerer permissões de superuser)
-- CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Agendar jobs
SELECT cron.schedule(
  'daily-rollup-realtime',
  '*/5 * * * *',
  $$SELECT public.cron_daily_rollup_realtime()$$
);

SELECT cron.schedule(
  'daily-close',
  '0 3 * * *',
  $$SELECT public.cron_daily_close()$$
);

SELECT cron.schedule(
  'archive-old-data',
  '0 4 * * *',
  $$SELECT public.cron_archive_old_data()$$
);

SELECT cron.schedule(
  'monthly-close',
  '0 5 1 * *',
  $$SELECT public.cron_monthly_close()$$
);
```

### 3. Configurar Estabelecimento

```sql
INSERT INTO public.archive_config (
  establishment_id,
  raw_data_retention_days,
  archive_retention_months,
  storage_provider,
  storage_bucket
) VALUES (
  'seu-establishment-id',
  90,  -- Dias antes de arquivar
  24,  -- Meses para manter arquivos
  'r2',
  'seu-bucket-r2'
);
```

### 4. Deploy Edge Function

```bash
supabase functions deploy archive-export
```

## 📈 Uso

### Processar Rollup Manualmente

```sql
-- Para um estabelecimento específico
SELECT public.run_rollup_manually('establishment-id', '2025-01-09');

-- Para todos os estabelecimentos
SELECT public.run_rollup_manually(NULL, '2025-01-09');
```

### Consultar Rollups

```sql
-- Vendas do último mês
SELECT * FROM public.fact_daily_sales
WHERE establishment_id = 'seu-id'
  AND date >= CURRENT_DATE - INTERVAL '30 days'
ORDER BY date DESC;

-- Produtos mais vendidos
SELECT 
  product_name,
  SUM(quantity_sold) as total_vendas,
  SUM(total_revenue) as receita_total
FROM public.fact_daily_products
WHERE establishment_id = 'seu-id'
  AND date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY product_name
ORDER BY total_vendas DESC
LIMIT 10;
```

### Exportar Dados para JSON

```sql
-- Exportar pedidos de um dia
SELECT public.export_orders_to_json('establishment-id', '2025-01-09');

-- Exportar dados de caixa
SELECT public.export_cash_sessions_to_json('establishment-id', '2025-01-09');
```

## 🔧 Implementação de Upload para R2

O arquivo `supabase/functions/archive-export/index.ts` precisa ser atualizado com as credenciais R2:

1. Adicione variáveis de ambiente:
   - `R2_ACCOUNT_ID`
   - `R2_ACCESS_KEY_ID`
   - `R2_SECRET_ACCESS_KEY`
   - `R2_BUCKET_NAME`

2. Implemente upload usando Cloudflare R2 API (S3-compatible)

## 📊 Benefícios

1. **Performance**: Dashboards usam dados agregados (rápidos)
2. **Custo**: Dados raw ficam em armazenamento barato (R2)
3. **Histórico**: Mantém 12-24 meses de histórico agregado
4. **Recuperação**: Pode reprocessar meses antigos usando arquivos JSON
5. **Escalabilidade**: Sistema cresce sem degradar performance

## 🎯 Próximos Passos

1. Implementar upload real para R2 na Edge Function
2. Criar dashboard usando dados agregados
3. Adicionar alertas para falhas nos jobs
4. Criar interface de reprocessamento de meses antigos

