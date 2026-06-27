-- Unifica cartão de crédito e débito em um único valor `cartao` no caixa e nos pedidos.

ALTER TABLE public.orders
DROP CONSTRAINT IF EXISTS orders_payment_method_check;

ALTER TABLE public.orders
ADD CONSTRAINT orders_payment_method_check
CHECK (
  payment_method IS NULL
  OR payment_method IN (
    'dinheiro',
    'pix',
    'cartao',
    'cartao_credito',
    'cartao_debito',
    'online',
    'whatsapp',
    'balcao',
    'a_confirmar'
  )
);

-- Pedidos legados: crédito/débito → cartao
UPDATE public.orders
SET payment_method = 'cartao'
WHERE payment_method IN ('cartao_credito', 'cartao_debito', 'cartao credito/debito', 'cartao_credito_debito');

UPDATE public.orders
SET payment_method_2 = 'cartao'
WHERE payment_method_2 IN ('cartao_credito', 'cartao_debito', 'cartao credito/debito', 'cartao_credito_debito');

-- Totais do caixa: todo cartão em expected_debit; expected_credit fica 0
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

  -- Cartão unificado (crédito + débito + cartao)
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
    AND o.payment_method IN (
      'cartao',
      'cartao_debito',
      'cartao_credito',
      'cartao credito/debito',
      'cartao_credito_debito'
    )
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

  expected_credit := 0;

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
