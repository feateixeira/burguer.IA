-- Allow admins to view all establishments
CREATE POLICY "Admins can view all establishments"
ON public.establishments
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = auth.uid() AND is_admin = true
  )
);

