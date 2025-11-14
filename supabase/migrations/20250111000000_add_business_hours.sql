-- Migration: Sistema de Horário de Funcionamento
-- Adiciona campos em establishments e cria tabelas para horários semanais e exceções

-- 1. Adicionar campos em establishments
DO $$ 
BEGIN
  -- Timezone do estabelecimento
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'establishments' 
                 AND column_name = 'timezone') THEN
    ALTER TABLE public.establishments 
    ADD COLUMN timezone TEXT NOT NULL DEFAULT 'America/Sao_Paulo';
  END IF;

  -- Permitir pedidos quando fechado
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'establishments' 
                 AND column_name = 'allow_orders_when_closed') THEN
    ALTER TABLE public.establishments 
    ADD COLUMN allow_orders_when_closed BOOLEAN NOT NULL DEFAULT false;
  END IF;

  -- Mostrar horários no cardápio
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'establishments' 
                 AND column_name = 'show_schedule_on_menu') THEN
    ALTER TABLE public.establishments 
    ADD COLUMN show_schedule_on_menu BOOLEAN NOT NULL DEFAULT true;
  END IF;
END $$;

-- 2. Criar tabela establishment_hours (horários semanais)
CREATE TABLE IF NOT EXISTS public.establishment_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  estab_id UUID NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0=domingo, 6=sábado
  enabled BOOLEAN NOT NULL DEFAULT true,
  intervals JSONB NOT NULL DEFAULT '[]'::jsonb, -- [{"open":"10:00","close":"14:00"},...]
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(estab_id, day_of_week)
);

CREATE INDEX IF NOT EXISTS idx_establishment_hours_estab_id ON public.establishment_hours(estab_id);

-- 3. Criar tabela establishment_hours_overrides (exceções/feriados)
CREATE TABLE IF NOT EXISTS public.establishment_hours_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  estab_id UUID NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  date DATE NOT NULL, -- data local do estabelecimento
  is_closed BOOLEAN NOT NULL DEFAULT false,
  intervals JSONB, -- null ou [{"open":"HH:mm","close":"HH:mm"}]
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(estab_id, date)
);

CREATE INDEX IF NOT EXISTS idx_establishment_hours_overrides_estab_date 
  ON public.establishment_hours_overrides(estab_id, date);

-- 4. Adicionar campos em orders
DO $$ 
BEGIN
  -- Marca se o pedido está na fila aguardando abertura
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'orders' 
                 AND column_name = 'queued_until_next_open') THEN
    ALTER TABLE public.orders 
    ADD COLUMN queued_until_next_open BOOLEAN NOT NULL DEFAULT false;
  END IF;

  -- Data/hora quando o pedido será liberado (quando o estabelecimento abrir)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'orders' 
                 AND column_name = 'release_at') THEN
    ALTER TABLE public.orders 
    ADD COLUMN release_at TIMESTAMPTZ;
  END IF;
END $$;

-- 5. Criar função para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_establishment_hours_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_establishment_hours_updated_at ON public.establishment_hours;
CREATE TRIGGER trigger_update_establishment_hours_updated_at
  BEFORE UPDATE ON public.establishment_hours
  FOR EACH ROW
  EXECUTE FUNCTION public.update_establishment_hours_updated_at();

DROP TRIGGER IF EXISTS trigger_update_establishment_hours_overrides_updated_at ON public.establishment_hours_overrides;
CREATE TRIGGER trigger_update_establishment_hours_overrides_updated_at
  BEFORE UPDATE ON public.establishment_hours_overrides
  FOR EACH ROW
  EXECUTE FUNCTION public.update_establishment_hours_updated_at();

-- 6. RLS Policies
ALTER TABLE public.establishment_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.establishment_hours_overrides ENABLE ROW LEVEL SECURITY;

-- Policies para establishment_hours
DROP POLICY IF EXISTS "Users can view establishment_hours from their establishment" ON public.establishment_hours;
CREATE POLICY "Users can view establishment_hours from their establishment"
  ON public.establishment_hours
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.establishment_id = establishment_hours.estab_id
      AND p.user_id = auth.uid()
    )
    OR
    -- Permitir leitura pública para o cardápio online
    true
  );

DROP POLICY IF EXISTS "Users can manage establishment_hours from their establishment" ON public.establishment_hours;
CREATE POLICY "Users can manage establishment_hours from their establishment"
  ON public.establishment_hours
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      INNER JOIN public.team_members tm ON tm.user_id = p.user_id AND tm.establishment_id = p.establishment_id
      WHERE p.establishment_id = establishment_hours.estab_id
      AND p.user_id = auth.uid()
      AND tm.role IN ('master', 'admin')
      AND tm.active = true
    )
  );

-- Policies para establishment_hours_overrides
DROP POLICY IF EXISTS "Users can view establishment_hours_overrides from their establishment" ON public.establishment_hours_overrides;
CREATE POLICY "Users can view establishment_hours_overrides from their establishment"
  ON public.establishment_hours_overrides
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.establishment_id = establishment_hours_overrides.estab_id
      AND p.user_id = auth.uid()
    )
    OR
    -- Permitir leitura pública para o cardápio online
    true
  );

DROP POLICY IF EXISTS "Users can manage establishment_hours_overrides from their establishment" ON public.establishment_hours_overrides;
CREATE POLICY "Users can manage establishment_hours_overrides from their establishment"
  ON public.establishment_hours_overrides
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      INNER JOIN public.team_members tm ON tm.user_id = p.user_id AND tm.establishment_id = p.establishment_id
      WHERE p.establishment_id = establishment_hours_overrides.estab_id
      AND p.user_id = auth.uid()
      AND tm.role IN ('master', 'admin')
      AND tm.active = true
    )
  );

-- 7. Comentários nas tabelas
COMMENT ON TABLE public.establishment_hours IS 'Horários semanais de funcionamento por estabelecimento';
COMMENT ON TABLE public.establishment_hours_overrides IS 'Exceções aos horários semanais (feriados, fechamentos especiais)';
COMMENT ON COLUMN public.establishment_hours.day_of_week IS '0=domingo, 1=segunda, ..., 6=sábado';
COMMENT ON COLUMN public.establishment_hours.intervals IS 'Array JSON: [{"open":"HH:mm","close":"HH:mm"}]';

