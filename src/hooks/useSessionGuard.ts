import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

/**
 * Hook para garantir que apenas uma sessão por usuário esteja ativa
 * Verifica periodicamente se a sessão atual ainda é válida
 */
export function useSessionGuard() {
  const navigate = useNavigate();
  const [isValidating, setIsValidating] = useState(true);
  const [isValid, setIsValid] = useState(false);

  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    let mounted = true;

    const validateSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          if (mounted) {
            setIsValid(false);
            setIsValidating(false);
            toast.error('Sessão expirada. Por favor, faça login novamente.');
            navigate('/auth');
          }
          return;
        }

        // Verificar se a sessão está válida no banco usando refresh_token
        if (!session.refresh_token) {
          if (mounted) {
            setIsValid(true);
            setIsValidating(false);
          }
          return;
        }

        const { data, error } = await supabase.rpc('is_session_valid', {
          p_user_id: session.user.id,
          p_refresh_token: session.refresh_token
        });

        if (error) {
          console.error('Error validating session:', error);
          // Se houver erro na validação, permitir continuar por enquanto
          if (mounted) {
            setIsValid(true);
            setIsValidating(false);
          }
          return;
        }

        if (!data) {
          // Sessão inválida - foi invalidada por outro dispositivo
          if (mounted) {
            setIsValid(false);
            setIsValidating(false);
            await supabase.auth.signOut();
            toast.error('Você foi desconectado. Outro dispositivo fez login com sua conta.');
            navigate('/auth');
          }
          return;
        }

        // Sessão válida - atualizar última atividade
        await supabase.rpc('update_session_activity', {
          p_user_id: session.user.id,
          p_refresh_token: session.refresh_token,
          p_session_token: session.access_token
        });

        if (mounted) {
          setIsValid(true);
          setIsValidating(false);
        }
      } catch (error) {
        console.error('Session validation error:', error);
        if (mounted) {
          setIsValid(false);
          setIsValidating(false);
        }
      }
    };

    // Validar imediatamente
    validateSession();

    // Validar a cada 30 segundos
    intervalId = setInterval(validateSession, 30000);

    // Limpar ao desmontar
    return () => {
      mounted = false;
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [navigate]);

  return { isValid, isValidating };
}

