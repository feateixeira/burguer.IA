-- ============================================
-- MIGRATION: Adicionar suporte a formas de pagamento no cardápio online
-- ============================================

-- Garantir que a tabela orders tenha os campos necessários
DO $$
BEGIN
  -- Adicionar delivery_type se não existir (usar order_type se já existir)
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'orders' 
    AND column_name = 'delivery_type'
  ) THEN
    ALTER TABLE public.orders
    ADD COLUMN delivery_type TEXT;
    
    -- Preencher delivery_type baseado em order_type
    UPDATE public.orders
    SET delivery_type = CASE 
      WHEN order_type = 'delivery' THEN 'delivery'
      WHEN order_type = 'pickup' THEN 'pickup'
      ELSE order_type
    END;
  END IF;

  -- Garantir customer_phone existe (já deve existir)
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'orders' 
    AND column_name = 'customer_phone'
  ) THEN
    ALTER TABLE public.orders
    ADD COLUMN customer_phone TEXT;
  END IF;

  -- Primeiro, remover constraint antigo se existir (para permitir UPDATE)
  IF EXISTS (
    SELECT FROM information_schema.table_constraints 
    WHERE constraint_name = 'orders_payment_method_check' 
    AND table_name = 'orders'
  ) THEN
    ALTER TABLE public.orders
    DROP CONSTRAINT orders_payment_method_check;
  END IF;

  -- Normalizar valores existentes de payment_method
  -- Mapear valores antigos/incompatíveis para valores válidos
  UPDATE public.orders
  SET payment_method = CASE
    WHEN payment_method = 'cartao credito/debito' THEN 'cartao_debito'
    WHEN payment_method = 'cartao_credito_debito' THEN 'cartao_debito'
    WHEN payment_method = 'cash' THEN 'dinheiro'
    WHEN payment_method = 'money' THEN 'dinheiro'
    WHEN payment_method = 'credito' THEN 'cartao_credito'
    WHEN payment_method = 'debito' THEN 'cartao_debito'
    WHEN payment_method = 'card' THEN 'cartao_debito'
    WHEN payment_method IS NULL THEN NULL
    -- Se já for um valor válido, mantém
    WHEN payment_method IN (
      'dinheiro', 'pix', 'cartao_credito', 'cartao_debito', 
      'online', 'whatsapp', 'balcao'
    ) THEN payment_method
    -- Para qualquer outro valor desconhecido, definir como 'online' (padrão genérico)
    ELSE 'online'
  END
  WHERE payment_method IS NOT NULL 
     AND payment_method NOT IN (
       'dinheiro', 'pix', 'cartao_credito', 'cartao_debito', 
       'online', 'whatsapp', 'balcao'
     )
     OR payment_method IN (
       'cartao credito/debito', 'cartao_credito_debito', 
       'cash', 'money', 'credito', 'debito', 'card'
     );

  -- Criar novo constraint mais permissivo
  ALTER TABLE public.orders
  ADD CONSTRAINT orders_payment_method_check 
  CHECK (payment_method IS NULL OR payment_method IN (
    'dinheiro', 'pix', 'cartao_credito', 'cartao_debito', 
    'online', 'whatsapp', 'balcao'
  ));
END $$;

-- Adicionar pix_key simples em establishments (para usar na mensagem WhatsApp)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'establishments' 
    AND column_name = 'pix_key'
  ) THEN
    ALTER TABLE public.establishments
    ADD COLUMN pix_key TEXT;
    
    -- Preencher com pix_key_value se existir
    IF EXISTS (
      SELECT FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'establishments' 
      AND column_name = 'pix_key_value'
    ) THEN
      UPDATE public.establishments
      SET pix_key = pix_key_value
      WHERE pix_key_value IS NOT NULL AND pix_key IS NULL;
    END IF;
  END IF;
END $$;

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_orders_establishment_created_at 
ON public.orders(establishment_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_payment_method 
ON public.orders(establishment_id, payment_method) 
WHERE payment_method IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_delivery_type 
ON public.orders(establishment_id, delivery_type) 
WHERE delivery_type IS NOT NULL;

-- RLS: Permitir leitura da pix_key para usuários autenticados do estabelecimento
DROP POLICY IF EXISTS "Users can view pix_key from their establishment" ON public.establishments;

CREATE POLICY "Users can view pix_key from their establishment"
  ON public.establishments FOR SELECT
  USING (
    id IN (
      SELECT establishment_id FROM public.profiles WHERE user_id = auth.uid()
    )
  );

