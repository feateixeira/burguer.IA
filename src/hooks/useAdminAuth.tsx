import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface AdminAuthContextType {
  isAdminAuthenticated: boolean;
  adminSessionExpiry: number | null;
  remainingMinutes: number;
  authenticateAdmin: (password: string) => Promise<boolean>;
  clearAdminSession: () => void;
  checkPageProtection: (pageName: string) => boolean;
  checkActionProtection: (pageName: string, action: string) => boolean;
  hasPasswordConfigured: boolean;
  logAdminAction: (action: string, details?: any) => Promise<void>;
}

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined);

export const AdminAuthProvider = ({ children }: { children: ReactNode }) => {
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [adminSessionExpiry, setAdminSessionExpiry] = useState<number | null>(null);
  const [remainingMinutes, setRemainingMinutes] = useState(0);
  const [establishmentSettings, setEstablishmentSettings] = useState<any>(null);
  const [establishmentId, setEstablishmentId] = useState<string | null>(null);

  useEffect(() => {
    loadEstablishmentSettings();
  }, []);

  useEffect(() => {
    if (!isAdminAuthenticated || !adminSessionExpiry) {
      setRemainingMinutes(0);
      return;
    }

    const updateTimer = () => {
      const remaining = Math.max(0, adminSessionExpiry - Date.now());
      setRemainingMinutes(Math.ceil(remaining / 60000));

      if (remaining <= 0) {
        clearAdminSession();
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [isAdminAuthenticated, adminSessionExpiry]);

  const loadEstablishmentSettings = async () => {
    try {
      // Verificar se Supabase está disponível antes de fazer queries
      if (!supabase || typeof supabase.auth === 'undefined') {
        return;
      }

      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) return;

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('establishment_id')
        .eq('user_id', session.user.id)
        .single();

      if (profileError || !profile?.establishment_id) return;

      setEstablishmentId(profile.establishment_id);

      // SECURITY: Do NOT load password hash to client
      // Only load settings needed for UI configuration
      const { data: establishment, error: estabError } = await supabase
        .from('establishments')
        .select('settings')
        .eq('id', profile.establishment_id)
        .single();

      if (estabError) return;

      // SECURITY: Use RPC to check if password exists without exposing the hash
      const { data: hasPassword, error: rpcError } = await supabase
        .rpc('check_admin_password_exists', { establishment_uuid: profile.establishment_id });
      
      if (rpcError) return;

      if (establishment) {
        const settings = establishment.settings as any;
        setEstablishmentSettings({
          // SECURITY: Store only presence flag, never the hash
          hasPassword: hasPassword || false,
          protectedPages: settings?.protected_pages || [],
          protectedActions: settings?.protected_actions || {},
          sessionTimeout: settings?.admin_session_timeout || 30
        });
      }
    } catch (error) {
      // Não bloquear a aplicação se houver erro ao carregar configurações
      // Apenas logar o erro silenciosamente
      if (import.meta.env.DEV) {
        console.error('Error loading establishment settings:', error);
      }
      // Não fazer nada - a aplicação deve continuar funcionando mesmo sem essas configurações
    }
  };

  const authenticateAdmin = async (password: string): Promise<boolean> => {
    // SECURITY: All authentication happens server-side via Edge Function
    // Password hash is NEVER loaded to client
    if (!establishmentSettings?.hasPassword) {
      return false;
    }

    try {
      const { data, error } = await supabase.functions.invoke('verify-admin-password', {
        body: { password },
      });

      if (error) {
        console.error('Error verifying admin password:', error);
        return false;
      }

      const { valid, sessionTimeout } = data || {};
      
      if (valid) {
        const timeout = (sessionTimeout || 30) * 60 * 1000;
        const expiry = Date.now() + timeout;
        
        setIsAdminAuthenticated(true);
        setAdminSessionExpiry(expiry);
        
        sessionStorage.setItem('admin_auth', 'true');
        sessionStorage.setItem('admin_expiry', expiry.toString());
        
        await logAdminAction('admin_login');
        
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error authenticating admin:', error);
      return false;
    }
  };

  const clearAdminSession = () => {
    setIsAdminAuthenticated(false);
    setAdminSessionExpiry(null);
    setRemainingMinutes(0);
    sessionStorage.removeItem('admin_auth');
    sessionStorage.removeItem('admin_expiry');
  };

  const checkPageProtection = (pageName: string): boolean => {
    if (!establishmentSettings?.hasPassword) return false;
    return establishmentSettings.protectedPages?.includes(pageName) || false;
  };

  const checkActionProtection = (pageName: string, action: string): boolean => {
    if (!establishmentSettings?.hasPassword) return false;
    const pageActions = establishmentSettings.protectedActions?.[pageName] || [];
    return pageActions.includes(action);
  };

  const logAdminAction = async (action: string, details?: any) => {
    if (!establishmentId) return;
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Tentar inserir com nova estrutura (event, actor_id)
      try {
        await supabase.from('audit_logs').insert({
          establishment_id: establishmentId,
          actor_id: user?.id,
          event: action,
          payload: {
            table_name: 'admin_actions',
            details: details || {}
          }
        });
      } catch (err: any) {
        // Se falhar, tentar com estrutura antiga (user_id, action)
        if (err.message?.includes('actor_id') || err.message?.includes('event')) {
      await supabase.from('audit_logs').insert({
        establishment_id: establishmentId,
        user_id: user?.id,
        table_name: 'admin_actions',
        action: action,
        new_values: details || {}
      });
        } else {
          throw err;
        }
      }
    } catch (error) {
      console.error('Error logging admin action:', error);
    }
  };

  // Restore session on load
  useEffect(() => {
    const storedAuth = sessionStorage.getItem('admin_auth');
    const storedExpiry = sessionStorage.getItem('admin_expiry');
    
    if (storedAuth === 'true' && storedExpiry) {
      const expiry = parseInt(storedExpiry);
      if (Date.now() < expiry) {
        setIsAdminAuthenticated(true);
        setAdminSessionExpiry(expiry);
      } else {
        clearAdminSession();
      }
    }
  }, []);

  return (
    <AdminAuthContext.Provider
      value={{
        isAdminAuthenticated,
        adminSessionExpiry,
        remainingMinutes,
        authenticateAdmin,
        clearAdminSession,
        checkPageProtection,
        checkActionProtection,
        hasPasswordConfigured: !!establishmentSettings?.hasPassword,
        logAdminAction
      }}
    >
      {children}
    </AdminAuthContext.Provider>
  );
};

export const useAdminAuth = () => {
  const context = useContext(AdminAuthContext);
  if (context === undefined) {
    throw new Error('useAdminAuth must be used within AdminAuthProvider');
  }
  return context;
};
