-- Adicionar campos para controle do Bot WhatsApp
ALTER TABLE establishments 
ADD COLUMN IF NOT EXISTS whatsapp_qr text,
ADD COLUMN IF NOT EXISTS whatsapp_status text DEFAULT 'disconnected',
ADD COLUMN IF NOT EXISTS whatsapp_updated_at timestamp with time zone;

-- Criar política de segurança (RLS) se necessário, mas geralmente o dono pode editar seu estabelecimentos
-- Assumindo que RLS já existe para 'establishments' baseado no user_id ou similar.
