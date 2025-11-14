-- Create categories table
CREATE TABLE public.categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  establishment_id UUID NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  sort_order INTEGER DEFAULT 0,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create products table
CREATE TABLE public.products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  establishment_id UUID NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL DEFAULT 0,
  image_url TEXT,
  sku TEXT,
  ingredients JSONB DEFAULT '[]',
  tags JSONB DEFAULT '[]',
  active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for categories
CREATE POLICY "Users can manage categories in their establishment" 
  ON public.categories FOR ALL 
  USING (
    establishment_id IN (
      SELECT establishment_id FROM public.profiles 
      WHERE user_id = auth.uid()
    )
  );

-- Create RLS policies for products
CREATE POLICY "Users can manage products in their establishment" 
  ON public.products FOR ALL 
  USING (
    establishment_id IN (
      SELECT establishment_id FROM public.profiles 
      WHERE user_id = auth.uid()
    )
  );

-- Create triggers for updated_at
CREATE TRIGGER update_categories_updated_at
  BEFORE UPDATE ON public.categories
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert establishment for Na Brasa
INSERT INTO public.establishments (id, name, slug)
VALUES (
  'c1b2a3d4-5e6f-7a8b-9c0d-1e2f3a4b5c6d',
  'Na Brasa',
  'nabrasa'
);

-- Insert profile for user
INSERT INTO public.profiles (user_id, establishment_id, full_name, phone)
VALUES (
  '213a8e36-66f8-42b3-901c-6f13418499af',
  'c1b2a3d4-5e6f-7a8b-9c0d-1e2f3a4b5c6d',
  'Na Brasa Admin',
  ''
);

-- Insert user role as admin
INSERT INTO public.user_roles (user_id, establishment_id, role)
VALUES (
  '213a8e36-66f8-42b3-901c-6f13418499af',
  'c1b2a3d4-5e6f-7a8b-9c0d-1e2f3a4b5c6d',
  'admin'
);

-- Insert categories
INSERT INTO public.categories (id, establishment_id, name, sort_order, active) VALUES
('a1b2c3d4-1111-1111-1111-111111111111', 'c1b2a3d4-5e6f-7a8b-9c0d-1e2f3a4b5c6d', 'Hambúrgueres', 1, true),
('a1b2c3d4-2222-2222-2222-222222222222', 'c1b2a3d4-5e6f-7a8b-9c0d-1e2f3a4b5c6d', 'Acompanhamentos', 2, true),
('a1b2c3d4-3333-3333-3333-333333333333', 'c1b2a3d4-5e6f-7a8b-9c0d-1e2f3a4b5c6d', 'Bebidas', 3, true);

