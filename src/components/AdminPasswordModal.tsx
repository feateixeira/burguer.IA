import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Lock } from 'lucide-react';
import { toast } from 'sonner';

interface AdminPasswordModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  onAuthenticate: (password: string) => Promise<boolean>;
  title?: string;
  description?: string;
}

export const AdminPasswordModal = ({
  open,
  onClose,
  onSuccess,
  onAuthenticate,
  title = 'Senha de Administrador',
  description = 'Digite a senha de 4 dígitos para continuar',
}: AdminPasswordModalProps) => {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

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

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
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
              onClick={onClose}
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
        </form>
      </DialogContent>
    </Dialog>
  );
};
