-- First, create categories for better organization
INSERT INTO categories (name, description, establishment_id, sort_order, active) VALUES
('Hamburguers', 'Hamburguers artesanais na brasa', (SELECT id FROM establishments LIMIT 1), 1, true),
('Acompanhamentos', 'Batatas, frango no pote e outras delícias', (SELECT id FROM establishments LIMIT 1), 2, true);

-- Insert Hamburguers with sauce configurations
INSERT INTO products (name, description, price, category_id, establishment_id, ingredients, tags, active, sort_order) VALUES
-- Basic Na Brasa line
('Na Brasa Simples', 'Hambúrguer artesanal na brasa', 15.00, (SELECT id FROM categories WHERE name = 'Hamburguers' LIMIT 1), (SELECT id FROM establishments LIMIT 1), '["molhos_disponiveis": ["Mostarda e Mel", "Bacon", "Alho", "Ervas"], "molhos_gratis": 1, "preco_molho_adicional": 2.00]'::jsonb, '["hamburguer", "simples"]'::jsonb, true, 1),
('Na Brasa Duplo', 'Hambúrguer artesanal duplo na brasa', 23.00, (SELECT id FROM categories WHERE name = 'Hamburguers' LIMIT 1), (SELECT id FROM establishments LIMIT 1), '["molhos_disponiveis": ["Mostarda e Mel", "Bacon", "Alho", "Ervas"], "molhos_gratis": 1, "preco_molho_adicional": 2.00]'::jsonb, '["hamburguer", "duplo"]'::jsonb, true, 2),
('Na Brasa Triplo', 'Hambúrguer artesanal triplo na brasa', 30.00, (SELECT id FROM categories WHERE name = 'Hamburguers' LIMIT 1), (SELECT id FROM establishments LIMIT 1), '["molhos_disponiveis": ["Mostarda e Mel", "Bacon", "Alho", "Ervas"], "molhos_gratis": 2, "preco_molho_adicional": 2.00]'::jsonb, '["hamburguer", "triplo"]'::jsonb, true, 3),

-- Especial line
('Na Brasa Especial Simples', 'Hambúrguer especial na brasa', 20.00, (SELECT id FROM categories WHERE name = 'Hamburguers' LIMIT 1), (SELECT id FROM establishments LIMIT 1), '["molhos_disponiveis": ["Mostarda e Mel", "Bacon", "Alho", "Ervas"], "molhos_gratis": 1, "preco_molho_adicional": 2.00]'::jsonb, '["hamburguer", "especial", "simples"]'::jsonb, true, 4),
('Na Brasa Especial Duplo', 'Hambúrguer especial duplo na brasa', 27.00, (SELECT id FROM categories WHERE name = 'Hamburguers' LIMIT 1), (SELECT id FROM establishments LIMIT 1), '["molhos_disponiveis": ["Mostarda e Mel", "Bacon", "Alho", "Ervas"], "molhos_gratis": 1, "preco_molho_adicional": 2.00]'::jsonb, '["hamburguer", "especial", "duplo"]'::jsonb, true, 5),
('Na Brasa Especial Triplo', 'Hambúrguer especial triplo na brasa', 32.00, (SELECT id FROM categories WHERE name = 'Hamburguers' LIMIT 1), (SELECT id FROM establishments LIMIT 1), '["molhos_disponiveis": ["Mostarda e Mel", "Bacon", "Alho", "Ervas"], "molhos_gratis": 2, "preco_molho_adicional": 2.00]'::jsonb, '["hamburguer", "especial", "triplo"]'::jsonb, true, 6),

-- Supremo line
('Na Brasa Supremo Simples', 'Hambúrguer supremo na brasa', 20.00, (SELECT id FROM categories WHERE name = 'Hamburguers' LIMIT 1), (SELECT id FROM establishments LIMIT 1), '["molhos_disponiveis": ["Mostarda e Mel", "Bacon", "Alho", "Ervas"], "molhos_gratis": 1, "preco_molho_adicional": 2.00]'::jsonb, '["hamburguer", "supremo", "simples"]'::jsonb, true, 7),
('Na Brasa Supremo Duplo', 'Hambúrguer supremo duplo na brasa', 27.00, (SELECT id FROM categories WHERE name = 'Hamburguers' LIMIT 1), (SELECT id FROM establishments LIMIT 1), '["molhos_disponiveis": ["Mostarda e Mel", "Bacon", "Alho", "Ervas"], "molhos_gratis": 1, "preco_molho_adicional": 2.00]'::jsonb, '["hamburguer", "supremo", "duplo"]'::jsonb, true, 8),
('Na Brasa Supremo Triplo', 'Hambúrguer supremo triplo na brasa', 32.00, (SELECT id FROM categories WHERE name = 'Hamburguers' LIMIT 1), (SELECT id FROM establishments LIMIT 1), '["molhos_disponiveis": ["Mostarda e Mel", "Bacon", "Alho", "Ervas"], "molhos_gratis": 2, "preco_molho_adicional": 2.00]'::jsonb, '["hamburguer", "supremo", "triplo"]'::jsonb, true, 9),

