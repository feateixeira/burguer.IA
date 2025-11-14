-- First, let's create the BEBIDAS category
INSERT INTO categories (name, description, establishment_id, sort_order, active)
SELECT 'BEBIDAS', 'Refrigerantes, sucos e bebidas diversas', e.id, 3, true
FROM establishments e
WHERE e.slug = 'hamburgueria-na-brasa'
AND NOT EXISTS (
  SELECT 1 FROM categories c 
  WHERE c.name = 'BEBIDAS' 
  AND c.establishment_id = e.id
);

-- Update all beverages to use the BEBIDAS category
UPDATE products 
SET category_id = (
  SELECT c.id 
  FROM categories c 
  JOIN establishments e ON c.establishment_id = e.id
  WHERE c.name = 'BEBIDAS' 
  AND e.slug = 'hamburgueria-na-brasa'
  LIMIT 1
)
WHERE name LIKE '%Coca-Cola%' 
   OR name LIKE '%Guaraná%' 
   OR name LIKE '%Sprit%' 
   OR name LIKE '%Sprite%'
   OR name LIKE '%Dell Vale%'
   OR name LIKE '%Água%'
   OR name LIKE '%Suco%'
   OR name LIKE '%Creme%'
   OR name LIKE '%SucoKids%';