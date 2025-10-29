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
import { Label } from '@/components/ui/label';
import { DollarSign, Lock, User } from 'lucide-react';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { AdminPasswordModal } from './AdminPasswordModal';

interface CashSessionModalProps {
  open: boolean;
  onClose: () => void;
  onOpen: (isAdmin: boolean, openingAmount: number) => void;
}

export const CashSessionModal = ({ open, onClose, onOpen }: CashSessionModalProps) => {
  const { authenticateAdmin, hasPasswordConfigured } = useAdminAuth();
  const [openingAmount, setOpeningAmount] = useState('');
  const [showPinModal, setShowPinModal] = useState(false);

  const handleAdminOpen = () => {
    if (!hasPasswordConfigured) {
      onOpen(true, parseFloat(openingAmount) || 0);
      onClose();
    } else {
      setShowPinModal(true);
    }
  };

  const handleOperationalOpen = () => {
    onOpen(false, parseFloat(openingAmount) || 0);
    onClose();
  };

  const handlePinSuccess = () => {
    onOpen(true, parseFloat(openingAmount) || 0);
    onClose();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-4 mx-auto">
              <DollarSign className="h-6 w-6 text-primary" />
            </div>
            <DialogTitle className="text-center">Abertura de Caixa</DialogTitle>
            <DialogDescription className="text-center">
              Escolha o tipo de abertura de caixa
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="opening-amount">Valor de Abertura</Label>
              <Input
                id="opening-amount"
                type="number"
                step="0.01"
                value={openingAmount}
                onChange={(e) => setOpeningAmount(e.target.value)}
                placeholder="R$ 0,00"
              />
            </div>

            <div className="space-y-2">
              <Button
                onClick={handleAdminOpen}
                className="w-full h-auto py-4 flex flex-col gap-2"
                variant="default"
              >
                <div className="flex items-center gap-2">
                  <Lock className="h-5 w-5" />
                  <span className="font-semibold">Caixa Administrativo</span>
                </div>
                <span className="text-xs opacity-90">
                  Acesso completo • Requer PIN
                </span>
              </Button>

              <Button
                onClick={handleOperationalOpen}
                className="w-full h-auto py-4 flex flex-col gap-2"
                variant="outline"
              >
                <div className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  <span className="font-semibold">Caixa Operacional</span>
                </div>
                <span className="text-xs opacity-90">
                  Funcionalidades limitadas • Sem PIN
                </span>
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AdminPasswordModal
        open={showPinModal}
        onClose={() => setShowPinModal(false)}
        onSuccess={handlePinSuccess}
        onAuthenticate={authenticateAdmin}
        title="PIN Administrativo"
        description="Digite o PIN para abrir caixa administrativo"
      />
    </>
  );
};
