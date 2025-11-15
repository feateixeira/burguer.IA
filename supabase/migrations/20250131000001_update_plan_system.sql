-- Atualizar sistema de planos para Gold, Platinum e Premium
-- Gold: básico (sem IA e WhatsApp)
-- Platinum: básico + Assistente IA
-- Premium: básico + Assistente IA + WhatsApp

-- Primeiro, remover a constraint antiga se existir
ALTER TABLE public.profiles
DROP CONSTRAINT IF EXISTS profiles_plan_type_check;

-- Atualizar valores existentes ANTES de criar a nova constraint
-- prata -> gold, gold -> platinum, NULL -> gold (padrão)
UPDATE public.profiles
SET plan_type = CASE 
  WHEN plan_type = 'prata' THEN 'gold'
  WHEN plan_type = 'gold' THEN 'platinum'
  WHEN plan_type IS NULL THEN 'gold'
  WHEN plan_type NOT IN ('gold', 'platinum', 'premium') THEN 'gold'
  ELSE plan_type
END;

-- Agora criar a nova constraint
ALTER TABLE public.profiles
ADD CONSTRAINT profiles_plan_type_check 
CHECK (plan_type IN ('gold', 'platinum', 'premium'));

-- Comentário atualizado
COMMENT ON COLUMN public.profiles.plan_type IS 'Tipo de plano: gold (básico), platinum (básico + IA), premium (básico + IA + WhatsApp)';

-- Atualizar função de plan_amount
CREATE OR REPLACE FUNCTION public.update_plan_amount()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.plan_type = 'gold' THEN
    NEW.plan_amount := 160.00;
  ELSIF NEW.plan_type = 'platinum' THEN
    NEW.plan_amount := 180.00;
  ELSIF NEW.plan_type = 'premium' THEN
    NEW.plan_amount := 220.00;
  END IF;
  RETURN NEW;
END;
$$;

-- Atualizar plan_amount dos registros existentes baseado no plan_type
UPDATE public.profiles
SET plan_amount = CASE 
  WHEN plan_type = 'gold' THEN 160.00
  WHEN plan_type = 'platinum' THEN 180.00
  WHEN plan_type = 'premium' THEN 220.00
  ELSE plan_amount
END
WHERE plan_type IS NOT NULL;

