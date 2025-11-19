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
 * - Retorna estado para mostrar modal quando trial expira
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
  const [showTrialExpiredModal, setShowTrialExpiredModal] = useState(false);

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

        // Verificar trial PRIMEIRO (antes de verificar bloqueio)
        // Se for trial expirado, mostrar modal mesmo se estiver bloqueado
        if (subscriptionType === 'trial' && profile.trial_end_date) {
          const trialEnd = new Date(profile.trial_end_date);
          const now = new Date();
          
          // Normalizar datas para comparar apenas dias (sem horas)
          // Comparar apenas as datas (sem horas) para calcular dias restantes
          const trialEndDateOnly = new Date(trialEnd.getFullYear(), trialEnd.getMonth(), trialEnd.getDate());
          const nowDateOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          
          // Calcular diferença em milissegundos
          const diffTime = trialEndDateOnly.getTime() - nowDateOnly.getTime();
          // Converter para dias (arredondar para cima para garantir que no último dia mostre 0)
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          // Se ainda estamos no mesmo dia ou antes, mostrar dias restantes
          // Se passou do dia, considerar expirado
          const daysLeft = diffDays >= 0 ? diffDays : 0;
          // Considerar expirado apenas se passou do dia (não no mesmo dia)
          const isExpired = nowDateOnly > trialEndDateOnly;

          // Se trial expirou, fazer logout imediatamente e redirecionar para auth
          // O modal será mostrado na página de autenticação
          if (isExpired) {
            // Se ainda não está bloqueado, bloquear automaticamente
            if (profile.status === 'active') {
              await supabase
                .from('profiles')
                .update({ status: 'blocked' })
                .eq('user_id', session.user.id);
            }
            
            // Fazer logout imediatamente e redirecionar para página de autenticação
            // O modal será mostrado lá quando o usuário tentar fazer login novamente
            await supabase.auth.signOut();
            navigate('/auth');
            setLoading(false);
            return;
          }

          // SEMPRE mostrar status do trial se for trial (mesmo que daysLeft seja 0 no último dia)
          setTrialStatus({
            subscriptionType: 'trial',
            trialDaysLeft: daysLeft,
            trialEndDate: profile.trial_end_date,
            isExpired,
            isBlocked: isBlocked,
          });
        } else if (subscriptionType === 'trial' && !profile.trial_end_date) {
          // É trial mas não tem trial_end_date - mostrar como trial sem data
          setTrialStatus({
            subscriptionType: 'trial',
            trialDaysLeft: null,
            trialEndDate: null,
            isExpired: false,
            isBlocked: isBlocked,
          });
        } else {
          // Não é trial - verificar se está bloqueado manualmente
          if (isBlocked) {
            // Se usuário está bloqueado manualmente (não é trial expirado), deslogar e redirecionar
            await supabase.auth.signOut();
            toast.error('Acesso negado. Sua conta está bloqueada.');
            navigate('/auth');
            setLoading(false);
            return;
          }
          
          // Não é trial e não está bloqueado
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

  return { trialStatus, loading, showTrialExpiredModal, setShowTrialExpiredModal };
}

