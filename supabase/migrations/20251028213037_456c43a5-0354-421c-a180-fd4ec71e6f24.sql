-- Tabela de roles de usuários
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  establishment_id UUID NOT NULL,
  role public.app_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(user_id, establishment_id)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Função security definer para checar roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _establishment_id UUID, _role public.app_role)
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
      AND establishment_id = _establishment_id
      AND role = _role
  );
$$;

-- Função para checar se é admin
CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID, _establishment_id UUID)
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
      AND establishment_id = _establishment_id
      AND role = 'admin'
  );
$$;

-- Políticas RLS para user_roles
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all roles in their establishment" ON public.user_roles;
CREATE POLICY "Admins can view all roles in their establishment"
  ON public.user_roles FOR SELECT
  USING (public.is_admin(auth.uid(), establishment_id));

DROP POLICY IF EXISTS "Only admins can insert roles" ON public.user_roles;
CREATE POLICY "Only admins can insert roles"
  ON public.user_roles FOR INSERT
  WITH CHECK (public.is_admin(auth.uid(), establishment_id));

DROP POLICY IF EXISTS "Only admins can update roles" ON public.user_roles;
CREATE POLICY "Only admins can update roles"
  ON public.user_roles FOR UPDATE
  USING (public.is_admin(auth.uid(), establishment_id));

DROP POLICY IF EXISTS "Only admins can delete roles" ON public.user_roles;
CREATE POLICY "Only admins can delete roles"
  ON public.user_roles FOR DELETE
  USING (public.is_admin(auth.uid(), establishment_id));

-- Criar tabela de sessões de caixa
CREATE TABLE IF NOT EXISTS public.cash_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id UUID NOT NULL,
  opened_by UUID NOT NULL REFERENCES auth.users(id),
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  opening_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
  closed_by UUID REFERENCES auth.users(id),
  closed_at TIMESTAMPTZ,
  closing_amount DECIMAL(10, 2),
  expected_amount DECIMAL(10, 2),
  difference_amount DECIMAL(10, 2),
  notes TEXT,
  is_admin_session BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cash_sessions_establishment ON public.cash_sessions(establishment_id);
CREATE INDEX IF NOT EXISTS idx_cash_sessions_status ON public.cash_sessions(status);
CREATE INDEX IF NOT EXISTS idx_cash_sessions_opened_by ON public.cash_sessions(opened_by);

