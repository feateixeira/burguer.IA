-- ============================================
-- REFATORAÇÃO: FECHAMENTO DE CAIXA AUTOMÁTICO
-- Adiciona campos para cálculo automático de totais esperados
-- ============================================

-- ============================================
-- 1. ADICIONAR CAMPOS NOVOS EM cash_sessions
-- ============================================
DO $$ 
BEGIN
  -- counted_cash: dinheiro contado pelo operador
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'cash_sessions' 
    AND column_name = 'counted_cash'
  ) THEN
    ALTER TABLE public.cash_sessions
    ADD COLUMN counted_cash DECIMAL(12, 2);
  END IF;

  -- expected_cash: dinheiro esperado (opening + vendas em dinheiro)
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'cash_sessions' 
    AND column_name = 'expected_cash'
  ) THEN
    ALTER TABLE public.cash_sessions
    ADD COLUMN expected_cash DECIMAL(12, 2);
  END IF;

  -- expected_pix: total esperado em PIX
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'cash_sessions' 
    AND column_name = 'expected_pix'
  ) THEN
    ALTER TABLE public.cash_sessions
    ADD COLUMN expected_pix DECIMAL(12, 2);
  END IF;

  -- expected_debit: total esperado em débito
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'cash_sessions' 
    AND column_name = 'expected_debit'
  ) THEN
    ALTER TABLE public.cash_sessions
    ADD COLUMN expected_debit DECIMAL(12, 2);
  END IF;

  -- expected_credit: total esperado em crédito
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'cash_sessions' 
    AND column_name = 'expected_credit'
  ) THEN
    ALTER TABLE public.cash_sessions
    ADD COLUMN expected_credit DECIMAL(12, 2);
  END IF;

  -- expected_total: soma de todos os métodos
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'cash_sessions' 
    AND column_name = 'expected_total'
  ) THEN
    ALTER TABLE public.cash_sessions
    ADD COLUMN expected_total DECIMAL(12, 2);
  END IF;

  -- Renomear campos se necessário (para manter compatibilidade)
  -- Nota: difference_amount já existe, vamos manter
END $$;

