-- ============================================
-- FECHAMENTO CEGO DE CAIXA PARA ATENDENTES
-- Adiciona campos de contagem e status pending_review
-- ============================================

-- 1. Adicionar campos de contagem para todos os métodos de pagamento
DO $$ 
BEGIN
  -- counted_pix: PIX contado pelo operador
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'cash_sessions' 
    AND column_name = 'counted_pix'
  ) THEN
    ALTER TABLE public.cash_sessions
    ADD COLUMN counted_pix DECIMAL(12, 2);
  END IF;

  -- counted_debit: Débito contado pelo operador
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'cash_sessions' 
    AND column_name = 'counted_debit'
  ) THEN
    ALTER TABLE public.cash_sessions
    ADD COLUMN counted_debit DECIMAL(12, 2);
  END IF;

  -- counted_credit: Crédito contado pelo operador
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'cash_sessions' 
    AND column_name = 'counted_credit'
  ) THEN
    ALTER TABLE public.cash_sessions
    ADD COLUMN counted_credit DECIMAL(12, 2);
  END IF;
END $$;

-- 2. Modificar constraint de status para incluir 'pending_review'
DO $$
BEGIN
  -- Remover constraint antigo se existir
  ALTER TABLE public.cash_sessions 
  DROP CONSTRAINT IF EXISTS cash_sessions_status_check;
  
  -- Adicionar novo constraint com 'pending_review'
  ALTER TABLE public.cash_sessions
  ADD CONSTRAINT cash_sessions_status_check 
  CHECK (status IN ('open', 'closed', 'pending_review'));
END $$;

-- 3. Atualizar função close_cash_session para suportar fechamento por atendente
-- Primeiro, remover todas as versões antigas da função se existirem
DO $$
DECLARE
  r RECORD;
BEGIN
  -- Buscar todas as versões da função close_cash_session
  FOR r IN 
    SELECT 
      p.proname,
      pg_get_function_identity_arguments(p.oid) as args
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' 
      AND p.proname = 'close_cash_session'
  LOOP
    -- Remover cada versão encontrada
    EXECUTE format('DROP FUNCTION IF EXISTS public.%I(%s)', r.proname, r.args);
  END LOOP;
EXCEPTION
  WHEN OTHERS THEN
    -- Ignorar erros se a função não existir
    NULL;
END $$;

