-- ============================================
-- TABELA DE TRANSAÇÕES DE CAIXA
-- Sangria (retirada) e Suprimento (adição)
-- ============================================

-- Garantir que cash_sessions existe antes de criar a foreign key
-- Se não existir, criar a tabela básica
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename = 'cash_sessions'
  ) THEN
    -- Criar tabela cash_sessions básica se não existir
    CREATE TABLE public.cash_sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      establishment_id UUID NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
      opened_by UUID NOT NULL REFERENCES auth.users(id),
      opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      opening_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
      closed_by UUID REFERENCES auth.users(id),
      closed_at TIMESTAMPTZ,
      closing_amount DECIMAL(10, 2),
      expected_amount DECIMAL(10, 2),
      difference_amount DECIMAL(10, 2),
      notes TEXT,
      is_admin_session BOOLEAN NOT NULL DEFAULT false,
      status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS idx_cash_sessions_establishment ON public.cash_sessions(establishment_id);
    CREATE INDEX IF NOT EXISTS idx_cash_sessions_status ON public.cash_sessions(status);
    CREATE INDEX IF NOT EXISTS idx_cash_sessions_opened_by ON public.cash_sessions(opened_by);

    ALTER TABLE public.cash_sessions ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Criar políticas RLS básicas para cash_sessions (se não existirem)
DO $$
BEGIN
  -- Política de SELECT
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'cash_sessions' 
    AND policyname = 'Users can view sessions from their establishment'
  ) THEN
    CREATE POLICY "Users can view sessions from their establishment"
      ON public.cash_sessions FOR SELECT
      USING (
        establishment_id IN (
          SELECT establishment_id FROM public.profiles WHERE user_id = auth.uid()
        )
      );
  END IF;

  -- Política de INSERT
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'cash_sessions' 
    AND policyname = 'Users can create sessions'
  ) THEN
    CREATE POLICY "Users can create sessions"
      ON public.cash_sessions FOR INSERT
      WITH CHECK (
        establishment_id IN (
          SELECT establishment_id FROM public.profiles WHERE user_id = auth.uid()
        )
      );
  END IF;

  -- Política de UPDATE
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'cash_sessions' 
    AND policyname = 'Users can update sessions'
  ) THEN
    CREATE POLICY "Users can update sessions"
      ON public.cash_sessions FOR UPDATE
      USING (
        opened_by = auth.uid() OR
        establishment_id IN (
          SELECT establishment_id FROM public.profiles 
          WHERE user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- Agora criar cash_transactions com referência segura
CREATE TABLE IF NOT EXISTS public.cash_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cash_session_id UUID NOT NULL REFERENCES public.cash_sessions(id) ON DELETE CASCADE,
  establishment_id UUID NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('withdraw', 'deposit')),
  amount DECIMAL(10, 2) NOT NULL,
  description TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cash_transactions_session ON public.cash_transactions(cash_session_id);
CREATE INDEX IF NOT EXISTS idx_cash_transactions_establishment ON public.cash_transactions(establishment_id);
CREATE INDEX IF NOT EXISTS idx_cash_transactions_type ON public.cash_transactions(type);
CREATE INDEX IF NOT EXISTS idx_cash_transactions_created_at ON public.cash_transactions(created_at);

ALTER TABLE public.cash_transactions ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para cash_transactions
DROP POLICY IF EXISTS "Users can view cash transactions from their establishment" ON public.cash_transactions;
CREATE POLICY "Users can view cash transactions from their establishment"
  ON public.cash_transactions FOR SELECT
  USING (
    establishment_id IN (
      SELECT establishment_id FROM public.profiles WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can create cash transactions" ON public.cash_transactions;
CREATE POLICY "Users can create cash transactions"
  ON public.cash_transactions FOR INSERT
  WITH CHECK (
    establishment_id IN (
      SELECT establishment_id FROM public.profiles WHERE user_id = auth.uid()
    )
  );

-- ============================================
-- ADICIONAR CAMPO PARA CONTAGEM POR MEIO DE PAGAMENTO NO FECHAMENTO
-- ============================================

-- Adicionar campo payment_method_counts se não existir
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'cash_sessions' 
    AND column_name = 'payment_method_counts'
  ) THEN
    ALTER TABLE public.cash_sessions
    ADD COLUMN payment_method_counts JSONB DEFAULT '{}';
  END IF;
END $$;

-- Este campo armazenará contagens por método de pagamento no fechamento
-- Exemplo: {"dinheiro": 150.00, "pix": 200.00, "cartao_debito": 100.00}

