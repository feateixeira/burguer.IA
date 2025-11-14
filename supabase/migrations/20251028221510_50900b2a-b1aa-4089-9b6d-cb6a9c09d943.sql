-- Create password_queue table for password panel
CREATE TABLE IF NOT EXISTS public.password_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid REFERENCES public.establishments(id) NOT NULL,
  password_number integer NOT NULL,
  customer_name text,
  service_type text NOT NULL DEFAULT 'normal',
  status text NOT NULL DEFAULT 'waiting',
  called_at timestamp with time zone,
  completed_at timestamp with time zone,
  cancelled_at timestamp with time zone,
  counter_number text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.password_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage passwords in their establishment"
ON public.password_queue FOR ALL
USING (establishment_id IN (
  SELECT establishment_id FROM public.profiles WHERE user_id = auth.uid()
));

-- Allow public to insert passwords (for totem)
CREATE POLICY "Anyone can generate passwords"
ON public.password_queue FOR INSERT
WITH CHECK (true);

-- Allow public to view active passwords (for display)
CREATE POLICY "Anyone can view active passwords"
ON public.password_queue FOR SELECT
USING (status IN ('waiting', 'calling'));

-- Create trigger for updated_at
CREATE OR REPLACE TRIGGER update_password_queue_updated_at
  BEFORE UPDATE ON public.password_queue
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create app_settings table
CREATE TABLE IF NOT EXISTS public.app_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid REFERENCES public.establishments(id) NOT NULL UNIQUE,
  password_panel_enabled boolean DEFAULT false,
  totem_enabled boolean DEFAULT false,
  password_prefix text DEFAULT 'S',
  counters_count integer DEFAULT 1,
  settings jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage app settings in their establishment"
ON public.app_settings FOR ALL
USING (establishment_id IN (
  SELECT establishment_id FROM public.profiles WHERE user_id = auth.uid()
));

-- Create trigger for updated_at
CREATE OR REPLACE TRIGGER update_app_settings_updated_at
  BEFORE UPDATE ON public.app_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();