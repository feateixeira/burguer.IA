import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

interface Supplier {
  id: string;
  name: string;
}

interface SupplierOrder {
  id: string;
  order_number: string;
  order_date: string;
  expected_delivery_date: string | null;
  total_amount: number;
  payment_due_date: string | null;
  payment_method: string | null;
  payment_status: string;
  delivery_status: string;
  notes: string | null;
  suppliers: {
    id: string;
    name: string;
  };
}

interface SupplierOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: SupplierOrder | null;
  onSuccess: () => void;
}

export function SupplierOrderDialog({
  open,
  onOpenChange,
  order,
  onSuccess,
}: SupplierOrderDialogProps) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [formData, setFormData] = useState({
    supplier_id: "",
    order_number: "",
    order_date: new Date().toISOString().split("T")[0],
    expected_delivery_date: "",
    total_amount: "",
    payment_due_date: "",
    payment_method: "",
    payment_status: "pending",
    delivery_status: "pending",
    notes: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      loadSuppliers();
    }
  }, [open]);

  useEffect(() => {
    if (order) {
      setFormData({
        supplier_id: order.suppliers.id,
        order_number: order.order_number,
        order_date: order.order_date,
        expected_delivery_date: order.expected_delivery_date || "",
        total_amount: order.total_amount.toString(),
        payment_due_date: order.payment_due_date || "",
        payment_method: order.payment_method || "",
        payment_status: order.payment_status,
        delivery_status: order.delivery_status,
        notes: order.notes || "",
      });
    } else {
      // Generate order number
      const orderNumber = `PED-${Date.now()}`;
      setFormData({
        supplier_id: "",
        order_number: orderNumber,
        order_date: new Date().toISOString().split("T")[0],
        expected_delivery_date: "",
        total_amount: "",
        payment_due_date: "",
        payment_method: "",
        payment_status: "pending",
        delivery_status: "pending",
        notes: "",
      });
    }
  }, [order, open]);

  const loadSuppliers = async () => {
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("establishment_id")
        .eq("user_id", (await supabase.auth.getUser()).data.user?.id)
        .single();

      if (!profile?.establishment_id) return;

      const { data, error } = await supabase
        .from("suppliers")
        .select("id, name")
        .eq("establishment_id", profile.establishment_id)
        .eq("active", true)
        .order("name");

      if (error) throw error;
      setSuppliers(data || []);
    } catch (error) {
      console.error("Error loading suppliers:", error);
      toast.error("Erro ao carregar fornecedores");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("establishment_id")
        .eq("user_id", (await supabase.auth.getUser()).data.user?.id)
        .single();

      if (!profile?.establishment_id) {
        toast.error("Erro ao identificar estabelecimento");
        return;
      }

      const orderData = {
        supplier_id: formData.supplier_id,
        order_number: formData.order_number,
        order_date: formData.order_date,
        expected_delivery_date: formData.expected_delivery_date || null,
        total_amount: parseFloat(formData.total_amount),
        payment_due_date: formData.payment_due_date || null,
        payment_method: formData.payment_method || null,
        payment_status: formData.payment_status,
        delivery_status: formData.delivery_status,
        notes: formData.notes || null,
      };

      if (order) {
        const { error } = await supabase
          .from("supplier_orders")
          .update(orderData)
          .eq("id", order.id);

        if (error) throw error;
        toast.success("Pedido atualizado com sucesso");
      } else {
        const { error } = await supabase
          .from("supplier_orders")
          .insert({
            ...orderData,
            establishment_id: profile.establishment_id,
          });

        if (error) throw error;
        toast.success("Pedido criado com sucesso");
      }

      onSuccess();
    } catch (error) {
      console.error("Error saving order:", error);
      toast.error("Erro ao salvar pedido");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {order ? "Editar Pedido" : "Novo Pedido"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="supplier_id">Fornecedor *</Label>
              <Select
                value={formData.supplier_id}
                onValueChange={(value) =>
                  setFormData({ ...formData, supplier_id: value })
                }
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o fornecedor" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((supplier) => (
                    <SelectItem key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="order_number">Número do Pedido *</Label>
              <Input
                id="order_number"
                value={formData.order_number}
                onChange={(e) =>
                  setFormData({ ...formData, order_number: e.target.value })
                }
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="order_date">Data do Pedido *</Label>
              <Input
                id="order_date"
                type="date"
                value={formData.order_date}
                onChange={(e) =>
                  setFormData({ ...formData, order_date: e.target.value })
                }
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="expected_delivery_date">Previsão de Entrega</Label>
              <Input
                id="expected_delivery_date"
                type="date"
                value={formData.expected_delivery_date}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    expected_delivery_date: e.target.value,
                  })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="total_amount">Valor Total *</Label>
              <Input
                id="total_amount"
                type="number"
                step="0.01"
                value={formData.total_amount}
                onChange={(e) =>
                  setFormData({ ...formData, total_amount: e.target.value })
                }
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="payment_due_date">Vencimento do Pagamento</Label>
              <Input
                id="payment_due_date"
                type="date"
                value={formData.payment_due_date}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    payment_due_date: e.target.value,
                  })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="payment_method">Forma de Pagamento</Label>
              <Input
                id="payment_method"
                value={formData.payment_method}
                onChange={(e) =>
                  setFormData({ ...formData, payment_method: e.target.value })
                }
                placeholder="Boleto, Transferência, etc."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="payment_status">Status do Pagamento</Label>
              <Select
                value={formData.payment_status}
                onValueChange={(value) =>
                  setFormData({ ...formData, payment_status: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pendente</SelectItem>
                  <SelectItem value="paid">Pago</SelectItem>
                  <SelectItem value="overdue">Atrasado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="delivery_status">Status da Entrega</Label>
              <Select
                value={formData.delivery_status}
                onValueChange={(value) =>
                  setFormData({ ...formData, delivery_status: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pendente</SelectItem>
                  <SelectItem value="delivered">Entregue</SelectItem>
                  <SelectItem value="cancelled">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Observações</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) =>
                setFormData({ ...formData, notes: e.target.value })
              }
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
