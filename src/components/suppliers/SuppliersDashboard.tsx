import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  DollarSign, 
  TrendingUp, 
  Package, 
  Clock,
  CheckCircle,
  AlertCircle 
} from "lucide-react";
import { toast } from "sonner";

interface DashboardStats {
  totalPending: number;
  totalPaid: number;
  pendingDeliveries: number;
  completedDeliveries: number;
}

interface PendingPayment {
  id: string;
  order_number: string;
  supplier_name: string;
  total_amount: number;
  payment_due_date: string;
  payment_method: string;
}

interface PendingDelivery {
  id: string;
  order_number: string;
  supplier_name: string;
  expected_delivery_date: string;
  total_amount: number;
}

export function SuppliersDashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalPending: 0,
    totalPaid: 0,
    pendingDeliveries: 0,
    completedDeliveries: 0,
  });
  const [pendingPayments, setPendingPayments] = useState<PendingPayment[]>([]);
  const [pendingDeliveries, setPendingDeliveries] = useState<PendingDelivery[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("establishment_id")
        .eq("user_id", (await supabase.auth.getUser()).data.user?.id)
        .single();

      if (!profile?.establishment_id) return;

      // Load orders stats
      const { data: orders } = await supabase
        .from("supplier_orders")
        .select("*, suppliers(name)")
        .eq("establishment_id", profile.establishment_id);

      if (orders) {
        const pending = orders
          .filter(o => o.payment_status === "pending")
          .reduce((sum, o) => sum + Number(o.total_amount), 0);
        
        const paid = orders
          .filter(o => o.payment_status === "paid")
          .reduce((sum, o) => sum + Number(o.total_amount), 0);

        const pendingDel = orders.filter(o => o.delivery_status === "pending").length;
        const completedDel = orders.filter(o => o.delivery_status === "delivered").length;

        setStats({
          totalPending: pending,
          totalPaid: paid,
          pendingDeliveries: pendingDel,
          completedDeliveries: completedDel,
        });

        // Pending payments
        const payments = orders
          .filter(o => o.payment_status === "pending")
          .map(o => ({
            id: o.id,
            order_number: o.order_number,
            supplier_name: (o.suppliers as any)?.name || "N/A",
            total_amount: Number(o.total_amount),
            payment_due_date: o.payment_due_date,
            payment_method: o.payment_method || "N/A",
          }))
          .sort((a, b) => new Date(a.payment_due_date).getTime() - new Date(b.payment_due_date).getTime());

        setPendingPayments(payments);

        // Pending deliveries
        const deliveries = orders
          .filter(o => o.delivery_status === "pending" && o.expected_delivery_date)
          .map(o => ({
            id: o.id,
            order_number: o.order_number,
            supplier_name: (o.suppliers as any)?.name || "N/A",
            expected_delivery_date: o.expected_delivery_date,
            total_amount: Number(o.total_amount),
          }))
          .sort((a, b) => new Date(a.expected_delivery_date).getTime() - new Date(b.expected_delivery_date).getTime());

        setPendingDeliveries(deliveries);
      }
    } catch (error) {
      console.error("Error loading dashboard:", error);
      toast.error("Erro ao carregar dashboard");
    } finally {
      setLoading(false);
    }
  };

  const markAsPaid = async (orderId: string) => {
    try {
      const { error } = await supabase
        .from("supplier_orders")
        .update({
          payment_status: "paid",
          payment_date: new Date().toISOString().split('T')[0],
        })
        .eq("id", orderId);

      if (error) throw error;

      toast.success("Pagamento registrado com sucesso");
      loadDashboardData();
    } catch (error) {
      console.error("Error marking as paid:", error);
      toast.error("Erro ao registrar pagamento");
    }
  };

  const markAsDelivered = async (orderId: string) => {
    try {
      const { error } = await supabase
        .from("supplier_orders")
        .update({
          delivery_status: "delivered",
          actual_delivery_date: new Date().toISOString().split('T')[0],
        })
        .eq("id", orderId);

      if (error) throw error;

      toast.success("Entrega registrada com sucesso");
      loadDashboardData();
    } catch (error) {
      console.error("Error marking as delivered:", error);
      toast.error("Erro ao registrar entrega");
    }
  };

  if (loading) {
    return <div>Carregando...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">A Pagar</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              R$ {stats.totalPending.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">
              {pendingPayments.length} pagamentos pendentes
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pago</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              R$ {stats.totalPaid.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">
              Pagamentos realizados
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Entregas Pendentes</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pendingDeliveries}</div>
            <p className="text-xs text-muted-foreground">
              Aguardando entrega
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Entregas Completas</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.completedDeliveries}</div>
            <p className="text-xs text-muted-foreground">
              Entregas realizadas
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Pending Payments */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Pagamentos Pendentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {pendingPayments.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhum pagamento pendente
                </p>
              ) : (
                pendingPayments.map((payment) => (
                  <div
                    key={payment.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div className="space-y-1">
                      <p className="font-medium">{payment.supplier_name}</p>
                      <p className="text-sm text-muted-foreground">
                        Pedido: {payment.order_number}
                      </p>
                      <p className="text-sm">
                        Vencimento:{" "}
                        {format(new Date(payment.payment_due_date), "dd/MM/yyyy", {
                          locale: ptBR,
                        })}
                      </p>
                      <p className="text-lg font-bold">
                        R$ {payment.total_amount.toFixed(2)}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => markAsPaid(payment.id)}
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Pagar
                    </Button>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Pending Deliveries */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Entregas Pendentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {pendingDeliveries.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhuma entrega pendente
                </p>
              ) : (
                pendingDeliveries.map((delivery) => (
                  <div
                    key={delivery.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div className="space-y-1">
                      <p className="font-medium">{delivery.supplier_name}</p>
                      <p className="text-sm text-muted-foreground">
                        Pedido: {delivery.order_number}
                      </p>
                      <p className="text-sm">
                        Previsão:{" "}
                        {format(new Date(delivery.expected_delivery_date), "dd/MM/yyyy", {
                          locale: ptBR,
                        })}
                      </p>
                      <p className="text-lg font-bold">
                        R$ {delivery.total_amount.toFixed(2)}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => markAsDelivered(delivery.id)}
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Dar Baixa
                    </Button>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
