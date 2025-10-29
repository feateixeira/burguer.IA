-- Remove duplicate categories and fix product assignments
-- First, let's keep only one category of each type and update products

-- Update all products in duplicate Hamburguers category to use the first one
UPDATE products 
SET category_id = 'e14217e0-4e7a-463a-8a19-0d316871e60d'
WHERE category_id = '4112d095-d748-491d-820b-6cd2ee26ab66';

-- Update all products in duplicate Acompanhamentos category to use the first one  
UPDATE products 
SET category_id = 'fcf1ae09-50a0-42e6-8e09-8b22a4a03e21'
WHERE category_id = 'c1afd6db-533f-46f2-9424-63e06668cd3b';

-- Update drinks to use BEBIDAS category
UPDATE products 
SET category_id = 'bbd1fc35-7101-46c4-a5bd-e9234c983b99'
WHERE name IN (
  'Coca Cola 350ml', 'Coca Cola 600ml', 'Coca Cola 2L',
  'Guaraná Antarctica 350ml', 'Guaraná Antarctica 600ml', 'Guaraná Antarctica 2L',
  'Suco de Laranja 300ml', 'Suco de Uva 300ml', 'Suco de Maracujá 300ml',
  'Água Mineral 500ml', 'Água com Gás 500ml'
);

-- Delete duplicate categories
DELETE FROM categories WHERE id = '4112d095-d748-491d-820b-6cd2ee26ab66';
DELETE FROM categories WHERE id = 'c1afd6db-533f-46f2-9424-63e06668cd3b';

-- Update category names to match PDV expectations
UPDATE categories SET name = 'HAMBÚRGUERES' WHERE id = 'e14217e0-4e7a-463a-8a19-0d316871e60d';
UPDATE categories SET name = 'ACOMPANHAMENTOS' WHERE id = 'fcf1ae09-50a0-42e6-8e09-8b22a4a03e21';