-- Remove duplicate products and add missing beverages
-- First, let's remove duplicate products (keep only one of each)
DELETE FROM products 
WHERE id IN (
  SELECT id 
  FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY name, category_id ORDER BY created_at) as rn 
    FROM products
  ) t 
  WHERE rn > 1
);

-- Add beverages to BEBIDAS category
INSERT INTO products (establishment_id, category_id, name, description, price, active) VALUES
-- Coca Cola
('505f64b4-322f-4a9b-9a5a-1709d0ce3c8f', 'bbd1fc35-7101-46c4-a5bd-e9234c983b99', 'Coca Cola 350ml', 'Refrigerante Coca Cola lata 350ml', 4.50, true),
('505f64b4-322f-4a9b-9a5a-1709d0ce3c8f', 'bbd1fc35-7101-46c4-a5bd-e9234c983b99', 'Coca Cola 600ml', 'Refrigerante Coca Cola garrafa 600ml', 6.00, true),
('505f64b4-322f-4a9b-9a5a-1709d0ce3c8f', 'bbd1fc35-7101-46c4-a5bd-e9234c983b99', 'Coca Cola 2L', 'Refrigerante Coca Cola garrafa 2L', 8.50, true),

-- Guaraná Antarctica  
('505f64b4-322f-4a9b-9a5a-1709d0ce3c8f', 'bbd1fc35-7101-46c4-a5bd-e9234c983b99', 'Guaraná Antarctica 350ml', 'Refrigerante Guaraná Antarctica lata 350ml', 4.50, true),
('505f64b4-322f-4a9b-9a5a-1709d0ce3c8f', 'bbd1fc35-7101-46c4-a5bd-e9234c983b99', 'Guaraná Antarctica 600ml', 'Refrigerante Guaraná Antarctica garrafa 600ml', 6.00, true),
('505f64b4-322f-4a9b-9a5a-1709d0ce3c8f', 'bbd1fc35-7101-46c4-a5bd-e9234c983b99', 'Guaraná Antarctica 2L', 'Refrigerante Guaraná Antarctica garrafa 2L', 8.50, true),

-- Sucos
('505f64b4-322f-4a9b-9a5a-1709d0ce3c8f', 'bbd1fc35-7101-46c4-a5bd-e9234c983b99', 'Suco de Laranja 300ml', 'Suco natural de laranja 300ml', 5.00, true),
('505f64b4-322f-4a9b-9a5a-1709d0ce3c8f', 'bbd1fc35-7101-46c4-a5bd-e9234c983b99', 'Suco de Uva 300ml', 'Suco natural de uva 300ml', 5.00, true),
('505f64b4-322f-4a9b-9a5a-1709d0ce3c8f', 'bbd1fc35-7101-46c4-a5bd-e9234c983b99', 'Suco de Maracujá 300ml', 'Suco natural de maracujá 300ml', 5.00, true),

-- Água
('505f64b4-322f-4a9b-9a5a-1709d0ce3c8f', 'bbd1fc35-7101-46c4-a5bd-e9234c983b99', 'Água Mineral 500ml', 'Água mineral sem gás 500ml', 3.00, true),
('505f64b4-322f-4a9b-9a5a-1709d0ce3c8f', 'bbd1fc35-7101-46c4-a5bd-e9234c983b99', 'Água com Gás 500ml', 'Água mineral com gás 500ml', 3.50, true);