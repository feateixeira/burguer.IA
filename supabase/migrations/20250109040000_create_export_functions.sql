-- ============================================
-- FUNÇÕES PARA EXPORTAÇÃO DE DADOS RAW
-- Exportam dados para JSON/CSV antes de arquivar
-- ============================================

-- ============================================
-- FUNÇÃO: EXPORTAR PEDIDOS DO DIA PARA JSON
-- ============================================
CREATE OR REPLACE FUNCTION public.export_orders_to_json(
  p_establishment_id UUID,
  p_date DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', o.id,
      'establishment_id', o.establishment_id,
      'order_number', o.order_number,
      'customer_name', o.customer_name,
      'customer_phone', o.customer_phone,
      'order_type', o.order_type,
      'channel', o.channel,
      'status', o.status,
      'payment_status', o.payment_status,
      'payment_method', o.payment_method,
      'subtotal', o.subtotal,
      'discount_amount', o.discount_amount,
      'delivery_fee', o.delivery_fee,
      'total_amount', o.total_amount,
      'notes', o.notes,
      'created_at', o.created_at,
      'updated_at', o.updated_at,
      'items', (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', oi.id,
            'product_id', oi.product_id,
            'product_name', p.name,
            'quantity', oi.quantity,
            'price', oi.price,
            'subtotal', oi.subtotal,
            'notes', oi.notes
          )
        )
        FROM public.order_items oi
        LEFT JOIN public.products p ON p.id = oi.product_id
        WHERE oi.order_id = o.id
      )
    )
  )
  INTO v_result
  FROM public.orders o
  WHERE o.establishment_id = p_establishment_id
    AND DATE(o.created_at) = p_date;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

-- ============================================
-- FUNÇÃO: EXPORTAR TRANSAÇÕES DE CAIXA PARA JSON
-- ============================================
CREATE OR REPLACE FUNCTION public.export_cash_transactions_to_json(
  p_establishment_id UUID,
  p_date DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', ct.id,
      'cash_session_id', ct.cash_session_id,
      'type', ct.type,
      'amount', ct.amount,
      'description', ct.description,
      'created_at', ct.created_at,
      'session', (
        SELECT jsonb_build_object(
          'id', cs.id,
          'opened_at', cs.opened_at,
          'closed_at', cs.closed_at,
          'opening_amount', cs.opening_amount,
          'closing_amount', cs.closing_amount,
          'status', cs.status
        )
        FROM public.cash_sessions cs
        WHERE cs.id = ct.cash_session_id
      )
    )
  )
  INTO v_result
  FROM public.cash_transactions ct
  INNER JOIN public.cash_sessions cs ON cs.id = ct.cash_session_id
  WHERE cs.establishment_id = p_establishment_id
    AND DATE(ct.created_at) = p_date;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

-- ============================================
-- FUNÇÃO: EXPORTAR SESSÕES DE CAIXA PARA JSON
-- ============================================
CREATE OR REPLACE FUNCTION public.export_cash_sessions_to_json(
  p_establishment_id UUID,
  p_date DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', cs.id,
      'establishment_id', cs.establishment_id,
      'opened_by', cs.opened_by,
      'opened_at', cs.opened_at,
      'opening_amount', cs.opening_amount,
      'closed_by', cs.closed_by,
      'closed_at', cs.closed_at,
      'closing_amount', cs.closing_amount,
      'expected_amount', cs.expected_amount,
      'difference_amount', cs.difference_amount,
      'notes', cs.notes,
      'status', cs.status,
      'payment_method_counts', cs.payment_method_counts,
      'created_at', cs.created_at,
      'updated_at', cs.updated_at,
      'transactions', (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', ct.id,
            'type', ct.type,
            'amount', ct.amount,
            'description', ct.description,
            'created_at', ct.created_at
          )
        )
        FROM public.cash_transactions ct
        WHERE ct.cash_session_id = cs.id
      )
    )
  )
  INTO v_result
  FROM public.cash_sessions cs
  WHERE cs.establishment_id = p_establishment_id
    AND (DATE(cs.opened_at) = p_date OR DATE(cs.closed_at) = p_date);

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

-- ============================================
-- FUNÇÃO: CRIAR JOB DE EXPORTAÇÃO
-- ============================================
CREATE OR REPLACE FUNCTION public.create_export_job(
  p_job_type TEXT,
  p_establishment_id UUID,
  p_date DATE,
  p_file_format TEXT DEFAULT 'json'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job_id UUID;
BEGIN
  INSERT INTO public.archive_jobs (
    job_type,
    establishment_id,
    target_date,
    status,
    file_format
  ) VALUES (
    p_job_type,
    p_establishment_id,
    p_date,
    'pending',
    p_file_format
  )
  RETURNING id INTO v_job_id;

  RETURN v_job_id;
END;
$$;

-- ============================================
-- FUNÇÃO: ATUALIZAR STATUS DO JOB
-- ============================================
CREATE OR REPLACE FUNCTION public.update_export_job(
  p_job_id UUID,
  p_status TEXT,
  p_file_path TEXT DEFAULT NULL,
  p_file_url TEXT DEFAULT NULL,
  p_file_size_bytes BIGINT DEFAULT NULL,
  p_records_count INTEGER DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.archive_jobs
  SET 
    status = p_status,
    file_path = COALESCE(p_file_path, file_path),
    file_url = COALESCE(p_file_url, file_url),
    file_size_bytes = COALESCE(p_file_size_bytes, file_size_bytes),
    records_count = COALESCE(p_records_count, records_count),
    error_message = COALESCE(p_error_message, error_message),
    started_at = CASE WHEN p_status = 'processing' THEN COALESCE(started_at, now()) ELSE started_at END,
    completed_at = CASE WHEN p_status IN ('completed', 'failed') THEN now() ELSE completed_at END,
    updated_at = now()
  WHERE id = p_job_id;
END;
$$;

-- ============================================
-- FUNÇÃO: OBTER DADOS PARA ARQUIVAMENTO (30+ DIAS)
-- ============================================
CREATE OR REPLACE FUNCTION public.get_data_ready_for_archive(
  p_establishment_id UUID,
  p_retention_days INTEGER DEFAULT 90
)
RETURNS TABLE (
  date DATE,
  orders_count BIGINT,
  has_cash_data BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT
    DATE(o.created_at) as date,
    COUNT(*) OVER (PARTITION BY DATE(o.created_at)) as orders_count,
    EXISTS(
      SELECT 1 FROM public.cash_sessions cs
      WHERE cs.establishment_id = p_establishment_id
        AND (DATE(cs.opened_at) = DATE(o.created_at) OR DATE(cs.closed_at) = DATE(o.created_at))
    ) as has_cash_data
  FROM public.orders o
  WHERE o.establishment_id = p_establishment_id
    AND DATE(o.created_at) < CURRENT_DATE - p_retention_days
    AND NOT EXISTS (
      SELECT 1 FROM public.archive_jobs aj
      WHERE aj.establishment_id = p_establishment_id
        AND aj.target_date = DATE(o.created_at)
        AND aj.job_type = 'export_orders'
        AND aj.status = 'completed'
    )
  ORDER BY date;
END;
$$;

-- ============================================
-- GRANTS
-- ============================================
GRANT EXECUTE ON FUNCTION public.export_orders_to_json(UUID, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.export_cash_transactions_to_json(UUID, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.export_cash_sessions_to_json(UUID, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_export_job(TEXT, UUID, DATE, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_export_job(UUID, TEXT, TEXT, TEXT, BIGINT, INTEGER, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_data_ready_for_archive(UUID, INTEGER) TO authenticated;