-- ============================================
-- 2. CRIAR/ATUALIZAR TABELA audit_logs
-- ============================================
-- Verificar se tabela existe e adaptar estrutura
DO $$
BEGIN
  -- Se a tabela não existe, criar
  IF NOT EXISTS (
    SELECT FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename = 'audit_logs'
  ) THEN
    CREATE TABLE public.audit_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      establishment_id UUID NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
      actor_id UUID NOT NULL REFERENCES auth.users(id),
      event TEXT NOT NULL, -- 'cash.open', 'cash.close', etc.
      payload JSONB NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  ELSE
    -- Tabela existe, adicionar colunas que faltam
    -- Adicionar actor_id se não existir (pode ser que tenha user_id)
    IF NOT EXISTS (
      SELECT FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'audit_logs' 
      AND column_name = 'actor_id'
    ) THEN
      -- Se tiver user_id, renomear para actor_id; senão, criar
      IF EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'audit_logs' 
        AND column_name = 'user_id'
      ) THEN
        ALTER TABLE public.audit_logs 
        RENAME COLUMN user_id TO actor_id;
      ELSE
        ALTER TABLE public.audit_logs
        ADD COLUMN actor_id UUID REFERENCES auth.users(id);
      END IF;
    END IF;

    -- Adicionar event se não existir
    IF NOT EXISTS (
      SELECT FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'audit_logs' 
      AND column_name = 'event'
    ) THEN
      ALTER TABLE public.audit_logs
      ADD COLUMN event TEXT;
      
      -- Se tiver action, migrar para event
      IF EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'audit_logs' 
        AND column_name = 'action'
      ) THEN
        UPDATE public.audit_logs 
        SET event = action::TEXT 
        WHERE event IS NULL;
        
        -- Se ainda houver NULLs, preencher com 'unknown'
        UPDATE public.audit_logs 
        SET event = 'unknown' 
        WHERE event IS NULL;
      ELSE
        -- Não tem action, preencher todos com 'unknown'
        UPDATE public.audit_logs 
        SET event = 'unknown' 
        WHERE event IS NULL;
      END IF;
      
      -- Agora tornar NOT NULL
      ALTER TABLE public.audit_logs
      ALTER COLUMN event SET NOT NULL;
      
      -- Tornar action nullable se existir (para compatibilidade)
      IF EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'audit_logs' 
        AND column_name = 'action'
      ) THEN
        -- Tornar nullable para evitar conflitos
        ALTER TABLE public.audit_logs
        ALTER COLUMN action DROP NOT NULL;
        
        -- Preencher action com event para manter compatibilidade temporária
        UPDATE public.audit_logs
        SET action = event
        WHERE action IS NULL;
      END IF;
      
      -- Tornar table_name nullable se existir (para compatibilidade)
      IF EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'audit_logs' 
        AND column_name = 'table_name'
      ) THEN
        -- Tornar nullable para evitar conflitos
        ALTER TABLE public.audit_logs
        ALTER COLUMN table_name DROP NOT NULL;
        
        -- Preencher table_name com valor padrão baseado no event
        UPDATE public.audit_logs
        SET table_name = CASE 
          WHEN event LIKE 'cash.%' THEN 'cash_sessions'
          WHEN event LIKE 'order.%' THEN 'orders'
          ELSE 'general'
        END
        WHERE table_name IS NULL;
      END IF;
    END IF;

    -- Adicionar payload se não existir
    IF NOT EXISTS (
      SELECT FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'audit_logs' 
      AND column_name = 'payload'
    ) THEN
      ALTER TABLE public.audit_logs
      ADD COLUMN payload JSONB DEFAULT '{}';
      
      -- Se tiver old_values e new_values, combinar em payload
      IF EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'audit_logs' 
        AND column_name = 'old_values'
      ) AND EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'audit_logs' 
        AND column_name = 'new_values'
      ) THEN
        UPDATE public.audit_logs 
        SET payload = jsonb_build_object(
          'old_values', COALESCE(old_values, '{}'::jsonb),
          'new_values', COALESCE(new_values, '{}'::jsonb)
        )
        WHERE payload = '{}'::jsonb;
      END IF;
    END IF;

    -- Preencher valores NULL de actor_id (event já foi tratado acima)
    -- Se actor_id for NULL, tentar usar user_id (se existir)
    IF EXISTS (
      SELECT FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'audit_logs' 
      AND column_name = 'user_id'
    ) THEN
      UPDATE public.audit_logs 
      SET actor_id = user_id 
      WHERE actor_id IS NULL AND user_id IS NOT NULL;
    END IF;
    
    -- Tornar actor_id NOT NULL apenas se não houver NULLs
    IF EXISTS (
      SELECT 1 FROM public.audit_logs WHERE actor_id IS NULL
    ) THEN
      -- Ainda há NULLs, deixar nullable por enquanto
      RAISE NOTICE 'Tabela audit_logs tem valores NULL em actor_id. Campo permanecerá nullable até migração manual.';
    ELSE
      -- Todos os valores preenchidos, pode tornar NOT NULL
      ALTER TABLE public.audit_logs
      ALTER COLUMN actor_id SET NOT NULL;
    END IF;

    ALTER TABLE public.audit_logs
    ALTER COLUMN payload SET DEFAULT '{}';
  END IF;
  
  -- GARANTIR que as colunas event e actor_id existam antes de continuar
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'audit_logs' 
    AND column_name = 'event'
  ) THEN
    RAISE EXCEPTION 'Coluna event não foi criada corretamente na tabela audit_logs';
  END IF;
  
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'audit_logs' 
    AND column_name = 'actor_id'
  ) THEN
    RAISE EXCEPTION 'Coluna actor_id não foi criada corretamente na tabela audit_logs';
  END IF;
END $$;

