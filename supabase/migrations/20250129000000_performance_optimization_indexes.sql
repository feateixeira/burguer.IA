-- ============================================
-- Otimizações de Performance para 20+ usuários simultâneos
-- ============================================
-- Esta migração adiciona índices críticos para melhorar
-- a performance de queries frequentes sem alterar funcionalidades
-- ============================================

-- Índices para tabela customers (queries frequentes)
CREATE INDEX IF NOT EXISTS idx_customers_establishment_name 
  ON public.customers(establishment_id, name) 
  WHERE active = true;

CREATE INDEX IF NOT EXISTS idx_customers_establishment_phone 
  ON public.customers(establishment_id, phone) 
  WHERE phone IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_customers_establishment_created 
  ON public.customers(establishment_id, created_at DESC);

-- Índices para tabela orders (queries frequentes)
CREATE INDEX IF NOT EXISTS idx_orders_establishment_status_created 
  ON public.orders(establishment_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_establishment_customer_name 
  ON public.orders(establishment_id, customer_name) 
  WHERE customer_name IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_establishment_customer_phone 
  ON public.orders(establishment_id, customer_phone) 
  WHERE customer_phone IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_establishment_customer_id 
  ON public.orders(establishment_id, customer_id) 
  WHERE customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_establishment_payment_status 
  ON public.orders(establishment_id, payment_status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_establishment_channel_origin 
  ON public.orders(establishment_id, channel, origin) 
  WHERE channel IS NOT NULL OR origin IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_establishment_accepted_printed 
  ON public.orders(establishment_id, accepted_and_printed_at) 
  WHERE accepted_and_printed_at IS NOT NULL;

-- Índices para tabela order_items (queries frequentes)
CREATE INDEX IF NOT EXISTS idx_order_items_order_id 
  ON public.order_items(order_id);

CREATE INDEX IF NOT EXISTS idx_order_items_product_id 
  ON public.order_items(product_id);

-- Índices para tabela products (queries frequentes)
CREATE INDEX IF NOT EXISTS idx_products_establishment_active 
  ON public.products(establishment_id, active, sort_order) 
  WHERE active = true;

CREATE INDEX IF NOT EXISTS idx_products_establishment_category 
  ON public.products(establishment_id, category_id) 
  WHERE active = true;

-- Índices para tabela categories (queries frequentes)
CREATE INDEX IF NOT EXISTS idx_categories_establishment_active 
  ON public.categories(establishment_id, active, sort_order) 
  WHERE active = true;

-- Índices para tabela combos (queries frequentes)
CREATE INDEX IF NOT EXISTS idx_combos_establishment_active 
  ON public.combos(establishment_id, active, sort_order) 
  WHERE active = true;

-- Índices para tabela promotions (queries frequentes)
CREATE INDEX IF NOT EXISTS idx_promotions_establishment_active_dates 
  ON public.promotions(establishment_id, active, start_date, end_date) 
  WHERE active = true;

-- Índice para customer_group_members (queries de grupos)
CREATE INDEX IF NOT EXISTS idx_customer_group_members_customer 
  ON public.customer_group_members(customer_id);

CREATE INDEX IF NOT EXISTS idx_customer_group_members_group 
  ON public.customer_group_members(group_id);

-- Índice para idempotency_keys (queries de API)
CREATE INDEX IF NOT EXISTS idx_idempotency_keys_establishment_created 
  ON public.idempotency_keys(establishment_id, created_at DESC);

-- ============================================
-- Comentários sobre os índices:
-- ============================================
-- 1. Índices compostos permitem queries mais rápidas
-- 2. Índices parciais (WHERE) reduzem tamanho e melhoram performance
-- 3. Ordem das colunas nos índices é importante (mais seletivo primeiro)
-- 4. Estes índices melhoram significativamente queries de:
--    - Dashboard (pedidos por período, status, cliente)
--    - Customers (busca por nome, telefone, estabelecimento)
--    - Orders (filtros por status, cliente, canal)
--    - Products/Categories/Combos (listagens ativas)
-- ============================================

