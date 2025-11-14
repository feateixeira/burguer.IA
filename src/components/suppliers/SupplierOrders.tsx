import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2 } from "lucide-react";
import { useConfirm } from "@/hooks/useConfirm";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { SupplierOrderDialog } from "./SupplierOrderDialog";

interface SupplierOrder {
  id: string;
  order_number: string;
  order_date: string;
  expected_delivery_date: string | null;
  actual_delivery_date: string | null;
  total_amount: number;
  payment_due_date: string | null;
  payment_method: string | null;
  payment_status: string;
  payment_date: string | null;
  delivery_status: string;
  notes: string | null;
  suppliers: {
    id: string;
    name: string;
  };
}

export function SupplierOrders() {
  const [orders, setOrders] = useState<SupplierOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<SupplierOrder | null>(null);
  const confirm = useConfirm();

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("establishment_id")
        .eq("user_id", (await supabase.auth.getUser()).data.user?.id)
        .single();

      if (!profile?.establishment_id) return;

      const { data, error } = await supabase
        .from("supplier_orders")
        .select("*, suppliers(id, name)")
        .eq("establishment_id", profile.establishment_id)
        .order("order_date", { ascending: false });

      if (error) throw error;
      setOrders(data || []);
    } catch (error) {
      console.error("Error loading orders:", error);
      toast.error("Erro ao carregar pedidos");
    } finally {
      setLoading(false);
    }
  };

  const handleNew = () => {
    setSelectedOrder(null);
    setDialogOpen(true);
  };

  const handleEdit = (order: SupplierOrder) => {
    setSelectedOrder(order);
    setDialogOpen(true);
  };

  const handleSuccess = () => {
    loadOrders();
    setDialogOpen(false);
  };

  const handleDelete = async (orderId: string) => {
    try {
      const ok = await confirm({ title: "Apagar pedido", description: "Tem certeza que deseja apagar este pedido? Esta ação não pode ser desfeita." });
      if (!ok) return;

      // Apaga itens do pedido antes (evita erro de FK caso não haja cascade)
      await supabase
        .from("supplier_order_items")
        .delete()
        .eq("order_id", orderId);

      const { error } = await supabase
        .from("supplier_orders")
        .delete()
        .eq("id", orderId);

      if (error) throw error;
      toast.success("Pedido apagado");
      loadOrders();
    } catch (err) {
      console.error("Erro ao apagar pedido:", err);
      toast.error("Não foi possível apagar o pedido");
    }
  };

  const getPaymentStatusBadge = (status: string) => {
    const colors = {
      pending: "destructive",
      paid: "default",
      overdue: "destructive",
    };
    return <Badge variant={colors[status as keyof typeof colors] as any}>{status === "pending" ? "Pendente" : status === "paid" ? "Pago" : "Atrasado"}</Badge>;
  };

  const getDeliveryStatusBadge = (status: string) => {
    const colors = {
      pending: "secondary",
      delivered: "default",
      cancelled: "destructive",
    };
    return <Badge variant={colors[status as keyof typeof colors] as any}>{status === "pending" ? "Pendente" : status === "delivered" ? "Entregue" : "Cancelado"}</Badge>;
  };

  if (loading) {
    return <div>Carregando...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Pedidos</h2>
          <p className="text-muted-foreground">
            Gerencie pedidos de fornecedores
          </p>
        </div>
        <Button onClick={handleNew}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Pedido
        </Button>
      </div>

      <div className="space-y-4">
        {orders.map((order) => (
          <Card
            key={order.id}
            className="cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => handleEdit(order)}
          >
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold">
                      Pedido #{order.order_number}
                    </h3>
                    {getPaymentStatusBadge(order.payment_status)}
                    {getDeliveryStatusBadge(order.delivery_status)}
                  </div>
                  
                  <p className="text-sm text-muted-foreground">
                    <strong>Fornecedor:</strong> {order.suppliers.name}
                  </p>
                  
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <p>
                      <strong>Data do Pedido:</strong>{" "}
                      {format(new Date(order.order_date), "dd/MM/yyyy", {
                        locale: ptBR,
                      })}
                    </p>
                    {order.expected_delivery_date && (
                      <p>
                        <strong>Entrega Prevista:</strong>{" "}
                        {format(new Date(order.expected_delivery_date), "dd/MM/yyyy", {
                          locale: ptBR,
                        })}
                      </p>
                    )}
                    {order.payment_due_date && (
                      <p>
                        <strong>Vencimento:</strong>{" "}
                        {format(new Date(order.payment_due_date), "dd/MM/yyyy", {
                          locale: ptBR,
                        })}
                      </p>
                    )}
                    {order.payment_method && (
                      <p>
                        <strong>Forma de Pagamento:</strong> {order.payment_method}
                      </p>
                    )}
                  </div>
                </div>

                <div className="text-right flex items-start gap-2">
                  <p className="text-2xl font-bold">R$ {Number(order.total_amount).toFixed(2)}</p>
                  <Button variant="outline" size="icon" onClick={(e) => { e.stopPropagation(); handleDelete(order.id); }} title="Apagar pedido">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {orders.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground mb-4">
              Nenhum pedido cadastrado
            </p>
            <Button onClick={handleNew}>
              <Plus className="h-4 w-4 mr-2" />
              Criar Primeiro Pedido
            </Button>
          </CardContent>
        </Card>
      )}

      <SupplierOrderDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        order={selectedOrder}
        onSuccess={handleSuccess}
      />
    </div>
  );
}
