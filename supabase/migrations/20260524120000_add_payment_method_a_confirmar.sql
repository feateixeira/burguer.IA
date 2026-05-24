-- ============================================
-- Forma de pagamento "a_confirmar" (À CONFIRMAR)
-- Usada quando o operador ainda não definiu o método no atendimento.
-- ============================================

ALTER TABLE public.orders
DROP CONSTRAINT IF EXISTS orders_payment_method_check;

ALTER TABLE public.orders
ADD CONSTRAINT orders_payment_method_check
CHECK (
  payment_method IS NULL
  OR payment_method IN (
    'dinheiro',
    'pix',
    'cartao_credito',
    'cartao_debito',
    'online',
    'whatsapp',
    'balcao',
    'a_confirmar'
  )
);

COMMENT ON COLUMN public.orders.payment_method IS
  'Forma de pagamento. Valor a_confirmar = operador ainda não definiu no atendimento (não entra nos totais do caixa).';

-- Pedidos existentes sem forma definida
UPDATE public.orders
SET payment_method = 'a_confirmar'
WHERE payment_method IS NULL;
