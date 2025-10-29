-- First, let's create categories for the products
INSERT INTO public.categories (name, description, establishment_id, active, sort_order) 
SELECT 'Hamburguers', 'Categoria de hamburguers', p.establishment_id, true, 1
FROM public.profiles p
WHERE p.establishment_id IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO public.categories (name, description, establishment_id, active, sort_order) 
SELECT 'Acompanhamentos', 'Categoria de acompanhamentos', p.establishment_id, true, 2
FROM public.profiles p
WHERE p.establishment_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- Now let's insert the hamburgers products
INSERT INTO public.products (name, description, price, category_id, establishment_id, active, tags, ingredients)
SELECT 
  'Na Brasa simples',
  'Hamburguer simples - pode escolher 1 molho grátis (Mostarda e Mel, Bacon, Alho ou Ervas). Molhos adicionais custam R$ 2,00 cada.',
  15.00,
  c.id,
  p.establishment_id,
  true,
  '["molhos-opcoes"]'::jsonb,
  '["Mostarda e Mel", "Bacon", "Alho", "Ervas"]'::jsonb
FROM public.profiles p
JOIN public.categories c ON c.establishment_id = p.establishment_id AND c.name = 'Hamburguers'
WHERE p.establishment_id IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO public.products (name, description, price, category_id, establishment_id, active, tags, ingredients)
SELECT 
  'Na Brasa duplo',
  'Hamburguer duplo - pode escolher 1 molho grátis (Mostarda e Mel, Bacon, Alho ou Ervas). Molhos adicionais custam R$ 2,00 cada.',
  23.00,
  c.id,
  p.establishment_id,
  true,
  '["molhos-opcoes"]'::jsonb,
  '["Mostarda e Mel", "Bacon", "Alho", "Ervas"]'::jsonb
FROM public.profiles p
JOIN public.categories c ON c.establishment_id = p.establishment_id AND c.name = 'Hamburguers'
WHERE p.establishment_id IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO public.products (name, description, price, category_id, establishment_id, active, tags, ingredients)
SELECT 
  'Na Brasa triplo',
  'Hamburguer triplo - pode escolher 2 molhos grátis (Mostarda e Mel, Bacon, Alho ou Ervas). Molhos adicionais custam R$ 2,00 cada.',
  30.00,
  c.id,
  p.establishment_id,
  true,
  '["molhos-opcoes", "molhos-gratis-2"]'::jsonb,
  '["Mostarda e Mel", "Bacon", "Alho", "Ervas"]'::jsonb
FROM public.profiles p
JOIN public.categories c ON c.establishment_id = p.establishment_id AND c.name = 'Hamburguers'
WHERE p.establishment_id IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO public.products (name, description, price, category_id, establishment_id, active, tags, ingredients)
SELECT 
  'Na Brasa Especial simples',
  'Hamburguer especial simples - pode escolher 1 molho grátis (Mostarda e Mel, Bacon, Alho ou Ervas). Molhos adicionais custam R$ 2,00 cada.',
  20.00,
  c.id,
  p.establishment_id,
  true,
  '["molhos-opcoes"]'::jsonb,
  '["Mostarda e Mel", "Bacon", "Alho", "Ervas"]'::jsonb
FROM public.profiles p
JOIN public.categories c ON c.establishment_id = p.establishment_id AND c.name = 'Hamburguers'
WHERE p.establishment_id IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO public.products (name, description, price, category_id, establishment_id, active, tags, ingredients)
SELECT 
  'Na Brasa Especial duplo',
  'Hamburguer especial duplo - pode escolher 1 molho grátis (Mostarda e Mel, Bacon, Alho ou Ervas). Molhos adicionais custam R$ 2,00 cada.',
  27.00,
  c.id,
  p.establishment_id,
  true,
  '["molhos-opcoes"]'::jsonb,
  '["Mostarda e Mel", "Bacon", "Alho", "Ervas"]'::jsonb
