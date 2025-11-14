-- Adicionar campos de plano (Prata/Gold) aos profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS plan_type TEXT CHECK (plan_type IN ('prata', 'gold')),
ADD COLUMN IF NOT EXISTS plan_amount DECIMAL(10, 2);

-- Criar índice para melhor performance
CREATE INDEX IF NOT EXISTS idx_profiles_plan_type ON public.profiles(plan_type);

-- Atualizar valores padrão baseado no plan_type
-- Prata: R$ 180,00
-- Gold: R$ 230,00
-- Função para atualizar plan_amount quando plan_type é alterado
CREATE OR REPLACE FUNCTION public.update_plan_amount()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.plan_type = 'prata' THEN
    NEW.plan_amount := 180.00;
  ELSIF NEW.plan_type = 'gold' THEN
    NEW.plan_amount := 230.00;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Criar trigger para atualizar plan_amount automaticamente
DROP TRIGGER IF EXISTS trigger_update_plan_amount ON public.profiles;
CREATE TRIGGER trigger_update_plan_amount
  BEFORE INSERT OR UPDATE OF plan_type ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_plan_amount();

-- Comentários para documentação
COMMENT ON COLUMN public.profiles.plan_type IS 'Tipo de plano mensal: prata (R$ 180) ou gold (R$ 230)';
COMMENT ON COLUMN public.profiles.plan_amount IS 'Valor mensal do plano em reais (R$)';

