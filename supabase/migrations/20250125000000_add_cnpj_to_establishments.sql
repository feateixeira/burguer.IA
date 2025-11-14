-- Adicionar campo CNPJ na tabela establishments
ALTER TABLE public.establishments
ADD COLUMN IF NOT EXISTS cnpj TEXT;

-- Comentário na coluna
COMMENT ON COLUMN public.establishments.cnpj IS 'CNPJ do estabelecimento para cupons não fiscais';

