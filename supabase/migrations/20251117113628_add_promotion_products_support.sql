-- Tabela para relacionar múltiplos produtos com promoções
CREATE TABLE IF NOT EXISTS public.promotion_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promotion_id UUID NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  fixed_price NUMERIC, -- Valor fixo para este produto específico (usado quando discount_type = 'fixed_per_product')
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(promotion_id, product_id)
);

-- Adicionar índice para performance
CREATE INDEX IF NOT EXISTS idx_promotion_products_promotion ON promotion_products(promotion_id);
CREATE INDEX IF NOT EXISTS idx_promotion_products_product ON promotion_products(product_id);

-- Modificar o constraint do discount_type para incluir 'fixed_per_product'
-- Primeiro, remover o constraint antigo
ALTER TABLE public.promotions DROP CONSTRAINT IF EXISTS promotions_discount_type_check;

-- Adicionar novo constraint com a opção 'fixed_per_product'
ALTER TABLE public.promotions ADD CONSTRAINT promotions_discount_type_check 
  CHECK (discount_type IN ('percentage', 'fixed', 'fixed_per_product'));

-- Comentário explicativo
COMMENT ON TABLE promotion_products IS 'Relaciona múltiplos produtos com uma promoção, permitindo valores fixos individuais por produto';
COMMENT ON COLUMN promotion_products.fixed_price IS 'Valor fixo para este produto específico. Usado quando discount_type da promoção é fixed_per_product';

