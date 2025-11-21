import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Edit, Trash2, X, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

interface Addon {
  id: string;
  name: string;
  description?: string;
  price: number;
  active: boolean;
  establishment_id: string;
}

interface Category {
  id: string;
  name: string;
}

interface Product {
  id: string;
  name: string;
  category_id?: string;
  is_combo?: boolean;
}

interface AddonsManagerProps {
  establishmentId: string;
}

const AddonsManager = ({ establishmentId }: AddonsManagerProps) => {
  const [addons, setAddons] = useState<Addon[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [addonsCategoryId, setAddonsCategoryId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAddon, setEditingAddon] = useState<Addon | null>(null);
  const [associationDialogOpen, setAssociationDialogOpen] = useState(false);
  const [selectedAddon, setSelectedAddon] = useState<Addon | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [associationType, setAssociationType] = useState<"category" | "product" | "both">("category");

  useEffect(() => {
    if (!establishmentId) return;
    
    let isMounted = true;
    let isLoading = false;

    const loadDataSafely = async () => {
      if (isLoading || !isMounted) return;
      isLoading = true;
      
      try {
        await loadData();
      } finally {
        if (isMounted) {
          isLoading = false;
        }
      }
    };

    loadDataSafely();

    return () => {
      isMounted = false;
    };
  }, [establishmentId]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load addons
      const { data: addonsData, error: addonsError } = await supabase
        .from("addons")
        .select("*")
        .eq("establishment_id", establishmentId)
        .order("name");

      if (addonsError) throw addonsError;

      // Load categories
      const { data: categoriesData, error: categoriesError } = await supabase
        .from("categories")
        .select("id, name")
        .eq("establishment_id", establishmentId)
        .eq("active", true)
        .order("name");

      if (categoriesError) throw categoriesError;

      // Load products (excluir combos e adicionais)
      const { data: productsData, error: productsError } = await supabase
        .from("products")
        .select("id, name, category_id, is_combo")
        .eq("establishment_id", establishmentId)
        .eq("active", true)
        .order("name");

      if (productsError) throw productsError;

      // Buscar ID da categoria "Adicionais" para filtrar
      const { data: addonsCategory } = await supabase
        .from("categories")
        .select("id")
        .eq("establishment_id", establishmentId)
        .eq("name", "Adicionais")
        .eq("active", true)
        .maybeSingle();

      const addonsCategoryIdValue = addonsCategory?.id || null;
      setAddonsCategoryId(addonsCategoryIdValue);

      // Filtrar produtos: excluir combos (is_combo: true) e produtos da categoria "Adicionais"
      const filteredProducts = (productsData || []).filter((product: any) => {
        // Excluir produtos que são combos
        if (product.is_combo) return false;
        // Excluir produtos da categoria "Adicionais"
        if (addonsCategoryIdValue && product.category_id === addonsCategoryIdValue) return false;
        return true;
      });

      setAddons(addonsData || []);
      setCategories(categoriesData || []);
      setProducts(filteredProducts);
    } catch (error: any) {
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  // Função auxiliar para buscar ou criar categoria "Adicionais"
  const getOrCreateAddonsCategory = async (): Promise<string | null> => {
    try {
      // Buscar categoria "Adicionais"
      const { data: existingCategory, error: findError } = await supabase
        .from("categories")
        .select("id")
        .eq("establishment_id", establishmentId)
        .eq("name", "Adicionais")
        .eq("active", true)
        .single();

      if (existingCategory && !findError) {
        return existingCategory.id;
      }

      // Se não encontrou, criar a categoria
      const { data: newCategory, error: createError } = await supabase
        .from("categories")
        .insert({
          establishment_id: establishmentId,
          name: "Adicionais",
          description: "Adicionais e complementos",
          active: true,
          sort_order: 998,
        })
        .select("id")
        .single();

      if (createError) throw createError;
      return newCategory?.id || null;
    } catch (error) {
      return null;
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const addonData = {
      name: formData.get("name") as string,
      description: (formData.get("description") as string) || null,
      price: parseFloat(formData.get("price") as string),
      establishment_id: establishmentId,
      active: true,
    };

    try {
      // Buscar ou criar categoria "Adicionais"
      const addonsCategoryId = await getOrCreateAddonsCategory();

      if (editingAddon) {
        const { error } = await supabase
          .from("addons")
          .update(addonData)
          .eq("id", editingAddon.id);

        if (error) throw error;

        // Atualizar ou criar produto correspondente com categoria "Adicionais"
        if (addonsCategoryId) {
          // Buscar produto existente para este adicional
          const { data: existingProduct } = await supabase
            .from("products")
            .select("id")
            .eq("establishment_id", establishmentId)
            .eq("name", addonData.name)
            .eq("category_id", addonsCategoryId)
            .maybeSingle();

          if (existingProduct) {
            // Atualizar produto existente
            await supabase
              .from("products")
              .update({
                name: addonData.name,
                description: addonData.description || null,
                price: addonData.price,
                category_id: addonsCategoryId,
                active: addonData.active,
              })
              .eq("id", existingProduct.id);
          } else {
            // Criar novo produto
            await supabase
              .from("products")
              .insert({
                establishment_id: establishmentId,
                name: addonData.name,
                description: addonData.description || null,
                price: addonData.price,
                category_id: addonsCategoryId,
                active: addonData.active,
              });
          }
        }

        toast.success("Adicional atualizado com sucesso!");
      } else {
        const { error } = await supabase.from("addons").insert(addonData);

        if (error) throw error;

        // Criar produto correspondente com categoria "Adicionais"
        if (addonsCategoryId) {
          await supabase
            .from("products")
            .insert({
              establishment_id: establishmentId,
              name: addonData.name,
              description: addonData.description || null,
              price: addonData.price,
              category_id: addonsCategoryId,
              active: addonData.active,
            });
        }

        toast.success("Adicional criado com sucesso!");
      }

      setIsDialogOpen(false);
      setEditingAddon(null);
      loadData();
    } catch (error: any) {
      toast.error(error?.message || "Erro ao salvar adicional");
    }
  };

  const handleDelete = async (addon: Addon) => {
    if (!confirm(`Tem certeza que deseja excluir "${addon.name}"?`)) return;

    try {
      // First, delete associations
      await supabase.from("category_addons").delete().eq("addon_id", addon.id);
      await supabase.from("product_addons").delete().eq("addon_id", addon.id);

      // Then delete the addon
      const { error } = await supabase.from("addons").delete().eq("id", addon.id);

      if (error) throw error;
      toast.success("Adicional excluído com sucesso!");
      loadData();
    } catch (error: any) {
      toast.error("Erro ao excluir adicional");
    }
  };

  const openEditDialog = (addon: Addon) => {
    setEditingAddon(addon);
    setIsDialogOpen(true);
  };

  const openCreateDialog = () => {
    setEditingAddon(null);
    setIsDialogOpen(true);
  };

  const openAssociationDialog = async (addon: Addon) => {
    setSelectedAddon(addon);
    setAssociationDialogOpen(true);

    // Load current associations
    try {
      // Load category associations
      const { data: categoryAssociations } = await supabase
        .from("category_addons")
        .select("category_id")
        .eq("addon_id", addon.id);

      // Load product associations
      const { data: productAssociations } = await supabase
        .from("product_addons")
        .select("product_id")
        .eq("addon_id", addon.id);

      const catIds = categoryAssociations?.map((ca) => ca.category_id) || [];
      const prodIds = productAssociations?.map((pa) => pa.product_id) || [];

      setSelectedCategories(catIds);
      setSelectedProducts(prodIds);

      // Determine association type
      if (catIds.length > 0 && prodIds.length > 0) {
        setAssociationType("both");
      } else if (catIds.length > 0) {
        setAssociationType("category");
      } else if (prodIds.length > 0) {
        setAssociationType("product");
      } else {
        setAssociationType("category");
      }
    } catch (error) {
      toast.error("Erro ao carregar associações");
    }
  };

  const handleSaveAssociations = async () => {
    if (!selectedAddon) return;

    try {
      // Delete all existing associations
      await supabase.from("category_addons").delete().eq("addon_id", selectedAddon.id);
      await supabase.from("product_addons").delete().eq("addon_id", selectedAddon.id);

      // Create new category associations
      if (associationType === "category" || associationType === "both") {
        if (selectedCategories.length > 0) {
          const categoryAssociations = selectedCategories.map((categoryId) => ({
            category_id: categoryId,
            addon_id: selectedAddon.id,
          }));

          const { error: catError } = await supabase
            .from("category_addons")
            .insert(categoryAssociations);

          if (catError) throw catError;
        }
      }

      // Create new product associations
      if (associationType === "product" || associationType === "both") {
        if (selectedProducts.length > 0) {
          const productAssociations = selectedProducts.map((productId) => ({
            product_id: productId,
            addon_id: selectedAddon.id,
          }));

          const { error: prodError } = await supabase
            .from("product_addons")
            .insert(productAssociations);

          if (prodError) throw prodError;
        }
      }

      toast.success("Associações salvas com sucesso!");
      setAssociationDialogOpen(false);
      setSelectedAddon(null);
      loadData();
    } catch (error: any) {
      toast.error("Erro ao salvar associações");
    }
  };


  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Carregando adicionais...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-muted-foreground">
          Gerencie os adicionais do seu estabelecimento (bacon, carne extra, etc.)
        </p>
        <Button onClick={openCreateDialog}>
          <Plus className="h-4 w-4 mr-2" />
          Adicionar Adicional
        </Button>
      </div>

      {/* Addon Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingAddon ? "Editar Adicional" : "Novo Adicional"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="name">Nome *</Label>
              <Input
                id="name"
                name="name"
                defaultValue={editingAddon?.name || ""}
                required
                placeholder="Ex: Bacon, Carne Extra, Queijo Extra"
              />
            </div>
            <div>
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                name="description"
                defaultValue={editingAddon?.description || ""}
                placeholder="Descrição opcional do adicional"
              />
            </div>
            <div>
              <Label htmlFor="price">Preço (R$) *</Label>
              <Input
                id="price"
                name="price"
                type="number"
                step="0.01"
                min="0"
                defaultValue={editingAddon?.price || ""}
                required
                placeholder="0.00"
              />
            </div>
            <div className="flex justify-end space-x-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit">
                {editingAddon ? "Atualizar" : "Criar"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Association Dialog */}
      <Dialog open={associationDialogOpen} onOpenChange={setAssociationDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Associar "{selectedAddon?.name}" a Categorias ou Produtos
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Tipo de Associação</Label>
              <Select
                value={associationType}
                onValueChange={(value: "category" | "product" | "both") =>
                  setAssociationType(value)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="category">Por Categoria</SelectItem>
                  <SelectItem value="product">Por Produto Individual</SelectItem>
                  <SelectItem value="both">Ambos (Categoria e Produto)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                {associationType === "category" &&
                  "O adicional será aplicado a todos os produtos da(s) categoria(s) selecionada(s)"}
                {associationType === "product" &&
                  "O adicional será aplicado apenas aos produtos individuais selecionados"}
                {associationType === "both" &&
                  "O adicional será aplicado às categorias e produtos selecionados"}
              </p>
            </div>

            {(associationType === "category" || associationType === "both") && (
              <div className="space-y-2">
                <Label>Categorias</Label>
                <div className="border rounded-md p-3 max-h-48 overflow-y-auto">
                  {categories.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Nenhuma categoria disponível
                    </p>
                  ) : (
                    categories.map((category) => (
                      <div key={category.id} className="flex items-center space-x-2 py-2">
                        <Checkbox
                          id={`cat-${category.id}`}
                          checked={selectedCategories.includes(category.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedCategories([...selectedCategories, category.id]);
                            } else {
                              setSelectedCategories(
                                selectedCategories.filter((id) => id !== category.id)
                              );
                            }
                          }}
                        />
                        <label
                          htmlFor={`cat-${category.id}`}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                        >
                          {category.name}
                        </label>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {(associationType === "product" || associationType === "both") && (
              <div className="space-y-2">
                <Label>Produtos Individuais</Label>
                <div className="border rounded-md p-3 max-h-48 overflow-y-auto">
                  {(() => {
                    // Filtrar produtos novamente na renderização para garantir que combos e adicionais não apareçam
                    const validProducts = products.filter((product) => {
                      // Excluir produtos que são combos
                      if (product.is_combo) return false;
                      // Excluir produtos da categoria "Adicionais"
                      if (addonsCategoryId && product.category_id === addonsCategoryId) return false;
                      return true;
                    });

                    if (validProducts.length === 0) {
                      return (
                        <p className="text-sm text-muted-foreground">
                          Nenhum produto disponível
                        </p>
                      );
                    }

                    return validProducts.map((product) => (
                      <div key={product.id} className="flex items-center space-x-2 py-2">
                        <Checkbox
                          id={`prod-${product.id}`}
                          checked={selectedProducts.includes(product.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedProducts([...selectedProducts, product.id]);
                            } else {
                              setSelectedProducts(
                                selectedProducts.filter((id) => id !== product.id)
                              );
                            }
                          }}
                        />
                        <label
                          htmlFor={`prod-${product.id}`}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                        >
                          {product.name}
                        </label>
                      </div>
                    ));
                  })()}
                </div>
              </div>
            )}

            <div className="flex justify-end space-x-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setAssociationDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="button" onClick={handleSaveAssociations}>
                Salvar Associações
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Addons List - Table Layout */}
      <div className="border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-3 text-sm font-semibold">Nome</th>
                <th className="text-left p-3 text-sm font-semibold">Descrição</th>
                <th className="text-right p-3 text-sm font-semibold">Preço</th>
                <th className="text-left p-3 text-sm font-semibold">Associações</th>
                <th className="text-right p-3 text-sm font-semibold">Ações</th>
              </tr>
            </thead>
            <tbody>
              {addons.map((addon) => (
                <AddonTableRow
                  key={addon.id}
                  addon={addon}
                  categories={categories}
                  products={products}
                  onEdit={() => openEditDialog(addon)}
                  onDelete={() => handleDelete(addon)}
                  onAssociate={() => openAssociationDialog(addon)}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {addons.length === 0 && (
        <Card>
          <CardContent className="text-center py-12">
            <p className="text-muted-foreground mb-4">
              Nenhum adicional cadastrado
            </p>
            <Button onClick={openCreateDialog}>
              <Plus className="h-4 w-4 mr-2" />
              Criar Primeiro Adicional
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

interface AddonTableRowProps {
  addon: Addon;
  categories: Category[];
  products: Product[];
  onEdit: () => void;
  onDelete: () => void;
  onAssociate: () => void;
}

const AddonTableRow = ({
  addon,
  categories,
  products,
  onEdit,
  onDelete,
  onAssociate,
}: AddonTableRowProps) => {
  const [associations, setAssociations] = useState<{
    categories: Array<{ category_id: string }>;
    products: Array<{ product_id: string }>;
  }>({ categories: [], products: [] });
  const [loadingAssociations, setLoadingAssociations] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const loadAssociationsData = async () => {
      try {
        setLoadingAssociations(true);
        
        // Load associations in parallel
        const [categoryResult, productResult] = await Promise.all([
          supabase
            .from("category_addons")
            .select("category_id")
            .eq("addon_id", addon.id),
          supabase
            .from("product_addons")
            .select("product_id")
            .eq("addon_id", addon.id)
        ]);

        if (isMounted) {
          setAssociations({
            categories: categoryResult.data || [],
            products: productResult.data || [],
          });
        }
      } catch (error) {
        // Erro silencioso - não precisa de ação
      } finally {
        if (isMounted) {
          setLoadingAssociations(false);
        }
      }
    };
    loadAssociationsData();
    return () => {
      isMounted = false;
    };
  }, [addon.id]);

  const getCategoryNames = () => {
    const categoryIds = associations.categories.map((ca) => ca.category_id);
    return categories
      .filter((cat) => categoryIds.includes(cat.id))
      .map((cat) => cat.name);
  };

  const getProductNames = () => {
    const productIds = associations.products.map((pa) => pa.product_id);
    return products
      .filter((prod) => productIds.includes(prod.id))
      .map((prod) => prod.name);
  };

  const categoryNames = getCategoryNames();
  const productNames = getProductNames();

  return (
    <tr className="border-b hover:bg-muted/30 transition-colors">
      <td className="p-3">
        <div className="font-medium text-sm">{addon.name}</div>
      </td>
      <td className="p-3">
        <div className="text-sm text-muted-foreground max-w-xs truncate">
          {addon.description || "-"}
        </div>
      </td>
      <td className="p-3 text-right">
        <div className="font-semibold text-sm">R$ {addon.price.toFixed(2)}</div>
      </td>
      <td className="p-3">
        {loadingAssociations ? (
          <div className="text-xs text-muted-foreground">Carregando...</div>
        ) : (
          <div className="flex flex-wrap gap-1">
            {categoryNames.length > 0 && (
              <>
                {categoryNames.slice(0, 2).map((name, idx) => (
                  <Badge key={idx} variant="secondary" className="text-xs">
                    {name}
                  </Badge>
                ))}
                {categoryNames.length > 2 && (
                  <Badge variant="secondary" className="text-xs">
                    +{categoryNames.length - 2}
                  </Badge>
                )}
              </>
            )}
            {productNames.length > 0 && (
              <>
                {productNames.slice(0, 2).map((name, idx) => (
                  <Badge key={idx} variant="outline" className="text-xs">
                    {name}
                  </Badge>
                ))}
                {productNames.length > 2 && (
                  <Badge variant="outline" className="text-xs">
                    +{productNames.length - 2}
                  </Badge>
                )}
              </>
            )}
            {categoryNames.length === 0 && productNames.length === 0 && (
              <span className="text-xs text-muted-foreground">Nenhuma</span>
            )}
          </div>
        )}
      </td>
      <td className="p-3">
        <div className="flex justify-end gap-1">
          <Button variant="outline" size="sm" onClick={onAssociate} className="h-8 px-2 text-xs">
            Associar
          </Button>
          <Button variant="outline" size="sm" onClick={onEdit} className="h-8 w-8 p-0">
            <Edit className="h-3 w-3" />
          </Button>
          <Button variant="destructive" size="sm" onClick={onDelete} className="h-8 w-8 p-0">
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </td>
    </tr>
  );
};

export default AddonsManager;

