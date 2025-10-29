-- RPC function to check if admin password is configured (without exposing the hash)
CREATE OR REPLACE FUNCTION check_admin_password_exists(establishment_uuid UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  password_exists BOOLEAN;
BEGIN
  SELECT admin_password_hash IS NOT NULL
  INTO password_exists
  FROM establishments
  WHERE id = establishment_uuid;
  
  RETURN COALESCE(password_exists, false);
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION check_admin_password_exists(UUID) TO authenticated;

