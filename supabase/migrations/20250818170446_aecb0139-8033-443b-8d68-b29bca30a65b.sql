-- Insert all beverages into the BEBIDAS category
INSERT INTO products (name, price, description, establishment_id, category_id, active, sort_order)
SELECT 
  beverages.name,
  beverages.price,
  beverages.description,
  e.id as establishment_id,
  c.id as category_id,
  true as active,
  beverages.sort_order
FROM (
  VALUES 
    -- Latas
    ('Coca-Cola Zero lata', 5.00, 'Refrigerante Coca-Cola Zero lata 350ml', 1),
    ('Coca-Cola lata', 5.00, 'Refrigerante Coca-Cola lata 350ml', 2),
    ('Guaraná Zero lata', 5.00, 'Refrigerante Guaraná Zero lata 350ml', 3),
    ('Guaraná lata', 5.00, 'Refrigerante Guaraná lata 350ml', 4),
    
    -- 600ml
    ('Coca-Cola 600ml', 7.50, 'Refrigerante Coca-Cola garrafa 600ml', 5),
    ('Coca-Cola Zero 600ml', 7.50, 'Refrigerante Coca-Cola Zero garrafa 600ml', 6),
    ('Guaraná 600ml', 7.50, 'Refrigerante Guaraná garrafa 600ml', 7),
    ('Guaraná Zero 600ml', 7.50, 'Refrigerante Guaraná Zero garrafa 600ml', 8),
    ('Sprit 600ml', 7.50, 'Refrigerante Sprite garrafa 600ml', 9),
    
    -- 1 litro
    ('Suco Dell Vale Uva 1lt', 8.00, 'Suco Dell Vale sabor uva 1 litro', 10),
    ('Suco Dell Vale Caju 1lt', 8.00, 'Suco Dell Vale sabor caju 1 litro', 11),
    ('Suco Dell Vale Laranja 1lt', 8.00, 'Suco Dell Vale sabor laranja 1 litro', 12),
    
    -- 2 litros
    ('Coca-Cola 2l', 12.00, 'Refrigerante Coca-Cola garrafa 2 litros', 13),
    ('Guaraná 2l', 12.00, 'Refrigerante Guaraná garrafa 2 litros', 14),
    ('Sprit 2l', 12.00, 'Refrigerante Sprite garrafa 2 litros', 15),
    
    -- Água
    ('Água com gás', 4.00, 'Água mineral com gás', 16),
    ('Água sem gás', 2.50, 'Água mineral sem gás', 17),
    
    -- Sucos 300ml
    ('Suco de Maracujá 300ml', 7.00, 'Suco natural de maracujá 300ml', 18),
    ('Suco de Acerola 300ml', 7.00, 'Suco natural de acerola 300ml', 19),
    ('Suco de Abacaxi c/ Hortelã 300ml', 7.00, 'Suco natural de abacaxi com hortelã 300ml', 20),
    ('Suco de Morango 300ml', 7.00, 'Suco natural de morango 300ml', 21),
    
    -- Sucos 500ml
    ('Suco de Maracujá 500ml', 10.00, 'Suco natural de maracujá 500ml', 22),
    ('Suco de Acerola 500ml', 10.00, 'Suco natural de acerola 500ml', 23),
    ('Suco de Abacaxi c/ Hortelã 500ml', 10.00, 'Suco natural de abacaxi com hortelã 500ml', 24),
    ('Suco de Morango 500ml', 10.00, 'Suco natural de morango 500ml', 25),
    
    -- Cremes 300ml
    ('Creme de Maracujá 300ml', 8.00, 'Creme de maracujá 300ml', 26),
    ('Creme de Morango 300ml', 8.00, 'Creme de morango 300ml', 27),
    
    -- Cremes 500ml
    ('Creme de Maracujá 500ml', 12.00, 'Creme de maracujá 500ml', 28),
    ('Creme de Morango 500ml', 12.00, 'Creme de morango 500ml', 29),
    
    -- SucoKids
    ('SucoKids Uva 200ml', 5.00, 'SucoKids sabor uva 200ml', 30),
    ('SucoKids Maracujá 200ml', 5.00, 'SucoKids sabor maracujá 200ml', 31)
) AS beverages(name, price, description, sort_order)
CROSS JOIN establishments e
CROSS JOIN categories c
WHERE e.slug = 'hamburgueria-na-brasa' 
AND c.name = 'BEBIDAS' 
AND c.establishment_id = e.id;