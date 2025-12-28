import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Calendar, DollarSign, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface CreditOrder {
  id: string;
  order_number: string;
  customer_name: string;
  total_amount: number;
  credit_due_date: string;
}

interface CreditDueDateAlertModalProps {
  open: boolean;
  onClose: () => void;
  orders: CreditOrder[];
}

export const CreditDueDateAlertModal = ({
  open,
  onClose,
  orders
}: CreditDueDateAlertModalProps) => {
  const navigate = useNavigate();

  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const handleGoToCreditSales = () => {
    navigate('/credit-sales');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-yellow-500" />
            Pedidos Fiado Vencendo Hoje
          </DialogTitle>
          <DialogDescription>
            {orders.length} {orders.length === 1 ? 'pedido vence' : 'pedidos vencem'} hoje e precisa ser recebido
          </DialogDescription>
        </DialogHeader>

        <Alert className="bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800">
          <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
          <AlertDescription className="text-yellow-800 dark:text-yellow-200">
            <strong>Atenção!</strong> Você tem {orders.length} {orders.length === 1 ? 'pedido fiado' : 'pedidos fiado'} vencendo hoje.
            Acesse a página de Vendas Fiado para receber os pagamentos.
          </AlertDescription>
        </Alert>

        <div className="space-y-3 max-h-96 overflow-y-auto">
          {orders.map((order) => (
            <div
              key={order.id}
              className="border rounded-lg p-4 bg-muted/50 hover:bg-muted transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-semibold">Pedido {order.order_number}</span>
                    <Badge variant="outline" className="bg-yellow-100 dark:bg-yellow-900">
                      <Calendar className="h-3 w-3 mr-1" />
                      Vence Hoje
                    </Badge>
                  </div>
                  <div className="space-y-1 text-sm">
                    <p className="text-muted-foreground">
                      <strong>Cliente:</strong> {order.customer_name}
                    </p>
                    <p className="text-muted-foreground flex items-center gap-1">
                      <DollarSign className="h-4 w-4" />
                      <strong>Valor:</strong> {formatCurrency(order.total_amount)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
          <Button onClick={handleGoToCreditSales}>
            Ir para Vendas Fiado
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

