import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Wallet, AlertCircle } from "lucide-react";

interface CashRequiredModalProps {
  open: boolean;
  onClose: () => void;
  onOpenCash: () => void;
}

export const CashRequiredModal = ({
  open,
  onClose,
  onOpenCash,
}: CashRequiredModalProps) => {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-yellow-100 rounded-full">
              <AlertCircle className="h-6 w-6 text-yellow-600" />
            </div>
            <DialogTitle>Caixa Fechado</DialogTitle>
          </div>
          <DialogDescription>
            Não é possível realizar vendas sem um caixa aberto.
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4">
          <p className="text-sm text-muted-foreground mb-4">
            Para iniciar as vendas, você precisa abrir o caixa primeiro na seção Financeiro.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => {
            onOpenCash();
            onClose();
          }}>
            <Wallet className="h-4 w-4 mr-2" />
            Abrir Caixa
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

