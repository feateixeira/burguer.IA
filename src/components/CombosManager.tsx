import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Package, X, Search } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

interface Combo {
  id: string;
  name: string;
  description?: string;
  price: number;
  image_url?: string;
  active: boolean;
  combo_items: ComboItem[];
}

interface ComboItem {
  id: string;
  product_id: string;
  quantity: number;
  products: {
    id: string;
    name: string;
    price: number;
  };
}

interface Product {
  id: string;
  name: string;
  price: number;
}

interface CombosManagerProps {
  establishmentId: string;
}

export default function CombosManager({ establishmentId }: CombosManagerProps) {
  const [combos, setCombos] = useState<Combo[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCombo, setEditingCombo] = useState<Combo | null>(null);
  const [productSearchTerm, setProductSearchTerm] = useState("");
  const [showProductSelector, setShowProductSelector] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price: 0,
    image_url: "",
    active: true,
  });

  const [comboItems, setComboItems] = useState<
    Array<{ product_id: string; quantity: number }>
  >([]);

  useEffect(() => {
    if (establishmentId) {
      loadData();
    }
  }, [establishmentId]);

  const loadData = async () => {
    try {
      const [combosRes, productsRes] = await Promise.all([
        supabase
          .from("combos")
          .select(
            `
            *,
            combo_items(
              id,
              product_id,
              quantity,
              products(id, name, price)
            )
          `
          )
          .eq("establishment_id", establishmentId)
          .order("created_at", { ascending: false }),
        supabase
          .from("products")
          .select("id, name, price")
          .eq("establishment_id", establishmentId)
          .eq("active", true)
          .eq("is_combo", false)
          .order("name"),
      ]);

      setCombos(combosRes.data || []);
      setProducts(productsRes.data || []);
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.name || comboItems.length === 0) {
      toast.error("Preencha o nome e adicione pelo menos 1 produto");
      return;
    }

    try {
      if (editingCombo) {
        const { error: comboError } = await supabase
          .from("combos")
          .update({
            name: formData.name,
            description: formData.description,
            price: formData.price,
            image_url: formData.image_url || null,
            active: formData.active,
          })
          .eq("id", editingCombo.id);

        if (comboError) throw comboError;

        await supabase.from("combo_items").delete().eq("combo_id", editingCombo.id);

        const { error: itemsError } = await supabase.from("combo_items").insert(
          comboItems.map((item) => ({
            combo_id: editingCombo.id,
            ...item,
          }))
        );

        if (itemsError) throw itemsError;
        toast.success("Combo atualizado!");
      } else {
        const { data: combo, error: comboError } = await supabase
          .from("combos")
          .insert({
            establishment_id: establishmentId,
            name: formData.name,
            description: formData.description,
            price: formData.price,
            image_url: formData.image_url || null,
            active: formData.active,
          })
          .select()
          .single();

        if (comboError) throw comboError;

        const { error: itemsError } = await supabase.from("combo_items").insert(
          comboItems.map((item) => ({
            combo_id: combo.id,
            ...item,
          }))
        );

        if (itemsError) throw itemsError;
        toast.success("Combo criado!");
      }

      setDialogOpen(false);
      resetForm();
      loadData();
    } catch (error) {
      console.error("Error saving combo:", error);
      toast.error("Erro ao salvar combo");
    }
  };

  const handleEdit = (combo: Combo) => {
    setEditingCombo(combo);
    setFormData({
      name: combo.name,
      description: combo.description || "",
      price: combo.price,
      image_url: combo.image_url || "",
      active: combo.active,
    });
    setComboItems(
      combo.combo_items.map((item) => ({
        product_id: item.product_id,
        quantity: item.quantity,
      }))
    );
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Deseja excluir este combo?")) return;

    try {
      const { error } = await supabase.from("combos").delete().eq("id", id);
      if (error) throw error;
      toast.success("Combo excluído!");
      loadData();
    } catch (error) {
      console.error("Error deleting combo:", error);
      toast.error("Erro ao excluir combo");
    }
  };

  const resetForm = () => {
    setEditingCombo(null);
    setFormData({
      name: "",
      description: "",
      price: 0,
      image_url: "",
      active: true,
    });
    setComboItems([]);
    setProductSearchTerm("");
  };

  const addProductToCombo = (productId: string) => {
    // Check if product already exists
    const existingIndex = comboItems.findIndex((item) => item.product_id === productId);
    
    if (existingIndex >= 0) {
      // Increment quantity
      const updated = [...comboItems];
      updated[existingIndex].quantity += 1;
      setComboItems(updated);
    } else {
      // Add new product
      setComboItems([...comboItems, { product_id: productId, quantity: 1 }]);
    }
    
    setShowProductSelector(false);
    setProductSearchTerm("");
  };

  const removeComboItem = (index: number) => {
    setComboItems(comboItems.filter((_, i) => i !== index));
  };

  const updateItemQuantity = (index: number, quantity: number) => {
    if (quantity < 1) return;
    const updated = [...comboItems];
    updated[index].quantity = quantity;
    setComboItems(updated);
  };

  const getProductById = (productId: string) => {
    return products.find((p) => p.id === productId);
  };

  const calculateComboTotal = (items: ComboItem[]) => {
    return items.reduce((total, item) => {
      return total + item.products.price * item.quantity;
    }, 0);
  };

  const filteredProducts = products.filter((product) =>
    product.name.toLowerCase().includes(productSearchTerm.toLowerCase())
  );

  if (loading) {
    return <div className="p-4">Carregando combos...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Package className="h-6 w-6" />
          Combos
        </h2>
        <Dialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetForm();
          }}
        >
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Novo Combo
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingCombo ? "Editar" : "Novo"} Combo</DialogTitle>
              <DialogDescription>
                Configure os detalhes do combo
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nome *</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ex: Combo Família"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Preço *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.price}
                    onChange={(e) =>
                      setFormData({ ...formData, price: parseFloat(e.target.value) })
                    }
                    placeholder="R$"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Descrição</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder="Descrição do combo"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Produtos do Combo *</Label>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setShowProductSelector(!showProductSelector)}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Adicionar Produto
                  </Button>
                </div>

                {/* Product Selector */}
                {showProductSelector && (
                  <Card className="p-4">
                    <div className="space-y-2">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          value={productSearchTerm}
                          onChange={(e) => setProductSearchTerm(e.target.value)}
                          placeholder="Buscar produto..."
                          className="pl-10"
                        />
                      </div>
                      <div className="max-h-48 overflow-y-auto space-y-1">
                        {filteredProducts.map((product) => (
                          <div
                            key={product.id}
                            className="p-2 hover:bg-accent rounded cursor-pointer flex justify-between items-center"
                            onClick={() => addProductToCombo(product.id)}
                          >
                            <span>{product.name}</span>
                            <span className="text-sm text-muted-foreground">
                              R$ {product.price.toFixed(2)}
                            </span>
                          </div>
                        ))}
                        {filteredProducts.length === 0 && (
                          <p className="text-sm text-muted-foreground text-center py-4">
                            Nenhum produto encontrado
                          </p>
                        )}
                      </div>
                    </div>
                  </Card>
                )}

                {/* Selected Products */}
                <div className="space-y-2">
                  {comboItems.map((item, index) => {
                    const product = getProductById(item.product_id);
                    if (!product) return null;

                    return (
                      <div
                        key={index}
                        className="flex gap-2 items-center p-2 bg-muted rounded"
                      >
                        <div className="flex-1">
                          <p className="font-medium">{product.name}</p>
                          <p className="text-xs text-muted-foreground">
                            R$ {product.price.toFixed(2)} cada
                          </p>
                        </div>
                        <Input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) =>
                            updateItemQuantity(index, parseInt(e.target.value))
                          }
                          className="w-20"
                        />
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => removeComboItem(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    );
                  })}
                  {comboItems.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4 border-2 border-dashed rounded">
                      Nenhum produto adicionado
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  checked={formData.active}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, active: checked })
                  }
                />
                <Label>Ativo</Label>
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setDialogOpen(false);
                    resetForm();
                  }}
                >
                  Cancelar
                </Button>
                <Button onClick={handleSubmit}>Salvar</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {combos.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">
                Nenhum combo cadastrado. Crie o primeiro!
              </p>
            </CardContent>
          </Card>
        ) : (
          combos.map((combo) => (
            <Card key={combo.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2">
                      {combo.name}
                      {combo.active ? (
                        <Badge>Ativo</Badge>
                      ) : (
                        <Badge variant="secondary">Inativo</Badge>
                      )}
                    </CardTitle>
                    {combo.description && (
                      <p className="text-sm text-muted-foreground">
                        {combo.description}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleEdit(combo)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDelete(combo.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Preço do Combo</p>
                      <p className="text-2xl font-bold">R$ {combo.price.toFixed(2)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Valor Individual</p>
                      <p className="text-lg line-through text-muted-foreground">
                        R$ {calculateComboTotal(combo.combo_items).toFixed(2)}
                      </p>
                      <p className="text-xs text-green-600">
                        Economia:{" "}
                        {(
                          ((calculateComboTotal(combo.combo_items) - combo.price) /
                            calculateComboTotal(combo.combo_items)) *
                          100
                        ).toFixed(0)}
                        %
                      </p>
                    </div>
                  </div>

                  <div>
                    <p className="text-sm text-muted-foreground mb-2">
                      Produtos Inclusos:
                    </p>
                    <div className="space-y-1">
                      {combo.combo_items.map((item) => (
                        <div
                          key={item.id}
                          className="flex justify-between text-sm"
                        >
                          <span>
                            {item.quantity}x {item.products.name}
                          </span>
                          <span className="text-muted-foreground">
                            R$ {(item.products.price * item.quantity).toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}