ALTER TABLE public.cash_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view sessions from their establishment" ON public.cash_sessions;
CREATE POLICY "Users can view sessions from their establishment"
  ON public.cash_sessions FOR SELECT
  USING (
    establishment_id IN (
      SELECT establishment_id FROM public.profiles WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Authenticated users can create sessions" ON public.cash_sessions;
CREATE POLICY "Authenticated users can create sessions"
  ON public.cash_sessions FOR INSERT
  WITH CHECK (
    establishment_id IN (
      SELECT establishment_id FROM public.profiles WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update their own sessions or admins can update any" ON public.cash_sessions;
CREATE POLICY "Users can update their own sessions or admins can update any"
  ON public.cash_sessions FOR UPDATE
  USING (
    opened_by = auth.uid() OR
    public.is_admin(auth.uid(), establishment_id)
  );

-- Criar tabelas de formas de pagamento
CREATE TABLE IF NOT EXISTS public.card_brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id UUID NOT NULL,
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(establishment_id, name)
);

ALTER TABLE public.card_brands ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view card brands from their establishment" ON public.card_brands;
CREATE POLICY "Users can view card brands from their establishment"
  ON public.card_brands FOR SELECT
  USING (
    establishment_id IN (
      SELECT establishment_id FROM public.profiles WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins can manage card brands" ON public.card_brands;
CREATE POLICY "Admins can manage card brands"
  ON public.card_brands FOR ALL
  USING (public.is_admin(auth.uid(), establishment_id))
  WITH CHECK (public.is_admin(auth.uid(), establishment_id));

CREATE TABLE IF NOT EXISTS public.payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id UUID NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('cash', 'debit', 'credit', 'pix', 'voucher', 'other')),
  requires_card_brand BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(establishment_id, name)
);

ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view payment methods from their establishment" ON public.payment_methods;
CREATE POLICY "Users can view payment methods from their establishment"
  ON public.payment_methods FOR SELECT
  USING (
    establishment_id IN (
      SELECT establishment_id FROM public.profiles WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins can manage payment methods" ON public.payment_methods;
CREATE POLICY "Admins can manage payment methods"
  ON public.payment_methods FOR ALL
  USING (public.is_admin(auth.uid(), establishment_id))
  WITH CHECK (public.is_admin(auth.uid(), establishment_id));

-- Criar tabela de transações financeiras
CREATE TABLE IF NOT EXISTS public.financial_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id UUID NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('receivable', 'payable')),
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  due_date DATE NOT NULL,
  payment_date DATE,
  payment_method_id UUID REFERENCES public.payment_methods(id),
  card_brand_id UUID REFERENCES public.card_brands(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled')),
  cash_session_id UUID REFERENCES public.cash_sessions(id),
  order_id TEXT,
  supplier_id UUID,
  notes TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_financial_transactions_establishment ON public.financial_transactions(establishment_id);
CREATE INDEX IF NOT EXISTS idx_financial_transactions_type ON public.financial_transactions(type);
CREATE INDEX IF NOT EXISTS idx_financial_transactions_status ON public.financial_transactions(status);
CREATE INDEX IF NOT EXISTS idx_financial_transactions_due_date ON public.financial_transactions(due_date);

ALTER TABLE public.financial_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view transactions from their establishment" ON public.financial_transactions;
CREATE POLICY "Users can view transactions from their establishment"
  ON public.financial_transactions FOR SELECT
  USING (
    establishment_id IN (
      SELECT establishment_id FROM public.profiles WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can create transactions" ON public.financial_transactions;
CREATE POLICY "Users can create transactions"
  ON public.financial_transactions FOR INSERT
  WITH CHECK (
    establishment_id IN (
      SELECT establishment_id FROM public.profiles WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins can update transactions" ON public.financial_transactions;
CREATE POLICY "Admins can update transactions"
  ON public.financial_transactions FOR UPDATE
  USING (public.is_admin(auth.uid(), establishment_id));

-- Criar tabela de auditoria PIX
CREATE TABLE IF NOT EXISTS public.pix_key_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id UUID NOT NULL,
  old_pix_key TEXT,
  new_pix_key TEXT NOT NULL,
  old_pix_key_type TEXT,
  new_pix_key_type TEXT NOT NULL,
  changed_by UUID NOT NULL REFERENCES auth.users(id),
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address TEXT,
  user_agent TEXT,
  reason TEXT
);

ALTER TABLE public.pix_key_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Only admins can view PIX audit logs" ON public.pix_key_audit;
CREATE POLICY "Only admins can view PIX audit logs"
  ON public.pix_key_audit FOR SELECT
  USING (public.is_admin(auth.uid(), establishment_id));

-- Função para registrar mudança de chave PIX
CREATE OR REPLACE FUNCTION public.audit_pix_key_change()
RETURNS TRIGGER AS $$
BEGIN
  IF (OLD.pix_key_value IS DISTINCT FROM NEW.pix_key_value) OR 
     (OLD.pix_key_type IS DISTINCT FROM NEW.pix_key_type) THEN
    INSERT INTO public.pix_key_audit (
      establishment_id,
      old_pix_key,
      new_pix_key,
      old_pix_key_type,
      new_pix_key_type,
      changed_by
    ) VALUES (
      NEW.id,
      OLD.pix_key_value,
      NEW.pix_key_value,
      OLD.pix_key_type,
      NEW.pix_key_type,
      auth.uid()
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para auditoria automática de mudanças PIX
DROP TRIGGER IF EXISTS audit_pix_changes ON public.establishments;
CREATE TRIGGER audit_pix_changes
  AFTER UPDATE ON public.establishments
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_pix_key_change();