-- Cardápio online (anon): corrigir RLS em orders/order_items.
-- Políticas "FOR ALL" sem TO aplicam-se a PUBLIC (inclui anon) e podem falhar INSERT ... RETURNING
-- mesmo existindo "Public can create orders" (comportamento/consulta do sub-SELECT em políticas).
-- Solução: restrigir "Users can manage" a authenticated apenas.
-- SELECT anon: usar establishment_has_slug (SECURITY DEFINER) para não depender do RLS de establishments no sub-SELECT.

DROP POLICY IF EXISTS "Users can manage orders in their establishment" ON public.orders;

CREATE POLICY "Users can manage orders in their establishment"
  ON public.orders
  FOR ALL
  TO authenticated
  USING (
    establishment_id IN (
      SELECT establishment_id FROM public.profiles
      WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    establishment_id IN (
      SELECT establishment_id FROM public.profiles
      WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Public can view orders they created" ON public.orders;

CREATE POLICY "Public can view orders they created"
  ON public.orders
  FOR SELECT
  TO anon
  USING (public.establishment_has_slug(establishment_id));

DROP POLICY IF EXISTS "Users can manage order items through orders" ON public.order_items;

CREATE POLICY "Users can manage order items through orders"
  ON public.order_items
  FOR ALL
  TO authenticated
  USING (
    order_id IN (
      SELECT id FROM public.orders
      WHERE establishment_id IN (
        SELECT establishment_id FROM public.profiles
        WHERE user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    order_id IN (
      SELECT id FROM public.orders
      WHERE establishment_id IN (
        SELECT establishment_id FROM public.profiles
        WHERE user_id = auth.uid()
      )
    )
  );
