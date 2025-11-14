-- Adiciona campos para rastrear recusa e aceitação/impressão de pedidos
-- Especialmente para usuários Na Brasa que recebem pedidos do site

ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
ADD COLUMN IF NOT EXISTS accepted_and_printed_at TIMESTAMP WITH TIME ZONE;

-- Comentários para documentação
COMMENT ON COLUMN public.orders.rejection_reason IS 'Justificativa fornecida ao recusar um pedido';
COMMENT ON COLUMN public.orders.accepted_and_printed_at IS 'Data/hora em que o pedido foi aceito e impresso (usado para contar como venda no dashboard para Na Brasa)';

