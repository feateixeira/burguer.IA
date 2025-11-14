-- ============================================
-- TABELAS FACT (ROLLUPS AGREGADOS)
-- Armazenam dados agregados por dia/semana/mês
-- Mantém apenas resumos no Postgres para performance
-- ============================================

-- ============================================
-- 1. FACT_DAILY_SALES
-- Agregação diária de vendas por estabelecimento e canal
-- ============================================
CREATE TABLE IF NOT EXISTS public.fact_daily_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id UUID NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  channel TEXT, -- 'online', 'balcao', 'delivery', 'totem'
  
  -- Métricas principais
  total_orders INTEGER NOT NULL DEFAULT 0,
  total_revenue DECIMAL(12, 2) NOT NULL DEFAULT 0,
  total_discounts DECIMAL(12, 2) NOT NULL DEFAULT 0,
  total_delivery_fee DECIMAL(12, 2) NOT NULL DEFAULT 0,
  total_cost_of_goods DECIMAL(12, 2) NOT NULL DEFAULT 0, -- CMV
  gross_margin DECIMAL(12, 2) NOT NULL DEFAULT 0,
  average_ticket DECIMAL(10, 2) NOT NULL DEFAULT 0,
  
  -- Cancelamentos
  cancelled_orders INTEGER NOT NULL DEFAULT 0,
  cancelled_revenue DECIMAL(12, 2) NOT NULL DEFAULT 0,
  
  -- Pagamentos
  payment_cash DECIMAL(12, 2) NOT NULL DEFAULT 0,
  payment_pix DECIMAL(12, 2) NOT NULL DEFAULT 0,
  payment_card_debit DECIMAL(12, 2) NOT NULL DEFAULT 0,
  payment_card_credit DECIMAL(12, 2) NOT NULL DEFAULT 0,
  payment_online DECIMAL(12, 2) NOT NULL DEFAULT 0,
  
  -- Metadados
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(establishment_id, date, channel)
);

CREATE INDEX IF NOT EXISTS idx_fact_daily_sales_establishment_date ON public.fact_daily_sales(establishment_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_fact_daily_sales_date ON public.fact_daily_sales(date DESC);
CREATE INDEX IF NOT EXISTS idx_fact_daily_sales_channel ON public.fact_daily_sales(channel);

-- ============================================
-- 2. FACT_DAILY_PRODUCTS
-- Agregação diária por produto
-- ============================================
CREATE TABLE IF NOT EXISTS public.fact_daily_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id UUID NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL, -- Mantém nome para histórico
  date DATE NOT NULL,
  
  -- Métricas
  quantity_sold INTEGER NOT NULL DEFAULT 0,
  total_revenue DECIMAL(12, 2) NOT NULL DEFAULT 0,
  total_cost DECIMAL(12, 2) NOT NULL DEFAULT 0, -- CMV do produto
  gross_margin DECIMAL(12, 2) NOT NULL DEFAULT 0,
  average_price DECIMAL(10, 2) NOT NULL DEFAULT 0,
  
  -- Metadados
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(establishment_id, product_id, date)
);

CREATE INDEX IF NOT EXISTS idx_fact_daily_products_establishment_date ON public.fact_daily_products(establishment_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_fact_daily_products_product ON public.fact_daily_products(product_id);
CREATE INDEX IF NOT EXISTS idx_fact_daily_products_date ON public.fact_daily_products(date DESC);

-- ============================================
-- 3. FACT_DAILY_CUSTOMERS
-- Agregação diária por cliente
-- ============================================
CREATE TABLE IF NOT EXISTS public.fact_daily_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id UUID NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_phone TEXT, -- Mantém para histórico
  date DATE NOT NULL,
  
  -- Métricas
  total_orders INTEGER NOT NULL DEFAULT 0,
  total_revenue DECIMAL(12, 2) NOT NULL DEFAULT 0,
  average_ticket DECIMAL(10, 2) NOT NULL DEFAULT 0,
  ltv_partial DECIMAL(12, 2) NOT NULL DEFAULT 0, -- LTV acumulado até a data
  
  -- Metadados
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(establishment_id, customer_id, date)
);

CREATE INDEX IF NOT EXISTS idx_fact_daily_customers_establishment_date ON public.fact_daily_customers(establishment_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_fact_daily_customers_customer ON public.fact_daily_customers(customer_id);
CREATE INDEX IF NOT EXISTS idx_fact_daily_customers_date ON public.fact_daily_customers(date DESC);

-- ============================================
-- 4. FACT_CASH_DAILY
-- Agregação diária de movimentações de caixa
-- ============================================
CREATE TABLE IF NOT EXISTS public.fact_cash_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id UUID NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  
  -- Caixa
  opening_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
  closing_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
  expected_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
  difference_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
  
  -- Transações
  total_deposits DECIMAL(12, 2) NOT NULL DEFAULT 0, -- Suprimentos
  total_withdraws DECIMAL(12, 2) NOT NULL DEFAULT 0, -- Sangrias
  deposit_count INTEGER NOT NULL DEFAULT 0,
  withdraw_count INTEGER NOT NULL DEFAULT 0,
  
  -- Pagamentos por método (do fechamento do caixa)
  payment_cash DECIMAL(12, 2) NOT NULL DEFAULT 0,
  payment_pix DECIMAL(12, 2) NOT NULL DEFAULT 0,
  payment_card_debit DECIMAL(12, 2) NOT NULL DEFAULT 0,
  payment_card_credit DECIMAL(12, 2) NOT NULL DEFAULT 0,
  
  -- Sessões
  sessions_opened INTEGER NOT NULL DEFAULT 0,
  sessions_closed INTEGER NOT NULL DEFAULT 0,
  
  -- Metadados
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(establishment_id, date)
);

