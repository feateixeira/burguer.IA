-- Function to delete a user completely from the system (except auth.users which requires Edge Function)
-- This function allows admins to delete all user data
CREATE OR REPLACE FUNCTION public.delete_user_completely(target_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid;
BEGIN
  -- Get current user ID first
  current_user_id := auth.uid();
  
  -- Only admins can call this function
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = current_user_id AND p.is_admin = true
  ) THEN
    RAISE EXCEPTION 'Access denied. Only admins can call this function.';
  END IF;

  -- Prevent deleting yourself
  IF target_user_id = current_user_id THEN
    RAISE EXCEPTION 'Cannot delete your own account';
  END IF;

  -- Delete related data first
  -- Delete user notifications
  DELETE FROM public.user_notifications WHERE user_id = target_user_id;
  
  -- Delete audit logs
  DELETE FROM public.audit_logs WHERE user_id = target_user_id;
  
  -- Delete team members for this user's establishment
  DELETE FROM public.team_members tm
  WHERE EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.user_id = target_user_id 
    AND p.establishment_id = tm.establishment_id
  )
  AND tm.user_id = target_user_id;
  
  -- Delete delivery boys if any (though unlikely, just in case)
  -- Actually, delivery_boys doesn't have user_id, so skip
  
  -- Delete profile (cascade will handle orders, products, etc. if configured)
  DELETE FROM public.profiles WHERE user_id = target_user_id;
  
  -- Note: auth.users deletion must be done via Edge Function with service_role
  -- But the user is effectively deleted from the system since profile is gone
  
  RETURN json_build_object(
    'success', true,
    'message', 'User data deleted successfully',
    'deleted_user_id', target_user_id
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM,
      'deleted_user_id', target_user_id
    );
END;
$$;

-- Grant execute permission to authenticated users (but the function checks admin status)
GRANT EXECUTE ON FUNCTION public.delete_user_completely(uuid) TO authenticated;