-- Criar índices se não existirem (dentro do bloco para garantir colunas existem)
DO $$
BEGIN
  -- Índice de establishment (sempre existe)
  IF NOT EXISTS (
    SELECT FROM pg_indexes 
    WHERE schemaname = 'public' 
    AND tablename = 'audit_logs' 
    AND indexname = 'idx_audit_logs_establishment'
  ) THEN
    CREATE INDEX idx_audit_logs_establishment ON public.audit_logs(establishment_id);
  END IF;

  -- Índice de event (só se coluna existir)
  IF EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'audit_logs' 
    AND column_name = 'event'
  ) AND NOT EXISTS (
    SELECT FROM pg_indexes 
    WHERE schemaname = 'public' 
    AND tablename = 'audit_logs' 
    AND indexname = 'idx_audit_logs_event'
  ) THEN
    CREATE INDEX idx_audit_logs_event ON public.audit_logs(event);
  END IF;

  -- Índice de created_at
  IF NOT EXISTS (
    SELECT FROM pg_indexes 
    WHERE schemaname = 'public' 
    AND tablename = 'audit_logs' 
    AND indexname = 'idx_audit_logs_created_at'
  ) THEN
    CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
  END IF;

  -- Índice de actor_id (só se coluna existir)
  IF EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'audit_logs' 
    AND column_name = 'actor_id'
  ) AND NOT EXISTS (
    SELECT FROM pg_indexes 
    WHERE schemaname = 'public' 
    AND tablename = 'audit_logs' 
    AND indexname = 'idx_audit_logs_actor'
  ) THEN
    CREATE INDEX idx_audit_logs_actor ON public.audit_logs(actor_id);
  END IF;
