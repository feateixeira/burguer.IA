-- Migration: Adicionar campo para ativar/desativar cardápio online
ALTER TABLE public.establishments 
ADD COLUMN IF NOT EXISTS menu_online_enabled BOOLEAN NOT NULL DEFAULT true;

