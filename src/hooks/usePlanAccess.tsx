import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface PlanAccess {
  planType: 'gold' | 'platinum' | 'premium' | 'trial' | null;
  hasAIAccess: boolean;
  hasWhatsAppAccess: boolean;
  isTrial: boolean;
  loading: boolean;
}

/**
 * Hook para verificar acesso a features baseado no plano do usuário
 * 
 * Regras:
 * - Trial: acesso como Premium (mas mostra avisos para contratar)
 * - Gold: apenas sistema básico
 * - Platinum: sistema + IA
 * - Premium: sistema + IA + WhatsApp
 */
export function usePlanAccess() {
  // Verificar se já temos dados em cache (sessionStorage)
  const getCachedPlanAccess = (): PlanAccess | null => {
    try {
      const cached = sessionStorage.getItem('planAccess');
      if (cached) {
        const parsed = JSON.parse(cached);
        // Verificar se o cache não expirou (5 minutos)
        if (Date.now() - parsed.timestamp < 5 * 60 * 1000) {
          return parsed.data;
        }
      }
    } catch (e) {
      // Ignorar erros de parse
    }
    return null;
  };

  const cachedData = getCachedPlanAccess();
  
  const [planAccess, setPlanAccess] = useState<PlanAccess>(
    cachedData || {
      planType: null,
      hasAIAccess: false,
      hasWhatsAppAccess: false,
      isTrial: false,
      loading: !cachedData, // Se temos cache, não precisa mostrar loading
    }
  );

  useEffect(() => {
    // Se já temos cache válido, não fazer nova requisição
    if (cachedData) {
      return;
    }

    const checkPlanAccess = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          setPlanAccess(prev => ({ ...prev, loading: false }));
          return;
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('plan_type, subscription_type')
          .eq('user_id', session.user.id)
          .maybeSingle();

        if (!profile) {
          setPlanAccess(prev => ({ ...prev, loading: false }));
          return;
        }

        const planType = profile.plan_type as 'gold' | 'platinum' | 'premium' | null;
        const subscriptionType = profile.subscription_type as 'trial' | 'monthly' | null;
        const isTrial = subscriptionType === 'trial';

        // Durante trial, acesso como Premium (mas mostra avisos)
        let newPlanAccess: PlanAccess;
        if (isTrial) {
          newPlanAccess = {
            planType: 'trial',
            hasAIAccess: true,
            hasWhatsAppAccess: true,
            isTrial: true,
            loading: false,
          };
        } else {
          // Planos pagos
          const hasAIAccess = planType === 'platinum' || planType === 'premium';
          const hasWhatsAppAccess = planType === 'premium';
          newPlanAccess = {
            planType: planType || null,
            hasAIAccess,
            hasWhatsAppAccess,
            isTrial: false,
            loading: false,
          };
        }

        setPlanAccess(newPlanAccess);
        
        // Salvar no cache
        try {
          sessionStorage.setItem('planAccess', JSON.stringify({
            data: newPlanAccess,
            timestamp: Date.now()
          }));
        } catch (e) {
          // Ignorar erros de sessionStorage
        }
      } catch (error) {
        setPlanAccess(prev => ({ ...prev, loading: false }));
      }
    };

    checkPlanAccess();
  }, [cachedData]);

  return planAccess;
}

