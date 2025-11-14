import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Trash2, Edit, Plus, Package, AlertTriangle, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { useConfirm } from "@/hooks/useConfirm";
import { toast as sonnerToast } from "sonner";

interface Ingredient {
  id: string;
  name: string;
  quantity_purchased: number;
  total_cost: number;
  unit_measure: string;
  unit_cost: number;
  stock_quantity?: number;
  min_stock_quantity?: number;
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
  const [stockAdjustDialogOpen, setStockAdjustDialogOpen] = useState(false);
  const [selectedIngredientForStock, setSelectedIngredientForStock] = useState<Ingredient | null>(null);
  const [editingIngredient, setEditingIngredient] = useState<Ingredient | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    quantity_purchased: "",
    total_cost: "",
    unit_measure: "unit",
    min_stock_quantity: "",
  });
  const [stockAdjustData, setStockAdjustData] = useState({
    adjustment: "",
    reason: "",
  });
  const [lowStockIngredients, setLowStockIngredients] = useState<Ingredient[]>([]);
  const { toast } = useToast();
  const confirmDialog = useConfirm();

  // Verificar ingredientes com estoque baixo
  useEffect(() => {
    const lowStock = ingredients.filter(ing => {
      const stock = ing.stock_quantity ?? 0;
      const minStock = ing.min_stock_quantity ?? 0;
      return stock <= minStock && stock >= 0;
    });
    setLowStockIngredients(lowStock);
  }, [ingredients]);

  const resetForm = () => {
    setFormData({
      name: "",
      quantity_purchased: "",
      total_cost: "",
      unit_measure: "unit",
      min_stock_quantity: "",
    });
    setEditingIngredient(null);
  };

  const resetStockAdjustForm = () => {
    setStockAdjustData({
      adjustment: "",
      reason: "",
    });
    setSelectedIngredientForStock(null);
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
      min_stock_quantity: (ingredient.min_stock_quantity ?? 0).toString().replace('.', ','),
    });
    setEditingIngredient(ingredient);
    setDialogOpen(true);
  };

  const openStockAdjustDialog = (ingredient: Ingredient) => {
    // Primeiro resetar o formulário
    setStockAdjustData({
      adjustment: "",
      reason: "",
    });
    // Depois definir o ingrediente selecionado
    setSelectedIngredientForStock(ingredient);
    // Por último abrir o modal
    setStockAdjustDialogOpen(true);
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

      const minStock = parseBrazilianNumber(formData.min_stock_quantity || "0");

      const ingredientData: any = {
        establishment_id: establishmentId,
        name: formData.name,
        quantity_purchased: quantity,
        total_cost: totalCost,
        unit_measure: formData.unit_measure,
        unit_cost: unitCost, // Salva o unit_cost calculado
        min_stock_quantity: minStock,
      };

      // Se for criação e não tiver stock_quantity definido, inicializar com quantity_purchased
      if (!editingIngredient) {
        ingredientData.stock_quantity = quantity;
      }

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

  // Formata quantidade baseado no tipo de unidade
  // - Unidades (unit, package, dozen, box): inteiro se possível, sem .00
  // - Peso (kg, g): mostrar decimais quando necessário (ex: 0.92kg, 92g)
  // - Valores monetários: sempre 2 casas (usar formatCurrency)
  const formatQuantity = (value: number, unit: string): string => {
    const unitLower = unit.toLowerCase();
    
    // Para medidas de peso (kg, g), mostrar decimais quando necessário
    if (unitLower === 'kg' || unitLower === 'g') {
      // Se for inteiro, mostrar sem decimais
      if (Number.isInteger(value)) {
        return value.toString();
      }
      // Se tiver decimais, mostrar até 3 casas e remover zeros à direita
      const formatted = value.toFixed(3);
      return formatted.replace(/\.?0+$/, '');
    }
    
    // Para unidades (unit, package, dozen, box), mostrar inteiro se possível
    if (unitLower === 'unit' || unitLower === 'package' || unitLower === 'dozen' || unitLower === 'box') {
      // Se for inteiro, mostrar sem decimais
      if (Number.isInteger(value)) {
        return value.toString();
      }
      // Se tiver decimais, mostrar mas remover zeros à direita
      const formatted = value.toFixed(2);
      return formatted.replace(/\.?0+$/, '');
    }
    
    // Para outros tipos (l, ml), mostrar decimais quando necessário
    if (Number.isInteger(value)) {
      return value.toString();
    }
    const formatted = value.toFixed(2);
    return formatted.replace(/\.?0+$/, '');
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

  // Função para obter status do estoque
  const getStockStatus = (ingredient: Ingredient): { status: 'ok' | 'low' | 'zero', label: string, color: string } => {
    const stock = ingredient.stock_quantity ?? 0;
    const minStock = ingredient.min_stock_quantity ?? 0;

    if (stock <= 0) {
      return { status: 'zero', label: 'Zerado', color: 'text-red-600' };
    } else if (stock <= minStock) {
      return { status: 'low', label: 'Baixo', color: 'text-orange-600' };
    } else {
      return { status: 'ok', label: 'OK', color: 'text-green-600' };
    }
  };

  // Função para ajustar estoque manualmente
  const handleStockAdjust = async () => {
    if (!selectedIngredientForStock || !establishmentId) return;

    const adjustment = parseBrazilianNumber(stockAdjustData.adjustment);
    if (adjustment === 0) {
      toast({
        title: "Erro",
        description: "O ajuste não pode ser zero",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data, error } = await supabase.rpc('adjust_ingredient_stock', {
        p_establishment_id: establishmentId,
        p_ingredient_id: selectedIngredientForStock.id,
        p_quantity_adjustment: adjustment,
        p_reason: stockAdjustData.reason || null,
      });

      if (error) throw error;

      if (data?.success) {
        sonnerToast.success(
          `Estoque ajustado: ${adjustment > 0 ? '+' : ''}${formatQuantity(adjustment, selectedIngredientForStock.unit_measure)} ${getUnitLabel(selectedIngredientForStock.unit_measure).toLowerCase()}`
        );
        setStockAdjustDialogOpen(false);
        resetStockAdjustForm();
        onUpdate();
      } else {
        throw new Error(data?.error || 'Erro ao ajustar estoque');
      }
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error?.message || "Falha ao ajustar estoque",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Alerta de estoque baixo */}
      {lowStockIngredients.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Ingredientes com estoque baixo</AlertTitle>
          <AlertDescription>
            <div className="mt-2 space-y-1">
              {lowStockIngredients.map(ing => {
                const status = getStockStatus(ing);
                return (
                  <div key={ing.id} className="flex items-center justify-between">
                    <span className="font-medium">{ing.name}</span>
                    <span className={status.color}>
                      {formatQuantity(ing.stock_quantity ?? 0, ing.unit_measure)} {getUnitLabel(ing.unit_measure).toLowerCase()} 
                      {ing.min_stock_quantity && ing.min_stock_quantity > 0 && (
                        <span className="text-muted-foreground ml-2">
                          (mín: {formatQuantity(ing.min_stock_quantity, ing.unit_measure)})
                        </span>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          </AlertDescription>
        </Alert>
      )}

      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Ingredientes</h2>
          {lowStockIngredients.length > 0 && (
            <Badge variant="destructive" className="mt-2">
              {lowStockIngredients.length} {lowStockIngredients.length === 1 ? 'ingrediente' : 'ingredientes'} com estoque baixo
            </Badge>
          )}
        </div>
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
              <DialogDescription>
                {editingIngredient ? 'Atualize as informações do ingrediente' : 'Adicione um novo ingrediente ao seu estoque'}
              </DialogDescription>
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
                  value={formData.quantity_purchased ? formData.quantity_purchased.replace(',', '.') : ''}
                  onChange={(e) => {
                    const value = e.target.value.replace(',', '.');
                    setFormData({ ...formData, quantity_purchased: value });
                  }}
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
                  value={formData.total_cost ? formData.total_cost.replace(',', '.') : ''}
                  onChange={(e) => {
                    const value = e.target.value.replace(',', '.');
                    setFormData({ ...formData, total_cost: value });
                  }}
                  placeholder="0.00"
                  required
                />
              </div>

              <div>
                <Label htmlFor="min_stock_quantity">Estoque Mínimo (Alerta)</Label>
                <Input
                  id="min_stock_quantity"
                  type="number"
                  step="0.01"
                  value={formData.min_stock_quantity ? formData.min_stock_quantity.replace(',', '.') : ''}
                  onChange={(e) => {
                    const value = e.target.value.replace(',', '.');
                    setFormData({ ...formData, min_stock_quantity: value });
                  }}
                  placeholder="0.00"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Quantidade mínima para emitir alerta de estoque baixo
                </p>
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
          {ingredients.map((ingredient) => {
            const stockStatus = getStockStatus(ingredient);
            const stock = ingredient.stock_quantity ?? 0;
            const minStock = ingredient.min_stock_quantity ?? 0;

            return (
              <Card key={ingredient.id} className={stockStatus.status === 'zero' ? 'border-red-500' : stockStatus.status === 'low' ? 'border-orange-500' : ''}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold">{ingredient.name}</h3>
                        <Badge 
                          variant={stockStatus.status === 'zero' ? 'destructive' : stockStatus.status === 'low' ? 'default' : 'secondary'}
                          className={stockStatus.status === 'low' ? 'bg-orange-500' : ''}
                        >
                          {stockStatus.label}
                        </Badge>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Quantidade comprada:</span>
                          <p className="font-medium">
                            {formatQuantity(ingredient.quantity_purchased, ingredient.unit_measure)} {getUnitLabel(ingredient.unit_measure).toLowerCase()}
                          </p>
                        </div>
                        
                        <div>
                          <span className="text-muted-foreground">Estoque atual:</span>
                          <p className={`font-bold ${stockStatus.color}`}>
                            {formatQuantity(stock, ingredient.unit_measure)} {getUnitLabel(ingredient.unit_measure).toLowerCase()}
                          </p>
                        </div>

                        {minStock > 0 && (
                          <div>
                            <span className="text-muted-foreground">Estoque mínimo:</span>
                            <p className="font-medium">
                              {formatQuantity(minStock, ingredient.unit_measure)} {getUnitLabel(ingredient.unit_measure).toLowerCase()}
                            </p>
                          </div>
                        )}

                        <div>
                          <span className="text-muted-foreground">Custo unitário:</span>
                          <p className="font-medium text-primary">
                            {formatCurrency(ingredient.unit_cost)} / {getUnitLabel(ingredient.unit_measure).toLowerCase()}
                          </p>
                        </div>
                      </div>

                      <div className="mt-2 text-sm text-muted-foreground">
                        <span>Total investido: {formatCurrency(ingredient.total_cost)}</span>
                      </div>
                    </div>
                    
                    <div className="flex flex-col space-y-2 ml-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openStockAdjustDialog(ingredient)}
                        className="w-full"
                      >
                        <Package className="h-4 w-4 mr-2" />
                        Ajustar Estoque
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEditDialog(ingredient)}
                        className="w-full"
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        Editar
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(ingredient.id)}
                        className="w-full"
                      >
                        <Trash2 className="h-4 w-4 mr-2 text-destructive" />
                        Excluir
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal de Ajuste de Estoque */}
      <Dialog open={stockAdjustDialogOpen} onOpenChange={(open) => {
        if (!open) {
          // Ao fechar, resetar tudo
          resetStockAdjustForm();
        }
        setStockAdjustDialogOpen(open);
      }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Ajustar Estoque</DialogTitle>
            <DialogDescription>
              Ajuste manual do estoque do ingrediente. Use valores positivos para entrada e negativos para saída.
            </DialogDescription>
          </DialogHeader>
          {selectedIngredientForStock ? (
            <div className="space-y-4 mt-4">
              <div className="p-3 bg-muted rounded-md">
                <p className="text-sm font-medium">Ingrediente: {selectedIngredientForStock.name}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Estoque atual: <span className="font-bold">{formatQuantity(selectedIngredientForStock.stock_quantity ?? 0, selectedIngredientForStock.unit_measure)}</span> {getUnitLabel(selectedIngredientForStock.unit_measure).toLowerCase()}
                </p>
              </div>

              <div>
                <Label htmlFor="adjustment">
                  Ajuste {selectedIngredientForStock.unit_measure && `(${getUnitLabel(selectedIngredientForStock.unit_measure).toLowerCase()})`}
                </Label>
                <Input
                  id="adjustment"
                  type="number"
                  step="0.01"
                  value={stockAdjustData.adjustment ? stockAdjustData.adjustment.replace(',', '.') : ''}
                  onChange={(e) => {
                    // Garantir que apenas números, ponto e sinal negativo sejam aceitos
                    const value = e.target.value.replace(',', '.');
                    setStockAdjustData({ ...stockAdjustData, adjustment: value });
                  }}
                  placeholder="Ex: 10 (entrada) ou -5 (saída)"
                  required
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Use valores positivos para entrada (+) e negativos para saída (-). Use ponto (.) para decimais.
                </p>
              </div>

              <div>
                <Label htmlFor="reason">Motivo (opcional)</Label>
                <Textarea
                  id="reason"
                  value={stockAdjustData.reason}
                  onChange={(e) => setStockAdjustData({ ...stockAdjustData, reason: e.target.value })}
                  placeholder="Ex: Compra do fornecedor X, Ajuste de inventário..."
                  rows={3}
                />
              </div>

              {stockAdjustData.adjustment && (
                <div className="p-3 bg-muted rounded-md">
                  <p className="text-sm font-medium">Estoque após ajuste:</p>
                  <p className="text-lg font-bold text-primary">
                    {formatQuantity((selectedIngredientForStock.stock_quantity ?? 0) + parseBrazilianNumber(stockAdjustData.adjustment), selectedIngredientForStock.unit_measure)} {getUnitLabel(selectedIngredientForStock.unit_measure).toLowerCase()}
                  </p>
                </div>
              )}

              <div className="flex justify-end space-x-2 pt-2">
                <Button type="button" variant="outline" onClick={() => {
                  setStockAdjustDialogOpen(false);
                  resetStockAdjustForm();
                }}>
                  Cancelar
                </Button>
                <Button onClick={handleStockAdjust}>
                  Salvar Ajuste
                </Button>
              </div>
            </div>
          ) : (
            <div className="p-4 text-center text-muted-foreground">
              Carregando informações do ingrediente...
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};