CREATE OR REPLACE FUNCTION public.close_cash_session(
  p_session_id UUID,
  p_closed_by UUID,
  p_counted_cash NUMERIC,
  p_note TEXT DEFAULT NULL,
  p_counted_pix NUMERIC DEFAULT NULL,
  p_counted_debit NUMERIC DEFAULT NULL,
  p_counted_credit NUMERIC DEFAULT NULL,
  p_is_attendant BOOLEAN DEFAULT false
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
  v_final_status TEXT;
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

  -- Se for atendente, marcar como pending_review
  -- Se for master/admin, marcar como closed
  IF p_is_attendant THEN
    v_final_status := 'pending_review';
  ELSE
    v_final_status := 'closed';
  END IF;

  -- Calcular diferença
  -- Para atendente: diferença será calculada na conferência
  -- Para master/admin: calcular normalmente
  IF p_is_attendant THEN
    -- Para atendente, não calcular diferença ainda (será calculada na conferência)
    v_difference := NULL;
  ELSE
    -- Para master/admin, calcular diferença normalmente
    v_difference := (COALESCE(p_counted_cash, 0) + 
                     COALESCE(p_counted_pix, 0) + 
                     COALESCE(p_counted_debit, 0) + 
                     COALESCE(p_counted_credit, 0)) - 
                    COALESCE(v_totals.expected_total, 0);
    
    -- Validar observação obrigatória se houver diferença
    IF v_difference != 0 AND (p_note IS NULL OR TRIM(p_note) = '') THEN
      RAISE EXCEPTION 'Observação obrigatória quando há diferença';
    END IF;
  END IF;

  -- Atualizar sessão
  UPDATE public.cash_sessions
  SET 
    closed_by = p_closed_by,
    closed_at = now(),
    counted_cash = p_counted_cash,
    counted_pix = COALESCE(p_counted_pix, 0),
    counted_debit = COALESCE(p_counted_debit, 0),
    counted_credit = COALESCE(p_counted_credit, 0),
    expected_cash = COALESCE(v_totals.expected_cash, 0),
    expected_pix = COALESCE(v_totals.expected_pix, 0),
    expected_debit = COALESCE(v_totals.expected_debit, 0),
    expected_credit = COALESCE(v_totals.expected_credit, 0),
    expected_total = COALESCE(v_totals.expected_total, 0),
    expected_amount = COALESCE(v_totals.expected_total, 0), -- Mantém compatibilidade
    difference_amount = v_difference,
    notes = p_note,
    status = v_final_status,
    updated_at = now()
  WHERE id = p_session_id;

  -- Criar audit log
  -- Verificar quais colunas existem para compatibilidade
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'audit_logs' 
    AND column_name = 'action'
  ) INTO v_has_action;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'audit_logs' 
    AND column_name = 'table_name'
  ) INTO v_has_table_name;

  -- Buscar establishment_id da sessão
  SELECT establishment_id INTO v_audit_id FROM public.cash_sessions WHERE id = p_session_id;

  IF v_has_action AND v_has_table_name THEN
    INSERT INTO public.audit_logs (
      establishment_id,
      actor_id,
      event,
      action,
      table_name,
      payload
    ) VALUES (
      v_audit_id,
      p_closed_by,
      'cash.close',
      'cash.close',
      'cash_sessions',
      jsonb_build_object(
        'session_id', p_session_id,
        'counted_cash', p_counted_cash,
        'counted_pix', p_counted_pix,
        'counted_debit', p_counted_debit,
        'counted_credit', p_counted_credit,
        'status', v_final_status,
        'is_attendant', p_is_attendant,
        'notes', p_note
      )
    );
  ELSIF v_has_action THEN
    INSERT INTO public.audit_logs (
      establishment_id,
      actor_id,
      event,
      action,
      payload
    ) VALUES (
      v_audit_id,
      p_closed_by,
      'cash.close',
      'cash.close',
      jsonb_build_object(
        'session_id', p_session_id,
        'counted_cash', p_counted_cash,
        'counted_pix', p_counted_pix,
        'counted_debit', p_counted_debit,
        'counted_credit', p_counted_credit,
        'status', v_final_status,
        'is_attendant', p_is_attendant,
        'notes', p_note
      )
    );
  ELSE
    INSERT INTO public.audit_logs (
      establishment_id,
      actor_id,
      event,
      payload
    ) VALUES (
      v_audit_id,
      p_closed_by,
      'cash.close',
      jsonb_build_object(
        'session_id', p_session_id,
        'counted_cash', p_counted_cash,
        'counted_pix', p_counted_pix,
        'counted_debit', p_counted_debit,
        'counted_credit', p_counted_credit,
        'status', v_final_status,
        'is_attendant', p_is_attendant,
        'notes', p_note
      )
    );
  END IF;

  RETURN p_session_id;
END;
$$;

