import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  TrendingDown,
  TrendingUp,
  Calendar,
  DollarSign,
  CreditCard,
  Wallet,
  Smartphone,
  ChevronDown,
  ChevronUp,
  Eye,
} from "lucide-react";
import { format, startOfMonth, endOfMonth, isWithinInterval } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
  Line,
} from "recharts";

interface PayableByMonth {
  monthStart: Date;
  monthEnd: Date;
  total: number;
  count: number;
  items: PayableItem[];
}

interface PayableItem {
  id: string;
  order_number: string;
  supplier_name: string;
  total_amount: number;
  payment_due_date: string;
  payment_method: string | null;
}

interface ReceivableByMonth {
  monthStart: Date;
  monthEnd: Date;
  total: number;
  byPaymentMethod: {
    dinheiro: number;
    pix: number;
    cartao_credito: number;
    cartao_debito: number;
    other: number;
  };
  count: number;
}

const AccountsPayableReceivable = () => {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [payablesByMonth, setPayablesByMonth] = useState<PayableByMonth[]>([]);
  const [receivablesByMonth, setReceivablesByMonth] = useState<ReceivableByMonth[]>([]);
  const [totalPayable, setTotalPayable] = useState(0);
  const [totalReceivable, setTotalReceivable] = useState(0);
  const [showReceivablesDetails, setShowReceivablesDetails] = useState(false);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (profile) {
      loadData();
    }
  }, [profile]);

  const loadInitialData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: profileData } = await supabase
        .from("profiles")
        .select("*, establishment_id")
        .eq("user_id", session.user.id)
        .single();
      
      if (profileData) {
        setProfile(profileData);
      }
    } catch (error) {
      console.error("Error loading profile:", error);
      toast.error("Erro ao carregar dados do perfil");
    }
  };

  const loadData = async () => {
    if (!profile) return;

    try {
      setLoading(true);

      // Load payables (supplier orders with pending payment)
      await loadPayables();
      
      // Load receivables (completed orders)
      await loadReceivables();
    } catch (error: any) {
      console.error("Error loading data:", error);
      toast.error(error.message || "Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  const loadPayables = async () => {
    if (!profile) return;

    try {
      // Get supplier orders with pending payment
      const { data: orders, error: ordersError } = await supabase
        .from("supplier_orders")
        .select(`
          id,
          order_number,
          total_amount,
          payment_due_date,
          payment_method,
          payment_status,
          suppliers (
            name
          )
        `)
        .eq("establishment_id", profile.establishment_id)
        .eq("payment_status", "pending")
        .not("payment_due_date", "is", null)
        .order("payment_due_date", { ascending: true });

      if (ordersError) {
        throw ordersError;
      }

      if (!orders || orders.length === 0) {
        setPayablesByMonth([]);
        setTotalPayable(0);
        return;
      }

      // Calculate date range (current month)
      const now = new Date();
      now.setHours(23, 59, 59, 999); // End of day
      const currentMonthStart = startOfMonth(now);
      currentMonthStart.setHours(0, 0, 0, 0); // Start of day

      // Generate months (only current month)
      const months = [currentMonthStart];

      // Group by month
      const groupedByMonth: PayableByMonth[] = months.map((monthStart) => {
        const monthEnd = endOfMonth(monthStart);
        monthEnd.setHours(23, 59, 59, 999);
        
        const monthItems = orders
          .filter((order: any) => {
            if (!order.payment_due_date) return false;
            const dueDate = new Date(order.payment_due_date);
            return isWithinInterval(dueDate, { start: monthStart, end: monthEnd });
          })
          .map((order: any) => ({
            id: order.id,
            order_number: order.order_number,
            supplier_name: (order.suppliers as any)?.name || "N/A",
            total_amount: Number(order.total_amount) || 0,
            payment_due_date: order.payment_due_date,
            payment_method: order.payment_method,
          }));

        const monthTotal = monthItems.reduce((sum, item) => sum + item.total_amount, 0);

        return {
          monthStart,
          monthEnd,
          total: monthTotal,
          count: monthItems.length,
          items: monthItems,
        };
      }).filter((month) => month.count > 0);

      // Calculate total payable
      const total = orders.reduce((sum: number, order: any) => {
        return sum + (Number(order.total_amount) || 0);
      }, 0);

      setPayablesByMonth(groupedByMonth);
      setTotalPayable(total);
    } catch (error: any) {
      console.error("Error loading payables:", error);
      throw error;
    }
  };

  const loadReceivables = async () => {
    if (!profile) return;

    try {
      // Get completed orders from current month
      const now = new Date();
      now.setHours(23, 59, 59, 999); // End of day
      const currentMonthStart = startOfMonth(now);
      currentMonthStart.setHours(0, 0, 0, 0); // Start of day

      const { data: orders, error: ordersError } = await supabase
        .from("orders")
        .select("id, total_amount, payment_method, created_at")
        .eq("establishment_id", profile.establishment_id)
        .eq("status", "completed")
        .gte("created_at", currentMonthStart.toISOString())
        .lte("created_at", now.toISOString())
        .order("created_at", { ascending: false });

      if (ordersError) {
        throw ordersError;
      }

      if (!orders || orders.length === 0) {
        setReceivablesByMonth([]);
        setTotalReceivable(0);
        return;
      }

      // Generate months (only current month)
      const months = [currentMonthStart];

      // Group by month
      const groupedByMonth: ReceivableByMonth[] = months.map((monthStart) => {
        const monthEnd = endOfMonth(monthStart);
        monthEnd.setHours(23, 59, 59, 999);
        
        const monthOrders = orders.filter((order: any) => {
          const orderDate = new Date(order.created_at);
          return isWithinInterval(orderDate, { start: monthStart, end: monthEnd });
        });

        const byPaymentMethod = {
          dinheiro: 0,
          pix: 0,
          cartao_credito: 0,
          cartao_debito: 0,
          other: 0,
        };

        let monthTotal = 0;

        monthOrders.forEach((order: any) => {
          const amount = Number(order.total_amount) || 0;
          monthTotal += amount;

          const method = order.payment_method;
          if (method === "dinheiro") {
            byPaymentMethod.dinheiro += amount;
          } else if (method === "pix") {
            byPaymentMethod.pix += amount;
          } else if (method === "cartao_credito") {
            byPaymentMethod.cartao_credito += amount;
          } else if (method === "cartao_debito") {
            byPaymentMethod.cartao_debito += amount;
          } else {
            byPaymentMethod.other += amount;
          }
        });

        return {
          monthStart,
          monthEnd,
          total: monthTotal,
          byPaymentMethod,
          count: monthOrders.length,
        };
      }).filter((month) => month.count > 0);

      // Calculate total receivable
      const total = orders.reduce((sum: number, order: any) => {
        return sum + (Number(order.total_amount) || 0);
      }, 0);

      setReceivablesByMonth(groupedByMonth);
      setTotalReceivable(total);
    } catch (error: any) {
      console.error("Error loading receivables:", error);
      throw error;
    }
  };

  const getPaymentMethodIcon = (method: string) => {
    switch (method) {
      case "dinheiro":
        return <Wallet className="h-4 w-4" />;
      case "pix":
        return <Smartphone className="h-4 w-4" />;
      case "cartao_credito":
      case "cartao_debito":
        return <CreditCard className="h-4 w-4" />;
      default:
        return <DollarSign className="h-4 w-4" />;
    }
  };

  const getPaymentMethodLabel = (method: string) => {
    switch (method) {
      case "dinheiro":
        return "Dinheiro";
      case "pix":
        return "PIX";
      case "cartao_credito":
        return "Cartão Crédito";
      case "cartao_debito":
        return "Cartão Débito";
      default:
        return "Outros";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-muted-foreground">Carregando dados...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Calendar className="h-6 w-6" />
          Contas a Pagar e Receber
        </h2>
        <p className="text-muted-foreground mt-1">
          Visão geral de pagamentos e recebimentos por mês
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total a Pagar</CardTitle>
            <TrendingDown className="h-5 w-5 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">
              R$ {totalPayable.toFixed(2).replace(".", ",")}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {payablesByMonth.reduce((sum, month) => sum + month.count, 0)} contas pendentes
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total a Receber</CardTitle>
            <TrendingUp className="h-5 w-5 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">
              R$ {totalReceivable.toFixed(2).replace(".", ",")}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Mês atual
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Comparison Chart */}
      {(payablesByMonth.length > 0 || receivablesByMonth.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle>Comparativo Mensal</CardTitle>
            <CardDescription>
              Contas a Pagar vs Contas a Receber por mês
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart
                data={(() => {
                  // Combine both datasets by month
                  const allMonths = new Map<number, { month: string; monthStart: Date; pagar: number; receber: number }>();
                  
                  payablesByMonth.forEach((month) => {
                    allMonths.set(month.monthStart.getTime(), {
                      month: format(month.monthStart, "MMMM yyyy", { locale: ptBR }),
                      monthStart: month.monthStart,
                      pagar: month.total,
                      receber: 0,
                    });
                  });
                  
                  receivablesByMonth.forEach((month) => {
                    const existing = allMonths.get(month.monthStart.getTime());
                    if (existing) {
                      existing.receber = month.total;
                    } else {
                      allMonths.set(month.monthStart.getTime(), {
                        month: format(month.monthStart, "MMMM yyyy", { locale: ptBR }),
                        monthStart: month.monthStart,
                        pagar: 0,
                        receber: month.total,
                      });
                    }
                  });
                  
                  return Array.from(allMonths.values())
                    .sort((a, b) => a.monthStart.getTime() - b.monthStart.getTime())
                    .map(({ monthStart, ...rest }) => rest);
                })()}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="month" 
                  angle={-45}
                  textAnchor="end"
                  height={80}
                  fontSize={12}
                />
                <YAxis />
                <Tooltip
                  formatter={(value: number) => `R$ ${value.toFixed(2).replace(".", ",")}`}
                />
                <Legend />
                <Bar dataKey="pagar" fill="#ef4444" name="A Pagar" />
                <Bar dataKey="receber" fill="#22c55e" name="A Receber" />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Accounts Payable */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingDown className="h-5 w-5 text-red-500" />
            Contas a Pagar por Mês
          </CardTitle>
          <CardDescription>
            Boletos e pagamentos pendentes de fornecedores
          </CardDescription>
        </CardHeader>
        <CardContent>
          {payablesByMonth.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma conta a pagar no período
            </div>
          ) : (
            <div className="space-y-6">
              {payablesByMonth.map((month, index) => (
                <div key={index} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-semibold">
                        {format(month.monthStart, "MMMM yyyy", { locale: ptBR })}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {format(month.monthStart, "dd/MM", { locale: ptBR })} a {format(month.monthEnd, "dd/MM/yyyy", { locale: ptBR })} • {month.count} {month.count === 1 ? "conta" : "contas"}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-red-600">
                        R$ {month.total.toFixed(2).replace(".", ",")}
                      </div>
                    </div>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fornecedor</TableHead>
                        <TableHead>Pedido</TableHead>
                        <TableHead>Vencimento</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {month.items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">
                            {item.supplier_name}
                          </TableCell>
                          <TableCell>{item.order_number}</TableCell>
                          <TableCell>
                            {format(new Date(item.payment_due_date), "dd/MM/yyyy", {
                              locale: ptBR,
                            })}
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            R$ {item.total_amount.toFixed(2).replace(".", ",")}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Accounts Receivable */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-green-500" />
                Contas a Receber
              </CardTitle>
              <CardDescription>
                Vendas realizadas agrupadas por método de pagamento
              </CardDescription>
            </div>
            {receivablesByMonth.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowReceivablesDetails(!showReceivablesDetails)}
                className="flex items-center gap-2"
              >
                <Eye className="h-4 w-4" />
                {showReceivablesDetails ? "Ocultar" : "Ver"} Detalhes
                {showReceivablesDetails ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {receivablesByMonth.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma venda no período
            </div>
          ) : (
            <div className="space-y-6">
              {/* Summary - Always visible */}
              <div className="bg-muted/50 rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold">Total a Receber</h3>
                    <p className="text-sm text-muted-foreground">
                      Mês atual
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-bold text-green-600">
                      R$ {totalReceivable.toFixed(2).replace(".", ",")}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {receivablesByMonth.reduce((sum, month) => sum + month.count, 0)}{" "}
                      {receivablesByMonth.reduce((sum, month) => sum + month.count, 0) === 1
                        ? "venda"
                        : "vendas"}
                    </p>
                  </div>
                </div>
                
                {/* Payment method breakdown - Always visible */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                  {(() => {
                    const totalsByMethod = {
                      dinheiro: 0,
                      pix: 0,
                      cartao_credito: 0,
                      cartao_debito: 0,
                      other: 0,
                    };
                    
                    receivablesByMonth.forEach((month) => {
                      totalsByMethod.dinheiro += month.byPaymentMethod.dinheiro;
                      totalsByMethod.pix += month.byPaymentMethod.pix;
                      totalsByMethod.cartao_credito += month.byPaymentMethod.cartao_credito;
                      totalsByMethod.cartao_debito += month.byPaymentMethod.cartao_debito;
                      totalsByMethod.other += month.byPaymentMethod.other;
                    });
                    
                    return Object.entries(totalsByMethod)
                      .filter(([_, amount]) => amount > 0)
                      .map(([method, amount]) => (
                        <div
                          key={method}
                          className="flex items-center gap-2 p-3 bg-background rounded-lg border"
                        >
                          <div className="text-muted-foreground">
                            {getPaymentMethodIcon(method)}
                          </div>
                          <div className="flex-1">
                            <p className="text-xs text-muted-foreground">
                              {getPaymentMethodLabel(method)}
                            </p>
                            <p className="font-semibold">
                              R$ {amount.toFixed(2).replace(".", ",")}
                            </p>
                          </div>
                        </div>
                      ));
                  })()}
                </div>
              </div>

              {/* Details - Only visible when expanded */}
              {showReceivablesDetails && (
                <div className="space-y-6 border-t pt-6">
                  <h3 className="text-lg font-semibold">Detalhes por Mês</h3>
                  {receivablesByMonth.map((month, index) => (
                    <div key={index} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h4 className="font-semibold">
                            {format(month.monthStart, "MMMM yyyy", { locale: ptBR })}
                          </h4>
                          <p className="text-sm text-muted-foreground">
                            {format(month.monthStart, "dd/MM", { locale: ptBR })} a {format(month.monthEnd, "dd/MM/yyyy", { locale: ptBR })} • {month.count} {month.count === 1 ? "venda" : "vendas"}
                          </p>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-green-600">
                            R$ {month.total.toFixed(2).replace(".", ",")}
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {Object.entries(month.byPaymentMethod)
                          .filter(([_, amount]) => amount > 0)
                          .map(([method, amount]) => (
                            <div
                              key={method}
                              className="flex items-center gap-2 p-3 bg-muted rounded-lg"
                            >
                              <div className="text-muted-foreground">
                                {getPaymentMethodIcon(method)}
                              </div>
                              <div className="flex-1">
                                <p className="text-xs text-muted-foreground">
                                  {getPaymentMethodLabel(method)}
                                </p>
                                <p className="font-semibold">
                                  R$ {amount.toFixed(2).replace(".", ",")}
                                </p>
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AccountsPayableReceivable;

