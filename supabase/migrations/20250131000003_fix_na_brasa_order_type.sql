-- ============================================
-- MIGRATION: Corrigir order_type de pedidos do Na Brasa
-- Corrige pedidos que foram salvos como 'delivery' mas deveriam ser 'pickup'
-- ============================================

-- Função para corrigir order_type baseado nas notes
DO $$
DECLARE
  order_record RECORD;
  should_be_pickup BOOLEAN;
  delivery_form TEXT;
  consumption_form TEXT;
  has_address BOOLEAN;
BEGIN
  -- Para cada pedido do Na Brasa que está como 'delivery'
  FOR order_record IN 
    SELECT o.id, o.order_type, o.notes, o.source_domain, o.customer_name
    FROM orders o
    INNER JOIN establishments e ON o.establishment_id = e.id
    WHERE o.order_type = 'delivery'
      AND (o.source_domain ILIKE '%hamburguerianabrasa%' 
           OR e.name ILIKE '%na brasa%' 
           OR e.name ILIKE '%nabrasa%')
  LOOP
    should_be_pickup := false;
    delivery_form := NULL;
    consumption_form := NULL;
    has_address := false;
    
    -- Verificar se tem "Forma de entrega: Retirar no local"
    IF order_record.notes IS NOT NULL THEN
      -- Extrair "Forma de entrega: ..."
      SELECT regexp_match(order_record.notes, 'Forma\s+de\s+entrega[:\s]+([^\n\r]+)', 'i') INTO delivery_form;
      IF delivery_form IS NOT NULL AND array_length(delivery_form, 1) > 0 THEN
        delivery_form := trim(delivery_form[1]);
        IF lower(delivery_form) LIKE '%retirar%' THEN
          should_be_pickup := true;
        END IF;
      END IF;
      
      -- Extrair "Forma de consumo/embalagem: ..."
      SELECT regexp_match(order_record.notes, 'Forma\s+de\s+(?:consumo[\/:]?\s*)?embalagem[:\s]+([^\n\r]+)', 'i') INTO consumption_form;
      IF consumption_form IS NULL THEN
        SELECT regexp_match(order_record.notes, 'Forma\s+de\s+consumo[:\s]+([^\n\r]+)', 'i') INTO consumption_form;
      END IF;
      IF consumption_form IS NOT NULL AND array_length(consumption_form, 1) > 0 THEN
        consumption_form := trim(consumption_form[1]);
        IF lower(consumption_form) LIKE '%embalar%' OR lower(consumption_form) LIKE '%levar%' THEN
          should_be_pickup := true;
        END IF;
      END IF;
      
      -- Verificar se tem endereço válido
      IF order_record.notes ~* 'Endereço:\s*.{10,}' THEN
        has_address := true;
      END IF;
      
      -- Verificar outras indicações de retirada
      IF order_record.notes ~* '(embalar\s+(para|pra)\s+levar|comer\s+no\s+local|retirar\s+no\s+local)' THEN
        should_be_pickup := true;
      END IF;
      
      -- Verificar no nome do cliente
      IF order_record.customer_name IS NOT NULL AND (
        order_record.customer_name ILIKE '%embalar%' OR
        order_record.customer_name ILIKE '%retirar%' OR
        order_record.customer_name ILIKE '%comer aqui%'
      ) THEN
        should_be_pickup := true;
      END IF;
    END IF;
    
    -- Se não tem endereço válido, também deve ser pickup
    IF NOT has_address THEN
      should_be_pickup := true;
    END IF;
    
    -- Atualizar se necessário
    IF should_be_pickup THEN
      UPDATE orders
      SET order_type = 'pickup'
      WHERE id = order_record.id;
      
      RAISE NOTICE 'Pedido % corrigido: delivery -> pickup (Forma de entrega: %, Forma de consumo: %)', 
        order_record.id, delivery_form, consumption_form;
    END IF;
  END LOOP;
END $$;

-- Criar função para validar order_type em novos pedidos do Na Brasa
CREATE OR REPLACE FUNCTION validate_na_brasa_order_type()
RETURNS TRIGGER AS $$
DECLARE
  is_na_brasa BOOLEAN;
  delivery_form TEXT;
  consumption_form TEXT;
  has_address BOOLEAN;
  notes_lower TEXT;
BEGIN
  -- Verificar se é do Na Brasa
  SELECT 
    NEW.source_domain ILIKE '%hamburguerianabrasa%' OR
    EXISTS (SELECT 1 FROM establishments WHERE id = NEW.establishment_id AND (name ILIKE '%na brasa%' OR name ILIKE '%nabrasa%'))
  INTO is_na_brasa;
  
  IF is_na_brasa AND NEW.order_type = 'delivery' THEN
    notes_lower := lower(COALESCE(NEW.notes, ''));
    has_address := false;
    
    -- Verificar "Forma de entrega: Retirar no local"
    SELECT regexp_match(NEW.notes, 'Forma\s+de\s+entrega[:\s]+([^\n\r]+)', 'i') INTO delivery_form;
    IF delivery_form IS NOT NULL AND array_length(delivery_form, 1) > 0 THEN
      delivery_form := trim(delivery_form[1]);
      IF lower(delivery_form) LIKE '%retirar%' THEN
        NEW.order_type := 'pickup';
        RETURN NEW;
      END IF;
    END IF;
    
    -- Verificar "Forma de consumo/embalagem: Embalar pra levar"
    SELECT regexp_match(NEW.notes, 'Forma\s+de\s+(?:consumo[\/:]?\s*)?embalagem[:\s]+([^\n\r]+)', 'i') INTO consumption_form;
    IF consumption_form IS NULL THEN
      SELECT regexp_match(NEW.notes, 'Forma\s+de\s+consumo[:\s]+([^\n\r]+)', 'i') INTO consumption_form;
    END IF;
    IF consumption_form IS NOT NULL AND array_length(consumption_form, 1) > 0 THEN
      consumption_form := trim(consumption_form[1]);
      IF lower(consumption_form) LIKE '%embalar%' OR lower(consumption_form) LIKE '%levar%' THEN
        NEW.order_type := 'pickup';
        RETURN NEW;
      END IF;
    END IF;
    
    -- Verificar outras indicações de retirada
    IF notes_lower ~ '(embalar\s+(para|pra)\s+levar|comer\s+no\s+local|retirar\s+no\s+local)' THEN
      NEW.order_type := 'pickup';
      RETURN NEW;
    END IF;
    
    -- Verificar se tem endereço válido
    IF NEW.notes ~* 'Endereço:\s*.{10,}' THEN
      has_address := true;
    END IF;
    
    -- Se não tem endereço válido, deve ser pickup
    IF NOT has_address THEN
      NEW.order_type := 'pickup';
      RETURN NEW;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger para validar order_type em INSERT e UPDATE
DROP TRIGGER IF EXISTS trigger_validate_na_brasa_order_type ON orders;
CREATE TRIGGER trigger_validate_na_brasa_order_type
  BEFORE INSERT OR UPDATE OF order_type, notes ON orders
  FOR EACH ROW
  EXECUTE FUNCTION validate_na_brasa_order_type();

