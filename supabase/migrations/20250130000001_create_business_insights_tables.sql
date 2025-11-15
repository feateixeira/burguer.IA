-- ============================================
-- BUSINESS INSIGHTS TABLES FOR GOLD PLAN
-- ============================================

-- Create business_insights table
CREATE TABLE IF NOT EXISTS public.business_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('weak_period', 'peak_period', 'product_tip', 'margin_alert', 'stock_alert', 'sales_tip', 'general')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  valid_until TIMESTAMPTZ,
  read BOOLEAN NOT NULL DEFAULT false
);

-- Create sales_profile table for storing aggregated sales data
CREATE TABLE IF NOT EXISTS public.sales_profile (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0 = Sunday, 6 = Saturday
  hour INTEGER NOT NULL CHECK (hour >= 0 AND hour <= 23),
  avg_orders NUMERIC(10, 2) NOT NULL DEFAULT 0,
  avg_revenue NUMERIC(10, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, day_of_week, hour)
);

-- Create assistant_settings table for user preferences
CREATE TABLE IF NOT EXISTS public.assistant_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  monthly_goal NUMERIC(10, 2),
  target_ticket_avg NUMERIC(10, 2),
  alerts_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id)
);

-- Enable RLS
ALTER TABLE public.business_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assistant_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for business_insights
CREATE POLICY "Users can view insights from their establishment"
  ON public.business_insights FOR SELECT
  USING (tenant_id IN (
    SELECT establishment_id FROM public.profiles WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can update insights from their establishment"
  ON public.business_insights FOR UPDATE
  USING (tenant_id IN (
    SELECT establishment_id FROM public.profiles WHERE user_id = auth.uid()
  ));

-- RLS Policies for sales_profile
CREATE POLICY "Users can view sales profile from their establishment"
  ON public.sales_profile FOR SELECT
  USING (tenant_id IN (
    SELECT establishment_id FROM public.profiles WHERE user_id = auth.uid()
  ));

-- RLS Policies for assistant_settings
CREATE POLICY "Users can manage assistant settings from their establishment"
  ON public.assistant_settings FOR ALL
  USING (tenant_id IN (
    SELECT establishment_id FROM public.profiles WHERE user_id = auth.uid()
  ));

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_business_insights_tenant_id ON public.business_insights(tenant_id);
CREATE INDEX IF NOT EXISTS idx_business_insights_created_at ON public.business_insights(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_business_insights_read ON public.business_insights(read);
CREATE INDEX IF NOT EXISTS idx_business_insights_valid_until ON public.business_insights(valid_until);

CREATE INDEX IF NOT EXISTS idx_sales_profile_tenant_id ON public.sales_profile(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sales_profile_day_hour ON public.sales_profile(day_of_week, hour);

CREATE INDEX IF NOT EXISTS idx_assistant_settings_tenant_id ON public.assistant_settings(tenant_id);

-- Create trigger for updated_at on sales_profile
CREATE OR REPLACE FUNCTION public.update_sales_profile_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_sales_profile_updated_at
  BEFORE UPDATE ON public.sales_profile
  FOR EACH ROW
  EXECUTE FUNCTION public.update_sales_profile_updated_at();

-- Create trigger for updated_at on assistant_settings
CREATE OR REPLACE FUNCTION public.update_assistant_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_assistant_settings_updated_at
  BEFORE UPDATE ON public.assistant_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_assistant_settings_updated_at();

