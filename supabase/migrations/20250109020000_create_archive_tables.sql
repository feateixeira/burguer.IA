-- ============================================
-- TABELAS DE CONTROLE DE ARQUIVAMENTO
-- Controlam exportação e arquivamento de dados raw
-- ============================================

-- ============================================
-- 1. ARCHIVE_JOBS
-- Controla jobs de exportação e arquivamento
-- ============================================
CREATE TABLE IF NOT EXISTS public.archive_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type TEXT NOT NULL CHECK (job_type IN ('export_orders', 'export_products', 'export_customers', 'export_cash', 'rollup_daily', 'rollup_monthly')),
  establishment_id UUID REFERENCES public.establishments(id) ON DELETE CASCADE,
  target_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  
  -- Metadados de arquivo
  file_path TEXT, -- Caminho no R2/Blob
  file_url TEXT, -- URL pública do arquivo
  file_size_bytes BIGINT,
  file_format TEXT CHECK (file_format IN ('json', 'csv')),
  
  -- Dados de processamento
  records_count INTEGER,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  -- Metadados
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_archive_jobs_type_date ON public.archive_jobs(job_type, target_date DESC);
CREATE INDEX IF NOT EXISTS idx_archive_jobs_status ON public.archive_jobs(status);
CREATE INDEX IF NOT EXISTS idx_archive_jobs_establishment ON public.archive_jobs(establishment_id);

-- ============================================
-- 2. ARCHIVE_CONFIG
-- Configurações de arquivamento por estabelecimento
-- ============================================
CREATE TABLE IF NOT EXISTS public.archive_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id UUID NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE UNIQUE,
  
  -- Configurações de retenção
  raw_data_retention_days INTEGER NOT NULL DEFAULT 90, -- Dias antes de arquivar
  archive_retention_months INTEGER NOT NULL DEFAULT 24, -- Meses para manter arquivos
  
  -- Configurações de rollup
  enable_daily_rollups BOOLEAN NOT NULL DEFAULT true,
  enable_weekly_rollups BOOLEAN NOT NULL DEFAULT true,
  enable_monthly_rollups BOOLEAN NOT NULL DEFAULT true,
  
  -- Configurações de armazenamento
  storage_provider TEXT NOT NULL DEFAULT 'r2' CHECK (storage_provider IN ('r2', 's3', 'blob')),
  storage_bucket TEXT,
  storage_region TEXT,
  
  -- Metadados
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_archive_config_establishment ON public.archive_config(establishment_id);

-- Trigger para updated_at
CREATE TRIGGER update_archive_config_updated_at
  BEFORE UPDATE ON public.archive_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_fact_updated_at();

CREATE TRIGGER update_archive_jobs_updated_at
  BEFORE UPDATE ON public.archive_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_fact_updated_at();

-- ============================================
-- HABILITAR RLS
-- ============================================
ALTER TABLE public.archive_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.archive_config ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
DROP POLICY IF EXISTS "Users can view archive_jobs from their establishment" ON public.archive_jobs;
CREATE POLICY "Users can view archive_jobs from their establishment"
  ON public.archive_jobs FOR SELECT
  USING (
    establishment_id IN (
      SELECT establishment_id FROM public.profiles WHERE user_id = auth.uid()
    ) OR establishment_id IS NULL -- Jobs globais
  );

DROP POLICY IF EXISTS "Users can view archive_config from their establishment" ON public.archive_config;
CREATE POLICY "Users can view archive_config from their establishment"
  ON public.archive_config FOR SELECT
  USING (
    establishment_id IN (
      SELECT establishment_id FROM public.profiles WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins can manage archive_config" ON public.archive_config;
CREATE POLICY "Admins can manage archive_config"
  ON public.archive_config FOR ALL
  USING (
    establishment_id IN (
      SELECT establishment_id FROM public.profiles WHERE user_id = auth.uid()
    )
  );

