-- ============================================
-- MIGRATION: Corrigir Auditoria de Chave PIX
-- ============================================
-- Esta migração:
-- 1. Adiciona campos de banco e titular na tabela pix_key_audit
-- 2. Atualiza a função de trigger para registrar todos os campos PIX
-- ============================================

-- Adicionar colunas de banco e titular na tabela pix_key_audit
ALTER TABLE public.pix_key_audit
ADD COLUMN IF NOT EXISTS old_pix_bank_name TEXT,
ADD COLUMN IF NOT EXISTS new_pix_bank_name TEXT,
ADD COLUMN IF NOT EXISTS old_pix_holder_name TEXT,
ADD COLUMN IF NOT EXISTS new_pix_holder_name TEXT;

-- Atualizar função de auditoria PIX para incluir banco e titular
CREATE OR REPLACE FUNCTION public.audit_pix_key_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Registrar mudança se houver alteração em qualquer campo PIX
  IF (OLD.pix_key_value IS DISTINCT FROM NEW.pix_key_value) OR 
     (OLD.pix_key_type IS DISTINCT FROM NEW.pix_key_type) OR
     (OLD.pix_bank_name IS DISTINCT FROM NEW.pix_bank_name) OR
     (OLD.pix_holder_name IS DISTINCT FROM NEW.pix_holder_name) THEN
    INSERT INTO public.pix_key_audit (
      establishment_id,
      old_pix_key,
      new_pix_key,
      old_pix_key_type,
      new_pix_key_type,
      old_pix_bank_name,
      new_pix_bank_name,
      old_pix_holder_name,
      new_pix_holder_name,
      changed_by
    ) VALUES (
      NEW.id,
      OLD.pix_key_value,
      NEW.pix_key_value,
      OLD.pix_key_type,
      NEW.pix_key_type,
      OLD.pix_bank_name,
      NEW.pix_bank_name,
      OLD.pix_holder_name,
      NEW.pix_holder_name,
      auth.uid()
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comentário explicativo
COMMENT ON FUNCTION public.audit_pix_key_change() IS 
'Função de trigger que registra todas as alterações de chave PIX na tabela pix_key_audit.
Registra mudanças em: pix_key_value, pix_key_type, pix_bank_name e pix_holder_name.';

-- Atualizar política RLS para permitir que usuários vejam histórico do próprio estabelecimento
DROP POLICY IF EXISTS "Admins can view PIX audit" ON public.pix_key_audit;
DROP POLICY IF EXISTS "Only admins can view PIX audit logs" ON public.pix_key_audit;

-- Política: Usuários podem ver histórico de PIX do próprio estabelecimento
CREATE POLICY "Users can view PIX audit from their establishment"
  ON public.pix_key_audit FOR SELECT
  USING (
    establishment_id IN (
      SELECT establishment_id 
      FROM public.profiles 
      WHERE user_id = auth.uid()
    )
  );

