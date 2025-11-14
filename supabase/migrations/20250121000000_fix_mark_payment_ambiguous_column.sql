-- Corrigir ambiguidade na função mark_payment_as_paid
-- O problema era que a variável local next_payment_date tinha o mesmo nome da coluna da tabela
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

