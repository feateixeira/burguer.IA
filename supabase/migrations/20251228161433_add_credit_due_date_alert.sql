-- ============================================
-- FUNÇÃO E CRON: VERIFICAR VENCIMENTOS DIARIAMENTE
-- ============================================

-- Função para verificar pedidos fiado vencendo hoje e criar notificações
CREATE OR REPLACE FUNCTION public.check_credit_sales_due_dates()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
  v_user_id UUID;
  v_notification_count INTEGER := 0;
  v_today DATE := CURRENT_DATE;
BEGIN
  -- Buscar todos os pedidos fiado que vencem hoje e ainda não foram recebidos
  FOR v_order IN
    SELECT 
      o.id,
      o.order_number,
      o.establishment_id,
      o.customer_name,
      o.total_amount,
      o.credit_due_date,
      o.credit_interest_rate_per_day
    FROM public.orders o
    WHERE o.is_credit_sale = true
      AND o.credit_due_date = v_today
      AND o.credit_received_at IS NULL
      AND o.payment_status != 'cancelled'
  LOOP
    -- Buscar todos os usuários do estabelecimento para criar notificações
    FOR v_user_id IN
      SELECT DISTINCT p.user_id
      FROM public.profiles p
      WHERE p.establishment_id = v_order.establishment_id
        AND p.user_id IS NOT NULL
    LOOP
      -- Verificar se já existe notificação para este pedido e usuário hoje
      IF NOT EXISTS (
        SELECT 1
        FROM public.user_notifications n
        WHERE n.user_id = v_user_id
          AND n.type = 'credit_due_date'
          AND n.title LIKE '%' || v_order.order_number || '%'
          AND DATE(n.created_at) = v_today
      ) THEN
        -- Criar notificação
        INSERT INTO public.user_notifications (
          user_id,
          title,
          message,
          type,
          created_by
        ) VALUES (
          v_user_id,
          '📅 Pedido Fiado Vencendo Hoje: ' || v_order.order_number,
          format(
            'O pedido %s do cliente %s vence hoje. Valor: R$ %s. Acesse Vendas Fiado para receber o pagamento.',
            v_order.order_number,
            COALESCE(v_order.customer_name, 'Cliente'),
            to_char(v_order.total_amount, 'FM999999999.00')
          ),
          'credit_due_date',
          NULL -- Sistema
        );

        v_notification_count := v_notification_count + 1;
      END IF;
    END LOOP;
  END LOOP;

  RETURN v_notification_count;
END;
$$;

COMMENT ON FUNCTION public.check_credit_sales_due_dates IS 'Verifica pedidos fiado vencendo hoje e cria notificações para os usuários do estabelecimento';

-- Agendar execução diária às 08:00 (ajustar timezone se necessário)
-- Nota: pg_cron precisa estar habilitado no Supabase
-- Se pg_cron não estiver disponível, a função pode ser chamada manualmente ou via Edge Function
-- Para habilitar o cron, execute no Supabase SQL Editor:
-- SELECT cron.schedule(
--   'check-credit-sales-due-dates',
--   '0 8 * * *', -- Todo dia às 08:00
--   $$SELECT public.check_credit_sales_due_dates()$$
-- );

