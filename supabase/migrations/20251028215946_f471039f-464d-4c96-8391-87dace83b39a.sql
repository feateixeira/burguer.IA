-- Add missing columns to product_ingredients
ALTER TABLE public.product_ingredients 
  ADD COLUMN IF NOT EXISTS quantity_used DECIMAL(10,2) DEFAULT 0;

-- Rename quantity to quantity_used if it exists
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name='product_ingredients' AND column_name='quantity') THEN
    UPDATE public.product_ingredients SET quantity_used = quantity;
    ALTER TABLE public.product_ingredients DROP COLUMN quantity;
  END IF;
END $$;