FROM public.profiles p
JOIN public.categories c ON c.establishment_id = p.establishment_id AND c.name = 'Hamburguers'
WHERE p.establishment_id IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO public.products (name, description, price, category_id, establishment_id, active, tags, ingredients)
SELECT 
  'Na Brasa Especial triplo',
  'Hamburguer especial triplo - pode escolher 2 molhos grátis (Mostarda e Mel, Bacon, Alho ou Ervas). Molhos adicionais custam R$ 2,00 cada.',
  32.00,
  c.id,
  p.establishment_id,
  true,
  '["molhos-opcoes", "molhos-gratis-2"]'::jsonb,
  '["Mostarda e Mel", "Bacon", "Alho", "Ervas"]'::jsonb
FROM public.profiles p
JOIN public.categories c ON c.establishment_id = p.establishment_id AND c.name = 'Hamburguers'
WHERE p.establishment_id IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO public.products (name, description, price, category_id, establishment_id, active, tags, ingredients)
SELECT 
  'Na Brasa Supremo simples',
  'Hamburguer supremo simples - pode escolher 1 molho grátis (Mostarda e Mel, Bacon, Alho ou Ervas). Molhos adicionais custam R$ 2,00 cada.',
  20.00,
  c.id,
  p.establishment_id,
  true,
  '["molhos-opcoes"]'::jsonb,
  '["Mostarda e Mel", "Bacon", "Alho", "Ervas"]'::jsonb
FROM public.profiles p
JOIN public.categories c ON c.establishment_id = p.establishment_id AND c.name = 'Hamburguers'
WHERE p.establishment_id IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO public.products (name, description, price, category_id, establishment_id, active, tags, ingredients)
SELECT 
  'Na Brasa Supremo duplo',
  'Hamburguer supremo duplo - pode escolher 1 molho grátis (Mostarda e Mel, Bacon, Alho ou Ervas). Molhos adicionais custam R$ 2,00 cada.',
  27.00,
  c.id,
  p.establishment_id,
  true,
  '["molhos-opcoes"]'::jsonb,
  '["Mostarda e Mel", "Bacon", "Alho", "Ervas"]'::jsonb
FROM public.profiles p
JOIN public.categories c ON c.establishment_id = p.establishment_id AND c.name = 'Hamburguers'
WHERE p.establishment_id IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO public.products (name, description, price, category_id, establishment_id, active, tags, ingredients)
SELECT 
  'Na Brasa Supremo triplo',
  'Hamburguer supremo triplo - pode escolher 2 molhos grátis (Mostarda e Mel, Bacon, Alho ou Ervas). Molhos adicionais custam R$ 2,00 cada.',
  32.00,
  c.id,
  p.establishment_id,
  true,
  '["molhos-opcoes", "molhos-gratis-2"]'::jsonb,
  '["Mostarda e Mel", "Bacon", "Alho", "Ervas"]'::jsonb
FROM public.profiles p
JOIN public.categories c ON c.establishment_id = p.establishment_id AND c.name = 'Hamburguers'
WHERE p.establishment_id IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO public.products (name, description, price, category_id, establishment_id, active, tags, ingredients)
SELECT 
  'Na Brasa Frango simples',
  'Hamburguer de frango simples - pode escolher 1 molho grátis (Mostarda e Mel, Bacon, Alho ou Ervas). Molhos adicionais custam R$ 2,00 cada.',
  20.00,
  c.id,
  p.establishment_id,
  true,
  '["molhos-opcoes"]'::jsonb,
  '["Mostarda e Mel", "Bacon", "Alho", "Ervas"]'::jsonb
FROM public.profiles p
JOIN public.categories c ON c.establishment_id = p.establishment_id AND c.name = 'Hamburguers'
WHERE p.establishment_id IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO public.products (name, description, price, category_id, establishment_id, active, tags, ingredients)
SELECT 
  'Na Brasa Frango duplo',
  'Hamburguer de frango duplo - pode escolher 1 molho grátis (Mostarda e Mel, Bacon, Alho ou Ervas). Molhos adicionais custam R$ 2,00 cada.',
  27.00,
  c.id,
  p.establishment_id,
  true,
  '["molhos-opcoes"]'::jsonb,
  '["Mostarda e Mel", "Bacon", "Alho", "Ervas"]'::jsonb
