-- Create establishment for the user
INSERT INTO establishments (name, slug, email, phone, address, subscription_plan, subscription_status)
VALUES (
  'Hamburgueria Na Brasa',
  'hamburgueria-na-brasa',
  'nabrasa.1602@gmail.com',
  '(11) 99999-9999',
  'Rua das Hamburguers, 123',
  'basic',
  'active'
);

-- Create profile for the user
INSERT INTO profiles (user_id, name, email, role, establishment_id)
VALUES (
  '85354f8c-4b74-4d6c-aa41-fe4570fb5f12',
  'Silvio Osmar',
  'nabrasa.1602@gmail.com',
  'manager',
  (SELECT id FROM establishments WHERE slug = 'hamburgueria-na-brasa' LIMIT 1)
);

-- Update products to use the correct establishment_id
UPDATE products 
SET establishment_id = (SELECT id FROM establishments WHERE slug = 'hamburgueria-na-brasa' LIMIT 1)
WHERE establishment_id IS NOT NULL;

-- Update categories to use the correct establishment_id
UPDATE categories 
SET establishment_id = (SELECT id FROM establishments WHERE slug = 'hamburgueria-na-brasa' LIMIT 1)
WHERE establishment_id IS NOT NULL;