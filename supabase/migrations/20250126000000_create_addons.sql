-- Create addons table
CREATE TABLE IF NOT EXISTS public.addons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  establishment_id UUID NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL DEFAULT 0,
  active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create category_addons table (many-to-many relationship)
CREATE TABLE IF NOT EXISTS public.category_addons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  addon_id UUID NOT NULL REFERENCES public.addons(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(category_id, addon_id)
);

-- Create product_addons table (many-to-many relationship)
CREATE TABLE IF NOT EXISTS public.product_addons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  addon_id UUID NOT NULL REFERENCES public.addons(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(product_id, addon_id)
);

-- Enable Row Level Security
ALTER TABLE public.addons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.category_addons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_addons ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for addons
CREATE POLICY "Users can manage addons in their establishment" 
  ON public.addons FOR ALL 
  USING (
    establishment_id IN (
      SELECT establishment_id FROM public.profiles 
      WHERE user_id = auth.uid()
    )
  );

-- Create RLS policies for category_addons
CREATE POLICY "Users can manage category_addons in their establishment" 
  ON public.category_addons FOR ALL 
  USING (
    category_id IN (
      SELECT c.id FROM public.categories c
      INNER JOIN public.profiles p ON c.establishment_id = p.establishment_id
      WHERE p.user_id = auth.uid()
    )
    AND addon_id IN (
      SELECT a.id FROM public.addons a
      INNER JOIN public.profiles p ON a.establishment_id = p.establishment_id
      WHERE p.user_id = auth.uid()
    )
  );

-- Create RLS policies for product_addons
CREATE POLICY "Users can manage product_addons in their establishment" 
  ON public.product_addons FOR ALL 
  USING (
    product_id IN (
      SELECT pr.id FROM public.products pr
      INNER JOIN public.profiles p ON pr.establishment_id = p.establishment_id
      WHERE p.user_id = auth.uid()
    )
    AND addon_id IN (
      SELECT a.id FROM public.addons a
      INNER JOIN public.profiles p ON a.establishment_id = p.establishment_id
      WHERE p.user_id = auth.uid()
    )
  );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_addons_establishment_id ON public.addons(establishment_id);
CREATE INDEX IF NOT EXISTS idx_addons_active ON public.addons(active);
CREATE INDEX IF NOT EXISTS idx_category_addons_category_id ON public.category_addons(category_id);
CREATE INDEX IF NOT EXISTS idx_category_addons_addon_id ON public.category_addons(addon_id);
CREATE INDEX IF NOT EXISTS idx_product_addons_product_id ON public.product_addons(product_id);
CREATE INDEX IF NOT EXISTS idx_product_addons_addon_id ON public.product_addons(addon_id);

-- Create trigger for updated_at
CREATE TRIGGER update_addons_updated_at
  BEFORE UPDATE ON public.addons
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

