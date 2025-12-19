-- ============================================
-- MIGRATION: Adicionar campos do Mercado Pago
-- ============================================
-- Campos para armazenar informações de assinatura e pagamento do Mercado Pago
-- ============================================

-- Adicionar campos do Mercado Pago na tabela profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS mercadopago_subscription_id TEXT,
ADD COLUMN IF NOT EXISTS mercadopago_payer_id TEXT,
ADD COLUMN IF NOT EXISTS mercadopago_payment_id TEXT,
ADD COLUMN IF NOT EXISTS mercadopago_preapproval_id TEXT,
ADD COLUMN IF NOT EXISTS mercadopago_status TEXT CHECK (mercadopago_status IN ('pending', 'authorized', 'paused', 'cancelled', 'completed')),
ADD COLUMN IF NOT EXISTS mercadopago_init_point TEXT,
ADD COLUMN IF NOT EXISTS mercadopago_last_webhook_date TIMESTAMP WITH TIME ZONE;

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_profiles_mercadopago_subscription_id ON public.profiles(mercadopago_subscription_id);
CREATE INDEX IF NOT EXISTS idx_profiles_mercadopago_status ON public.profiles(mercadopago_status);

-- Comentários para documentação
COMMENT ON COLUMN public.profiles.mercadopago_subscription_id IS 'ID da assinatura no Mercado Pago';
COMMENT ON COLUMN public.profiles.mercadopago_payer_id IS 'ID do pagador no Mercado Pago';
COMMENT ON COLUMN public.profiles.mercadopago_payment_id IS 'ID do último pagamento processado';
COMMENT ON COLUMN public.profiles.mercadopago_preapproval_id IS 'ID do pré-aprovamento (para assinaturas recorrentes)';
COMMENT ON COLUMN public.profiles.mercadopago_status IS 'Status da assinatura no Mercado Pago: pending, authorized, paused, cancelled, completed';
COMMENT ON COLUMN public.profiles.mercadopago_init_point IS 'URL de inicialização do pagamento';
COMMENT ON COLUMN public.profiles.mercadopago_last_webhook_date IS 'Data do último webhook recebido do Mercado Pago';

-- Criar tabela para histórico de pagamentos do Mercado Pago
CREATE TABLE IF NOT EXISTS public.mercadopago_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mercadopago_payment_id TEXT NOT NULL UNIQUE,
  mercadopago_subscription_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled', 'refunded', 'charged_back')),
  payment_type TEXT,
  payment_method_id TEXT,
  transaction_amount DECIMAL(10, 2) NOT NULL,
  currency_id TEXT DEFAULT 'BRL',
  description TEXT,
  external_reference TEXT,
  date_created TIMESTAMP WITH TIME ZONE,
  date_approved TIMESTAMP WITH TIME ZONE,
  date_last_updated TIMESTAMP WITH TIME ZONE,
  webhook_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Criar índices para a tabela de pagamentos
CREATE INDEX IF NOT EXISTS idx_mercadopago_payments_user_id ON public.mercadopago_payments(user_id);
CREATE INDEX IF NOT EXISTS idx_mercadopago_payments_payment_id ON public.mercadopago_payments(mercadopago_payment_id);
CREATE INDEX IF NOT EXISTS idx_mercadopago_payments_subscription_id ON public.mercadopago_payments(mercadopago_subscription_id);
CREATE INDEX IF NOT EXISTS idx_mercadopago_payments_status ON public.mercadopago_payments(status);

-- Habilitar RLS na tabela de pagamentos
ALTER TABLE public.mercadopago_payments ENABLE ROW LEVEL SECURITY;

-- Política: Usuários podem ver seus próprios pagamentos
CREATE POLICY "Users can view their own payments"
  ON public.mercadopago_payments FOR SELECT
  USING (user_id = auth.uid());

-- Política: Sistema pode inserir/atualizar pagamentos (via webhook)
CREATE POLICY "System can manage payments"
  ON public.mercadopago_payments FOR ALL
  USING (true)
  WITH CHECK (true);

-- Comentários para a tabela de pagamentos
COMMENT ON TABLE public.mercadopago_payments IS 'Histórico de pagamentos processados pelo Mercado Pago';
COMMENT ON COLUMN public.mercadopago_payments.mercadopago_payment_id IS 'ID único do pagamento no Mercado Pago';
COMMENT ON COLUMN public.mercadopago_payments.webhook_data IS 'Dados completos recebidos do webhook do Mercado Pago';