END $$;

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view audit logs from their establishment" ON public.audit_logs;
CREATE POLICY "Users can view audit logs from their establishment"
  ON public.audit_logs FOR SELECT
  USING (
    establishment_id IN (
      SELECT establishment_id FROM public.profiles WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "System can create audit logs" ON public.audit_logs;
CREATE POLICY "System can create audit logs"
  ON public.audit_logs FOR INSERT
  WITH CHECK (
    establishment_id IN (
      SELECT establishment_id FROM public.profiles WHERE user_id = auth.uid()
    )
    AND actor_id = auth.uid()
  );

-- ============================================
-- 3. FUNÇÃO: CALCULAR TOTAIS ESPERADOS DA SESSÃO
-- ============================================
-- Dropar função existente se houver (para permitir mudança de tipo de retorno)
DROP FUNCTION IF EXISTS public.compute_cash_session_totals(UUID);

CREATE FUNCTION public.compute_cash_session_totals(
  p_session_id UUID
)
RETURNS TABLE (
  expected_cash NUMERIC,
  expected_pix NUMERIC,
  expected_debit NUMERIC,
  expected_credit NUMERIC,
  expected_total NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session RECORD;
  v_opening_amount NUMERIC;
BEGIN
  -- Buscar sessão
  SELECT cs.* INTO v_session
  FROM public.cash_sessions cs
  WHERE cs.id = p_session_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sessão não encontrada';
  END IF;

  v_opening_amount := COALESCE(v_session.opening_amount, 0);

  -- Calcular totais por método de pagamento
  -- Usa apenas pedidos com status 'paid' no período da sessão
  SELECT 
    v_opening_amount + COALESCE(SUM(o.total_amount) FILTER (
      WHERE (o.payment_method = 'dinheiro' OR o.payment_method = 'cash')
      AND o.payment_status = 'paid'
      AND o.created_at >= v_session.opened_at
      AND o.created_at < COALESCE(v_session.closed_at, now())
    ), 0),
    COALESCE(SUM(o.total_amount) FILTER (
      WHERE o.payment_method = 'pix' 
      AND o.payment_status = 'paid'
      AND o.created_at >= v_session.opened_at
      AND o.created_at < COALESCE(v_session.closed_at, now())
    ), 0),
    -- Cartão débito: busca por "cartao_debito" ou "cartao credito/debito" (para compatibilidade)
    COALESCE(SUM(o.total_amount) FILTER (
      WHERE (o.payment_method = 'cartao_debito' OR o.payment_method = 'cartao credito/debito')
      AND o.payment_status = 'paid'
      AND o.created_at >= v_session.opened_at
      AND o.created_at < COALESCE(v_session.closed_at, now())
    ), 0),
    -- Cartão crédito: busca por "cartao_credito"
    COALESCE(SUM(o.total_amount) FILTER (
      WHERE o.payment_method = 'cartao_credito'
      AND o.payment_status = 'paid'
      AND o.created_at >= v_session.opened_at
      AND o.created_at < COALESCE(v_session.closed_at, now())
    ), 0)
  INTO expected_cash, expected_pix, expected_debit, expected_credit
  FROM public.orders o
  WHERE o.establishment_id = v_session.establishment_id
    AND o.status != 'cancelled';

  -- Se não houver vendas, expected_cash = opening_amount
  IF expected_cash IS NULL THEN
    expected_cash := v_opening_amount;
    expected_pix := 0;
    expected_debit := 0;
    expected_credit := 0;
  END IF;

  -- Calcular total esperado
  expected_total := expected_cash + expected_pix + expected_debit + expected_credit;

  RETURN QUERY SELECT expected_cash, expected_pix, expected_debit, expected_credit, expected_total;
END;
$$;

-- ============================================
-- 4. FUNÇÃO: BUSCAR SESSÃO ABERTA
-- ============================================
-- Dropar função existente se houver (caso tenha mudado a assinatura)
DROP FUNCTION IF EXISTS public.get_open_cash_session(UUID);

CREATE FUNCTION public.get_open_cash_session(
  p_establishment_id UUID
)
RETURNS TABLE (
  id UUID,
  establishment_id UUID,
  opened_by UUID,
  opened_at TIMESTAMPTZ,
  opening_amount NUMERIC,
  status TEXT,
  expected_cash NUMERIC,
  expected_pix NUMERIC,
  expected_debit NUMERIC,
  expected_credit NUMERIC,
  expected_total NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session RECORD;
  v_totals RECORD;
BEGIN
  -- Buscar sessão aberta
  SELECT cs.* INTO v_session
  FROM public.cash_sessions cs
  WHERE cs.establishment_id = p_establishment_id
    AND cs.status = 'open'
  ORDER BY cs.opened_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN; -- Retorna vazio se não houver sessão aberta
  END IF;

  -- Calcular totais esperados
  SELECT * INTO v_totals
  FROM public.compute_cash_session_totals(v_session.id);

  RETURN QUERY SELECT 
    v_session.id,
    v_session.establishment_id,
    v_session.opened_by,
    v_session.opened_at,
    v_session.opening_amount,
    v_session.status,
    v_totals.expected_cash,
    v_totals.expected_pix,
    v_totals.expected_debit,
    v_totals.expected_credit,
    v_totals.expected_total;
END;
$$;

-- ============================================
-- 5. FUNÇÃO: FECHAR CAIXA COM CÁLCULO AUTOMÁTICO
-- ============================================
-- Dropar função existente se houver (caso tenha mudado a assinatura)
DROP FUNCTION IF EXISTS public.close_cash_session(UUID, UUID, NUMERIC, TEXT);
DROP FUNCTION IF EXISTS public.close_cash_session(UUID, UUID, NUMERIC, TEXT, NUMERIC, NUMERIC);

CREATE FUNCTION public.close_cash_session(
  p_session_id UUID,
  p_closed_by UUID,
  p_counted_cash NUMERIC,
  p_note TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session RECORD;
  v_totals RECORD;
  v_difference NUMERIC;
  v_audit_id UUID;
  v_has_action BOOLEAN;
  v_has_table_name BOOLEAN;
BEGIN
  -- Buscar sessão
  SELECT * INTO v_session
  FROM public.cash_sessions
  WHERE id = p_session_id AND status = 'open';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sessão não encontrada ou já fechada';
  END IF;

  -- Calcular totais esperados
  SELECT * INTO v_totals
  FROM public.compute_cash_session_totals(p_session_id);

  -- Calcular diferença
  -- difference = (counted_cash + expected_pix + expected_debit + expected_credit) - expected_total
  v_difference := (COALESCE(p_counted_cash, 0) + COALESCE(v_totals.expected_pix, 0) + COALESCE(v_totals.expected_debit, 0) + COALESCE(v_totals.expected_credit, 0)) - COALESCE(v_totals.expected_total, 0);

  -- Validar observação obrigatória se houver diferença
  IF v_difference != 0 AND (p_note IS NULL OR TRIM(p_note) = '') THEN
    RAISE EXCEPTION 'Observação obrigatória quando há diferença';
  END IF;

  -- Atualizar sessão
  UPDATE public.cash_sessions
  SET 
    closed_by = p_closed_by,
    closed_at = now(),
    counted_cash = p_counted_cash,
    expected_cash = COALESCE(v_totals.expected_cash, 0),
    expected_pix = COALESCE(v_totals.expected_pix, 0),
    expected_debit = COALESCE(v_totals.expected_debit, 0),
    expected_credit = COALESCE(v_totals.expected_credit, 0),
    expected_total = COALESCE(v_totals.expected_total, 0),
    expected_amount = COALESCE(v_totals.expected_total, 0), -- Mantém compatibilidade
    difference_amount = v_difference,
    notes = p_note,
    status = 'closed',
    updated_at = now()
  WHERE id = p_session_id;

  -- Criar audit log
  -- Verificar quais colunas existem para compatibilidade
  SELECT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'audit_logs' 
    AND column_name = 'action'
  ) INTO v_has_action;
  
  SELECT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'audit_logs' 
    AND column_name = 'table_name'
  ) INTO v_has_table_name;
  
  -- Montar INSERT dinâmico baseado nas colunas existentes
  IF v_has_action AND v_has_table_name THEN
      -- Estrutura antiga completa
      INSERT INTO public.audit_logs (
        establishment_id,
        actor_id,
        event,
        action,
        table_name,
        payload
      ) VALUES (
        v_session.establishment_id,
        p_closed_by,
        'cash.close',
        'cash.close',
        'cash_sessions',
        jsonb_build_object(
          'session_id', p_session_id,
          'counted_cash', p_counted_cash,
          'expected_cash', v_totals.expected_cash,
          'expected_pix', v_totals.expected_pix,
          'expected_debit', v_totals.expected_debit,
          'expected_credit', v_totals.expected_credit,
          'expected_total', v_totals.expected_total,
          'difference', v_difference,
          'note', p_note
        )
      )
      RETURNING id INTO v_audit_id;
    ELSIF v_has_action THEN
      -- Tem action mas não table_name
      INSERT INTO public.audit_logs (
        establishment_id,
        actor_id,
        event,
        action,
        payload
      ) VALUES (
        v_session.establishment_id,
        p_closed_by,
        'cash.close',
        'cash.close',
        jsonb_build_object(
          'session_id', p_session_id,
          'counted_cash', p_counted_cash,
          'expected_cash', v_totals.expected_cash,
          'expected_pix', v_totals.expected_pix,
          'expected_debit', v_totals.expected_debit,
          'expected_credit', v_totals.expected_credit,
          'expected_total', v_totals.expected_total,
          'difference', v_difference,
          'note', p_note
        )
      )
      RETURNING id INTO v_audit_id;
    ELSIF v_has_table_name THEN
      -- Tem table_name mas não action
      INSERT INTO public.audit_logs (
        establishment_id,
        actor_id,
        event,
        table_name,
        payload
      ) VALUES (
        v_session.establishment_id,
        p_closed_by,
        'cash.close',
        'cash_sessions',
        jsonb_build_object(
          'session_id', p_session_id,
          'counted_cash', p_counted_cash,
          'expected_cash', v_totals.expected_cash,
          'expected_pix', v_totals.expected_pix,
          'expected_debit', v_totals.expected_debit,
          'expected_credit', v_totals.expected_credit,
          'expected_total', v_totals.expected_total,
          'difference', v_difference,
          'note', p_note
        )
      )
      RETURNING id INTO v_audit_id;
    ELSE
      -- Estrutura nova (apenas event e payload)
      INSERT INTO public.audit_logs (
        establishment_id,
        actor_id,
        event,
        payload
      ) VALUES (
        v_session.establishment_id,
        p_closed_by,
        'cash.close',
        jsonb_build_object(
          'session_id', p_session_id,
          'counted_cash', p_counted_cash,
          'expected_cash', v_totals.expected_cash,
          'expected_pix', v_totals.expected_pix,
          'expected_debit', v_totals.expected_debit,
          'expected_credit', v_totals.expected_credit,
          'expected_total', v_totals.expected_total,
          'difference', v_difference,
          'note', p_note
        )
      )
      RETURNING id INTO v_audit_id;
  END IF;

  RETURN v_audit_id;
END;
$$;

-- ============================================
-- 6. FUNÇÃO: VERIFICAR SE HÁ CAIXA ABERTO
-- ============================================
CREATE OR REPLACE FUNCTION public.has_open_cash_session(
  p_establishment_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.cash_sessions
    WHERE establishment_id = p_establishment_id
      AND status = 'open'
  );
END;
$$;

-- ============================================
-- GRANTS
-- ============================================
GRANT EXECUTE ON FUNCTION public.compute_cash_session_totals(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_open_cash_session(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.close_cash_session(UUID, UUID, NUMERIC, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_open_cash_session(UUID) TO authenticated;

