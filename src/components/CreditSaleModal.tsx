import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Calendar, Loader2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface CartItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
  notes?: string;
  saucePrice?: number;
  originalPrice?: number;
  promotionId?: string;
  promotionName?: string;
  addons?: any[];
}

interface Customer {
  id: string;
  name: string;
  phone?: string;
  address?: string;
}

interface CreditSaleModalProps {
  open: boolean;
  onClose: () => void;
  cart: CartItem[];
  totalAmount: number;
  subtotal: number;
  discountAmount: number;
  deliveryFee: number;
  onConfirm: (data: {
    customerId: string | null;
    customerName: string;
    customerPhone: string | null;
    dueDate: string;
    interestRate: number;
  }) => Promise<void>;
}

export const CreditSaleModal = ({
  open,
  onClose,
  cart,
  totalAmount,
  subtotal,
  discountAmount,
  deliveryFee,
  onConfirm
}: CreditSaleModalProps) => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [interestRate, setInterestRate] = useState<number>(0);
  const [defaultInterestRate, setDefaultInterestRate] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [loadingCustomers, setLoadingCustomers] = useState(false);

  useEffect(() => {
    if (open) {
      loadCustomers();
      loadDefaultInterestRate();
      // Definir data mínima como hoje
      const today = new Date().toISOString().split('T')[0];
      setDueDate(today);
      // Resetar campos
      setSelectedCustomer(null);
      setCustomerName('');
      setCustomerPhone('');
      setCustomerSearch('');
      setInterestRate(0);
    }
  }, [open]);

  const loadDefaultInterestRate = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('establishment_id')
        .eq('user_id', session.user.id)
        .single();

      if (!profile) return;

      const { data: establishment } = await supabase
        .from('establishments')
        .select('settings')
        .eq('id', profile.establishment_id)
        .single();

      if (establishment?.settings?.credit_interest_rate_per_day) {
        const rate = parseFloat(establishment.settings.credit_interest_rate_per_day) || 0;
        setDefaultInterestRate(rate);
        setInterestRate(rate);
      }
    } catch (error) {
      console.error('Erro ao carregar taxa de juros padrão:', error);
    }
  };

  const loadCustomers = async () => {
    setLoadingCustomers(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('establishment_id')
        .eq('user_id', session.user.id)
        .single();

      if (!profile) return;

      const { data: customersData, error } = await supabase
        .from('customers')
        .select('*')
        .eq('establishment_id', profile.establishment_id)
        .order('name');

      if (error) throw error;
      setCustomers(customersData || []);
    } catch (error) {
      console.error('Erro ao carregar clientes:', error);
    } finally {
      setLoadingCustomers(false);
    }
  };

  const filteredCustomers = customers.filter(c =>
    c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
    (c.phone && c.phone.includes(customerSearch))
  );

  const handleCustomerSelect = (customer: Customer) => {
    setSelectedCustomer(customer);
    setCustomerName(customer.name);
    setCustomerPhone(customer.phone || '');
    setCustomerSearch('');
    setShowCustomerDropdown(false);
  };

  const handleCreateNewCustomer = () => {
    setSelectedCustomer(null);
    setShowCustomerDropdown(false);
  };

  const handleConfirm = async () => {
    if (cart.length === 0) {
      toast.error('Carrinho vazio');
      return;
    }

    if (!customerName.trim()) {
      toast.error('Informe o nome do cliente');
      return;
    }

    if (!dueDate) {
      toast.error('Selecione a data de vencimento');
      return;
    }

    // Validar que a data não seja no passado
    const selectedDate = new Date(dueDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (selectedDate < today) {
      toast.error('A data de vencimento não pode ser no passado');
      return;
    }

    if (interestRate < 0) {
      toast.error('A taxa de juros não pode ser negativa');
      return;
    }

    setLoading(true);
    try {
      await onConfirm({
        customerId: selectedCustomer?.id || null,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim() || null,
        dueDate,
        interestRate: interestRate / 100, // Converter porcentagem para decimal
      });
      onClose();
    } catch (error) {
      console.error('Erro ao confirmar venda fiado:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Venda Fiado
          </DialogTitle>
          <DialogDescription>
            Configure os dados do cliente e data de vencimento para finalizar a venda fiado
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Resumo do Pedido */}
          <div className="border rounded-lg p-4 bg-muted/50">
            <h3 className="font-semibold mb-2">Resumo do Pedido</h3>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>R$ {subtotal.toFixed(2)}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Desconto:</span>
                  <span>-R$ {discountAmount.toFixed(2)}</span>
                </div>
              )}
              {deliveryFee > 0 && (
                <div className="flex justify-between">
                  <span>Taxa de Entrega:</span>
                  <span>R$ {deliveryFee.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between font-semibold border-t pt-1 mt-1">
                <span>Total:</span>
                <span>R$ {totalAmount.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Seleção de Cliente */}
          <div className="space-y-2">
            <Label>Cliente *</Label>
            <div className="relative">
              <Input
                placeholder="Buscar cliente ou digite um novo nome"
                value={customerSearch || customerName}
                onChange={(e) => {
                  const value = e.target.value;
                  if (selectedCustomer) {
                    setSelectedCustomer(null);
                    setCustomerName('');
                    setCustomerPhone('');
                  }
                  setCustomerSearch(value);
                  setCustomerName(value);
                  setShowCustomerDropdown(value.length > 0 && !selectedCustomer);
                }}
                onFocus={() => {
                  if (customerSearch.length > 0 && !selectedCustomer) {
                    setShowCustomerDropdown(true);
                  }
                }}
              />
              {showCustomerDropdown && filteredCustomers.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-background border rounded-md shadow-lg max-h-60 overflow-auto">
                  {filteredCustomers.map((customer) => (
                    <button
                      key={customer.id}
                      type="button"
                      className="w-full text-left px-4 py-2 hover:bg-muted"
                      onClick={() => handleCustomerSelect(customer)}
                    >
                      <div className="font-medium">{customer.name}</div>
                      {customer.phone && (
                        <div className="text-sm text-muted-foreground">{customer.phone}</div>
                      )}
                    </button>
                  ))}
                  <button
                    type="button"
                    className="w-full text-left px-4 py-2 hover:bg-muted border-t"
                    onClick={handleCreateNewCustomer}
                  >
                    <div className="font-medium text-primary">+ Criar novo cliente</div>
                  </button>
                </div>
              )}
            </div>
            {selectedCustomer && (
              <p className="text-xs text-muted-foreground">
                Cliente selecionado: {selectedCustomer.name}
              </p>
            )}
          </div>

          {/* Telefone do Cliente */}
          <div className="space-y-2">
            <Label>Telefone do Cliente</Label>
            <Input
              placeholder="(11) 99999-9999"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
            />
          </div>

          {/* Data de Vencimento */}
          <div className="space-y-2">
            <Label>Data de Vencimento *</Label>
            <Input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
            />
          </div>

          {/* Taxa de Juros */}
          <div className="space-y-2">
            <Label>Taxa de Juros por Dia (%)</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              max="100"
              value={interestRate}
              onChange={(e) => setInterestRate(parseFloat(e.target.value) || 0)}
              placeholder={defaultInterestRate > 0 ? `Padrão: ${defaultInterestRate}%` : '0.00'}
            />
            <p className="text-xs text-muted-foreground">
              Taxa de juros aplicada por dia de atraso após a data de vencimento. 
              {defaultInterestRate > 0 && ` Padrão configurado: ${defaultInterestRate}%`}
            </p>
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
                  Finalizando...
                </>
              ) : (
                'Finalizar Venda Fiado'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