-- Frango line
('Na Brasa Frango Simples', 'Hambúrguer de frango na brasa', 20.00, (SELECT id FROM categories WHERE name = 'Hamburguers' LIMIT 1), (SELECT id FROM establishments LIMIT 1), '["molhos_disponiveis": ["Mostarda e Mel", "Bacon", "Alho", "Ervas"], "molhos_gratis": 1, "preco_molho_adicional": 2.00]'::jsonb, '["hamburguer", "frango", "simples"]'::jsonb, true, 10),
('Na Brasa Frango Duplo', 'Hambúrguer de frango duplo na brasa', 27.00, (SELECT id FROM categories WHERE name = 'Hamburguers' LIMIT 1), (SELECT id FROM establishments LIMIT 1), '["molhos_disponiveis": ["Mostarda e Mel", "Bacon", "Alho", "Ervas"], "molhos_gratis": 1, "preco_molho_adicional": 2.00]'::jsonb, '["hamburguer", "frango", "duplo"]'::jsonb, true, 11),
('Na Brasa Frango Triplo', 'Hambúrguer de frango triplo na brasa', 32.00, (SELECT id FROM categories WHERE name = 'Hamburguers' LIMIT 1), (SELECT id FROM establishments LIMIT 1), '["molhos_disponiveis": ["Mostarda e Mel", "Bacon", "Alho", "Ervas"], "molhos_gratis": 2, "preco_molho_adicional": 2.00]'::jsonb, '["hamburguer", "frango", "triplo"]'::jsonb, true, 12),

-- Special items
('Na Brasa Kids', 'Hambúrguer kids', 10.00, (SELECT id FROM categories WHERE name = 'Hamburguers' LIMIT 1), (SELECT id FROM establishments LIMIT 1), '["molhos_disponiveis": ["Mostarda e Mel", "Bacon", "Alho", "Ervas"], "molhos_gratis": 1, "preco_molho_adicional": 2.00]'::jsonb, '["hamburguer", "kids"]'::jsonb, true, 13),
('Na Brasa Nutella', 'Hambúrguer doce com Nutella', 12.00, (SELECT id FROM categories WHERE name = 'Hamburguers' LIMIT 1), (SELECT id FROM establishments LIMIT 1), '["molhos_disponiveis": [], "molhos_gratis": 0, "preco_molho_adicional": 0]'::jsonb, '["hamburguer", "doce", "nutella"]'::jsonb, true, 14),

-- Acompanhamentos
('Batata P', 'Batata frita pequena', 8.00, (SELECT id FROM categories WHERE name = 'Acompanhamentos' LIMIT 1), (SELECT id FROM establishments LIMIT 1), '[]'::jsonb, '["batata", "pequena"]'::jsonb, true, 15),
('Batata M', 'Batata frita média', 16.00, (SELECT id FROM categories WHERE name = 'Acompanhamentos' LIMIT 1), (SELECT id FROM establishments LIMIT 1), '["opcao_recheada": true, "preco_recheada": 21.00]'::jsonb, '["batata", "media"]'::jsonb, true, 16),
('Batata G', 'Batata frita grande', 22.00, (SELECT id FROM categories WHERE name = 'Acompanhamentos' LIMIT 1), (SELECT id FROM establishments LIMIT 1), '["opcao_recheada": true, "preco_recheada": 30.00]'::jsonb, '["batata", "grande"]'::jsonb, true, 17),
('Frango no Pote P', 'Frango desfiado pequeno', 20.00, (SELECT id FROM categories WHERE name = 'Acompanhamentos' LIMIT 1), (SELECT id FROM establishments LIMIT 1), '[]'::jsonb, '["frango", "pote", "pequeno"]'::jsonb, true, 18),
('Frango no Pote M', 'Frango desfiado médio', 37.00, (SELECT id FROM categories WHERE name = 'Acompanhamentos' LIMIT 1), (SELECT id FROM establishments LIMIT 1), '[]'::jsonb, '["frango", "pote", "medio"]'::jsonb, true, 19),
('Frango no Pote G', 'Frango desfiado grande', 50.00, (SELECT id FROM categories WHERE name = 'Acompanhamentos' LIMIT 1), (SELECT id FROM establishments LIMIT 1), '[]'::jsonb, '["frango", "pote", "grande"]'::jsonb, true, 20),
('Fritas Especial + Frango M', 'Batata especial com frango médio', 25.00, (SELECT id FROM categories WHERE name = 'Acompanhamentos' LIMIT 1), (SELECT id FROM establishments LIMIT 1), '[]'::jsonb, '["fritas", "especial", "frango", "medio"]'::jsonb, true, 21),
('Fritas Especial + Frango G', 'Batata especial com frango grande', 37.00, (SELECT id FROM categories WHERE name = 'Acompanhamentos' LIMIT 1), (SELECT id FROM establishments LIMIT 1), '[]'::jsonb, '["fritas", "especial", "frango", "grande"]'::jsonb, true, 22);