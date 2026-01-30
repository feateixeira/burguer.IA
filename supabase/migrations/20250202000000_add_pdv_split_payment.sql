-- ============================================
-- PDV: Duas formas de pagamento (ex.: dinheiro + PIX/crédito)
-- ============================================

ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS payment_method_2 TEXT,
ADD COLUMN IF NOT EXISTS payment_amount_1 DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS payment_amount_2 DECIMAL(10,2);

COMMENT ON COLUMN public.orders.payment_method_2 IS 'Segunda forma de pagamento quando o cliente paga em duas (ex.: dinheiro + PIX)';
COMMENT ON COLUMN public.orders.payment_amount_1 IS 'Valor pago na primeira forma (payment_method)';
COMMENT ON COLUMN public.orders.payment_amount_2 IS 'Valor pago na segunda forma (payment_method_2)';
