import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  Search, 
  DollarSign,
  Calendar,
  AlertCircle,
  CheckCircle,
  Clock,
  Phone
} from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import { useSidebarWidth } from '@/hooks/useSidebarWidth';
import { CreditPaymentModal } from '@/components/CreditPaymentModal';

interface CreditOrder {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone?: string;
  total_amount: number;
  credit_due_date: string;
  credit_received_at: string | null;
  credit_interest_rate_per_day: number;
  credit_interest_amount: number;
  credit_total_with_interest: number;
  payment_method?: string;
  created_at: string;
}

const CreditSales = () => {
  const [orders, setOrders] = useState<CreditOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<string>('pending');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const sidebarWidth = useSidebarWidth();

  useEffect(() => {
    loadOrders();
    
    // Real-time subscription para atualizar quando houver mudanças
    const channel = supabase
      .channel('credit_sales_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: 'is_credit_sale=eq.true'
        },
        () => {
          loadOrders();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeTab]);

  const loadOrders = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Usuário não autenticado');
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('establishment_id')
        .eq('user_id', session.user.id)
        .single();

      if (!profile) return;

      let query = supabase
        .from('orders')
        .select('*')
        .eq('establishment_id', profile.establishment_id)
        .eq('is_credit_sale', true)
        .order('created_at', { ascending: false });

      // Filtrar por status
      if (activeTab === 'pending') {
        query = query.is('credit_received_at', null);
      } else if (activeTab === 'received') {
        query = query.not('credit_received_at', 'is', null);
      } else if (activeTab === 'overdue') {
        const today = new Date().toISOString().split('T')[0];
        query = query
          .is('credit_received_at', null)
          .lt('credit_due_date', today);
      }

      const { data, error } = await query;

      if (error) throw error;
      setOrders((data as CreditOrder[]) || []);
    } catch (error: any) {
      console.error('Erro ao carregar pedidos fiado:', error);
      toast.error('Erro ao carregar pedidos fiado');
    } finally {
      setLoading(false);
    }
  };

  const filteredOrders = orders.filter(order =>
    order.order_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (order.customer_phone && order.customer_phone.includes(searchTerm))
  );

  const getDaysOverdue = (dueDate: string): number => {
    const due = new Date(dueDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    due.setHours(0, 0, 0, 0);
    return Math.max(0, Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24)));
  };

  const calculateInterest = (order: CreditOrder): number => {
    if (order.credit_received_at) {
      return order.credit_interest_amount;
    }
    const daysOverdue = getDaysOverdue(order.credit_due_date);
    if (order.credit_interest_rate_per_day > 0 && daysOverdue > 0) {
      return order.total_amount * order.credit_interest_rate_per_day * daysOverdue;
    }
    return 0;
  };

  const handleReceivePayment = (orderId: string) => {
    setSelectedOrderId(orderId);
    setShowPaymentModal(true);
  };

  const handlePaymentReceived = () => {
    loadOrders();
    setShowPaymentModal(false);
    setSelectedOrderId(null);
  };

  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div 
        className="flex-1 overflow-auto"
        style={{ marginLeft: `${sidebarWidth}px`, transition: 'margin-left 0.3s ease' }}
      >
        <div className="container mx-auto p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Vendas Fiado</h1>
              <p className="text-muted-foreground mt-1">
                Gerencie pedidos vendidos a prazo
              </p>
            </div>
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Pedidos Fiado</CardTitle>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por pedido ou cliente..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-8 w-64"
                    />
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList>
                  <TabsTrigger value="pending">
                    Pendentes
                    {orders.filter(o => !o.credit_received_at).length > 0 && (
                      <Badge variant="secondary" className="ml-2">
                        {orders.filter(o => !o.credit_received_at).length}
                      </Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="overdue">
                    Vencidos
                    {orders.filter(o => {
                      const days = getDaysOverdue(o.credit_due_date);
                      return !o.credit_received_at && days > 0;
                    }).length > 0 && (
                      <Badge variant="destructive" className="ml-2">
                        {orders.filter(o => {
                          const days = getDaysOverdue(o.credit_due_date);
                          return !o.credit_received_at && days > 0;
                        }).length}
                      </Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="received">Recebidos</TabsTrigger>
                </TabsList>

                <TabsContent value={activeTab} className="mt-4">
                  {loading ? (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground">Carregando...</p>
                    </div>
                  ) : filteredOrders.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground">
                        {activeTab === 'pending' && 'Nenhum pedido fiado pendente'}
                        {activeTab === 'overdue' && 'Nenhum pedido fiado vencido'}
                        {activeTab === 'received' && 'Nenhum pedido fiado recebido'}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {filteredOrders.map((order) => {
                        const daysOverdue = getDaysOverdue(order.credit_due_date);
                        const interest = calculateInterest(order);
                        const totalWithInterest = order.total_amount + interest;
                        const isOverdue = daysOverdue > 0 && !order.credit_received_at;

                        return (
                          <Card key={order.id} className={isOverdue ? 'border-red-500' : ''}>
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-2">
                                    <span className="font-semibold text-lg">
                                      Pedido {order.order_number}
                                    </span>
                                    {order.credit_received_at ? (
                                      <Badge variant="default" className="bg-green-600">
                                        <CheckCircle className="h-3 w-3 mr-1" />
                                        Recebido
                                      </Badge>
                                    ) : isOverdue ? (
                                      <Badge variant="destructive">
                                        <AlertCircle className="h-3 w-3 mr-1" />
                                        {daysOverdue} {daysOverdue === 1 ? 'dia' : 'dias'} em atraso
                                      </Badge>
                                    ) : (
                                      <Badge variant="secondary">
                                        <Clock className="h-3 w-3 mr-1" />
                                        Pendente
                                      </Badge>
                                    )}
                                  </div>

                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                    <div>
                                      <Label className="text-muted-foreground">Cliente</Label>
                                      <p className="font-medium">{order.customer_name}</p>
                                      {order.customer_phone && (
                                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                                          <Phone className="h-3 w-3" />
                                          {order.customer_phone}
                                        </p>
                                      )}
                                    </div>
                                    <div>
                                      <Label className="text-muted-foreground">Vencimento</Label>
                                      <p className="font-medium flex items-center gap-1">
                                        <Calendar className="h-4 w-4" />
                                        {formatDate(order.credit_due_date)}
                                      </p>
                                    </div>
                                    <div>
                                      <Label className="text-muted-foreground">Valor Original</Label>
                                      <p className="font-medium">{formatCurrency(order.total_amount)}</p>
                                    </div>
                                    <div>
                                      <Label className="text-muted-foreground">Total com Juros</Label>
                                      <p className="font-medium text-primary">
                                        {formatCurrency(totalWithInterest)}
                                      </p>
                                      {interest > 0 && (
                                        <p className="text-xs text-muted-foreground">
                                          Juros: {formatCurrency(interest)}
                                        </p>
                                      )}
                                    </div>
                                  </div>

                                  {order.credit_received_at && (
                                    <div className="mt-3 pt-3 border-t">
                                      <p className="text-xs text-muted-foreground">
                                        Recebido em: {formatDate(order.credit_received_at)} • 
                                        Método: {order.payment_method || 'N/A'}
                                      </p>
                                    </div>
                                  )}
                                </div>

                                {!order.credit_received_at && (
                                  <div className="ml-4">
                                    <Button
                                      onClick={() => handleReceivePayment(order.id)}
                                      className="flex items-center gap-2"
                                    >
                                      <DollarSign className="h-4 w-4" />
                                      Receber Pagamento
                                    </Button>
                                  </div>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>

      {selectedOrderId && (
        <CreditPaymentModal
          open={showPaymentModal}
          onClose={() => {
            setShowPaymentModal(false);
            setSelectedOrderId(null);
          }}
          orderId={selectedOrderId}
          onPaymentReceived={handlePaymentReceived}
        />
      )}
    </div>
  );
};

export default CreditSales;

