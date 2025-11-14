-- Add category fields to orders table for Na Brasa site orders
-- These fields store category quantities (burger, side, drink) from the external website
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS site_category_quantities JSONB DEFAULT '{}'::jsonb;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_orders_site_categories ON public.orders(establishment_id) 
WHERE site_category_quantities IS NOT NULL AND site_category_quantities != '{}'::jsonb;

-- Example structure of site_category_quantities:
-- {
--   "burger": 2,
--   "side": 1,
--   "drink": 3
-- }

