-- Cria tabela de motoboys
CREATE TABLE IF NOT EXISTS delivery_boys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id UUID NOT NULL REFERENCES establishments(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  daily_rate NUMERIC(10,2) DEFAULT 0 CHECK (daily_rate >= 0),
  delivery_fee NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (delivery_fee >= 0),
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT delivery_boys_name_not_empty CHECK (name <> '')
);

-- Adiciona delivery_boy_id na tabela orders
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS delivery_boy_id UUID REFERENCES delivery_boys(id) ON DELETE SET NULL;

-- Cria índices para performance
CREATE INDEX IF NOT EXISTS idx_delivery_boys_establishment ON delivery_boys(establishment_id);
CREATE INDEX IF NOT EXISTS idx_delivery_boys_active ON delivery_boys(active);
CREATE INDEX IF NOT EXISTS idx_orders_delivery_boy ON orders(delivery_boy_id);

-- Cria trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_delivery_boys_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_delivery_boys_updated_at
BEFORE UPDATE ON delivery_boys
FOR EACH ROW
EXECUTE FUNCTION update_delivery_boys_updated_at();

-- RLS Policies
ALTER TABLE delivery_boys ENABLE ROW LEVEL SECURITY;

-- Policy: usuários podem ver motoboys do seu estabelecimento
CREATE POLICY "Users can view delivery_boys from their establishment"
ON delivery_boys FOR SELECT
USING (
  establishment_id IN (
    SELECT establishment_id FROM profiles WHERE user_id = auth.uid()
  )
);

-- Policy: apenas master/admin podem criar motoboys
CREATE POLICY "Master and admin can insert delivery_boys"
ON delivery_boys FOR INSERT
WITH CHECK (
  establishment_id IN (
    SELECT e.id FROM establishments e
    INNER JOIN profiles p ON p.establishment_id = e.id
    INNER JOIN team_members tm ON tm.establishment_id = e.id AND tm.user_id = p.user_id
    WHERE p.user_id = auth.uid()
    AND tm.role IN ('master', 'admin')
    AND tm.active = true
  )
);

-- Policy: apenas master/admin podem atualizar motoboys
CREATE POLICY "Master and admin can update delivery_boys"
ON delivery_boys FOR UPDATE
USING (
  establishment_id IN (
    SELECT e.id FROM establishments e
    INNER JOIN profiles p ON p.establishment_id = e.id
    INNER JOIN team_members tm ON tm.establishment_id = e.id AND tm.user_id = p.user_id
    WHERE p.user_id = auth.uid()
    AND tm.role IN ('master', 'admin')
    AND tm.active = true
  )
);

-- Policy: apenas master/admin podem deletar motoboys
CREATE POLICY "Master and admin can delete delivery_boys"
ON delivery_boys FOR DELETE
USING (
  establishment_id IN (
    SELECT e.id FROM establishments e
    INNER JOIN profiles p ON p.establishment_id = e.id
    INNER JOIN team_members tm ON tm.establishment_id = e.id AND tm.user_id = p.user_id
    WHERE p.user_id = auth.uid()
    AND tm.role IN ('master', 'admin')
    AND tm.active = true
  )
);

