-- ============================================
-- CONFIGURAÇÃO DE JOBS CRON
-- Jobs para processamento automático de rollups e arquivamento
-- ============================================

-- Nota: Para usar pg_cron no Supabase, você precisa habilitar a extensão
-- Isso geralmente requer permissões de superuser ou pode ser feito via dashboard

-- ============================================
-- 1. JOB: ROLLUP DIÁRIO (5 MINUTOS - DIA CORRENTE)
-- Processa rollups do dia atual a cada 5 minutos para "near real-time"
-- ============================================

-- Função wrapper para o cron
CREATE OR REPLACE FUNCTION public.cron_daily_rollup_realtime()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_establishment RECORD;
  v_today DATE := CURRENT_DATE;
BEGIN
  -- Processa rollup do dia atual para todos os estabelecimentos
  FOR v_establishment IN
    SELECT DISTINCT establishment_id
    FROM public.profiles
    WHERE establishment_id IS NOT NULL
  LOOP
    BEGIN
      PERFORM public.process_daily_rollup(v_establishment.establishment_id, v_today);
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING 'Erro ao processar rollup para estabelecimento %: %', 
          v_establishment.establishment_id, SQLERRM;
    END;
  END LOOP;
END;
$$;

-- Para habilitar com pg_cron (executar separadamente com superuser):
-- SELECT cron.schedule(
--   'daily-rollup-realtime',
--   '*/5 * * * *', -- A cada 5 minutos
--   $$SELECT public.cron_daily_rollup_realtime()$$
-- );

-- ============================================
-- 2. JOB: FECHAMENTO DIÁRIO (03:00 - D-1)
-- Consolida o dia anterior às 3h da manhã
-- ============================================

CREATE OR REPLACE FUNCTION public.cron_daily_close()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_establishment RECORD;
  v_yesterday DATE := CURRENT_DATE - 1;
BEGIN
  -- Processa rollup do dia anterior para todos os estabelecimentos
  FOR v_establishment IN
    SELECT DISTINCT establishment_id
    FROM public.profiles
    WHERE establishment_id IS NOT NULL
  LOOP
    BEGIN
      -- Processa rollups
      PERFORM public.process_daily_rollup(v_establishment.establishment_id, v_yesterday);
      
      -- Marca como processado (opcional: criar tabela de controle)
      RAISE NOTICE 'Fechamento diário processado para estabelecimento % no dia %', 
        v_establishment.establishment_id, v_yesterday;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING 'Erro no fechamento diário para estabelecimento %: %', 
          v_establishment.establishment_id, SQLERRM;
    END;
  END LOOP;
END;
$$;

-- Para habilitar com pg_cron:
-- SELECT cron.schedule(
--   'daily-close',
--   '0 3 * * *', -- Todos os dias às 3h da manhã
--   $$SELECT public.cron_daily_close()$$
-- );

-- ============================================
-- 3. JOB: ARQUIVAMENTO (DIÁRIO - DADOS ANTIGOS)
-- Exporta dados raw com mais de 90 dias para R2/Blob
-- ============================================

CREATE OR REPLACE FUNCTION public.cron_archive_old_data()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_establishment RECORD;
  v_archive_date RECORD;
  v_config RECORD;
  v_retention_days INTEGER;
BEGIN
  -- Para cada estabelecimento
  FOR v_establishment IN
    SELECT DISTINCT establishment_id
    FROM public.profiles
    WHERE establishment_id IS NOT NULL
  LOOP
    -- Busca configuração de arquivamento
    SELECT * INTO v_config
    FROM public.archive_config
    WHERE establishment_id = v_establishment.establishment_id;
    
    v_retention_days := COALESCE(v_config.raw_data_retention_days, 90);
    
    -- Busca datas prontas para arquivamento
    FOR v_archive_date IN
      SELECT DISTINCT date
      FROM public.get_data_ready_for_archive(v_establishment.establishment_id, v_retention_days)
      ORDER BY date
      LIMIT 10 -- Processa 10 dias por execução para não sobrecarregar
    LOOP
      -- Cria job de exportação para pedidos
      PERFORM public.create_export_job(
        'export_orders',
        v_establishment.establishment_id,
        v_archive_date.date,
        'json'
      );
      
      -- Cria job de exportação para caixa (se houver dados)
      IF v_archive_date.has_cash_data THEN
        PERFORM public.create_export_job(
          'export_cash',
          v_establishment.establishment_id,
          v_archive_date.date,
          'json'
        );
      END IF;
      
      RAISE NOTICE 'Job de arquivamento criado para estabelecimento % no dia %', 
        v_establishment.establishment_id, v_archive_date.date;
    END LOOP;
  END LOOP;