FROM public.profiles p
JOIN public.categories c ON c.establishment_id = p.establishment_id AND c.name = 'Hamburguers'
WHERE p.establishment_id IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO public.products (name, description, price, category_id, establishment_id, active, tags, ingredients)
SELECT 
  'Na Brasa Frango triplo',
  'Hamburguer de frango triplo - pode escolher 2 molhos grátis (Mostarda e Mel, Bacon, Alho ou Ervas). Molhos adicionais custam R$ 2,00 cada.',
  32.00,
  c.id,
  p.establishment_id,
  true,
  '["molhos-opcoes", "molhos-gratis-2"]'::jsonb,
  '["Mostarda e Mel", "Bacon", "Alho", "Ervas"]'::jsonb
FROM public.profiles p
JOIN public.categories c ON c.establishment_id = p.establishment_id AND c.name = 'Hamburguers'
WHERE p.establishment_id IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO public.products (name, description, price, category_id, establishment_id, active, tags, ingredients)
SELECT 
  'Na Brasa Kids',
  'Hamburguer kids - pode escolher 1 molho grátis (Mostarda e Mel, Bacon, Alho ou Ervas). Molhos adicionais custam R$ 2,00 cada.',
  10.00,
  c.id,
  p.establishment_id,
  true,
  '["molhos-opcoes"]'::jsonb,
  '["Mostarda e Mel", "Bacon", "Alho", "Ervas"]'::jsonb
FROM public.profiles p
JOIN public.categories c ON c.establishment_id = p.establishment_id AND c.name = 'Hamburguers'
WHERE p.establishment_id IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO public.products (name, description, price, category_id, establishment_id, active, tags, ingredients)
SELECT 
  'Na Brasa Nutella',
  'Hamburguer doce com Nutella - sem opção de molhos.',
  12.00,
  c.id,
  p.establishment_id,
  true,
  '["sem-molhos"]'::jsonb,
  '[]'::jsonb
FROM public.profiles p
JOIN public.categories c ON c.establishment_id = p.establishment_id AND c.name = 'Hamburguers'
WHERE p.establishment_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- Now let's insert the side dishes (acompanhamentos)
INSERT INTO public.products (name, description, price, category_id, establishment_id, active, tags, ingredients)
SELECT 
  'Batata P',
  'Batata pequena',
  8.00,
  c.id,
  p.establishment_id,
  true,
  '["batata"]'::jsonb,
  '[]'::jsonb
FROM public.profiles p
JOIN public.categories c ON c.establishment_id = p.establishment_id AND c.name = 'Acompanhamentos'
WHERE p.establishment_id IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO public.products (name, description, price, category_id, establishment_id, active, tags, ingredients)
SELECT 
  'Batata M',
  'Batata média',
  16.00,
  c.id,
  p.establishment_id,
  true,
  '["batata", "pode-rechear"]'::jsonb,
  '[]'::jsonb
FROM public.profiles p
JOIN public.categories c ON c.establishment_id = p.establishment_id AND c.name = 'Acompanhamentos'
WHERE p.establishment_id IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO public.products (name, description, price, category_id, establishment_id, active, tags, ingredients)
SELECT 
  'Batata M recheada',
  'Batata média recheada',
  21.00,
  c.id,
  p.establishment_id,
  true,
  '["batata", "recheada"]'::jsonb,
  '[]'::jsonb
FROM public.profiles p
JOIN public.categories c ON c.establishment_id = p.establishment_id AND c.name = 'Acompanhamentos'
WHERE p.establishment_id IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO public.products (name, description, price, category_id, establishment_id, active, tags, ingredients)
SELECT 
  'Batata G',
  'Batata grande',
  22.00,
  c.id,
  p.establishment_id,
  true,
  '["batata", "pode-rechear"]'::jsonb,
  '[]'::jsonb
FROM public.profiles p
JOIN public.categories c ON c.establishment_id = p.establishment_id AND c.name = 'Acompanhamentos'
WHERE p.establishment_id IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO public.products (name, description, price, category_id, establishment_id, active, tags, ingredients)
SELECT 
  'Batata G recheada',
  'Batata grande recheada',
  30.00,
  c.id,
  p.establishment_id,
  true,
  '["batata", "recheada"]'::jsonb,
  '[]'::jsonb
FROM public.profiles p
JOIN public.categories c ON c.establishment_id = p.establishment_id AND c.name = 'Acompanhamentos'
WHERE p.establishment_id IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO public.products (name, description, price, category_id, establishment_id, active, tags, ingredients)
SELECT 
  'Frango no Pote P',
  'Frango no pote pequeno',
  20.00,
  c.id,
  p.establishment_id,
  true,
  '["frango-pote"]'::jsonb,
  '[]'::jsonb
