-- Add missing columns to establishments
ALTER TABLE public.establishments ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}'::jsonb;

-- Add missing columns to products
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS variable_cost DECIMAL(10,2) DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS profit_margin DECIMAL(5,2) DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS suggested_price DECIMAL(10,2) DEFAULT 0;

-- Create customers table
CREATE TABLE IF NOT EXISTS public.customers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  establishment_id UUID NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  notes TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create customer_groups table
CREATE TABLE IF NOT EXISTS public.customer_groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  establishment_id UUID NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  discount_percentage DECIMAL(5,2) DEFAULT 0,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create customer_group_members table
CREATE TABLE IF NOT EXISTS public.customer_group_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES public.customer_groups(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(customer_id, group_id)
);

-- Create fixed_costs table
CREATE TABLE IF NOT EXISTS public.fixed_costs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  establishment_id UUID NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  recurrence TEXT NOT NULL DEFAULT 'monthly',
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create ingredients table
CREATE TABLE IF NOT EXISTS public.ingredients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  establishment_id UUID NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  quantity DECIMAL(10,2) NOT NULL DEFAULT 0,
  cost DECIMAL(10,2) NOT NULL DEFAULT 0,
  unit_measure TEXT NOT NULL,
  purchase_unit_measure TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create product_ingredients table
CREATE TABLE IF NOT EXISTS public.product_ingredients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  ingredient_id UUID NOT NULL REFERENCES public.ingredients(id) ON DELETE CASCADE,
  quantity DECIMAL(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(product_id, ingredient_id)
);

-- Create orders table
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  establishment_id UUID NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  order_number TEXT NOT NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name TEXT,
  customer_phone TEXT,
  order_type TEXT NOT NULL DEFAULT 'balcao',
  table_number TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  payment_method TEXT,
  payment_status TEXT DEFAULT 'pending',
  subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
  tax_amount DECIMAL(10,2) DEFAULT 0,
  discount_amount DECIMAL(10,2) DEFAULT 0,
  delivery_fee DECIMAL(10,2) DEFAULT 0,
  total_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create order_items table
CREATE TABLE IF NOT EXISTS public.order_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price DECIMAL(10,2) NOT NULL,
  total_price DECIMAL(10,2) NOT NULL,
  customizations JSONB DEFAULT '{}',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fixed_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for customers
CREATE POLICY "Users can manage customers in their establishment" 
  ON public.customers FOR ALL 
  USING (
    establishment_id IN (
      SELECT establishment_id FROM public.profiles 
      WHERE user_id = auth.uid()
    )
  );

-- Create RLS policies for customer_groups
CREATE POLICY "Users can manage customer groups in their establishment" 
  ON public.customer_groups FOR ALL 
  USING (
    establishment_id IN (
      SELECT establishment_id FROM public.profiles 
      WHERE user_id = auth.uid()
    )
  );

-- Create RLS policies for customer_group_members
CREATE POLICY "Users can manage customer group members" 
  ON public.customer_group_members FOR ALL 
  USING (
    customer_id IN (
      SELECT id FROM public.customers 
      WHERE establishment_id IN (
        SELECT establishment_id FROM public.profiles 
        WHERE user_id = auth.uid()
      )
    )
  );

-- Create RLS policies for fixed_costs
CREATE POLICY "Users can manage fixed costs in their establishment" 
  ON public.fixed_costs FOR ALL 
  USING (
    establishment_id IN (
      SELECT establishment_id FROM public.profiles 
      WHERE user_id = auth.uid()
    )
  );

-- Create RLS policies for ingredients
CREATE POLICY "Users can manage ingredients in their establishment" 
  ON public.ingredients FOR ALL 
  USING (
    establishment_id IN (
      SELECT establishment_id FROM public.profiles 
      WHERE user_id = auth.uid()
    )
  );

-- Create RLS policies for product_ingredients
CREATE POLICY "Users can manage product ingredients" 
  ON public.product_ingredients FOR ALL 
  USING (
    product_id IN (
      SELECT id FROM public.products 
      WHERE establishment_id IN (
        SELECT establishment_id FROM public.profiles 
        WHERE user_id = auth.uid()
      )
    )
  );

-- Create RLS policies for orders
CREATE POLICY "Users can manage orders in their establishment" 
  ON public.orders FOR ALL 
  USING (
    establishment_id IN (
      SELECT establishment_id FROM public.profiles 
      WHERE user_id = auth.uid()
    )
  );

-- Create RLS policies for order_items
CREATE POLICY "Users can manage order items through orders" 
  ON public.order_items FOR ALL 
  USING (
    order_id IN (
      SELECT id FROM public.orders 
      WHERE establishment_id IN (
        SELECT establishment_id FROM public.profiles 
        WHERE user_id = auth.uid()
      )
    )
  );

-- Create triggers for updated_at
CREATE TRIGGER update_customers_updated_at
  BEFORE UPDATE ON public.customers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_customer_groups_updated_at
  BEFORE UPDATE ON public.customer_groups
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_fixed_costs_updated_at
  BEFORE UPDATE ON public.fixed_costs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ingredients_updated_at
  BEFORE UPDATE ON public.ingredients
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();