CREATE INDEX IF NOT EXISTS idx_fact_cash_daily_establishment_date ON public.fact_cash_daily(establishment_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_fact_cash_daily_date ON public.fact_cash_daily(date DESC);

-- ============================================
-- 5. FACT_MARKETING_CAMPAIGNS
-- Agregação diária por campanha de marketing
-- ============================================
CREATE TABLE IF NOT EXISTS public.fact_marketing_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id UUID NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  campaign_id UUID, -- Pode referenciar tabela de campanhas futura
  campaign_name TEXT, -- Nome da campanha/promoção
  date DATE NOT NULL,
  
  -- Métricas
  total_revenue DECIMAL(12, 2) NOT NULL DEFAULT 0,
  total_discounts DECIMAL(12, 2) NOT NULL DEFAULT 0,
  total_orders INTEGER NOT NULL DEFAULT 0,
  gross_margin DECIMAL(12, 2) NOT NULL DEFAULT 0,
  average_ticket DECIMAL(10, 2) NOT NULL DEFAULT 0,
  
  -- Metadados
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(establishment_id, campaign_id, date)
);

CREATE INDEX IF NOT EXISTS idx_fact_marketing_campaigns_establishment_date ON public.fact_marketing_campaigns(establishment_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_fact_marketing_campaigns_campaign ON public.fact_marketing_campaigns(campaign_id);
CREATE INDEX IF NOT EXISTS idx_fact_marketing_campaigns_date ON public.fact_marketing_campaigns(date DESC);

-- ============================================
-- TRIGGERS PARA UPDATED_AT
-- ============================================
CREATE OR REPLACE FUNCTION public.update_fact_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_fact_daily_sales_updated_at
  BEFORE UPDATE ON public.fact_daily_sales
  FOR EACH ROW
  EXECUTE FUNCTION public.update_fact_updated_at();

CREATE TRIGGER update_fact_daily_products_updated_at
  BEFORE UPDATE ON public.fact_daily_products
  FOR EACH ROW
  EXECUTE FUNCTION public.update_fact_updated_at();

CREATE TRIGGER update_fact_daily_customers_updated_at
  BEFORE UPDATE ON public.fact_daily_customers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_fact_updated_at();

CREATE TRIGGER update_fact_cash_daily_updated_at
  BEFORE UPDATE ON public.fact_cash_daily
  FOR EACH ROW
  EXECUTE FUNCTION public.update_fact_updated_at();

CREATE TRIGGER update_fact_marketing_campaigns_updated_at
  BEFORE UPDATE ON public.fact_marketing_campaigns
  FOR EACH ROW
  EXECUTE FUNCTION public.update_fact_updated_at();

-- ============================================
-- HABILITAR RLS
-- ============================================
ALTER TABLE public.fact_daily_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fact_daily_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fact_daily_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fact_cash_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fact_marketing_campaigns ENABLE ROW LEVEL SECURITY;

-- Políticas RLS padrão: usuários veem apenas dados do seu estabelecimento
-- fact_daily_sales
DROP POLICY IF EXISTS "Users can view fact_daily_sales from their establishment" ON public.fact_daily_sales;
CREATE POLICY "Users can view fact_daily_sales from their establishment"
  ON public.fact_daily_sales FOR SELECT
  USING (
    establishment_id IN (
      SELECT establishment_id FROM public.profiles WHERE user_id = auth.uid()
    )
  );

-- fact_daily_products
DROP POLICY IF EXISTS "Users can view fact_daily_products from their establishment" ON public.fact_daily_products;
CREATE POLICY "Users can view fact_daily_products from their establishment"
  ON public.fact_daily_products FOR SELECT
  USING (
    establishment_id IN (
      SELECT establishment_id FROM public.profiles WHERE user_id = auth.uid()
    )
  );

-- fact_daily_customers
DROP POLICY IF EXISTS "Users can view fact_daily_customers from their establishment" ON public.fact_daily_customers;
CREATE POLICY "Users can view fact_daily_customers from their establishment"
  ON public.fact_daily_customers FOR SELECT
  USING (
    establishment_id IN (
      SELECT establishment_id FROM public.profiles WHERE user_id = auth.uid()
    )
  );

-- fact_cash_daily
DROP POLICY IF EXISTS "Users can view fact_cash_daily from their establishment" ON public.fact_cash_daily;
CREATE POLICY "Users can view fact_cash_daily from their establishment"
  ON public.fact_cash_daily FOR SELECT
  USING (
    establishment_id IN (
      SELECT establishment_id FROM public.profiles WHERE user_id = auth.uid()
    )
  );

-- fact_marketing_campaigns
DROP POLICY IF EXISTS "Users can view fact_marketing_campaigns from their establishment" ON public.fact_marketing_campaigns;
CREATE POLICY "Users can view fact_marketing_campaigns from their establishment"
  ON public.fact_marketing_campaigns FOR SELECT
  USING (
    establishment_id IN (
      SELECT establishment_id FROM public.profiles WHERE user_id = auth.uid()
    )
  );

