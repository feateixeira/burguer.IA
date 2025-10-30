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

interface Ingredient {
  id: string;
  name: string;
  quantity_purchased: number;
  total_cost: number;
  unit_measure: string;
  unit_cost: number;
  active: boolean;
}

interface IngredientsSectionProps {
  ingredients: Ingredient[];
  establishmentId: string | null;
  onUpdate: () => void;
}

const unitMeasures = [
  { value: 'kg', label: 'Quilograma (kg)' },
  { value: 'g', label: 'Grama (g)' },
  { value: 'l', label: 'Litro (l)' },
  { value: 'ml', label: 'Mililitro (ml)' },
  { value: 'unit', label: 'Unidade' },
  { value: 'package', label: 'Pacote' },
  { value: 'dozen', label: 'Dúzia' },
  { value: 'box', label: 'Caixa' },
];

export const IngredientsSection = ({ ingredients, establishmentId, onUpdate }: IngredientsSectionProps) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingIngredient, setEditingIngredient] = useState<Ingredient | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    quantity_purchased: "",
    total_cost: "",
    unit_measure: "unit",
  });
  const { toast } = useToast();
  const confirmDialog = useConfirm();

  const resetForm = () => {
    setFormData({
      name: "",
      quantity_purchased: "",
      total_cost: "",
      unit_measure: "unit",
    });
    setEditingIngredient(null);
  };

  const openCreateDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEditDialog = (ingredient: Ingredient) => {
    // Formata o total_cost para exibição com vírgula (formato brasileiro)
    const formatNumberForInput = (value: number): string => {
      return value.toFixed(2).replace('.', ',');
    };

    setFormData({
      name: ingredient.name,
      quantity_purchased: ingredient.quantity_purchased.toString().replace('.', ','),
      total_cost: formatNumberForInput(ingredient.total_cost),
      unit_measure: ingredient.unit_measure,
    });
    setEditingIngredient(ingredient);
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!establishmentId) return;

    try {
      // Converte valores usando formato brasileiro
      const quantity = parseBrazilianNumber(formData.quantity_purchased);
      const totalCost = parseBrazilianNumber(formData.total_cost);
      
      // Calcula o custo unitário
      const unitCost = quantity > 0 ? totalCost / quantity : 0;

      const ingredientData = {
        establishment_id: establishmentId,
        name: formData.name,
        quantity_purchased: quantity,
        total_cost: totalCost,
        unit_measure: formData.unit_measure,
        unit_cost: unitCost, // Salva o unit_cost calculado
      };

      if (editingIngredient) {
        const { error } = await supabase
          .from('ingredients')
          .update(ingredientData)
          .eq('id', editingIngredient.id);
        
        if (error) throw error;
        
        toast({
          title: "Success",
          description: "Ingredient updated successfully",
        });
      } else {
        const { error } = await supabase
          .from('ingredients')
          .insert([ingredientData]);
        
        if (error) throw error;
        
        toast({
          title: "Success", 
          description: "Ingredient created successfully",
        });
      }

      setDialogOpen(false);
      resetForm();
      onUpdate();
    } catch (error) {
      console.error('Error saving ingredient:', error);
      toast({
        title: "Error",
        description: "Failed to save ingredient",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (id: string) => {
    const ok = await confirmDialog({ title: 'Excluir ingrediente', description: 'Tem certeza que deseja excluir este ingrediente?' });
    if (!ok) return;

    try {
      const { error } = await supabase
        .from('ingredients')
        .update({ active: false })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Ingredient deleted successfully",
      });

      onUpdate();
    } catch (error) {
      console.error('Error deleting ingredient:', error);
      toast({
        title: "Error",
        description: "Failed to delete ingredient",
        variant: "destructive",
      });
    }
  };

  const getUnitLabel = (unit: string) => {
    const measure = unitMeasures.find(m => m.value === unit);
    return measure ? measure.label : unit;
  };

  // Converte string com vírgula (formato brasileiro) para número
  const parseBrazilianNumber = (value: string): number => {
    if (!value) return 0;
    // Remove espaços e substitui vírgula por ponto
    const cleaned = value.toString().trim().replace(/\./g, '').replace(',', '.');
    return parseFloat(cleaned) || 0;
  };

  // Formata valor monetário para exibição (2 casas decimais), mas mantém valor real para cálculos
  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  // Calcula o custo unitário corretamente
  const calculatedUnitCost = formData.quantity_purchased && formData.total_cost 
    ? parseBrazilianNumber(formData.total_cost) / parseBrazilianNumber(formData.quantity_purchased)
    : 0;

  const calculatedUnitCostDisplay = formatCurrency(calculatedUnitCost);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Ingredientes</h2>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreateDialog}>
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Ingrediente
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingIngredient ? 'Editar' : 'Adicionar'} Ingrediente
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">Nome do Ingrediente</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Pão, Carne, Queijo..."
                  required
                />
              </div>
              
              <div>
                <Label htmlFor="quantity_purchased">Quantidade Adquirida</Label>
                <Input
                  id="quantity_purchased"
                  type="number"
                  step="0.001"
                  value={formData.quantity_purchased}
                  onChange={(e) => setFormData({ ...formData, quantity_purchased: e.target.value })}
                  placeholder="Ex: 50 (se for 50 pães)"
                  required
                />
              </div>

              <div>
                <Label htmlFor="unit_measure">Unidade de Medida</Label>
                <Select 
                  value={formData.unit_measure} 
                  onValueChange={(value) => 
                    setFormData({ ...formData, unit_measure: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {unitMeasures.map((measure) => (
                      <SelectItem key={measure.value} value={measure.value}>
                        {measure.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="total_cost">Valor Total Pago (R$)</Label>
                <Input
                  id="total_cost"
                  type="number"
                  step="0.01"
                  value={formData.total_cost}
                  onChange={(e) => setFormData({ ...formData, total_cost: e.target.value })}
                  placeholder="0.00"
                  required
                />
              </div>

              {formData.quantity_purchased && formData.total_cost && (
                <div className="p-3 bg-muted rounded-md">
                  <Label className="text-sm font-medium">Custo Unitário Calculado:</Label>
                  <p className="text-lg font-bold text-primary">
                    {calculatedUnitCostDisplay} por {getUnitLabel(formData.unit_measure).toLowerCase()}
                  </p>
                </div>
              )}

              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit">
                  {editingIngredient ? 'Atualizar' : 'Criar'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {ingredients.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="text-center">
              <h3 className="text-lg font-semibold mb-2">Nenhum ingrediente cadastrado</h3>
              <p className="text-muted-foreground mb-4">
                Comece adicionando ingredientes e matérias-primas do seu negócio.
              </p>
              <Button onClick={openCreateDialog}>
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Primeiro Ingrediente
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {ingredients.map((ingredient) => (
            <Card key={ingredient.id}>
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex-1">
                  <h3 className="font-semibold">{ingredient.name}</h3>
                  <div className="text-sm text-muted-foreground">
                    <span className="mr-4">
                      {ingredient.quantity_purchased} {getUnitLabel(ingredient.unit_measure).toLowerCase()}
                    </span>
                    <span className="mr-4">
                      Total: {formatCurrency(ingredient.total_cost)}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-primary">
                    Custo unitário: {formatCurrency(ingredient.unit_cost)} por {getUnitLabel(ingredient.unit_measure).toLowerCase()}
                  </p>
                </div>
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openEditDialog(ingredient)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(ingredient.id)}
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