-- Create printers table
CREATE TABLE public.printers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  establishment_id UUID NOT NULL REFERENCES public.establishments(id),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('local', 'network', 'bluetooth')),
  location TEXT,
  paper_width INTEGER DEFAULT 80,
  font_size INTEGER DEFAULT 12,
  font_family TEXT DEFAULT 'monospace',
  ip_address TEXT,
  port INTEGER,
  bluetooth_address TEXT,
  print_all BOOLEAN DEFAULT false,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.printers ENABLE ROW LEVEL SECURITY;

-- RLS Policies for printers
CREATE POLICY "Users can manage printers in their establishment"
ON public.printers
FOR ALL
USING (establishment_id IN (
  SELECT establishment_id FROM profiles WHERE user_id = auth.uid()
));

-- Create printer_routing table
CREATE TABLE public.printer_routing (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  establishment_id UUID NOT NULL REFERENCES public.establishments(id),
  printer_id UUID NOT NULL REFERENCES public.printers(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.categories(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT printer_routing_target_check CHECK (
    (category_id IS NOT NULL AND product_id IS NULL) OR
    (category_id IS NULL AND product_id IS NOT NULL)
  )
);

-- Enable RLS
ALTER TABLE public.printer_routing ENABLE ROW LEVEL SECURITY;

-- RLS Policies for printer_routing
CREATE POLICY "Users can manage printer routing in their establishment"
ON public.printer_routing
FOR ALL
USING (establishment_id IN (
  SELECT establishment_id FROM profiles WHERE user_id = auth.uid()
));

-- Create trigger for updated_at
CREATE TRIGGER update_printers_updated_at
BEFORE UPDATE ON public.printers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();