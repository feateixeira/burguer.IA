-- Add missing columns to establishments
ALTER TABLE public.establishments ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.establishments ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.establishments ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE public.establishments ADD COLUMN IF NOT EXISTS daily_goal DECIMAL(10,2) DEFAULT 0;
ALTER TABLE public.establishments ADD COLUMN IF NOT EXISTS weekly_goal DECIMAL(10,2) DEFAULT 0;
ALTER TABLE public.establishments ADD COLUMN IF NOT EXISTS monthly_goal DECIMAL(10,2) DEFAULT 0;