-- 4. Criar função para validar fechamento (Master/Admin)
CREATE OR REPLACE FUNCTION public.validate_cash_session(
  p_session_id UUID,
  p_validated_by UUID,
  p_final_counted_cash NUMERIC DEFAULT NULL,
  p_final_counted_pix NUMERIC DEFAULT NULL,
  p_final_counted_debit NUMERIC DEFAULT NULL,
  p_final_counted_credit NUMERIC DEFAULT NULL,
  p_adjustment_note TEXT DEFAULT NULL
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
  v_counted_cash NUMERIC;
  v_counted_pix NUMERIC;
  v_counted_debit NUMERIC;
  v_counted_credit NUMERIC;
BEGIN
  -- Buscar sessão pendente
  SELECT * INTO v_session
  FROM public.cash_sessions
  WHERE id = p_session_id AND status = 'pending_review';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sessão não encontrada ou não está pendente de conferência';
  END IF;

  -- Usar valores ajustados se fornecidos, senão usar os valores originais
  v_counted_cash := COALESCE(p_final_counted_cash, v_session.counted_cash, 0);
  v_counted_pix := COALESCE(p_final_counted_pix, v_session.counted_pix, 0);
  v_counted_debit := COALESCE(p_final_counted_debit, v_session.counted_debit, 0);
  v_counted_credit := COALESCE(p_final_counted_credit, v_session.counted_credit, 0);

  -- Calcular totais esperados
  SELECT * INTO v_totals
  FROM public.compute_cash_session_totals(p_session_id);

  -- Calcular diferença final
  v_difference := (v_counted_cash + v_counted_pix + v_counted_debit + v_counted_credit) - 
                  COALESCE(v_totals.expected_total, 0);

  -- Atualizar sessão com valores finais
  UPDATE public.cash_sessions
  SET 
    closed_by = p_validated_by, -- Atualiza quem validou
    counted_cash = v_counted_cash,
    counted_pix = v_counted_pix,
    counted_debit = v_counted_debit,
    counted_credit = v_counted_credit,
    difference_amount = v_difference,
    notes = CASE 
      WHEN p_adjustment_note IS NOT NULL AND TRIM(p_adjustment_note) != '' THEN
        COALESCE(v_session.notes || E'\n\n--- Ajuste pelo Supervisor ---\n', '') || p_adjustment_note
      ELSE
        v_session.notes
    END,
    status = 'closed',
    updated_at = now()
  WHERE id = p_session_id;

  -- Criar audit log
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'audit_logs' 
    AND column_name = 'action'
  ) INTO v_has_action;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'audit_logs' 
    AND column_name = 'table_name'
  ) INTO v_has_table_name;

  SELECT establishment_id INTO v_audit_id FROM public.cash_sessions WHERE id = p_session_id;

  IF v_has_action AND v_has_table_name THEN
    INSERT INTO public.audit_logs (
      establishment_id,
      actor_id,
      event,
      action,
      table_name,
      payload
    ) VALUES (
      v_audit_id,
      p_validated_by,
      'cash.validate',
      'cash.validate',
      'cash_sessions',
      jsonb_build_object(
        'session_id', p_session_id,
        'final_counted_cash', v_counted_cash,
        'final_counted_pix', v_counted_pix,
        'final_counted_debit', v_counted_debit,
        'final_counted_credit', v_counted_credit,
        'difference', v_difference,
        'adjustment_note', p_adjustment_note
      )
    );
  ELSIF v_has_action THEN
    INSERT INTO public.audit_logs (
      establishment_id,
      actor_id,
      event,
      action,
      payload
    ) VALUES (
      v_audit_id,
      p_validated_by,
      'cash.validate',
      'cash.validate',
      jsonb_build_object(
        'session_id', p_session_id,
        'final_counted_cash', v_counted_cash,
        'final_counted_pix', v_counted_pix,
        'final_counted_debit', v_counted_debit,
        'final_counted_credit', v_counted_credit,
        'difference', v_difference,
        'adjustment_note', p_adjustment_note
      )
    );
  ELSE
    INSERT INTO public.audit_logs (
      establishment_id,
      actor_id,
      event,
      payload
    ) VALUES (
      v_audit_id,
      p_validated_by,
      'cash.validate',
      jsonb_build_object(
        'session_id', p_session_id,
        'final_counted_cash', v_counted_cash,
        'final_counted_pix', v_counted_pix,
        'final_counted_debit', v_counted_debit,
        'final_counted_credit', v_counted_credit,
        'difference', v_difference,
        'adjustment_note', p_adjustment_note
      )
    );
  END IF;

  RETURN p_session_id;
END;
$$;

-- 5. Grant permissions
GRANT EXECUTE ON FUNCTION public.close_cash_session TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_cash_session TO authenticated;

