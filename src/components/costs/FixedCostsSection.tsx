import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Edit, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { useConfirm } from "@/hooks/useConfirm";

interface FixedCost {
  id: string;
  name: string;
  amount: number;
  start_date: string;
  recurrence: 'monthly' | 'yearly' | 'one_time';
  active: boolean;
}

interface FixedCostsSectionProps {
  fixedCosts: FixedCost[];
  establishmentId: string | null;
  onUpdate: () => void;
}

export const FixedCostsSection = ({ fixedCosts, establishmentId, onUpdate }: FixedCostsSectionProps) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCost, setEditingCost] = useState<FixedCost | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    amount: "",
    start_date: "",
    recurrence: "monthly" as 'monthly' | 'yearly' | 'one_time',
  });
  const { toast } = useToast();
  const confirmDialog = useConfirm();

  const resetForm = () => {
    setFormData({
      name: "",
      amount: "",
      start_date: "",
      recurrence: "monthly" as 'monthly' | 'yearly' | 'one_time',
    });
    setEditingCost(null);
  };

  const openCreateDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEditDialog = (cost: FixedCost) => {
    setFormData({
      name: cost.name,
      amount: cost.amount.toString(),
      start_date: cost.start_date,
      recurrence: cost.recurrence,
    });
    setEditingCost(cost);
    setDialogOpen(true);
  };

  const parseAmount = (value: string): number => {
    // Remove espaços e substitui vírgula por ponto para parsing
    let cleanValue = value.replace(/\s/g, '');
    
    // Se contém vírgula, assume formato brasileiro (1.500,00 ou 1500,00)
    if (cleanValue.includes(',')) {
      // Remove pontos (separadores de milhares) e substitui vírgula por ponto
      cleanValue = cleanValue.replace(/\./g, '').replace(',', '.');
    }
    // Se não contém vírgula, mas contém múltiplos pontos, assume formato americano com separador de milhares
    else if ((cleanValue.match(/\./g) || []).length > 1) {
      // Remove todos os pontos exceto o último (decimal)
      const parts = cleanValue.split('.');
      const decimal = parts.pop();
      cleanValue = parts.join('') + '.' + decimal;
    }
    
    const parsed = parseFloat(cleanValue);
    return isNaN(parsed) ? 0 : parsed;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!establishmentId) return;

    try {
      const costData = {
        establishment_id: establishmentId,
        name: formData.name,
        amount: parseAmount(formData.amount),
        start_date: formData.start_date,
        recurrence: formData.recurrence,
      };

      if (editingCost) {
        const { error } = await supabase
          .from('fixed_costs')
          .update(costData)
          .eq('id', editingCost.id);
        
        if (error) throw error;
        
        toast({
          title: "Success",
          description: "Fixed cost updated successfully",
        });
      } else {
        const { error } = await supabase
          .from('fixed_costs')
          .insert([costData]);
        
        if (error) throw error;
        
        toast({
          title: "Success", 
          description: "Fixed cost created successfully",
        });
      }

      setDialogOpen(false);
      resetForm();
      onUpdate();
    } catch (error) {
      console.error('Error saving fixed cost:', error);
      toast({
        title: "Error",
        description: "Failed to save fixed cost",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (id: string) => {
    const ok = await confirmDialog({ title: 'Excluir custo fixo', description: 'Tem certeza que deseja excluir este custo fixo?' });
    if (!ok) return;

    try {
      const { error } = await supabase
        .from('fixed_costs')
        .update({ active: false })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Fixed cost deleted successfully",
      });

      onUpdate();
    } catch (error) {
      console.error('Error deleting fixed cost:', error);
      toast({
        title: "Error",
        description: "Failed to delete fixed cost",
        variant: "destructive",
      });
    }
  };

  const getRecurrenceLabel = (recurrence: string) => {
    switch (recurrence) {
      case 'monthly': return 'Mensal';
      case 'yearly': return 'Anual';
      case 'one_time': return 'Único';
      default: return recurrence;
    }
  };

  const getMonthlyAmount = (cost: FixedCost) => {
    if (cost.recurrence === 'monthly') return cost.amount;
    if (cost.recurrence === 'yearly') return cost.amount / 12;
    return 0; // one_time costs don't count toward monthly
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Custos Fixos</h2>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreateDialog}>
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Custo Fixo
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingCost ? 'Editar' : 'Adicionar'} Custo Fixo
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">Nome do Custo</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Aluguel, Energia, Internet..."
                  required
                />
              </div>
              
              <div>
                <Label htmlFor="amount">Valor (R$)</Label>
                <Input
                  id="amount"
                  type="text"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  placeholder="Ex: 1500 ou 1.500,00 ou 1500.00"
                  required
                />
              </div>

              <div>
                <Label htmlFor="start_date">Data de Início</Label>
                <Input
                  id="start_date"
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                  required
                />
              </div>

              <div>
                <Label htmlFor="recurrence">Recorrência</Label>
                <Select 
                  value={formData.recurrence} 
                  onValueChange={(value: 'monthly' | 'yearly' | 'one_time') => 
                    setFormData({ ...formData, recurrence: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Mensal</SelectItem>
                    <SelectItem value="yearly">Anual</SelectItem>
                    <SelectItem value="one_time">Único</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit">
                  {editingCost ? 'Atualizar' : 'Criar'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {fixedCosts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="text-center">
              <h3 className="text-lg font-semibold mb-2">Nenhum custo fixo cadastrado</h3>
              <p className="text-muted-foreground mb-4">
                Comece adicionando seus custos fixos mensais como aluguel, energia, etc.
              </p>
              <Button onClick={openCreateDialog}>
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Primeiro Custo
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {fixedCosts.map((cost) => (
            <Card key={cost.id}>
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex-1">
                  <h3 className="font-semibold">{cost.name}</h3>
                  <div className="text-sm text-muted-foreground">
                    <span className="mr-4">
                      R$ {cost.amount.toFixed(2)} ({getRecurrenceLabel(cost.recurrence)})
                    </span>
                    {cost.recurrence !== 'monthly' && (
                      <span className="text-primary font-medium">
                        R$ {getMonthlyAmount(cost).toFixed(2)}/mês
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Início: {new Date(cost.start_date).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openEditDialog(cost)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(cost.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};