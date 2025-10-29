import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';
import { DollarSign, AlertTriangle, CheckCircle, Clock, Download, Filter } from 'lucide-react';
import { toast } from 'sonner';
import Sidebar from '@/components/Sidebar';

interface PixPayment {
  id: string;
  order_id: string;
  amount: number;
  status: string;
  pix_key_used: string;
  pix_key_type: string;
  fraud_suspected: boolean;
  fraud_reason: string | null;
  confirmed_at: string | null;
  created_at: string;
  orders: {
    order_number: string;
    customer_name: string | null;
  };
}

export default function PixPayments() {
  const [payments, setPayments] = useState<PixPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState({
    start: format(new Date(), 'yyyy-MM-dd'),
    end: format(new Date(), 'yyyy-MM-dd'),
  });
  const [stats, setStats] = useState({
    total: 0,
    confirmed: 0,
    pending: 0,
    fraudSuspected: 0,
  });

  useEffect(() => {
    loadPayments();
  }, [dateFilter]);

  const loadPayments = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('establishment_id')
        .eq('user_id', session.user.id)
        .single();

      if (!profile) return;

      const { data, error } = await supabase
        .from('pix_payments')
        .select(`
          *,
          orders!pix_payments_order_id_fkey (
            order_number,
            customer_name
          )
        `)
        .eq('establishment_id', profile.establishment_id)
        .gte('created_at', `${dateFilter.start}T00:00:00`)
        .lte('created_at', `${dateFilter.end}T23:59:59`)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setPayments(data as any || []);

      // Calcular estatísticas
      const totalAmount = data?.reduce((acc, p) => acc + Number(p.amount), 0) || 0;
      const confirmedCount = data?.filter(p => p.status === 'paid').length || 0;
      const pendingCount = data?.filter(p => p.status === 'pending').length || 0;
      const fraudCount = 0; // Placeholder - fraud detection not implemented yet

      setStats({
        total: totalAmount,
        confirmed: confirmedCount,
        pending: pendingCount,
        fraudSuspected: fraudCount,
      });
    } catch (error) {
      console.error('Error loading payments:', error);
      toast.error('Erro ao carregar pagamentos');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string, fraudSuspected: boolean) => {
    if (fraudSuspected) {
      return <Badge variant="destructive"><AlertTriangle className="h-3 w-3 mr-1" /> Fraude Suspeita</Badge>;
    }

    switch (status) {
      case 'paid':
        return <Badge className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" /> Pago</Badge>;
      case 'pending':
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" /> Pendente</Badge>;
      case 'cancelled':
        return <Badge variant="outline">Cancelado</Badge>;
      case 'failed':
        return <Badge variant="destructive">Falhou</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const exportToCSV = () => {
    const headers = ['Data', 'Pedido', 'Cliente', 'Valor', 'Status', 'Chave PIX', 'Fraude'];
    const rows = payments.map(p => [
      format(new Date(p.created_at), 'dd/MM/yyyy HH:mm'),
      p.orders.order_number,
      p.orders.customer_name || '-',
      `R$ ${Number(p.amount).toFixed(2)}`,
      p.status,
      p.pix_key_used,
      p.fraud_suspected ? 'SIM' : 'NÃO',
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pagamentos-pix-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
  };

  return (
    <div className="flex min-h-screen w-full">
      <Sidebar />
      <div className="flex-1 p-8 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Pagamentos PIX</h1>
          <p className="text-muted-foreground">Controle e monitore todos os pagamentos via PIX</p>
        </div>

      {/* Cards de Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Recebido</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R$ {stats.total.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">No período selecionado</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Confirmados</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.confirmed}</div>
            <p className="text-xs text-muted-foreground">Pagamentos confirmados</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Pendentes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
            <p className="text-xs text-muted-foreground">Aguardando confirmação</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Fraudes Suspeitas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.fraudSuspected}</div>
            <p className="text-xs text-muted-foreground">Requer atenção</p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filtros
            </span>
            <Button onClick={exportToCSV} variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Exportar CSV
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="text-sm font-medium">Data Inicial</label>
              <Input
                type="date"
                value={dateFilter.start}
                onChange={(e) => setDateFilter(prev => ({ ...prev, start: e.target.value }))}
              />
            </div>
            <div className="flex-1">
              <label className="text-sm font-medium">Data Final</label>
              <Input
                type="date"
                value={dateFilter.end}
                onChange={(e) => setDateFilter(prev => ({ ...prev, end: e.target.value }))}
              />
            </div>
            <div className="flex items-end">
              <Button onClick={loadPayments}>
                Filtrar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabela de Pagamentos */}
      <Card>
        <CardHeader>
          <CardTitle>Histórico de Pagamentos</CardTitle>
          <CardDescription>
            Listagem de todos os pagamentos PIX registrados
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data/Hora</TableHead>
                <TableHead>Pedido</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Chave PIX</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Confirmado em</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center">Carregando...</TableCell>
                </TableRow>
              ) : payments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    Nenhum pagamento encontrado
                  </TableCell>
                </TableRow>
              ) : (
                payments.map((payment) => (
                  <TableRow key={payment.id} className={payment.fraud_suspected ? 'bg-red-50' : ''}>
                    <TableCell>
                      {format(new Date(payment.created_at), 'dd/MM/yyyy HH:mm')}
                    </TableCell>
                    <TableCell className="font-medium">
                      {payment.orders.order_number}
                    </TableCell>
                    <TableCell>{payment.orders.customer_name || '-'}</TableCell>
                    <TableCell className="font-bold">
                      R$ {Number(payment.amount).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div className="font-medium">{payment.pix_key_used}</div>
                        <div className="text-muted-foreground">{payment.pix_key_type?.toUpperCase()}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(payment.status, payment.fraud_suspected)}
                      {payment.fraud_suspected && payment.fraud_reason && (
                        <div className="text-xs text-red-600 mt-1">{payment.fraud_reason}</div>
                      )}
                    </TableCell>
                    <TableCell>
                      {payment.confirmed_at
                        ? format(new Date(payment.confirmed_at), 'dd/MM/yyyy HH:mm')
                        : '-'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
