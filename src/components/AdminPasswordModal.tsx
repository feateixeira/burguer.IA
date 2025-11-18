import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Lock, X, LogOut } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface AdminPasswordModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  onAuthenticate: (password: string) => Promise<boolean>;
  title?: string;
  description?: string;
  logoutOnClose?: boolean;
}

export const AdminPasswordModal = ({
  open,
  onClose,
  onSuccess,
  onAuthenticate,
  title = 'Senha de Administrador',
  description = 'Digite a senha de 4 dígitos para continuar',
  logoutOnClose = false,
}: AdminPasswordModalProps) => {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Função para fazer logout - FORÇA redirecionamento imediato
  const performLogout = useCallback(() => {
    // Limpar sessão admin local IMEDIATAMENTE
    sessionStorage.removeItem('admin_auth');
    sessionStorage.removeItem('admin_expiry');
    
    // Fazer logout do Supabase (não aguardar)
    supabase.auth.signOut().catch(() => {
      // Ignorar erros
    });
    
    // FORÇAR redirecionamento usando window.location (mais confiável que navigate)
    window.location.href = '/auth';
  }, []);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password.length !== 4) {
      toast.error('A senha deve ter 4 dígitos');
      return;
    }

    setLoading(true);
    
    try {
      const isValid = await onAuthenticate(password);
      
      if (isValid) {
        toast.success('Acesso liberado!');
        onSuccess();
        setPassword('');
        onClose();
      } else {
        toast.error('Senha incorreta');
        setPassword('');
      }
    } catch (error) {
      toast.error('Erro ao verificar senha');
    } finally {
      setLoading(false);
    }
  };

  // Debug: verificar se logoutOnClose está ativo
  useEffect(() => {
    if (open && logoutOnClose) {
      console.log('AdminPasswordModal aberto com logoutOnClose=true');
    }
  }, [open, logoutOnClose]);

  return (
    <Dialog 
      open={open} 
      onOpenChange={(isOpen) => {
        // Se está tentando fechar
        if (!isOpen) {
          if (logoutOnClose) {
            // Fazer logout e redirecionar IMEDIATAMENTE
            performLogout();
            // Não chamar onClose para evitar conflito
            return;
          } else {
            // Fechamento normal
            onClose();
          }
        }
      }}
      modal={true}
    >
      <DialogContent 
        className="sm:max-w-md"
        onEscapeKeyDown={(e) => {
          if (logoutOnClose) {
            e.preventDefault();
            performLogout();
          }
        }}
        onInteractOutside={(e) => {
          if (logoutOnClose) {
            e.preventDefault();
            performLogout();
          }
        }}
        onPointerDownOutside={(e) => {
          if (logoutOnClose) {
            e.preventDefault();
            performLogout();
          }
        }}
      >
        {/* Esconder botão X padrão quando logoutOnClose está ativo */}
        {logoutOnClose && (
          <style dangerouslySetInnerHTML={{__html: `
            [data-radix-dialog-content] button[data-radix-dialog-close],
            [data-radix-dialog-content] button[aria-label="Close"],
            [data-radix-dialog-content] > button:last-child:has(svg) {
              display: none !important;
              visibility: hidden !important;
              pointer-events: none !important;
              opacity: 0 !important;
              width: 0 !important;
              height: 0 !important;
            }
          `}} />
        )}
        
        {/* Botão X customizado que funciona - SEMPRE visível quando logoutOnClose */}
        {logoutOnClose && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              performLogout();
            }}
            className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 z-[9999] cursor-pointer bg-background"
            style={{ 
              pointerEvents: 'auto',
              zIndex: 9999
            }}
            aria-label="Fechar e voltar para login"
            title="Fechar e voltar para login"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Fechar e voltar para login</span>
          </button>
        )}
        
        <DialogHeader>
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-4 mx-auto">
            <Lock className="h-6 w-6 text-primary" />
          </div>
          <DialogTitle className="text-center">{title}</DialogTitle>
          <DialogDescription className="text-center">
            {description}
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={4}
            value={password}
            onChange={(e) => setPassword(e.target.value.replace(/\D/g, '').slice(0, 4))}
            placeholder="••••"
            className="text-center text-2xl tracking-widest"
            autoFocus
            autoComplete="off"
            autoSave="off"
            data-form-type="other"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !loading && password.length === 4) {
                e.preventDefault();
                handleSubmit(e as any);
              }
            }}
          />
          
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (logoutOnClose) {
                  performLogout();
                } else {
                  onClose();
                }
              }}
              className="flex-1"
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="flex-1"
              disabled={loading || password.length !== 4}
            >
              {loading ? 'Verificando...' : 'Confirmar'}
            </Button>
          </div>
          
          {/* Botão "Voltar para Login" quando logoutOnClose está ativo */}
          {logoutOnClose && (
            <div className="pt-2 border-t">
              <Button
                type="button"
                variant="ghost"
                onClick={performLogout}
                className="w-full text-muted-foreground hover:text-destructive"
                disabled={loading}
              >
                <LogOut className="h-4 w-4 mr-2" />
                Voltar para Login
              </Button>
            </div>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
};