FROM public.profiles p
JOIN public.categories c ON c.establishment_id = p.establishment_id AND c.name = 'Acompanhamentos'
WHERE p.establishment_id IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO public.products (name, description, price, category_id, establishment_id, active, tags, ingredients)
SELECT 
  'Frango no Pote M',
  'Frango no pote médio',
  37.00,
  c.id,
  p.establishment_id,
  true,
  '["frango-pote"]'::jsonb,
  '[]'::jsonb
FROM public.profiles p
JOIN public.categories c ON c.establishment_id = p.establishment_id AND c.name = 'Acompanhamentos'
WHERE p.establishment_id IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO public.products (name, description, price, category_id, establishment_id, active, tags, ingredients)
SELECT 
  'Frango no Pote G',
  'Frango no pote grande',
  50.00,
  c.id,
  p.establishment_id,
  true,
  '["frango-pote"]'::jsonb,
  '[]'::jsonb
FROM public.profiles p
JOIN public.categories c ON c.establishment_id = p.establishment_id AND c.name = 'Acompanhamentos'
WHERE p.establishment_id IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO public.products (name, description, price, category_id, establishment_id, active, tags, ingredients)
SELECT 
  'Fritas Especial + frango M',
  'Batatas fritas especiais com frango médio',
  25.00,
  c.id,
  p.establishment_id,
  true,
  '["fritas-especial"]'::jsonb,
  '[]'::jsonb
FROM public.profiles p
JOIN public.categories c ON c.establishment_id = p.establishment_id AND c.name = 'Acompanhamentos'
WHERE p.establishment_id IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO public.products (name, description, price, category_id, establishment_id, active, tags, ingredients)
SELECT 
  'Fritas Especial + frango G',
  'Batatas fritas especiais com frango grande',
  37.00,
  c.id,
  p.establishment_id,
  true,
  '["fritas-especial"]'::jsonb,
  '[]'::jsonb
FROM public.profiles p
JOIN public.categories c ON c.establishment_id = p.establishment_id AND c.name = 'Acompanhamentos'
WHERE p.establishment_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- Create customers table
CREATE TABLE public.customers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  establishment_id uuid NOT NULL,
  name text NOT NULL,
  phone text,
  address text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- Create policies for customers
CREATE POLICY "Users can manage customers in their establishment" 
ON public.customers 
FOR ALL 
USING (establishment_id IN ( 
  SELECT profiles.establishment_id
  FROM profiles
  WHERE (profiles.user_id = auth.uid())
));

-- Create customer groups table
CREATE TABLE public.customer_groups (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  establishment_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  discount_percentage numeric DEFAULT 0,
  discount_amount numeric DEFAULT 0,
  benefits jsonb DEFAULT '{}'::jsonb,
  active boolean DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.customer_groups ENABLE ROW LEVEL SECURITY;

-- Create policies for customer groups
CREATE POLICY "Users can manage customer groups in their establishment" 
ON public.customer_groups 
FOR ALL 
USING (establishment_id IN ( 
  SELECT profiles.establishment_id
  FROM profiles
  WHERE (profiles.user_id = auth.uid())
));

-- Create many-to-many table for customers and groups
CREATE TABLE public.customer_group_members (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES public.customer_groups(id) ON DELETE CASCADE,
  joined_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(customer_id, group_id)
);

-- Enable RLS
ALTER TABLE public.customer_group_members ENABLE ROW LEVEL SECURITY;

-- Create policies for customer group members
CREATE POLICY "Users can manage customer group members through groups" 
ON public.customer_group_members 
FOR ALL 
USING (group_id IN ( 
  SELECT customer_groups.id
  FROM customer_groups
  WHERE customer_groups.establishment_id IN ( 
    SELECT profiles.establishment_id
    FROM profiles
    WHERE (profiles.user_id = auth.uid())
  )
));

-- Add triggers for updated_at
CREATE TRIGGER update_customers_updated_at
BEFORE UPDATE ON public.customers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_customer_groups_updated_at
BEFORE UPDATE ON public.customer_groups
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();