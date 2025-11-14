-- Migration: Habilitar Realtime para produtos, categorias e combos
-- Necessário para atualizações em tempo real no cardápio online, PDV e Totem

-- Habilitar Realtime na tabela products
ALTER TABLE public.products REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.products;

-- Habilitar Realtime na tabela categories
ALTER TABLE public.categories REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.categories;

-- Habilitar Realtime na tabela combos (se existir)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'combos') THEN
    ALTER TABLE public.combos REPLICA IDENTITY FULL;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.combos;
  END IF;
END $$;

-- Habilitar Realtime na tabela promotions (se existir)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'promotions') THEN
    ALTER TABLE public.promotions REPLICA IDENTITY FULL;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.promotions;
  END IF;
END $$;

