import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Calculator, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";

interface Product {
  id: string;
  name: string;
  price: number;
  variable_cost: number;
  profit_margin: number;
  suggested_price: number;
}

interface Ingredient {
  id: string;
  name: string;
  quantity_purchased: number;
  total_cost: number;
  unit_measure: string;
  unit_cost: number;
  active: boolean;
}

interface ProductIngredient {
  id: string;
  ingredient_id: string;
  quantity_used: number;
  ingredient: {
    name: string;
    unit_cost: number;
    unit_measure: string;
  };
}

interface ProductCostsSectionProps {
  establishmentId: string | null;
  ingredients: Ingredient[];
}

export const ProductCostsSection = ({ establishmentId, ingredients }: ProductCostsSectionProps) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [productIngredients, setProductIngredients] = useState<ProductIngredient[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [ingredientDialogOpen, setIngredientDialogOpen] = useState(false);
  const [selectedIngredient, setSelectedIngredient] = useState("");
  const [ingredientQuantity, setIngredientQuantity] = useState("");
  const [profitMargin, setProfitMargin] = useState("");
  const { toast } = useToast();

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);

  useEffect(() => {
    if (establishmentId) {
      loadProducts();
    }
  }, [establishmentId]);

  const loadProducts = async () => {
    if (!establishmentId) return;

    try {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, price, variable_cost, profit_margin, suggested_price')
        .eq('establishment_id', establishmentId)
        .eq('active', true);

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Error loading products:', error);
    }
  };

  const loadProductIngredients = async (productId: string) => {
    try {
      const { data, error } = await supabase
        .from('product_ingredients')
        .select(`
          id,
          ingredient_id,
          quantity_used,
          ingredients!ingredient_id (
            name,
            unit_cost,
            unit_measure
          )
        `)
        .eq('product_id', productId);

      if (error) throw error;
      
      const formattedData = data?.map(item => ({
        id: item.id,
        ingredient_id: item.ingredient_id,
        quantity_used: item.quantity_used,
        ingredient: {
          name: item.ingredients?.name || '',
          unit_cost: item.ingredients?.unit_cost || 0,
          unit_measure: item.ingredients?.unit_measure || '',
        }
      })) || [];
      
      setProductIngredients(formattedData);
    } catch (error) {
      console.error('Error loading product ingredients:', error);
    }
  };

  const handleProductSelect = async (product: Product) => {
    setSelectedProduct(product);
    setProfitMargin(product.profit_margin.toString());
    await loadProductIngredients(product.id);
    setDialogOpen(true);
  };

  const handleAddIngredient = async () => {
    if (!selectedProduct || !selectedIngredient || !ingredientQuantity) return;

    try {
      const { error } = await supabase
        .from('product_ingredients')
        .insert([{
          product_id: selectedProduct.id,
          ingredient_id: selectedIngredient,
          quantity_used: parseFloat(ingredientQuantity)
        }]);

      if (error) throw error;

      await loadProductIngredients(selectedProduct.id);
      await updateProductCosts();
      setSelectedIngredient("");
      setIngredientQuantity("");
      setIngredientDialogOpen(false);

      toast({
        title: "Success",
        description: "Ingredient added to product",
      });
    } catch (error) {
      console.error('Error adding ingredient:', error);
      toast({
        title: "Error",
        description: "Failed to add ingredient",
        variant: "destructive",
      });
    }
  };

  const handleRemoveIngredient = async (ingredientId: string) => {
    try {
      const { error } = await supabase
        .from('product_ingredients')
        .delete()
        .eq('id', ingredientId);

      if (error) throw error;

      await loadProductIngredients(selectedProduct!.id);
      await updateProductCosts();

      toast({
        title: "Success",
        description: "Ingredient removed from product",
      });
    } catch (error) {
      console.error('Error removing ingredient:', error);
      toast({
        title: "Error",
        description: "Failed to remove ingredient",
        variant: "destructive",
      });
    }
  };

  const updateProductCosts = async () => {
    if (!selectedProduct) {
      toast({
        title: "Erro",
        description: "Nenhum produto selecionado",
        variant: "destructive",
      });
      return;
    }

    try {
      // Buscar ingredientes do produto diretamente para garantir dados atualizados
      const { data: ingredientsData, error: ingredientsError } = await supabase
        .from('product_ingredients')
        .select(`
          id,
          ingredient_id,
          quantity_used,
          ingredients!ingredient_id (
            name,
            unit_cost,
            unit_measure
          )
        `)
        .eq('product_id', selectedProduct.id);

      if (ingredientsError) {
        console.error('Error loading product ingredients:', ingredientsError);
        throw ingredientsError;
      }

      // Formatar dados
      const currentIngredients = (ingredientsData || []).map(item => ({
        id: item.id,
        ingredient_id: item.ingredient_id,
        quantity_used: item.quantity_used,
        ingredient: {
          name: (item.ingredients as any)?.name || '',
          unit_cost: (item.ingredients as any)?.unit_cost || 0,
          unit_measure: (item.ingredients as any)?.unit_measure || '',
        }
      }));

      // Calcular custo variável com os dados mais recentes
      const variableCost = currentIngredients.reduce((sum, pi) => {
        const cost = (pi.ingredient?.unit_cost || 0) * (pi.quantity_used || 0);
        return sum + cost;
      }, 0);

      // Calcular preço sugerido
      const margin = parseFloat(profitMargin) || 0;
      const suggestedPrice = variableCost * (1 + margin / 100);

      // Preparar dados para atualização
      const updateData: {
        variable_cost: number;
        profit_margin: number;
        suggested_price: number;
      } = {
        variable_cost: variableCost,
        profit_margin: margin,
        suggested_price: suggestedPrice
      };

      const { data, error } = await supabase
        .from('products')
        .update(updateData)
        .eq('id', selectedProduct.id)
        .select();

      if (error) {
        console.error('Error updating product costs:', error);
        throw error;
      }

      if (!data || data.length === 0) {
        throw new Error('Produto não encontrado ou não foi possível atualizar');
      }

      // Atualizar estado local dos ingredientes
      setProductIngredients(currentIngredients);

      // Atualizar estado local do produto
      setSelectedProduct({
        ...selectedProduct,
        variable_cost: variableCost,
        profit_margin: margin,
        suggested_price: suggestedPrice
      });

      // Recarregar lista de produtos
      await loadProducts();

      toast({
        title: "Sucesso",
        description: "Custos salvos com sucesso",
      });
    } catch (error: any) {
      console.error('Error updating product costs:', error);
      toast({
        title: "Erro",
        description: error?.message || "Falha ao salvar custos. Verifique o console para mais detalhes.",
        variant: "destructive",
      });
    }
  };

  const totalVariableCost = productIngredients.reduce((sum, pi) => 
    sum + (pi.ingredient.unit_cost * pi.quantity_used), 0
  );

  const calculatedSuggestedPrice = profitMargin 
    ? totalVariableCost * (1 + parseFloat(profitMargin) / 100)
    : totalVariableCost;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Custos dos Produtos</h2>
      </div>

      {products.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="text-center">
              <h3 className="text-lg font-semibold mb-2">Nenhum produto encontrado</h3>
              <p className="text-muted-foreground mb-4">
                Adicione produtos na seção de Produtos primeiro.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {products.map((product) => (
            <Card key={product.id} className="cursor-pointer hover:shadow-md transition-shadow">
              <CardContent className="p-4" onClick={() => handleProductSelect(product)}>
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold">{product.name}</h3>
                    <div className="text-sm text-muted-foreground">
                      <span className="mr-4">Preço atual: R$ {product.price.toFixed(2)}</span>
                      <span className="mr-4">Custo variável: R$ {product.variable_cost.toFixed(2)}</span>
                      {product.suggested_price > 0 && (
                        <span className="text-primary font-medium">
                          Preço sugerido: R$ {product.suggested_price.toFixed(2)}
                        </span>
                      )}
                    </div>
                    {product.profit_margin > 0 && (
                      <Badge variant="secondary" className="mt-1">
                        Margem: {product.profit_margin.toFixed(1)}%
                      </Badge>
                    )}
                  </div>
                  <Calculator className="h-5 w-5 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              Custos do Produto: {selectedProduct?.name}
            </DialogTitle>
          </DialogHeader>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left Column - Ingredients */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Ingredientes</h3>
                <Dialog open={ingredientDialogOpen} onOpenChange={setIngredientDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Plus className="h-4 w-4 mr-2" />
                      Adicionar
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Adicionar Ingrediente</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label>Ingrediente</Label>
                        <Select value={selectedIngredient} onValueChange={setSelectedIngredient}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione um ingrediente" />
                          </SelectTrigger>
                          <SelectContent>
                            {ingredients.map((ingredient) => (
                              <SelectItem key={ingredient.id} value={ingredient.id}>
                                {ingredient.name} ({formatCurrency(ingredient.unit_cost)}/{ingredient.unit_measure})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Quantidade Usada</Label>
                        <Input
                          type="number"
                          step="0.001"
                          value={ingredientQuantity}
                          onChange={(e) => setIngredientQuantity(e.target.value)}
                          placeholder="Ex: 0.2 (para 200g)"
                        />
                      </div>
                      <div className="flex justify-end space-x-2">
                        <Button variant="outline" onClick={() => setIngredientDialogOpen(false)}>
                          Cancelar
                        </Button>
                        <Button onClick={handleAddIngredient}>
                          Adicionar
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              <div className="space-y-2">
                {productIngredients.length === 0 ? (
                  <p className="text-muted-foreground text-sm">
                    Nenhum ingrediente adicionado
                  </p>
                ) : (
                  productIngredients.map((pi) => (
                    <div key={pi.id} className="flex items-center justify-between p-2 bg-muted rounded">
                      <div className="flex-1">
                        <span className="font-medium">{pi.ingredient.name}</span>
                        <div className="text-xs text-muted-foreground">
                          {pi.quantity_used} {pi.ingredient.unit_measure} × {formatCurrency(pi.ingredient.unit_cost)} = 
                          <span className="font-medium"> {formatCurrency(pi.quantity_used * pi.ingredient.unit_cost)}</span>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveIngredient(pi.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Right Column - Cost Calculation */}
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-4">Cálculo de Custos</h3>
                
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span>Custo Variável Total:</span>
                    <span className="font-bold">{formatCurrency(totalVariableCost)}</span>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Margem de Lucro (%)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={profitMargin}
                      onChange={(e) => setProfitMargin(e.target.value)}
                      placeholder="Ex: 30 (para 30%)"
                    />
                  </div>

                  {profitMargin && (
                    <div className="p-4 bg-primary/10 rounded-md">
                      <div className="flex justify-between mb-2">
                        <span>Custo Variável:</span>
                        <span>{formatCurrency(totalVariableCost)}</span>
                      </div>
                      <div className="flex justify-between mb-2">
                        <span>Margem ({profitMargin}%):</span>
                        <span>{formatCurrency(totalVariableCost * (parseFloat(profitMargin) || 0) / 100)}</span>
                      </div>
                      <hr className="my-2" />
                      <div className="flex justify-between font-bold text-lg">
                        <span>Preço Sugerido:</span>
                        <span className="text-primary">{formatCurrency(calculatedSuggestedPrice)}</span>
                      </div>
                    </div>
                  )}

                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Preço Atual:</span>
                    <span>R$ {selectedProduct?.price.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Fechar
                </Button>
                <Button onClick={updateProductCosts}>
                  Salvar Custos
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};