import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { DollarSign, Loader2, AlertCircle, Calendar } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface CreditPaymentModalProps {
  open: boolean;
  onClose: () => void;
  orderId: string;
  onPaymentReceived: () => void;
}

interface OrderData {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone?: string;
  total_amount: number;
  credit_due_date: string;
  credit_interest_rate_per_day: number;
  credit_interest_amount: number;
  credit_total_with_interest: number;
  credit_received_at: string | null;
}

export const CreditPaymentModal = ({
  open,
  onClose,
  orderId,
  onPaymentReceived
}: CreditPaymentModalProps) => {
  const [order, setOrder] = useState<OrderData | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingOrder, setLoadingOrder] = useState(true);
  const [interestAmount, setInterestAmount] = useState<number>(0);
  const [totalWithInterest, setTotalWithInterest] = useState<number>(0);
  const [daysOverdue, setDaysOverdue] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<string>('');
  const [manualInterest, setManualInterest] = useState<boolean>(false);

  useEffect(() => {
    if (open && orderId) {
      loadOrder();
    }
  }, [open, orderId]);

  const loadOrder = async () => {
    setLoadingOrder(true);
    try {
      const { data: orderData, error } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .single();

      if (error) throw error;
      if (!orderData) {
        toast.error('Pedido não encontrado');
        onClose();
        return;
      }

      if (!orderData.is_credit_sale) {
        toast.error('Este pedido não é uma venda fiado');
        onClose();
        return;
      }

      if (orderData.credit_received_at) {
        toast.error('Este pedido já foi recebido');
        onClose();
        return;
      }

      setOrder(orderData as OrderData);

      // Calcular dias de atraso
      const dueDate = new Date(orderData.credit_due_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      dueDate.setHours(0, 0, 0, 0);
      const overdue = Math.max(0, Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)));
      setDaysOverdue(overdue);

      // Calcular juros automaticamente
      if (orderData.credit_interest_rate_per_day > 0 && overdue > 0) {
        const calculatedInterest = orderData.total_amount * orderData.credit_interest_rate_per_day * overdue;
        setInterestAmount(Number(calculatedInterest.toFixed(2)));
        setTotalWithInterest(Number((orderData.total_amount + calculatedInterest).toFixed(2)));
      } else {
        setInterestAmount(0);
        setTotalWithInterest(orderData.total_amount);
      }
    } catch (error) {
      console.error('Erro ao carregar pedido:', error);
      toast.error('Erro ao carregar pedido');
      onClose();
    } finally {
      setLoadingOrder(false);
    }
  };

  const handleInterestChange = (value: string) => {
    const newInterest = parseFloat(value) || 0;
    setInterestAmount(newInterest);
    setTotalWithInterest((order?.total_amount || 0) + newInterest);
    setManualInterest(true);
  };

  const handleConfirm = async () => {
    if (!paymentMethod) {
      toast.error('Selecione o método de pagamento');
      return;
    }

    if (!order) return;

    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Usuário não autenticado');
        return;
      }

      // Registrar recebimento usando a função do banco
      const { error: paymentError } = await supabase.rpc('register_credit_payment', {
        p_order_id: order.id,
        p_payment_method: paymentMethod,
        p_amount: totalWithInterest,
        p_received_by: session.user.id,
        p_interest_amount: interestAmount
      });

      if (paymentError) throw paymentError;

      toast.success(`Pagamento recebido com sucesso! Total: R$ ${totalWithInterest.toFixed(2)}`);
      onPaymentReceived();
      onClose();
    } catch (error: any) {
      console.error('Erro ao receber pagamento:', error);
      toast.error(error.message || 'Erro ao receber pagamento');
    } finally {
      setLoading(false);
    }
  };

  if (loadingOrder) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!order) return null;

  const dueDateFormatted = new Date(order.credit_due_date).toLocaleDateString('pt-BR');

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Receber Pagamento - Pedido {order.order_number}
          </DialogTitle>
          <DialogDescription>
            Registre o recebimento do pedido fiado
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Informações do Pedido */}
          <div className="border rounded-lg p-4 bg-muted/50">
            <h3 className="font-semibold mb-3">Informações do Pedido</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Cliente:</span>
                <span className="font-medium">{order.customer_name}</span>
              </div>
              {order.customer_phone && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Telefone:</span>
                  <span>{order.customer_phone}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Valor Original:</span>
                <span className="font-medium">R$ {order.total_amount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Data de Vencimento:</span>
                <span className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  {dueDateFormatted}
                </span>
              </div>
            </div>
          </div>

          {/* Status de Atraso */}
          {daysOverdue > 0 && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Pedido em atraso!</strong> {daysOverdue} {daysOverdue === 1 ? 'dia' : 'dias'} após o vencimento.
              </AlertDescription>
            </Alert>
          )}

          {daysOverdue === 0 && (
            <Alert className="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
              <AlertDescription className="text-green-800 dark:text-green-200">
                Pedido vencendo hoje. Sem atraso.
              </AlertDescription>
            </Alert>
          )}

          {/* Cálculo de Juros */}
          {order.credit_interest_rate_per_day > 0 && daysOverdue > 0 && (
            <div className="border rounded-lg p-4">
              <h3 className="font-semibold mb-3">Cálculo de Juros</h3>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span>Taxa de juros por dia:</span>
                  <span className="font-medium">{(order.credit_interest_rate_per_day * 100).toFixed(2)}%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Dias de atraso:</span>
                  <span className="font-medium">{daysOverdue} {daysOverdue === 1 ? 'dia' : 'dias'}</span>
                </div>
                <div className="space-y-2">
                  <Label>Valor dos Juros (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={interestAmount}
                    onChange={(e) => handleInterestChange(e.target.value)}
                    placeholder="0.00"
                  />
                  <p className="text-xs text-muted-foreground">
                    Juros calculados automaticamente. Você pode ajustar manualmente se necessário.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Valor Total */}
          <div className="border rounded-lg p-4 bg-primary/5">
            <div className="flex justify-between items-center">
              <span className="text-lg font-semibold">Total a Receber:</span>
              <span className="text-2xl font-bold text-primary">
                R$ {totalWithInterest.toFixed(2)}
              </span>
            </div>
            {interestAmount > 0 && (
              <div className="mt-2 text-sm text-muted-foreground">
                (R$ {order.total_amount.toFixed(2)} + R$ {interestAmount.toFixed(2)} de juros)
              </div>
            )}
          </div>

          {/* Método de Pagamento */}
          <div className="space-y-2">
            <Label>Método de Pagamento *</Label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o método de pagamento" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dinheiro">Dinheiro</SelectItem>
                <SelectItem value="pix">PIX</SelectItem>
                <SelectItem value="cartao_debito">Cartão de Débito</SelectItem>
                <SelectItem value="cartao_credito">Cartão de Crédito</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Botões */}
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={onClose} disabled={loading}>
              Cancelar
            </Button>
            <Button onClick={handleConfirm} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Registrando...
                </>
              ) : (
                'Confirmar Recebimento'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

