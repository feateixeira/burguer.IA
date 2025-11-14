-- Function to get user emails from auth.users
-- This function allows admins to get emails for multiple users at once
CREATE OR REPLACE FUNCTION public.get_user_emails(user_ids uuid[])
RETURNS TABLE(user_id uuid, email text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  current_user_id uuid;
BEGIN
  -- Get current user ID first to avoid ambiguity
  current_user_id := auth.uid();
  
  -- Only admins can call this function
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = current_user_id AND p.is_admin = true
  ) THEN
    RAISE EXCEPTION 'Access denied. Only admins can call this function.';
  END IF;

  RETURN QUERY
  SELECT 
    u.id::uuid,
    u.email::text
  FROM auth.users u
  WHERE u.id = ANY(user_ids);
END;
$$;

-- Grant execute permission to authenticated users (but the function checks admin status)
GRANT EXECUTE ON FUNCTION public.get_user_emails(uuid[]) TO authenticated;

