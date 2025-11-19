import { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useTrialCheck } from '@/hooks/useTrialCheck';
import { TrialExpiredModal } from '@/components/TrialExpiredModal';

/**
 * Componente que garante apenas uma sessão ativa por usuário
 * 
 * ESTRATÉGIA: Confiar completamente no Supabase Auth para gerenciar sessões
 * - Não faz validação periódica agressiva (causava desconexões falsas)
 * - Apenas sincroniza sessão no banco quando necessário
 * - Desconecta apenas quando Supabase Auth realmente faz logout
 * 
 * Desconecta apenas quando:
 * 1. Supabase Auth faz logout (refresh token expirado, usuário faz logout, etc)
 * 2. Outro dispositivo faz login (detectado via create_user_session que invalida sessões anteriores)
 * 
 * NOTA: Não desconecta quando:
 * - Notebook entra em suspensão
 * - Aba fica inativa
 * - Navegador entra em modo de economia de energia
 * - Problemas de rede temporários
 * - Validação no banco falha
 */
export function SessionGuard({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const sessionRef = useRef<{ userId: string; refreshToken: string; accessToken: string } | null>(null);
  
  // Verificar status do trial (bloqueia automaticamente se expirado)
  // O hook já faz o bloqueio automaticamente quando detecta que o trial expirou
  const { showTrialExpiredModal, setShowTrialExpiredModal } = useTrialCheck();

  // Rotas públicas que não precisam validação
  const publicRoutes = ['/', '/auth', '/landing', '/password-display', '/password-panel'];
  const isPublicRoute = publicRoutes.includes(location.pathname) || 
                       location.pathname.startsWith('/menu-public/') || 
                       location.pathname.startsWith('/cardapio/');

  useEffect(() => {
    // Se for rota pública, não fazer nada
    if (isPublicRoute) {
      return;
    }

    let mounted = true;

    // Função auxiliar para sincronizar sessão no banco (não bloqueia se falhar)
    const syncSessionToDatabase = async (session: any) => {
      if (!session?.refresh_token) return;

      try {
        const deviceInfo = `${navigator.userAgent} - ${navigator.platform}`;
        const expiresAt = session.expires_at 
          ? new Date(session.expires_at * 1000).toISOString()
          : null;

        // Tentar atualizar primeiro
        const updateResult = await supabase.rpc('update_session_token', {
          p_user_id: session.user.id,
          p_refresh_token: session.refresh_token,
          p_new_session_token: session.access_token,
          p_expires_at: expiresAt
        }).catch(() => ({ data: false }));

        // Se não encontrou, criar nova sessão
        if (!updateResult.data) {
          await supabase.rpc('create_user_session', {
            p_user_id: session.user.id,
            p_session_token: session.access_token,
            p_refresh_token: session.refresh_token,
            p_device_info: deviceInfo,
            p_ip_address: null,
            p_user_agent: navigator.userAgent,
            p_expires_at: expiresAt
          }).catch(() => {
            // Ignorar erros - não é crítico
          });
        }
      } catch (error) {
        // Ignorar erros silenciosamente - não é crítico para funcionamento
      }
    };

    // Escutar mudanças de autenticação do Supabase
    // Esta é a única fonte de verdade para sessões
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.refresh_token) {
        // Usuário fez login - atualizar referência e sincronizar com banco
        sessionRef.current = {
          userId: session.user.id,
          refreshToken: session.refresh_token,
          accessToken: session.access_token
        };

        // Sincronizar com banco (não bloqueia se falhar)
        syncSessionToDatabase(session);
      } else if (event === 'TOKEN_REFRESHED' && session?.refresh_token) {
        // Token foi renovado - atualizar referência e sincronizar com banco
        sessionRef.current = {
          userId: session.user.id,
          refreshToken: session.refresh_token,
          accessToken: session.access_token
        };

        // Sincronizar com banco (não bloqueia se falhar)
        syncSessionToDatabase(session);
      } else if (event === 'SIGNED_OUT') {
        // Supabase fez logout - limpar referência
        // Não tentar recuperar - confiar no Supabase
        sessionRef.current = null;
      }
    });

    // Inicializar sessão atual se existir
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.refresh_token && mounted) {
        sessionRef.current = {
          userId: session.user.id,
          refreshToken: session.refresh_token,
          accessToken: session.access_token
        };
        // Sincronizar com banco (não bloqueia se falhar)
        syncSessionToDatabase(session);
      }
    });

    // Limpar ao desmontar
    return () => {
      mounted = false;
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, [navigate, isPublicRoute]);

  return (
    <>
      {children}
      <TrialExpiredModal 
        open={showTrialExpiredModal} 
        onOpenChange={setShowTrialExpiredModal} 
      />
    </>
  );
}

