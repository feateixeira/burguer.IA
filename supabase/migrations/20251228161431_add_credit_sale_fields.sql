-- ============================================
-- ADICIONAR CAMPOS DE FIADO NA TABELA ORDERS
-- ============================================

ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS is_credit_sale BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS credit_due_date DATE;

ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS credit_received_at TIMESTAMPTZ;

ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS credit_received_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS credit_interest_rate_per_day NUMERIC(10, 4) DEFAULT 0;

ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS credit_interest_amount NUMERIC(10, 2) DEFAULT 0;

ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS credit_total_with_interest NUMERIC(10, 2) DEFAULT 0;

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_orders_is_credit_sale ON public.orders(is_credit_sale) WHERE is_credit_sale = true;
CREATE INDEX IF NOT EXISTS idx_orders_credit_due_date ON public.orders(credit_due_date) WHERE is_credit_sale = true AND credit_received_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_orders_credit_received_at ON public.orders(credit_received_at) WHERE is_credit_sale = true;

-- Comentários nas colunas
COMMENT ON COLUMN public.orders.is_credit_sale IS 'Indica se é uma venda fiado';
COMMENT ON COLUMN public.orders.credit_due_date IS 'Data prevista para recebimento do pagamento';
COMMENT ON COLUMN public.orders.credit_received_at IS 'Data/hora em que o pagamento foi recebido';
COMMENT ON COLUMN public.orders.credit_received_by IS 'ID do usuário que recebeu o pagamento';
COMMENT ON COLUMN public.orders.credit_interest_rate_per_day IS 'Taxa de juros por dia aplicada ao pedido (em decimal, ex: 0.01 = 1%)';
COMMENT ON COLUMN public.orders.credit_interest_amount IS 'Valor dos juros calculados e recebidos';
COMMENT ON COLUMN public.orders.credit_total_with_interest IS 'Valor total do pedido incluindo juros';

