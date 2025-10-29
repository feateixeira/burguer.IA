import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import bcrypt from 'bcryptjs';

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
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('establishment_id')
        .eq('user_id', session.user.id)
        .single();

      if (!profile?.establishment_id) return;

      setEstablishmentId(profile.establishment_id);

      const { data: establishment } = await supabase
        .from('establishments')
        .select('admin_password_hash, settings')
        .eq('id', profile.establishment_id)
        .single();

      if (establishment) {
        const settings = establishment.settings as any;
        setEstablishmentSettings({
          passwordHash: establishment.admin_password_hash,
          protectedPages: settings?.protected_pages || [],
          protectedActions: settings?.protected_actions || {},
          sessionTimeout: settings?.admin_session_timeout || 30
        });
      }
    } catch (error) {
      console.error('Error loading establishment settings:', error);
    }
  };

  const authenticateAdmin = async (password: string): Promise<boolean> => {
    if (!establishmentSettings?.passwordHash) {
      return false;
    }

    try {
      const isValid = await bcrypt.compare(password, establishmentSettings.passwordHash);
      
      if (isValid) {
        const timeout = (establishmentSettings.sessionTimeout || 30) * 60 * 1000;
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
    if (!establishmentSettings?.passwordHash) return false;
    return establishmentSettings.protectedPages?.includes(pageName) || false;
  };

  const checkActionProtection = (pageName: string, action: string): boolean => {
    if (!establishmentSettings?.passwordHash) return false;
    const pageActions = establishmentSettings.protectedActions?.[pageName] || [];
    return pageActions.includes(action);
  };

  const logAdminAction = async (action: string, details?: any) => {
    if (!establishmentId) return;
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      await supabase.from('audit_logs').insert({
        establishment_id: establishmentId,
        user_id: user?.id,
        table_name: 'admin_actions',
        action: action,
        new_values: details || {}
      });
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
        hasPasswordConfigured: !!establishmentSettings?.passwordHash,
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