-- Insert Hambúrgueres products
INSERT INTO public.products (establishment_id, category_id, name, price, description, active) VALUES
('c1b2a3d4-5e6f-7a8b-9c0d-1e2f3a4b5c6d', 'a1b2c3d4-1111-1111-1111-111111111111', 'Na Brasa simples', 15.00, '1 molho grátis (Mostarda e Mel, Bacon, Alho ou Ervas)', true),
('c1b2a3d4-5e6f-7a8b-9c0d-1e2f3a4b5c6d', 'a1b2c3d4-1111-1111-1111-111111111111', 'Na Brasa duplo', 23.00, '1 molho grátis (Mostarda e Mel, Bacon, Alho ou Ervas)', true),
('c1b2a3d4-5e6f-7a8b-9c0d-1e2f3a4b5c6d', 'a1b2c3d4-1111-1111-1111-111111111111', 'Na Brasa triplo', 30.00, '2 molhos grátis (Mostarda e Mel, Bacon, Alho ou Ervas)', true),
('c1b2a3d4-5e6f-7a8b-9c0d-1e2f3a4b5c6d', 'a1b2c3d4-1111-1111-1111-111111111111', 'Na Brasa Especial simples', 22.00, '1 molho grátis (Mostarda e Mel, Bacon, Alho ou Ervas)', true),
('c1b2a3d4-5e6f-7a8b-9c0d-1e2f3a4b5c6d', 'a1b2c3d4-1111-1111-1111-111111111111', 'Na Brasa Especial duplo', 30.00, '1 molho grátis (Mostarda e Mel, Bacon, Alho ou Ervas)', true),
('c1b2a3d4-5e6f-7a8b-9c0d-1e2f3a4b5c6d', 'a1b2c3d4-1111-1111-1111-111111111111', 'Na Brasa Especial triplo', 35.00, '2 molhos grátis (Mostarda e Mel, Bacon, Alho ou Ervas)', true),
('c1b2a3d4-5e6f-7a8b-9c0d-1e2f3a4b5c6d', 'a1b2c3d4-1111-1111-1111-111111111111', 'Na Brasa Supremo simples', 22.00, '1 molho grátis (Mostarda e Mel, Bacon, Alho ou Ervas)', true),
('c1b2a3d4-5e6f-7a8b-9c0d-1e2f3a4b5c6d', 'a1b2c3d4-1111-1111-1111-111111111111', 'Na Brasa Supremo duplo', 30.00, '1 molho grátis (Mostarda e Mel, Bacon, Alho ou Ervas)', true),
('c1b2a3d4-5e6f-7a8b-9c0d-1e2f3a4b5c6d', 'a1b2c3d4-1111-1111-1111-111111111111', 'Na Brasa Supremo triplo', 35.00, '2 molhos grátis (Mostarda e Mel, Bacon, Alho ou Ervas)', true),
('c1b2a3d4-5e6f-7a8b-9c0d-1e2f3a4b5c6d', 'a1b2c3d4-1111-1111-1111-111111111111', 'Na Brasa Frango simples', 22.00, '1 molho grátis (Mostarda e Mel, Bacon, Alho ou Ervas)', true),
('c1b2a3d4-5e6f-7a8b-9c0d-1e2f3a4b5c6d', 'a1b2c3d4-1111-1111-1111-111111111111', 'Na Brasa Frango duplo', 30.00, '1 molho grátis (Mostarda e Mel, Bacon, Alho ou Ervas)', true),
('c1b2a3d4-5e6f-7a8b-9c0d-1e2f3a4b5c6d', 'a1b2c3d4-1111-1111-1111-111111111111', 'Na Brasa Frango supremo simples', 24.00, '1 molho grátis (Mostarda e Mel, Bacon, Alho ou Ervas)', true),
('c1b2a3d4-5e6f-7a8b-9c0d-1e2f3a4b5c6d', 'a1b2c3d4-1111-1111-1111-111111111111', 'Na Brasa Frango supremo duplo', 32.00, '1 molho grátis (Mostarda e Mel, Bacon, Alho ou Ervas)', true),
('c1b2a3d4-5e6f-7a8b-9c0d-1e2f3a4b5c6d', 'a1b2c3d4-1111-1111-1111-111111111111', 'Na Brasa salada simples', 16.00, '1 molho grátis (Mostarda e Mel, Bacon, Alho ou Ervas)', true),
('c1b2a3d4-5e6f-7a8b-9c0d-1e2f3a4b5c6d', 'a1b2c3d4-1111-1111-1111-111111111111', 'Na Brasa salada duplo', 24.00, '1 molho grátis (Mostarda e Mel, Bacon, Alho ou Ervas)', true),
('c1b2a3d4-5e6f-7a8b-9c0d-1e2f3a4b5c6d', 'a1b2c3d4-1111-1111-1111-111111111111', 'Na Brasa salada triplo', 31.00, '2 molhos grátis (Mostarda e Mel, Bacon, Alho ou Ervas)', true),
('c1b2a3d4-5e6f-7a8b-9c0d-1e2f3a4b5c6d', 'a1b2c3d4-1111-1111-1111-111111111111', 'Na Brasa ENO', 42.00, '1 molho grátis (Mostarda e Mel, Bacon, Alho ou Ervas)', true);

