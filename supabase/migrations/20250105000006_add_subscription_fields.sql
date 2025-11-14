-- Adicionar campos de assinatura e pagamento aos profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS subscription_type TEXT DEFAULT 'trial' CHECK (subscription_type IN ('monthly', 'trial')),
ADD COLUMN IF NOT EXISTS trial_end_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS last_payment_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS next_payment_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('paid', 'pending', 'overdue'));

-- Criar índice para melhor performance nas consultas
CREATE INDEX IF NOT EXISTS idx_profiles_subscription_type ON public.profiles(subscription_type);
CREATE INDEX IF NOT EXISTS idx_profiles_next_payment_date ON public.profiles(next_payment_date);
CREATE INDEX IF NOT EXISTS idx_profiles_payment_status ON public.profiles(payment_status);

-- Função para calcular a próxima data de pagamento (dia 05 do próximo mês)
CREATE OR REPLACE FUNCTION public.calculate_next_payment_date()
RETURNS TIMESTAMP WITH TIME ZONE
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_current_date DATE;
  next_month DATE;
  next_payment DATE;
BEGIN
  v_current_date := CURRENT_DATE;
  next_month := DATE_TRUNC('month', v_current_date) + INTERVAL '1 month';
  next_payment := next_month + INTERVAL '4 days'; -- Dia 05 do próximo mês (1 + 4 = 5)
  
  RETURN next_payment::TIMESTAMP WITH TIME ZONE;
END;
$$;

-- Função para verificar e atualizar status de pagamento
CREATE OR REPLACE FUNCTION public.update_payment_status()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Atualizar status para 'overdue' se next_payment_date passou e payment_status é 'pending'
  UPDATE public.profiles
  SET payment_status = 'overdue'
  WHERE subscription_type = 'monthly'
    AND next_payment_date < CURRENT_DATE
    AND payment_status = 'pending';
END;
$$;

-- Função para marcar pagamento como pago e calcular próximo vencimento
CREATE OR REPLACE FUNCTION public.mark_payment_as_paid(target_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid;
  v_next_payment_date TIMESTAMP WITH TIME ZONE;
BEGIN
  current_user_id := auth.uid();
  
  -- Verificar se é admin
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = current_user_id AND p.is_admin = true
  ) THEN
    RAISE EXCEPTION 'Access denied. Only admins can call this function.';
  END IF;

  -- Calcular próxima data de pagamento
  SELECT public.calculate_next_payment_date() INTO v_next_payment_date;

  -- Atualizar perfil
  UPDATE public.profiles p
  SET 
    last_payment_date = CURRENT_TIMESTAMP,
    next_payment_date = v_next_payment_date,
    payment_status = 'paid'
  WHERE p.user_id = target_user_id
    AND p.subscription_type = 'monthly';

  RETURN json_build_object(
    'success', true,
    'message', 'Pagamento marcado como pago',
    'next_payment_date', v_next_payment_date
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_payment_as_paid(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_next_payment_date() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_payment_status() TO authenticated;

