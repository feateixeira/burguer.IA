-- Remove admin status from nabrasa.1602@gmail.com if exists
UPDATE profiles 
SET is_admin = false 
WHERE email = 'nabrasa.1602@gmail.com';

-- Create admin user fellipe_1693@outlook.com
-- First, we need to check if the user exists in auth, if not we'll need to create via edge function
-- For now, let's add to admin_users and profiles tables

-- Add to admin_users
INSERT INTO admin_users (email, name, active)
VALUES ('fellipe_1693@outlook.com', 'Admin', true)
ON CONFLICT (email) DO UPDATE SET active = true;

-- We'll update the profile when the user logs in for the first time
-- or we can create the auth user via the create-user edge function