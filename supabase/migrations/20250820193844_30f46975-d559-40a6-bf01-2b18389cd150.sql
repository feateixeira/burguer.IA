-- Create table for fixed costs
CREATE TABLE public.fixed_costs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  establishment_id UUID NOT NULL,
  name TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  start_date DATE NOT NULL,
  recurrence TEXT NOT NULL DEFAULT 'monthly', -- 'monthly', 'yearly', 'one_time'
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.fixed_costs ENABLE ROW LEVEL SECURITY;

-- Create policy for fixed costs
CREATE POLICY "Users can manage fixed costs in their establishment" 
ON public.fixed_costs 
FOR ALL 
USING (establishment_id IN (
  SELECT profiles.establishment_id 
  FROM profiles 
  WHERE profiles.user_id = auth.uid()
));

-- Create table for ingredients (variable costs)
CREATE TABLE public.ingredients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  establishment_id UUID NOT NULL,
  name TEXT NOT NULL,
  quantity_purchased NUMERIC NOT NULL,
  total_cost NUMERIC NOT NULL,
  unit_measure TEXT NOT NULL, -- 'kg', 'unit', 'package', 'liter', etc.
  unit_cost NUMERIC GENERATED ALWAYS AS (total_cost / quantity_purchased) STORED,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ingredients ENABLE ROW LEVEL SECURITY;

-- Create policy for ingredients
CREATE POLICY "Users can manage ingredients in their establishment" 
ON public.ingredients 
FOR ALL 
USING (establishment_id IN (
  SELECT profiles.establishment_id 
  FROM profiles 
  WHERE profiles.user_id = auth.uid()
));

-- Create table for product ingredients relationship
CREATE TABLE public.product_ingredients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL,
  ingredient_id UUID NOT NULL,
  quantity_used NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(product_id, ingredient_id)
);

-- Enable RLS
ALTER TABLE public.product_ingredients ENABLE ROW LEVEL SECURITY;

-- Create policy for product ingredients
CREATE POLICY "Users can manage product ingredients through products" 
ON public.product_ingredients 
FOR ALL 
USING (product_id IN (
  SELECT products.id 
  FROM products 
  WHERE products.establishment_id IN (
    SELECT profiles.establishment_id 
    FROM profiles 
    WHERE profiles.user_id = auth.uid()
  )
));

-- Add profit margin and suggested price to products table
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS variable_cost NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS profit_margin NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS suggested_price NUMERIC DEFAULT 0;

-- Create trigger for automatic timestamp updates on fixed_costs
CREATE TRIGGER update_fixed_costs_updated_at
BEFORE UPDATE ON public.fixed_costs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create trigger for automatic timestamp updates on ingredients
CREATE TRIGGER update_ingredients_updated_at
BEFORE UPDATE ON public.ingredients
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();