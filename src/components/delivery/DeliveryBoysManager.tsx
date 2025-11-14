import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Edit, Trash2, Truck } from "lucide-react";
import { useConfirm } from "@/hooks/useConfirm";

interface DeliveryBoy {
  id: string;
  name: string;
  daily_rate: number;
  delivery_fee: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

interface DeliveryBoysManagerProps {
  establishmentId: string;
}

export const DeliveryBoysManager: React.FC<DeliveryBoysManagerProps> = ({ establishmentId }) => {
  const [deliveryBoys, setDeliveryBoys] = useState<DeliveryBoy[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingBoy, setEditingBoy] = useState<DeliveryBoy | null>(null);
  const [name, setName] = useState("");
  const [dailyRate, setDailyRate] = useState<number>(0);
  const [deliveryFee, setDeliveryFee] = useState<number>(0);
  const confirmDialog = useConfirm();

  useEffect(() => {
    loadDeliveryBoys();
  }, [establishmentId]);

  const loadDeliveryBoys = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("delivery_boys")
        .select("*")
        .eq("establishment_id", establishmentId)
        .order("name");

      if (error) throw error;
      setDeliveryBoys(data || []);
    } catch (error: any) {
      console.error("Error loading delivery boys:", error);
      toast.error("Erro ao carregar motoboys");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (boy?: DeliveryBoy) => {
    if (boy) {
      setEditingBoy(boy);
      setName(boy.name);
      setDailyRate(boy.daily_rate);
      setDeliveryFee(boy.delivery_fee);
    } else {
      setEditingBoy(null);
      setName("");
      setDailyRate(0);
      setDeliveryFee(0);
    }
    setShowDialog(true);
  };

  const handleCloseDialog = () => {
    setShowDialog(false);
    setEditingBoy(null);
    setName("");
    setDailyRate(0);
    setDeliveryFee(0);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }

    if (deliveryFee < 0) {
      toast.error("Valor por entrega deve ser positivo");
      return;
    }

    if (dailyRate < 0) {
      toast.error("Diária deve ser positiva");
      return;
    }

    try {
      if (editingBoy) {
        const { error } = await supabase
          .from("delivery_boys")
          .update({
            name: name.trim(),
            daily_rate: dailyRate,
            delivery_fee: deliveryFee,
          })
          .eq("id", editingBoy.id);

        if (error) throw error;
        toast.success("Motoboy atualizado com sucesso");
      } else {
        const { error } = await supabase
          .from("delivery_boys")
          .insert({
            establishment_id: establishmentId,
            name: name.trim(),
            daily_rate: dailyRate,
            delivery_fee: deliveryFee,
            active: true,
          });

        if (error) throw error;
        toast.success("Motoboy cadastrado com sucesso");
      }

      handleCloseDialog();
      loadDeliveryBoys();
    } catch (error: any) {
      console.error("Error saving delivery boy:", error);
      toast.error(error.message || "Erro ao salvar motoboy");
    }
  };

  const handleDelete = async (boy: DeliveryBoy) => {
    const confirmed = await confirmDialog(
      "Confirmar exclusão",
      `Deseja realmente excluir o motoboy "${boy.name}"? Esta ação não pode ser desfeita.`
    );

    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from("delivery_boys")
        .delete()
        .eq("id", boy.id);

      if (error) throw error;
      toast.success("Motoboy excluído com sucesso");
      loadDeliveryBoys();
    } catch (error: any) {
      console.error("Error deleting delivery boy:", error);
      toast.error("Erro ao excluir motoboy");
    }
  };

  const handleToggleActive = async (boy: DeliveryBoy) => {
    try {
      const { error } = await supabase
        .from("delivery_boys")
        .update({ active: !boy.active })
        .eq("id", boy.id);

      if (error) throw error;
      toast.success(`Motoboy ${!boy.active ? "ativado" : "desativado"} com sucesso`);
      loadDeliveryBoys();
    } catch (error: any) {
      console.error("Error toggling delivery boy:", error);
      toast.error("Erro ao alterar status do motoboy");
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-muted-foreground">Carregando motoboys...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Truck className="h-5 w-5 text-primary" />
                Gerenciar Motoboys
              </CardTitle>
              <CardDescription>
                Cadastre e gerencie os motoboys do estabelecimento
              </CardDescription>
            </div>
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Motoboy
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {deliveryBoys.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum motoboy cadastrado. Clique em "Adicionar Motoboy" para começar.
            </div>
          ) : (
            <div className="space-y-2">
              {deliveryBoys.map((boy) => (
                <div
                  key={boy.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{boy.name}</h3>
                      <Badge variant={boy.active ? "default" : "secondary"}>
                        {boy.active ? "Ativo" : "Inativo"}
                      </Badge>
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground space-x-4">
                      {boy.daily_rate > 0 && (
                        <span>Diária: {formatCurrency(boy.daily_rate)}</span>
                      )}
                      <span>Por entrega: {formatCurrency(boy.delivery_fee)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleToggleActive(boy)}
                    >
                      {boy.active ? "Desativar" : "Ativar"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenDialog(boy)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDelete(boy)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingBoy ? "Editar Motoboy" : "Novo Motoboy"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome do Motoboy *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: João Silva"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="daily_rate">Diária (R$)</Label>
              <Input
                id="daily_rate"
                type="number"
                min="0"
                step="0.01"
                value={dailyRate}
                onChange={(e) => setDailyRate(parseFloat(e.target.value) || 0)}
                placeholder="0.00"
              />
              <p className="text-xs text-muted-foreground">
                Deixe em 0 se o motoboy for freelance (sem diária fixa)
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="delivery_fee">Valor por Entrega (R$) *</Label>
              <Input
                id="delivery_fee"
                type="number"
                min="0"
                step="0.01"
                value={deliveryFee}
                onChange={(e) => setDeliveryFee(parseFloat(e.target.value) || 0)}
                placeholder="0.00"
                required
              />
              <p className="text-xs text-muted-foreground">
                Valor que o motoboy recebe por cada entrega realizada
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>
              Cancelar
            </Button>
            <Button onClick={handleSave}>
              {editingBoy ? "Salvar" : "Cadastrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

