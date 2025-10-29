-- Criar enum para tipos de chave PIX
CREATE TYPE pix_key_type AS ENUM ('cpf', 'cnpj', 'email', 'phone', 'random');

-- Criar enum para status de pagamento PIX
CREATE TYPE pix_payment_status AS ENUM ('pending', 'paid', 'cancelled', 'failed');

-- Adicionar campos PIX na tabela establishments
ALTER TABLE establishments 
ADD COLUMN pix_key_type pix_key_type,
ADD COLUMN pix_key_value TEXT,
ADD COLUMN pix_bank_name TEXT,
ADD COLUMN pix_holder_name TEXT,
ADD COLUMN pix_key_locked BOOLEAN DEFAULT false,
ADD COLUMN pix_key_locked_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN pix_key_locked_by UUID REFERENCES auth.users(id);

-- Criar tabela de pagamentos PIX
CREATE TABLE pix_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id UUID NOT NULL REFERENCES establishments(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  status pix_payment_status NOT NULL DEFAULT 'pending',
  pix_key_used TEXT NOT NULL,
  pix_key_type pix_key_type NOT NULL,
  qr_code_data TEXT,
  txid TEXT,
  confirmed_by UUID REFERENCES auth.users(id),
  confirmed_at TIMESTAMP WITH TIME ZONE,
  fraud_suspected BOOLEAN DEFAULT false,
  fraud_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela de logs de auditoria
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id UUID NOT NULL REFERENCES establishments(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  table_name TEXT NOT NULL,
  record_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Adicionar campo de pagamento PIX confirmado nos pedidos
ALTER TABLE orders
ADD COLUMN pix_payment_confirmed BOOLEAN DEFAULT false,
ADD COLUMN pix_payment_id UUID REFERENCES pix_payments(id);

-- Criar índices para performance
CREATE INDEX idx_pix_payments_establishment ON pix_payments(establishment_id);
CREATE INDEX idx_pix_payments_order ON pix_payments(order_id);
CREATE INDEX idx_pix_payments_status ON pix_payments(status);
CREATE INDEX idx_pix_payments_created_at ON pix_payments(created_at);
CREATE INDEX idx_audit_logs_establishment ON audit_logs(establishment_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);

-- Habilitar RLS
ALTER TABLE pix_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para pix_payments
CREATE POLICY "Users can manage PIX payments in their establishment"
ON pix_payments
FOR ALL
USING (
  establishment_id IN (
    SELECT establishment_id FROM profiles WHERE user_id = auth.uid()
  )
);

-- Políticas RLS para audit_logs
CREATE POLICY "Users can view audit logs from their establishment"
ON audit_logs
FOR SELECT
USING (
  establishment_id IN (
    SELECT establishment_id FROM profiles WHERE user_id = auth.uid()
  )
);

CREATE POLICY "System can insert audit logs"
ON audit_logs
FOR INSERT
WITH CHECK (true);

-- Trigger para atualizar updated_at em pix_payments
CREATE TRIGGER update_pix_payments_updated_at
BEFORE UPDATE ON pix_payments
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Função para detectar fraude em chave PIX
CREATE OR REPLACE FUNCTION check_pix_key_fraud()
RETURNS TRIGGER AS $$
DECLARE
  official_key TEXT;
BEGIN
  -- Buscar chave PIX oficial do estabelecimento
  SELECT pix_key_value INTO official_key
  FROM establishments
  WHERE id = NEW.establishment_id;
  
  -- Se a chave usada for diferente da oficial, marcar como suspeita
  IF official_key IS NOT NULL AND NEW.pix_key_used != official_key THEN
    NEW.fraud_suspected = true;
    NEW.fraud_reason = 'Chave PIX diferente da cadastrada oficialmente';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger para detectar fraude ao inserir pagamento PIX
CREATE TRIGGER check_pix_fraud_on_insert
BEFORE INSERT ON pix_payments
FOR EACH ROW
EXECUTE FUNCTION check_pix_key_fraud();

-- Função para registrar alteração de chave PIX em audit log
CREATE OR REPLACE FUNCTION log_pix_key_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Registrar alteração apenas se a chave PIX mudou
  IF (OLD.pix_key_value IS DISTINCT FROM NEW.pix_key_value) OR
     (OLD.pix_key_type IS DISTINCT FROM NEW.pix_key_type) THEN
    INSERT INTO audit_logs (
      establishment_id,
      user_id,
      action,
      table_name,
      record_id,
      old_values,
      new_values
    ) VALUES (
      NEW.id,
      auth.uid(),
      'update_pix_key',
      'establishments',
      NEW.id,
      jsonb_build_object(
        'pix_key_type', OLD.pix_key_type,
        'pix_key_value', OLD.pix_key_value,
        'pix_bank_name', OLD.pix_bank_name,
        'pix_holder_name', OLD.pix_holder_name
      ),
      jsonb_build_object(
        'pix_key_type', NEW.pix_key_type,
        'pix_key_value', NEW.pix_key_value,
        'pix_bank_name', NEW.pix_bank_name,
        'pix_holder_name', NEW.pix_holder_name
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger para log de alteração de chave PIX
CREATE TRIGGER log_pix_key_changes
AFTER UPDATE ON establishments
FOR EACH ROW
EXECUTE FUNCTION log_pix_key_change();