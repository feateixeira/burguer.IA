-- Add monthly orders and customers goals to establishments table
ALTER TABLE public.establishments 
ADD COLUMN IF NOT EXISTS monthly_orders_goal INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS monthly_customers_goal INTEGER DEFAULT 0;

