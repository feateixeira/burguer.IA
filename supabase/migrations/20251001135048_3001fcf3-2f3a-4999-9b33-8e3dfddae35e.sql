-- Create profile for admin user
INSERT INTO profiles (user_id, email, name, is_admin, role)
SELECT 
  id,
  email,
  COALESCE(raw_user_meta_data->>'name', 'Admin') as name,
  true as is_admin,
  'admin' as role
FROM auth.users
WHERE email = 'fellipe_1693@outlook.com'
ON CONFLICT (user_id) DO UPDATE 
SET is_admin = true, role = 'admin';