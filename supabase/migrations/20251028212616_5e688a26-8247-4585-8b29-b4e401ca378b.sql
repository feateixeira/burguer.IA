-- Corrigir função audit_pix_key_change com search_path
CREATE OR REPLACE FUNCTION public.audit_pix_key_change()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (OLD.pix_key_value IS DISTINCT FROM NEW.pix_key_value) OR 
     (OLD.pix_key_type IS DISTINCT FROM NEW.pix_key_type) THEN
    INSERT INTO public.pix_key_audit (
      establishment_id,
      old_pix_key,
      new_pix_key,
      old_pix_key_type,
      new_pix_key_type,
      changed_by
    ) VALUES (
      NEW.id,
      OLD.pix_key_value,
      NEW.pix_key_value,
      OLD.pix_key_type,
      NEW.pix_key_type,
      auth.uid()
    );
  END IF;
  RETURN NEW;
END;
$$;