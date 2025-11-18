import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hook para limpar sessão ao fechar aba/navegador
 * Garante que ao fechar a aba, o usuário precise fazer login novamente
 */
export function useSessionCleanup() {
  useEffect(() => {
    const handleBeforeUnload = async () => {
      // Limpar sessão admin
      sessionStorage.removeItem('admin_auth');
      sessionStorage.removeItem('admin_expiry');
      
      // Limpar dados de navegação
      sessionStorage.clear();
      
      // Fazer logout do Supabase (não aguarda para não bloquear o fechamento)
      supabase.auth.signOut().catch(() => {
        // Ignorar erros - o navegador pode estar fechando
      });
    };

    // Limpar ao fechar aba/navegador
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    // Limpar ao sair da página (navegação)
    window.addEventListener('unload', handleBeforeUnload);
    
    // Limpar quando a página fica oculta (mudança de aba)
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Não limpar imediatamente ao mudar de aba, apenas ao fechar
        // Isso permite que o usuário mude de aba sem perder a sessão
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('unload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);
}

