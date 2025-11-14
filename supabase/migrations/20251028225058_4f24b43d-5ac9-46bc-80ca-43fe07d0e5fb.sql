-- Tabela de promoções programadas
CREATE TABLE public.promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL CHECK (type IN ('product', 'category', 'global')),
  target_id UUID, -- product_id ou category_id, null se global
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value NUMERIC NOT NULL CHECK (discount_value >= 0),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de cupons
CREATE TABLE public.coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id UUID NOT NULL,
  code TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL CHECK (type IN ('percentage', 'fixed')),
  value NUMERIC NOT NULL CHECK (value >= 0),
  max_uses INTEGER,
  uses_count INTEGER DEFAULT 0,
  valid_from DATE NOT NULL,
  valid_until DATE NOT NULL,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(establishment_id, code)
);

-- Tabela de combos
CREATE TABLE public.combos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC NOT NULL CHECK (price >= 0),
  image_url TEXT,
  active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de itens do combo
CREATE TABLE public.combo_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  combo_id UUID NOT NULL REFERENCES combos(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de complementos/adicionais
CREATE TABLE public.product_complements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC NOT NULL CHECK (price >= 0),
  category TEXT, -- para agrupar complementos (ex: "Molhos", "Adicionais")
  required BOOLEAN DEFAULT false,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de vínculo entre produtos e complementos
CREATE TABLE public.product_complement_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  complement_id UUID NOT NULL REFERENCES product_complements(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(product_id, complement_id)
);

-- Adicionar campos na tabela products para suportar combos
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS is_combo BOOLEAN DEFAULT false;

-- Adicionar campos na tabela order_items para registrar promoções e cupons
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS promotion_id UUID REFERENCES promotions(id);
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS original_price NUMERIC;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS complements JSONB DEFAULT '[]'::jsonb;

-- Adicionar campo na tabela orders para registrar cupom usado
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS coupon_id UUID REFERENCES coupons(id);
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS coupon_discount NUMERIC DEFAULT 0;

-- Índices para performance
CREATE INDEX idx_promotions_establishment ON promotions(establishment_id);
CREATE INDEX idx_promotions_dates ON promotions(start_date, end_date) WHERE active = true;
CREATE INDEX idx_coupons_establishment ON coupons(establishment_id);
CREATE INDEX idx_coupons_code ON coupons(establishment_id, code) WHERE active = true;
CREATE INDEX idx_combos_establishment ON combos(establishment_id);
CREATE INDEX idx_combo_items_combo ON combo_items(combo_id);
CREATE INDEX idx_product_complements_establishment ON product_complements(establishment_id);
CREATE INDEX idx_product_complement_links_product ON product_complement_links(product_id);

-- RLS Policies para promotions
ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage promotions in their establishment"
ON promotions FOR ALL
USING (establishment_id IN (
  SELECT establishment_id FROM profiles WHERE user_id = auth.uid()
));

-- RLS Policies para coupons
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage coupons in their establishment"
ON coupons FOR ALL
USING (establishment_id IN (
  SELECT establishment_id FROM profiles WHERE user_id = auth.uid()
));

-- RLS Policies para combos
ALTER TABLE public.combos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage combos in their establishment"
ON combos FOR ALL
USING (establishment_id IN (
  SELECT establishment_id FROM profiles WHERE user_id = auth.uid()
));

-- Permitir visualização pública de combos quando totem está ativo
CREATE POLICY "Anyone can view combos when totem is enabled"
ON combos FOR SELECT
USING (
  establishment_id IN (
    SELECT establishment_id 
    FROM app_settings 
    WHERE totem_enabled = true
  )
);

-- RLS Policies para combo_items
ALTER TABLE public.combo_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage combo items"
ON combo_items FOR ALL
USING (combo_id IN (
  SELECT id FROM combos WHERE establishment_id IN (
    SELECT establishment_id FROM profiles WHERE user_id = auth.uid()
  )
));

-- Permitir visualização pública de combo_items quando totem está ativo
CREATE POLICY "Anyone can view combo items when totem is enabled"
ON combo_items FOR SELECT
USING (
  combo_id IN (
    SELECT id FROM combos WHERE establishment_id IN (
      SELECT establishment_id FROM app_settings WHERE totem_enabled = true
    )
  )
);

-- RLS Policies para product_complements
ALTER TABLE public.product_complements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage complements in their establishment"
ON product_complements FOR ALL
USING (establishment_id IN (
  SELECT establishment_id FROM profiles WHERE user_id = auth.uid()
));

-- RLS Policies para product_complement_links
ALTER TABLE public.product_complement_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage complement links"
ON product_complement_links FOR ALL
USING (product_id IN (
  SELECT id FROM products WHERE establishment_id IN (
    SELECT establishment_id FROM profiles WHERE user_id = auth.uid()
  )
));

-- Trigger para atualizar updated_at
CREATE TRIGGER update_promotions_updated_at
  BEFORE UPDATE ON promotions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_coupons_updated_at
  BEFORE UPDATE ON coupons
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_combos_updated_at
  BEFORE UPDATE ON combos
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_product_complements_updated_at
  BEFORE UPDATE ON product_complements
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();