-- Insert Acompanhamentos products
INSERT INTO public.products (establishment_id, category_id, name, price, active) VALUES
('c1b2a3d4-5e6f-7a8b-9c0d-1e2f3a4b5c6d', 'a1b2c3d4-2222-2222-2222-222222222222', 'Batata P', 8.00, true),
('c1b2a3d4-5e6f-7a8b-9c0d-1e2f3a4b5c6d', 'a1b2c3d4-2222-2222-2222-222222222222', 'Batata M', 16.00, true),
('c1b2a3d4-5e6f-7a8b-9c0d-1e2f3a4b5c6d', 'a1b2c3d4-2222-2222-2222-222222222222', 'Batata M recheada', 22.00, true),
('c1b2a3d4-5e6f-7a8b-9c0d-1e2f3a4b5c6d', 'a1b2c3d4-2222-2222-2222-222222222222', 'Batata G', 22.00, true),
('c1b2a3d4-5e6f-7a8b-9c0d-1e2f3a4b5c6d', 'a1b2c3d4-2222-2222-2222-222222222222', 'Batata G recheada', 32.00, true),
('c1b2a3d4-5e6f-7a8b-9c0d-1e2f3a4b5c6d', 'a1b2c3d4-2222-2222-2222-222222222222', 'Frango no Pote P', 20.00, true),
('c1b2a3d4-5e6f-7a8b-9c0d-1e2f3a4b5c6d', 'a1b2c3d4-2222-2222-2222-222222222222', 'Frango no Pote M', 30.00, true),
('c1b2a3d4-5e6f-7a8b-9c0d-1e2f3a4b5c6d', 'a1b2c3d4-2222-2222-2222-222222222222', 'Frango no Pote G', 50.00, true),
('c1b2a3d4-5e6f-7a8b-9c0d-1e2f3a4b5c6d', 'a1b2c3d4-2222-2222-2222-222222222222', 'Fritas Especial + frango M', 30.00, true),
('c1b2a3d4-5e6f-7a8b-9c0d-1e2f3a4b5c6d', 'a1b2c3d4-2222-2222-2222-222222222222', 'Fritas Especial + frango G', 45.00, true),
('c1b2a3d4-5e6f-7a8b-9c0d-1e2f3a4b5c6d', 'a1b2c3d4-2222-2222-2222-222222222222', 'Cebolas empanadas M', 20.00, true),
('c1b2a3d4-5e6f-7a8b-9c0d-1e2f3a4b5c6d', 'a1b2c3d4-2222-2222-2222-222222222222', 'Cebolas empanadas G', 30.00, true),
('c1b2a3d4-5e6f-7a8b-9c0d-1e2f3a4b5c6d', 'a1b2c3d4-2222-2222-2222-222222222222', 'Cebolas empanadas + Fritas M', 30.00, true),
('c1b2a3d4-5e6f-7a8b-9c0d-1e2f3a4b5c6d', 'a1b2c3d4-2222-2222-2222-222222222222', 'Cebolas empanadas + Fritas G', 50.00, true),
('c1b2a3d4-5e6f-7a8b-9c0d-1e2f3a4b5c6d', 'a1b2c3d4-2222-2222-2222-222222222222', 'Mini Chickens M', 25.00, true),
('c1b2a3d4-5e6f-7a8b-9c0d-1e2f3a4b5c6d', 'a1b2c3d4-2222-2222-2222-222222222222', 'Mini Chickens G', 40.00, true);

