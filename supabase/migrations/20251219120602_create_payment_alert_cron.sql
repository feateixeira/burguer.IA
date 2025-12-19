-- ============================================
-- CRON JOB: Alerta de Pagamento Mensal (Dia 05)
-- ============================================
-- Envia notificações para usuários com assinatura mensal no dia 05 de cada mês
-- mostrando o valor proporcional ao plano deles
-- ============================================

-- Função para enviar alertas de pagamento no dia 05
CREATE OR REPLACE FUNCTION public.cron_send_payment_alerts()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile RECORD;
  v_today DATE := CURRENT_DATE;
  v_today_day INTEGER;
  v_plan_name TEXT;
  v_notification_count INTEGER := 0;
BEGIN
  -- Verificar se é dia 05
  v_today_day := EXTRACT(DAY FROM v_today);
  
  IF v_today_day != 5 THEN
    -- Não é dia 05, não fazer nada
    RETURN;
  END IF;

  -- Buscar todos os perfis com assinatura mensal ativa
  FOR v_profile IN
    SELECT 
      p.user_id,
      p.plan_type,
      p.plan_amount,
      p.subscription_type,
      p.payment_status,
      p.next_payment_date,
      u.email,
      e.name as establishment_name
    FROM public.profiles p
    INNER JOIN auth.users u ON u.id = p.user_id
    LEFT JOIN public.establishments e ON e.id = p.establishment_id
    WHERE p.subscription_type = 'monthly'
      AND p.payment_status IN ('pending', 'paid')
      AND p.plan_type IS NOT NULL
      AND p.plan_amount IS NOT NULL
      -- Verificar se já não foi enviada notificação hoje
      AND NOT EXISTS (
        SELECT 1 
        FROM public.user_notifications n
        WHERE n.user_id = p.user_id
          AND n.type = 'payment'
          AND n.title LIKE '%Alerta de Pagamento%'
          AND DATE(n.created_at) = v_today
      )
  LOOP
    BEGIN
      -- Determinar nome do plano
      v_plan_name := CASE 
        WHEN v_profile.plan_type = 'gold' THEN 'Standard'
        WHEN v_profile.plan_type = 'platinum' THEN 'Gold'
        WHEN v_profile.plan_type = 'premium' THEN 'Premium'
        ELSE 'Plano'
      END;

      -- Criar notificação de alerta de pagamento
      INSERT INTO public.user_notifications (
        user_id,
        title,
        message,
        type,
        created_by
      ) VALUES (
        v_profile.user_id,
        '💳 Alerta de Pagamento Mensal',
        format(
          'Olá! Este é um lembrete de que sua mensalidade do plano %s está próxima. Valor: R$ %.2f/mês. Por favor, realize o pagamento para continuar utilizando nossos serviços.',
          v_plan_name,
          v_profile.plan_amount
        ),
        'payment',
        NULL -- Sistema
      );

      v_notification_count := v_notification_count + 1;

      RAISE NOTICE 'Notificação de pagamento enviada para usuário % (estabelecimento: %) - Valor: R$ %.2f', 
        v_profile.user_id, 
        COALESCE(v_profile.establishment_name, 'N/A'),
        v_profile.plan_amount;

    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING 'Erro ao enviar notificação para usuário %: %', 
          v_profile.user_id, SQLERRM;
    END;
  END LOOP;

  RAISE NOTICE 'Total de notificações de pagamento enviadas: %', v_notification_count;
END;
$$;

-- Grant para permitir execução
GRANT EXECUTE ON FUNCTION public.cron_send_payment_alerts() TO authenticated;

-- Comentário explicativo
COMMENT ON FUNCTION public.cron_send_payment_alerts() IS 
'Função que envia alertas de pagamento mensal no dia 05 de cada mês para usuários com assinatura mensal ativa. 
Mostra o valor proporcional ao plano do usuário.';

-- Para habilitar com pg_cron (executar separadamente com superuser):
-- SELECT cron.schedule(
--   'send-payment-alerts',
--   '0 9 5 * *', -- Todo dia 05 às 9h da manhã
--   $$SELECT public.cron_send_payment_alerts()$$
-- );

-- Alternativa: Criar Edge Function que pode ser chamada via cron externo ou webhook
-- A Edge Function será criada em: supabase/functions/send-payment-alerts/index.ts


