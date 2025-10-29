-- Add missing columns to establishments
ALTER TABLE public.establishments 
ADD COLUMN IF NOT EXISTS admin_password_hash text,
ADD COLUMN IF NOT EXISTS pix_key_locked boolean DEFAULT false;

-- Add missing columns to ingredients
ALTER TABLE public.ingredients
ADD COLUMN IF NOT EXISTS unit_cost numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS quantity_purchased numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_cost numeric DEFAULT 0;

-- Add missing columns to fixed_costs
ALTER TABLE public.fixed_costs
ADD COLUMN IF NOT EXISTS start_date date DEFAULT CURRENT_DATE;

-- Add missing column to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS is_admin boolean DEFAULT false;

-- Create audit_logs table
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid REFERENCES public.establishments(id) NOT NULL,
  user_id uuid REFERENCES auth.users(id),
  action text NOT NULL,
  table_name text NOT NULL,
  old_values jsonb,
  new_values jsonb,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view audit logs from their establishment"
ON public.audit_logs FOR SELECT
USING (establishment_id IN (
  SELECT establishment_id FROM public.profiles WHERE user_id = auth.uid()
));

-- Create pix_payments table
CREATE TABLE IF NOT EXISTS public.pix_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid REFERENCES public.establishments(id) NOT NULL,
  order_id uuid REFERENCES public.orders(id),
  amount numeric NOT NULL,
  status text DEFAULT 'pending' NOT NULL,
  qr_code text,
  payment_id text,
  payer_name text,
  payer_document text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  paid_at timestamp with time zone,
  expires_at timestamp with time zone
);

ALTER TABLE public.pix_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage pix payments in their establishment"
ON public.pix_payments FOR ALL
USING (establishment_id IN (
  SELECT establishment_id FROM public.profiles WHERE user_id = auth.uid()
));

-- Create suppliers table
CREATE TABLE IF NOT EXISTS public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid REFERENCES public.establishments(id) NOT NULL,
  name text NOT NULL,
  contact_name text,
  email text,
  phone text,
  address text,
  cnpj text,
  notes text,
  active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage suppliers in their establishment"
ON public.suppliers FOR ALL
USING (establishment_id IN (
  SELECT establishment_id FROM public.profiles WHERE user_id = auth.uid()
));

-- Create supplier_products table
CREATE TABLE IF NOT EXISTS public.supplier_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE CASCADE NOT NULL,
  ingredient_id uuid REFERENCES public.ingredients(id),
  product_name text NOT NULL,
  unit_price numeric NOT NULL DEFAULT 0,
  unit_measure text NOT NULL,
  min_order_quantity numeric,
  delivery_days integer,
  active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.supplier_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage supplier products"
ON public.supplier_products FOR ALL
USING (supplier_id IN (
  SELECT id FROM public.suppliers WHERE establishment_id IN (
    SELECT establishment_id FROM public.profiles WHERE user_id = auth.uid()
  )
));

-- Create supplier_orders table
CREATE TABLE IF NOT EXISTS public.supplier_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid REFERENCES public.establishments(id) NOT NULL,
  supplier_id uuid REFERENCES public.suppliers(id) NOT NULL,
  order_number text NOT NULL,
  order_date date DEFAULT CURRENT_DATE NOT NULL,
  expected_delivery_date date,
  actual_delivery_date date,
  total_amount numeric NOT NULL DEFAULT 0,
  payment_due_date date,
  payment_method text,
  payment_status text DEFAULT 'pending' NOT NULL,
  payment_date date,
  delivery_status text DEFAULT 'pending' NOT NULL,
  notes text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.supplier_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage supplier orders in their establishment"
ON public.supplier_orders FOR ALL
USING (establishment_id IN (
  SELECT establishment_id FROM public.profiles WHERE user_id = auth.uid()
));

-- Create supplier_order_items table
CREATE TABLE IF NOT EXISTS public.supplier_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_order_id uuid REFERENCES public.supplier_orders(id) ON DELETE CASCADE NOT NULL,
  supplier_product_id uuid REFERENCES public.supplier_products(id),
  product_name text NOT NULL,
  quantity numeric NOT NULL,
  unit_price numeric NOT NULL,
  total_price numeric NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.supplier_order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage supplier order items"
ON public.supplier_order_items FOR ALL
USING (supplier_order_id IN (
  SELECT id FROM public.supplier_orders WHERE establishment_id IN (
    SELECT establishment_id FROM public.profiles WHERE user_id = auth.uid()
  )
));

-- Create triggers for updated_at
CREATE OR REPLACE TRIGGER update_suppliers_updated_at
  BEFORE UPDATE ON public.suppliers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE TRIGGER update_supplier_products_updated_at
  BEFORE UPDATE ON public.supplier_products
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE TRIGGER update_supplier_orders_updated_at
  BEFORE UPDATE ON public.supplier_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();