-- Insert Bebidas products
INSERT INTO public.products (establishment_id, category_id, name, price, description, active) VALUES
('c1b2a3d4-5e6f-7a8b-9c0d-1e2f3a4b5c6d', 'a1b2c3d4-3333-3333-3333-333333333333', 'Refrigerante lata 350ml - Coca Cola', 5.00, 'Coca Cola 350ml', true),
('c1b2a3d4-5e6f-7a8b-9c0d-1e2f3a4b5c6d', 'a1b2c3d4-3333-3333-3333-333333333333', 'Refrigerante lata 350ml - Coca Cola Zero', 5.00, 'Coca Cola Zero 350ml', true),
('c1b2a3d4-5e6f-7a8b-9c0d-1e2f3a4b5c6d', 'a1b2c3d4-3333-3333-3333-333333333333', 'Refrigerante lata 350ml - Guaraná', 5.00, 'Guaraná 350ml', true),
('c1b2a3d4-5e6f-7a8b-9c0d-1e2f3a4b5c6d', 'a1b2c3d4-3333-3333-3333-333333333333', 'Refrigerante 600ml - Coca Cola', 8.00, 'Coca Cola 600ml', true),
('c1b2a3d4-5e6f-7a8b-9c0d-1e2f3a4b5c6d', 'a1b2c3d4-3333-3333-3333-333333333333', 'Refrigerante 600ml - Coca Cola Zero', 8.00, 'Coca Cola Zero 600ml', true),
('c1b2a3d4-5e6f-7a8b-9c0d-1e2f3a4b5c6d', 'a1b2c3d4-3333-3333-3333-333333333333', 'Refrigerante 600ml - Guaraná', 8.00, 'Guaraná 600ml', true),
('c1b2a3d4-5e6f-7a8b-9c0d-1e2f3a4b5c6d', 'a1b2c3d4-3333-3333-3333-333333333333', 'Suco 1 litro - Uva', 8.00, 'Suco de Uva 1L', true),
('c1b2a3d4-5e6f-7a8b-9c0d-1e2f3a4b5c6d', 'a1b2c3d4-3333-3333-3333-333333333333', 'Suco 1 litro - Maracujá', 8.00, 'Suco de Maracujá 1L', true),
('c1b2a3d4-5e6f-7a8b-9c0d-1e2f3a4b5c6d', 'a1b2c3d4-3333-3333-3333-333333333333', 'Suco 1 litro - Laranja', 8.00, 'Suco de Laranja 1L', true),
('c1b2a3d4-5e6f-7a8b-9c0d-1e2f3a4b5c6d', 'a1b2c3d4-3333-3333-3333-333333333333', 'Suco 1 litro - Pêssego', 8.00, 'Suco de Pêssego 1L', true),
('c1b2a3d4-5e6f-7a8b-9c0d-1e2f3a4b5c6d', 'a1b2c3d4-3333-3333-3333-333333333333', 'Refrigerante 2 litros - Coca Cola', 12.00, 'Coca Cola 2L', true),
('c1b2a3d4-5e6f-7a8b-9c0d-1e2f3a4b5c6d', 'a1b2c3d4-3333-3333-3333-333333333333', 'Refrigerante 2 litros - Coca Cola Zero', 12.00, 'Coca Cola Zero 2L', true),
('c1b2a3d4-5e6f-7a8b-9c0d-1e2f3a4b5c6d', 'a1b2c3d4-3333-3333-3333-333333333333', 'Refrigerante 2 litros - Guaraná', 12.00, 'Guaraná 2L', true),
('c1b2a3d4-5e6f-7a8b-9c0d-1e2f3a4b5c6d', 'a1b2c3d4-3333-3333-3333-333333333333', 'Suco Na Brasa 330ml - Morango', 7.00, 'Suco Natural de Morango 330ml', true),
('c1b2a3d4-5e6f-7a8b-9c0d-1e2f3a4b5c6d', 'a1b2c3d4-3333-3333-3333-333333333333', 'Suco Na Brasa 330ml - Acerola', 7.00, 'Suco Natural de Acerola 330ml', true),
('c1b2a3d4-5e6f-7a8b-9c0d-1e2f3a4b5c6d', 'a1b2c3d4-3333-3333-3333-333333333333', 'Suco Na Brasa 330ml - Maracujá', 7.00, 'Suco Natural de Maracujá 330ml', true),
('c1b2a3d4-5e6f-7a8b-9c0d-1e2f3a4b5c6d', 'a1b2c3d4-3333-3333-3333-333333333333', 'Suco Na Brasa 500ml - Morango', 10.00, 'Suco Natural de Morango 500ml', true),
('c1b2a3d4-5e6f-7a8b-9c0d-1e2f3a4b5c6d', 'a1b2c3d4-3333-3333-3333-333333333333', 'Suco Na Brasa 500ml - Acerola', 10.00, 'Suco Natural de Acerola 500ml', true),
('c1b2a3d4-5e6f-7a8b-9c0d-1e2f3a4b5c6d', 'a1b2c3d4-3333-3333-3333-333333333333', 'Suco Na Brasa 500ml - Maracujá', 10.00, 'Suco Natural de Maracujá 500ml', true),
('c1b2a3d4-5e6f-7a8b-9c0d-1e2f3a4b5c6d', 'a1b2c3d4-3333-3333-3333-333333333333', 'Creme Na Brasa 330ml - Morango', 8.00, 'Creme de Morango 330ml', true),
('c1b2a3d4-5e6f-7a8b-9c0d-1e2f3a4b5c6d', 'a1b2c3d4-3333-3333-3333-333333333333', 'Creme Na Brasa 330ml - Maracujá', 8.00, 'Creme de Maracujá 330ml', true),
('c1b2a3d4-5e6f-7a8b-9c0d-1e2f3a4b5c6d', 'a1b2c3d4-3333-3333-3333-333333333333', 'Creme Na Brasa 500ml - Morango', 12.00, 'Creme de Morango 500ml', true),
('c1b2a3d4-5e6f-7a8b-9c0d-1e2f3a4b5c6d', 'a1b2c3d4-3333-3333-3333-333333333333', 'Creme Na Brasa 500ml - Maracujá', 12.00, 'Creme de Maracujá 500ml', true),
('c1b2a3d4-5e6f-7a8b-9c0d-1e2f3a4b5c6d', 'a1b2c3d4-3333-3333-3333-333333333333', 'Água com gás', 4.00, 'Água mineral com gás', true),
('c1b2a3d4-5e6f-7a8b-9c0d-1e2f3a4b5c6d', 'a1b2c3d4-3333-3333-3333-333333333333', 'Água sem gás', 3.00, 'Água mineral sem gás', true);