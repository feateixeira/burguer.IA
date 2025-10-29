-- ============================================
-- SECURITY FIX: Proper Role-Based Access Control
-- ============================================

-- 1. Create role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'manager', 'user');

-- 2. Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 3. Create security definer function to check roles (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  );
$$;

-- 4. RLS policies for user_roles table
-- Only admins can manage roles
CREATE POLICY "Only admins can insert roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can update roles"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can delete roles"
ON public.user_roles
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Users can view their own roles
CREATE POLICY "Users can view own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Admins can view all roles
CREATE POLICY "Admins can view all roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 5. Secure establishments table - restrict sensitive fields to admins only
-- Drop existing policies first
DROP POLICY IF EXISTS "Users can update their establishment" ON public.establishments;
DROP POLICY IF EXISTS "Users can view their establishment" ON public.establishments;

-- View policy remains the same
CREATE POLICY "Users can view their establishment"
ON public.establishments
FOR SELECT
TO authenticated
USING (
  id IN (
    SELECT establishment_id
    FROM profiles
    WHERE user_id = auth.uid()
  )
);

-- Separate update policies for regular fields vs admin-only fields
-- Regular users can update non-sensitive fields
CREATE POLICY "Users can update basic establishment info"
ON public.establishments
FOR UPDATE
TO authenticated
USING (
  id IN (
    SELECT establishment_id
    FROM profiles
    WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  id IN (
    SELECT establishment_id
    FROM profiles
    WHERE user_id = auth.uid()
  )
  -- Prevent modification of admin-only fields by non-admins
  AND (
    public.has_role(auth.uid(), 'admin')
    OR (
      -- Allow updates only if these sensitive fields are unchanged
      admin_password_hash IS NOT DISTINCT FROM (SELECT admin_password_hash FROM establishments WHERE id = establishments.id)
      AND admin_password_salt IS NOT DISTINCT FROM (SELECT admin_password_salt FROM establishments WHERE id = establishments.id)
      AND pix_key_value IS NOT DISTINCT FROM (SELECT pix_key_value FROM establishments WHERE id = establishments.id)
      AND pix_key_type IS NOT DISTINCT FROM (SELECT pix_key_type FROM establishments WHERE id = establishments.id)
      AND pix_key_locked IS NOT DISTINCT FROM (SELECT pix_key_locked FROM establishments WHERE id = establishments.id)
      AND protected_pages IS NOT DISTINCT FROM (SELECT protected_pages FROM establishments WHERE id = establishments.id)
      AND protected_actions IS NOT DISTINCT FROM (SELECT protected_actions FROM establishments WHERE id = establishments.id)
    )
  )
);

-- 6. Secure profiles table - prevent is_admin modification
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

CREATE POLICY "Users can update their own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (
  user_id = auth.uid()
  -- Prevent users from setting is_admin to true unless they're already admin
  AND (
    is_admin IS NOT DISTINCT FROM (SELECT is_admin FROM profiles WHERE user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  )
);

-- 7. Migrate existing admin users to user_roles table
-- This preserves existing admin status
INSERT INTO public.user_roles (user_id, role, created_by)
SELECT user_id, 'admin'::app_role, user_id
FROM public.profiles
WHERE is_admin = true
ON CONFLICT (user_id, role) DO NOTHING;

-- 8. Add helper function to check if user is admin (for backward compatibility)
CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'admin');
$$;