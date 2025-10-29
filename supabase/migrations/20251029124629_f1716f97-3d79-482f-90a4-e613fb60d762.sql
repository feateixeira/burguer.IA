-- Drop the problematic policies that cause infinite recursion
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;

-- Create security definer function to check if user is global admin
CREATE OR REPLACE FUNCTION public.is_global_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE user_id = _user_id
      AND is_admin = true
  );
$$;

-- Create proper RLS policies using the security definer function
CREATE POLICY "Global admins can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (is_global_admin(auth.uid()));

CREATE POLICY "Global admins can update all profiles"
ON public.profiles
FOR UPDATE
TO authenticated
USING (is_global_admin(auth.uid()));