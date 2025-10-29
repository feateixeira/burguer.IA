-- Function to safely delete an order and related rows with RLS-safe execution
CREATE OR REPLACE FUNCTION public.delete_order_cascade(p_order_id uuid, p_establishment_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Ensure the order belongs to the establishment requesting deletion
  IF NOT EXISTS (
    SELECT 1 FROM public.orders 
    WHERE id = p_order_id AND establishment_id = p_establishment_id
  ) THEN
    RAISE EXCEPTION 'ORDER_NOT_FOUND_OR_UNAUTHORIZED';
  END IF;

  -- Delete dependent rows explicitly before order to avoid RLS pitfalls
  DELETE FROM public.order_items WHERE order_id = p_order_id;
  DELETE FROM public.pix_payments WHERE order_id = p_order_id;

  -- Delete the order itself
  DELETE FROM public.orders WHERE id = p_order_id;
END;
$$;

-- Allow authenticated users to execute the function
GRANT EXECUTE ON FUNCTION public.delete_order_cascade(uuid, uuid) TO authenticated;

