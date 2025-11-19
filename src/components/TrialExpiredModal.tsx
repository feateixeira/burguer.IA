import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle, MessageCircle } from 'lucide-react';

interface TrialExpiredModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TrialExpiredModal({ open, onOpenChange }: TrialExpiredModalProps) {
  const navigate = useNavigate();

  const handleOk = async () => {
    // Garantir que está deslogado e apenas fechar o modal
    // Se já estiver na página de autenticação, apenas fechar
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      await supabase.auth.signOut();
    }
    onOpenChange(false);
  };

  const handleContact = () => {
    const whatsappNumber = "5561999098562";
    const message = encodeURIComponent(
      "Olá! Meu período de teste expirou e gostaria de contratar um plano para continuar usando o sistema."
    );
    window.open(`https://wa.me/${whatsappNumber}?text=${message}`, "_blank");
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent 
        className="sm:max-w-md" 
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        {/* Remove botão X de fechar completamente */}
        <style dangerouslySetInnerHTML={{__html: `
          [data-radix-dialog-content] button[data-radix-dialog-close],
          [data-radix-dialog-content] button[aria-label="Close"],
          [data-radix-dialog-content] > button:last-child:has(svg),
          [data-radix-dialog-content] button:has(svg[aria-label="Close"]),
          [data-radix-dialog-content] button:has(svg[class*="lucide"]):not([class*="mr-2"]):not([class*="ml-2"]) {
            display: none !important;
            visibility: hidden !important;
            pointer-events: none !important;
            opacity: 0 !important;
            width: 0 !important;
            height: 0 !important;
            position: absolute !important;
            left: -9999px !important;
          }
        `}} />
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <AlertTriangle className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
            <DialogTitle className="text-xl">
              Período de Teste Expirado
            </DialogTitle>
          </div>
          <DialogDescription className="text-base pt-2">
            Seu período de teste expirou. Para continuar usando o sistema, você precisa contratar um plano.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button 
            onClick={handleContact} 
            variant="default"
            className="w-full sm:w-auto"
          >
            <MessageCircle className="h-4 w-4 mr-2" />
            Entrar em Contato
          </Button>
          <Button 
            onClick={handleOk} 
            variant="outline"
            className="w-full sm:w-auto"
          >
            OK
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

