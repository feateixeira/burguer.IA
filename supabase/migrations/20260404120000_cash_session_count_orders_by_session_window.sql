-- Pedidos finalizados (pronto/concluído) devem entrar no caixa da sessão em que foram concluídos,
-- mesmo que tenham sido criados antes da abertura do caixa (ex.: cardápio online).
-- Inclui também rejected_total para compatibilidade com useCashSession.

DROP FUNCTION IF EXISTS public.compute_cash_session_totals(UUID);

CREATE FUNCTION public.compute_cash_session_totals(
  p_session_id UUID
)
RETURNS TABLE (
  expected_cash NUMERIC,
  expected_pix NUMERIC,
  expected_debit NUMERIC,
  expected_credit NUMERIC,
  expected_total NUMERIC,
  rejected_total NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session RECORD;
  v_establishment RECORD;
  v_opening_amount NUMERIC;
  v_is_na_brasa BOOLEAN := FALSE;
  v_closed_at timestamptz;
BEGIN
  SELECT cs.* INTO v_session
  FROM public.cash_sessions cs
  WHERE cs.id = p_session_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sessão não encontrada';
  END IF;

  v_closed_at := COALESCE(v_session.closed_at, now());

  SELECT e.* INTO v_establishment
  FROM public.establishments e
  WHERE e.id = v_session.establishment_id;

  IF FOUND THEN
    v_is_na_brasa := LOWER(TRIM(v_establishment.name)) = 'na brasa';
  END IF;

  v_opening_amount := COALESCE(v_session.opening_amount, 0);

  -- Janela do pedido: criado na sessão OU (pronto/concluído e atualizado na sessão)
  -- Assim pedidos online pagos antes de abrir o caixa entram ao marcar "Pronto".

  SELECT 
    v_opening_amount + COALESCE(SUM(
      CASE 
        WHEN o.is_credit_sale = true AND o.credit_received_at IS NOT NULL 
        THEN o.credit_total_with_interest
        ELSE o.total_amount
      END
    ), 0)
  INTO expected_cash
  FROM public.orders o
  WHERE o.establishment_id = v_session.establishment_id
    AND o.status != 'cancelled'
    AND o.status IN ('completed', 'ready')
    AND o.payment_status = 'paid'
    AND (o.payment_method = 'dinheiro' OR o.payment_method = 'cash')
    AND (
      (o.is_credit_sale = false AND (
          (o.created_at >= v_session.opened_at AND o.created_at < v_closed_at)
          OR (
            COALESCE(o.updated_at, o.created_at) >= v_session.opened_at
            AND COALESCE(o.updated_at, o.created_at) < v_closed_at
          )
        ))
      OR
      (o.is_credit_sale = true AND o.credit_received_at IS NOT NULL 
        AND o.credit_received_at >= v_session.opened_at 
        AND o.credit_received_at < v_closed_at)
    )
    AND (
      NOT v_is_na_brasa OR
      (v_is_na_brasa AND (
        (o.source_domain IS NOT NULL AND LOWER(o.source_domain) LIKE '%hamburguerianabrasa%' AND o.accepted_and_printed_at IS NOT NULL) OR
        (o.source_domain IS NULL OR o.channel != 'online' OR o.origin != 'site')
      ))
    );

  SELECT 
    COALESCE(SUM(
      CASE 
        WHEN o.is_credit_sale = true AND o.credit_received_at IS NOT NULL 
        THEN o.credit_total_with_interest
        ELSE o.total_amount
      END
    ), 0)
  INTO expected_pix
  FROM public.orders o
  WHERE o.establishment_id = v_session.establishment_id
    AND o.status != 'cancelled'
    AND o.status IN ('completed', 'ready')
    AND o.payment_status = 'paid'
    AND o.payment_method = 'pix'
    AND (
      (o.is_credit_sale = false AND (
          (o.created_at >= v_session.opened_at AND o.created_at < v_closed_at)
          OR (
            COALESCE(o.updated_at, o.created_at) >= v_session.opened_at
            AND COALESCE(o.updated_at, o.created_at) < v_closed_at
          )
        ))
      OR
      (o.is_credit_sale = true AND o.credit_received_at IS NOT NULL 
        AND o.credit_received_at >= v_session.opened_at 
        AND o.credit_received_at < v_closed_at)
    )
    AND (
      NOT v_is_na_brasa OR
      (v_is_na_brasa AND (
        (o.source_domain IS NOT NULL AND LOWER(o.source_domain) LIKE '%hamburguerianabrasa%' AND o.accepted_and_printed_at IS NOT NULL) OR
        (o.source_domain IS NULL OR o.channel != 'online' OR o.origin != 'site')
      ))
    );

  SELECT 
    COALESCE(SUM(
      CASE 
        WHEN o.is_credit_sale = true AND o.credit_received_at IS NOT NULL 
        THEN o.credit_total_with_interest
        ELSE o.total_amount
      END
    ), 0)
  INTO expected_debit
  FROM public.orders o
  WHERE o.establishment_id = v_session.establishment_id
    AND o.status != 'cancelled'
    AND o.status IN ('completed', 'ready')
    AND o.payment_status = 'paid'
    AND (o.payment_method = 'cartao_debito' OR o.payment_method = 'cartao credito/debito')
    AND (
      (o.is_credit_sale = false AND (
          (o.created_at >= v_session.opened_at AND o.created_at < v_closed_at)
          OR (
            COALESCE(o.updated_at, o.created_at) >= v_session.opened_at
            AND COALESCE(o.updated_at, o.created_at) < v_closed_at
          )
        ))
      OR
      (o.is_credit_sale = true AND o.credit_received_at IS NOT NULL 
        AND o.credit_received_at >= v_session.opened_at 
        AND o.credit_received_at < v_closed_at)
    )
    AND (
      NOT v_is_na_brasa OR
      (v_is_na_brasa AND (
        (o.source_domain IS NOT NULL AND LOWER(o.source_domain) LIKE '%hamburguerianabrasa%' AND o.accepted_and_printed_at IS NOT NULL) OR
        (o.source_domain IS NULL OR o.channel != 'online' OR o.origin != 'site')
      ))
    );

  SELECT 
    COALESCE(SUM(
      CASE 
        WHEN o.is_credit_sale = true AND o.credit_received_at IS NOT NULL 
        THEN o.credit_total_with_interest
        ELSE o.total_amount
      END
    ), 0)
  INTO expected_credit
  FROM public.orders o
  WHERE o.establishment_id = v_session.establishment_id
    AND o.status != 'cancelled'
    AND o.status IN ('completed', 'ready')
    AND o.payment_status = 'paid'
    AND o.payment_method = 'cartao_credito'
    AND (
      (o.is_credit_sale = false AND (
          (o.created_at >= v_session.opened_at AND o.created_at < v_closed_at)
          OR (
            COALESCE(o.updated_at, o.created_at) >= v_session.opened_at
            AND COALESCE(o.updated_at, o.created_at) < v_closed_at
          )
        ))
      OR
      (o.is_credit_sale = true AND o.credit_received_at IS NOT NULL 
        AND o.credit_received_at >= v_session.opened_at 
        AND o.credit_received_at < v_closed_at)
    )
    AND (
      NOT v_is_na_brasa OR
      (v_is_na_brasa AND (
        (o.source_domain IS NOT NULL AND LOWER(o.source_domain) LIKE '%hamburguerianabrasa%' AND o.accepted_and_printed_at IS NOT NULL) OR
        (o.source_domain IS NULL OR o.channel != 'online' OR o.origin != 'site')
      ))
    );

  IF expected_cash IS NULL THEN
    expected_cash := v_opening_amount;
    expected_pix := 0;
    expected_debit := 0;
    expected_credit := 0;
  END IF;

  expected_total := expected_cash + expected_pix + expected_debit + expected_credit;

  SELECT 
    COALESCE(SUM(o.total_amount), 0)
  INTO rejected_total
  FROM public.orders o
  WHERE o.establishment_id = v_session.establishment_id
    AND o.status = 'cancelled'
    AND o.rejection_reason IS NOT NULL
    AND o.created_at >= v_session.opened_at
    AND o.created_at < v_closed_at;

  RETURN QUERY SELECT 
    expected_cash, 
    expected_pix, 
    expected_debit, 
    expected_credit, 
    expected_total,
    rejected_total;
END;
$$;

GRANT EXECUTE ON FUNCTION public.compute_cash_session_totals(UUID) TO authenticated;

COMMENT ON FUNCTION public.compute_cash_session_totals IS
  'Totais esperados do caixa: pedidos pagos prontos/concluídos na sessão por created_at OU updated_at; fiado por credit_received_at; rejected_total informativo.';