END;
$$;

-- Para habilitar com pg_cron:
-- SELECT cron.schedule(
--   'archive-old-data',
--   '0 4 * * *', -- Todos os dias às 4h da manhã
--   $$SELECT public.cron_archive_old_data()$$
-- );

-- ============================================
-- 4. JOB: FECHAMENTO MENSAL (DIA 1 - DRE DO MÊS ANTERIOR)
-- Gera snapshot mensal de DRE (Demonstração de Resultado do Exercício)
-- ============================================

CREATE OR REPLACE FUNCTION public.cron_monthly_close()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_establishment RECORD;
  v_last_month DATE;
  v_month_start DATE;
  v_month_end DATE;
BEGIN
  -- Se não for dia 1, sai
  IF EXTRACT(DAY FROM CURRENT_DATE) != 1 THEN
    RETURN;
  END IF;

  v_last_month := DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month');
  v_month_start := v_last_month;
  v_month_end := DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 day';

  -- Para cada estabelecimento
  FOR v_establishment IN
    SELECT DISTINCT establishment_id
    FROM public.profiles
    WHERE establishment_id IS NOT NULL
  LOOP
    BEGIN
      -- Reprocessa todos os rollups do mês anterior
      FOR v_month_start IN 
        SELECT generate_series(v_month_start, v_month_end, '1 day'::interval)::date
      LOOP
        PERFORM public.process_daily_rollup(v_establishment.establishment_id, v_month_start);
      END LOOP;
      
      -- Aqui você pode criar uma tabela de DRE mensal se necessário
      RAISE NOTICE 'Fechamento mensal processado para estabelecimento % no mês %', 
        v_establishment.establishment_id, v_last_month;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING 'Erro no fechamento mensal para estabelecimento %: %', 
          v_establishment.establishment_id, SQLERRM;
    END;
  END LOOP;
END;
$$;

-- Para habilitar com pg_cron:
-- SELECT cron.schedule(
--   'monthly-close',
--   '0 5 1 * *', -- Todo dia 1 às 5h da manhã
--   $$SELECT public.cron_monthly_close()$$
-- );

-- ============================================
-- FUNÇÃO: EXECUTAR JOB MANUALMENTE (PARA TESTES)
-- ============================================
CREATE OR REPLACE FUNCTION public.run_rollup_manually(
  p_establishment_id UUID DEFAULT NULL,
  p_date DATE DEFAULT CURRENT_DATE - 1
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_establishment RECORD;
  v_result TEXT := '';
BEGIN
  IF p_establishment_id IS NULL THEN
    -- Processa todos os estabelecimentos
    FOR v_establishment IN
      SELECT DISTINCT establishment_id
      FROM public.profiles
      WHERE establishment_id IS NOT NULL
    LOOP
      BEGIN
        PERFORM public.process_daily_rollup(v_establishment.establishment_id, p_date);
        v_result := v_result || format('OK: estabelecimento %s - %s\n', v_establishment.establishment_id, p_date);
      EXCEPTION
        WHEN OTHERS THEN
          v_result := v_result || format('ERRO: estabelecimento %s - %s\n', v_establishment.establishment_id, SQLERRM);
      END;
    END LOOP;
  ELSE
    -- Processa estabelecimento específico
    BEGIN
      PERFORM public.process_daily_rollup(p_establishment_id, p_date);
      v_result := format('OK: estabelecimento %s - %s', p_establishment_id, p_date);
    EXCEPTION
      WHEN OTHERS THEN
        v_result := format('ERRO: %s', SQLERRM);
    END;
  END IF;

  RETURN v_result;
END;
$$;

-- ============================================
-- GRANTS
-- ============================================
GRANT EXECUTE ON FUNCTION public.cron_daily_rollup_realtime() TO authenticated;
GRANT EXECUTE ON FUNCTION public.cron_daily_close() TO authenticated;
GRANT EXECUTE ON FUNCTION public.cron_archive_old_data() TO authenticated;
GRANT EXECUTE ON FUNCTION public.cron_monthly_close() TO authenticated;
GRANT EXECUTE ON FUNCTION public.run_rollup_manually(UUID, DATE) TO authenticated;

