-- Function to automatically delete orders older than 3 months
-- This should be called periodically (e.g., daily via cron job or Edge Function)
CREATE OR REPLACE FUNCTION public.delete_old_orders()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cutoff_date timestamp with time zone;
  deleted_count integer;
BEGIN
  -- Calculate cutoff date: 3 months ago
  cutoff_date := NOW() - INTERVAL '3 months';
  
  -- Delete order_items first (CASCADE will handle this, but being explicit)
  DELETE FROM public.order_items oi
  WHERE EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = oi.order_id
    AND o.created_at < cutoff_date
  );
  
  -- Delete old orders
  DELETE FROM public.orders
  WHERE created_at < cutoff_date;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RETURN json_build_object(
    'success', true,
    'deleted_count', deleted_count,
    'cutoff_date', cutoff_date,
    'message', format('Deleted %s orders older than 3 months', deleted_count)
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM,
      'message', 'Error deleting old orders'
    );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.delete_old_orders() TO authenticated;

-- Create index on created_at for faster queries (if not exists)
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at);

