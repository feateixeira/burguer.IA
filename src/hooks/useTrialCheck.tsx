import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface TrialStatus {
  subscriptionType: 'trial' | 'monthly' | null;
  trialDaysLeft: number | null;
  trialEndDate: string | null;
  isExpired: boolean;
  isBlocked: boolean;
}

/**
 * Hook para verificar status do trial e bloquear usuário se necessário
 * 
 * Funcionalidades:
 * - Calcula dias restantes do trial
 * - Bloqueia automaticamente quando trial expira
 * - Retorna status do trial para exibição
 */
export function useTrialCheck() {
  const navigate = useNavigate();
  const [trialStatus, setTrialStatus] = useState<TrialStatus>({
    subscriptionType: null,
    trialDaysLeft: null,
    trialEndDate: null,
    isExpired: false,
    isBlocked: false,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkTrialStatus = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          setLoading(false);
          return;
        }

        // Buscar perfil do usuário
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('subscription_type, trial_end_date, status')
          .eq('user_id', session.user.id)
          .maybeSingle();

        if (profileError) {
          setLoading(false);
          return;
        }

        if (!profile) {
          setLoading(false);
          return;
        }

        const subscriptionType = profile.subscription_type as 'trial' | 'monthly' | null;
        const isBlocked = profile.status === 'blocked';

        // Se usuário está bloqueado, deslogar e redirecionar
        if (isBlocked) {
          await supabase.auth.signOut();
          toast.error('Acesso negado. Sua conta está bloqueada.');
          navigate('/auth');
          setLoading(false);
          return;
        }

        // Verificar trial
        if (subscriptionType === 'trial' && profile.trial_end_date) {
          const trialEnd = new Date(profile.trial_end_date);
          const now = new Date();
          
          // Normalizar datas para comparar apenas dias (sem horas)
          const trialEndDate = new Date(trialEnd.getFullYear(), trialEnd.getMonth(), trialEnd.getDate());
          const nowDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          
          // Calcular diferença em dias
          const diffTime = trialEndDate.getTime() - nowDate.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          const daysLeft = diffDays > 0 ? diffDays : 0;
          const isExpired = nowDate > trialEndDate;

          // Se trial expirou e usuário ainda está ativo, bloquear
          if (isExpired && profile.status === 'active') {
            // Bloquear usuário automaticamente
            await supabase
              .from('profiles')
              .update({ status: 'blocked' })
              .eq('user_id', session.user.id);
            
            toast.error('Seu período de teste expirou. Entre em contato para converter para assinatura mensal.');
            await supabase.auth.signOut();
            navigate('/auth');
            setLoading(false);
            return;
          }

          setTrialStatus({
            subscriptionType: 'trial',
            trialDaysLeft: daysLeft,
            trialEndDate: profile.trial_end_date,
            isExpired,
            isBlocked: false,
          });
        } else {
          // Não é trial ou não tem trial_end_date
          setTrialStatus({
            subscriptionType: subscriptionType || null,
            trialDaysLeft: null,
            trialEndDate: null,
            isExpired: false,
            isBlocked: false,
          });
        }
      } catch (error) {
        // Erro silencioso - não interrompe o fluxo
      } finally {
        setLoading(false);
      }
    };

    checkTrialStatus();

    // Verificar periodicamente (a cada 5 minutos)
    const interval = setInterval(checkTrialStatus, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [navigate]);

  return { trialStatus, loading };
}

