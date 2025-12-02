import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Tag, X, Search } from "lucide-react";
import { toast } from "sonner";
import { revalidateHelpers } from "@/utils/revalidateCache";
import { Badge } from "@/components/ui/badge";
import { useConfirm } from "@/hooks/useConfirm";

interface Promotion {
  id: string;
  name: string;
  description?: string;
  type: string;
  target_id?: string;
  discount_type: string;
  discount_value: number;
  start_date: string;
  end_date: string;
  start_time?: string;
  end_time?: string;
  active: boolean;
}

export default function Promotions() {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const confirmDialog = useConfirm();
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [addonsCategoryId, setAddonsCategoryId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPromotion, setEditingPromotion] = useState<Promotion | null>(null);
  const [establishmentId, setEstablishmentId] = useState("");

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    type: "product",
    target_id: "",
    discount_type: "percentage",
    discount_value: 0,
    start_date: "",
    end_date: "",
    start_time: "",
    end_time: "",
    active: true,
  });
  const [selectedProducts, setSelectedProducts] = useState<Array<{ product_id: string; fixed_price?: number }>>([]);
  const [productSearchTerm, setProductSearchTerm] = useState("");
  const [showProductSelector, setShowProductSelector] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("establishment_id")
        .eq("user_id", session.user.id)
        .single();

      if (!profile?.establishment_id) return;
      setEstablishmentId(profile.establishment_id);

      const [promotionsRes, productsRes, categoriesRes] = await Promise.all([
        supabase
          .from("promotions")
          .select("*")
          .eq("establishment_id", profile.establishment_id)
          .order("created_at", { ascending: false }),
        supabase
          .from("products")
          .select("id, name, price")
          .eq("establishment_id", profile.establishment_id)
          .eq("active", true),
        supabase
          .from("categories")
          .select("id, name")
          .eq("establishment_id", profile.establishment_id)
          .eq("active", true),
      ]);

      setPromotions(promotionsRes.data || []);
      
      // Buscar ID da categoria "Adicionais" para filtrar
      const addonsCategory = (categoriesRes.data || []).find((cat: any) => cat.name === "Adicionais");
      setAddonsCategoryId(addonsCategory?.id || null);
      
      // Filtrar produtos: excluir combos (is_combo: true) e produtos da categoria "Adicionais"
      const filteredProducts = (productsRes.data || []).filter((product: any) => {
        // Excluir produtos que são combos
        if (product.is_combo) return false;
        // Excluir produtos da categoria "Adicionais"
        if (addonsCategory?.id && product.category_id === addonsCategory.id) return false;
        return true;
      });
      
      setProducts(filteredProducts);
      setCategories(categoriesRes.data || []);
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.start_date || !formData.end_date) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    // Validação para produtos
    if (formData.type === "product") {
      if (selectedProducts.length === 0) {
        toast.error("Adicione pelo menos um produto");
        return;
      }

      // Validação para valor fixo por produto - sempre obrigatório quando tipo é produto
      const hasInvalidPrice = selectedProducts.some(
        (item) => !item.fixed_price || item.fixed_price <= 0
      );
      if (hasInvalidPrice) {
        toast.error("Defina um valor promocional válido para todos os produtos adicionados");
        return;
      }
    }

    // Validação para outros tipos
    if (formData.type !== "product" && formData.type !== "global" && !formData.target_id) {
      toast.error("Selecione um alvo para a promoção");
      return;
    }

    try {
      const promotionData = {
        ...formData,
        establishment_id: establishmentId,
        target_id: formData.type === "global" ? null : (formData.type === "product" ? null : formData.target_id || null),
        start_time: formData.start_time || null,
        end_time: formData.end_time || null,
      };

      let promotionId: string;

      if (editingPromotion) {
        const { error, data } = await supabase
          .from("promotions")
          .update(promotionData)
          .eq("id", editingPromotion.id)
          .select()
          .single();

        if (error) throw error;
        promotionId = editingPromotion.id;
        toast.success("Promoção atualizada!");
      } else {
        const { error, data } = await supabase
          .from("promotions")
          .insert(promotionData)
          .select()
          .single();

        if (error) throw error;
        promotionId = data.id;
        toast.success("Promoção criada!");
      }

      // Gerenciar produtos relacionados (apenas para tipo "product")
      if (formData.type === "product") {
        // Deletar produtos antigos
        await supabase
          .from("promotion_products")
          .delete()
          .eq("promotion_id", promotionId);

        // Inserir novos produtos
        if (selectedProducts.length > 0) {
          const productsToInsert = selectedProducts.map((item) => ({
            promotion_id: promotionId,
            product_id: item.product_id,
            fixed_price: item.fixed_price || null,
          }));

          const { error: productsError } = await supabase
            .from("promotion_products")
            .insert(productsToInsert);

          if (productsError) throw productsError;
        }
      } else {
        // Se não for tipo produto, limpar produtos relacionados
        await supabase
          .from("promotion_products")
          .delete()
          .eq("promotion_id", promotionId);
      }

      setDialogOpen(false);
      resetForm();
      
      // Get establishment slug for revalidation
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('establishment_id')
          .eq('user_id', session.user.id)
          .single();
        
        if (profile?.establishment_id) {
          const { data: establishment } = await supabase
            .from('establishments')
            .select('slug')
            .eq('id', profile.establishment_id)
            .single();
          
          await revalidateHelpers.promotions(establishment?.slug);
        }
      }
      
      loadData();
    } catch (error) {
      console.error("Error saving promotion:", error);
      toast.error("Erro ao salvar promoção");
    }
  };

  const handleEdit = async (promotion: Promotion) => {
    setEditingPromotion(promotion);
    // Se for tipo produto, garantir que discount_type seja fixed_per_product
    const discountType = promotion.type === "product" ? "fixed_per_product" : promotion.discount_type;
    setFormData({
      name: promotion.name,
      description: promotion.description || "",
      type: promotion.type,
      target_id: promotion.target_id || "",
      discount_type: discountType,
      discount_value: promotion.discount_value,
      start_date: promotion.start_date,
      end_date: promotion.end_date,
      start_time: promotion.start_time || "",
      end_time: promotion.end_time || "",
      active: promotion.active,
    });

    // Carregar produtos relacionados se for tipo produto
    if (promotion.type === "product") {
      const { data: promotionProducts } = await supabase
        .from("promotion_products")
        .select("product_id, fixed_price")
        .eq("promotion_id", promotion.id);

      if (promotionProducts && promotionProducts.length > 0) {
        const products = promotionProducts.map((pp) => ({
          product_id: pp.product_id,
          fixed_price: pp.fixed_price || undefined,
        }));
        setSelectedProducts(products);
      } else {
        // Se não houver produtos relacionados, usar o target_id antigo (compatibilidade)
        if (promotion.target_id) {
          setSelectedProducts([{ product_id: promotion.target_id, fixed_price: undefined }]);
        } else {
          setSelectedProducts([]);
        }
      }
    } else {
      setSelectedProducts([]);
    }

    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    const ok = await confirmDialog({ title: 'Excluir promoção', description: 'Deseja excluir esta promoção?' });
    if (!ok) return;

    try {
      const { error } = await supabase.from("promotions").delete().eq("id", id);
      if (error) throw error;
      toast.success("Promoção excluída!");
      
      // Get establishment slug for revalidation
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('establishment_id')
          .eq('user_id', session.user.id)
          .single();
        
        if (profile?.establishment_id) {
          const { data: establishment } = await supabase
            .from('establishments')
            .select('slug')
            .eq('id', profile.establishment_id)
            .single();
          
          await revalidateHelpers.promotions(establishment?.slug);
        }
      }
      
      loadData();
    } catch (error) {
      console.error("Error deleting promotion:", error);
      toast.error("Erro ao excluir promoção");
    }
  };

  const resetForm = () => {
    setEditingPromotion(null);
    setFormData({
      name: "",
      description: "",
      type: "product",
      target_id: "",
      discount_type: "percentage",
      discount_value: 0,
      start_date: "",
      end_date: "",
      start_time: "",
      end_time: "",
      active: true,
    });
    setSelectedProducts([]);
    setProductSearchTerm("");
    setShowProductSelector(false);
  };

  // Componente para exibir o nome do alvo (suporta async para produtos)
  const TargetNameDisplay = ({ promotion }: { promotion: Promotion }) => {
    const [targetName, setTargetName] = useState<string>("Carregando...");

    useEffect(() => {
      const loadTargetName = async () => {
        if (promotion.type === "global") {
          setTargetName("Global");
          return;
        }
        
        if (promotion.type === "product") {
          // Verificar se há produtos relacionados na tabela promotion_products
          const { data: promotionProducts } = await supabase
            .from("promotion_products")
            .select("product_id")
            .eq("promotion_id", promotion.id);

          if (promotionProducts && promotionProducts.length > 0) {
            const productNames = promotionProducts
              .map((pp) => {
                const product = products.find((p) => p.id === pp.product_id);
                return product?.name;
              })
              .filter(Boolean);
            setTargetName(productNames.length > 0 ? productNames.join(", ") : "-");
          } else {
            // Fallback para target_id antigo (compatibilidade)
            const product = products.find((p) => p.id === promotion.target_id);
            setTargetName(product?.name || "-");
          }
          return;
        }
        
        if (promotion.type === "category") {
          const category = categories.find((c) => c.id === promotion.target_id);
          setTargetName(category?.name || "-");
          return;
        }
        
        setTargetName("-");
      };

      loadTargetName();
    }, [promotion, products, categories]);

    return <span>{targetName}</span>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-full">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Tag className="h-8 w-8" />
            Promoções
          </h1>
          <p className="text-muted-foreground">
            Crie promoções programadas por produto, categoria ou globais
          </p>
        </div>
            <Dialog open={dialogOpen} onOpenChange={(open) => {
              setDialogOpen(open);
              if (!open) resetForm();
            }}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Nova Promoção
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>
                    {editingPromotion ? "Editar" : "Nova"} Promoção
                  </DialogTitle>
                  <DialogDescription>
                    Configure os detalhes da promoção
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Nome *</Label>
                      <Input
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="Ex: Black Friday"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Tipo *</Label>
                      <Select
                        value={formData.type}
                        onValueChange={(value) => {
                          // Se mudar para produto, definir discount_type como fixed_per_product
                          // Se mudar de produto, manter o discount_type atual
                          const newDiscountType = value === "product" ? "fixed_per_product" : formData.discount_type;
                          setFormData({ 
                            ...formData, 
                            type: value, 
                            target_id: "",
                            discount_type: newDiscountType
                          });
                          // Limpar produtos selecionados ao mudar o tipo
                          if (value !== "product") {
                            setSelectedProducts([]);
                            setProductSearchTerm("");
                            setShowProductSelector(false);
                          }
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="product">Produto</SelectItem>
                          <SelectItem value="category">Categoria</SelectItem>
                          <SelectItem value="global">Global</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {formData.type === "product" && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>Produtos *</Label>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
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
                              {products
                                .filter((product) =>
                                  product.name.toLowerCase().includes(productSearchTerm.toLowerCase()) &&
                                  !selectedProducts.some((item) => item.product_id === product.id)
                                )
                                .map((product) => (
                                  <div
                                    key={product.id}
                                    className="p-2 hover:bg-accent rounded cursor-pointer flex justify-between items-center"
                                    onClick={() => {
                                      const newProduct = {
                                        product_id: product.id,
                                        fixed_price: undefined, // Sempre inicializar sem valor para o usuário preencher
                                      };
                                      setSelectedProducts([
                                        ...selectedProducts,
                                        newProduct,
                                      ]);
                                      setShowProductSelector(false);
                                      setProductSearchTerm("");
                                    }}
                                  >
                                    <span>{product.name}</span>
                                    <span className="text-sm text-muted-foreground">
                                      R$ {product.price?.toFixed(2) || "0.00"}
                                    </span>
                                  </div>
                                ))}
                              {products.filter(
                                (product) =>
                                  product.name.toLowerCase().includes(productSearchTerm.toLowerCase()) &&
                                  !selectedProducts.some((item) => item.product_id === product.id)
                              ).length === 0 && (
                                <p className="text-sm text-muted-foreground text-center py-4">
                                  {productSearchTerm
                                    ? "Nenhum produto encontrado"
                                    : "Todos os produtos já foram adicionados"}
                                </p>
                              )}
                            </div>
                          </div>
                        </Card>
                      )}

                      {/* Selected Products */}
                      <div className="space-y-2">
                        {selectedProducts.map((item, index) => {
                          const product = products.find((p) => p.id === item.product_id);
                          if (!product) return null;

                          return (
                            <div
                              key={item.product_id}
                              className="flex gap-2 items-center p-2 bg-muted rounded"
                            >
                              <div className="flex-1 min-w-0">
                                <p className="font-medium truncate">{product.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  Preço original: R$ {product.price?.toFixed(2) || "0.00"}
                                </p>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <Label className="text-xs whitespace-nowrap">Valor Promoção:</Label>
                                <Input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  placeholder="0.00"
                                  className="w-32"
                                  value={item.fixed_price !== undefined && item.fixed_price !== null ? item.fixed_price : ""}
                                  onChange={(e) => {
                                    const inputValue = e.target.value;
                                    const value = inputValue === "" ? undefined : (isNaN(parseFloat(inputValue)) ? undefined : parseFloat(inputValue));
                                    const updated = [...selectedProducts];
                                    const itemIndex = updated.findIndex(p => p.product_id === item.product_id);
                                    if (itemIndex !== -1) {
                                      updated[itemIndex] = {
                                        ...updated[itemIndex],
                                        fixed_price: value,
                                      };
                                      setSelectedProducts(updated);
                                    }
                                  }}
                                />
                                <span className="text-xs text-muted-foreground">R$</span>
                              </div>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="flex-shrink-0"
                                onClick={() => {
                                  setSelectedProducts(selectedProducts.filter((_, i) => i !== index));
                                }}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          );
                        })}
                        {selectedProducts.length === 0 && (
                          <p className="text-sm text-muted-foreground text-center py-4 border-2 border-dashed rounded">
                            Nenhum produto adicionado
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {formData.type === "category" && (
                    <div className="space-y-2">
                      <Label>Categoria *</Label>
                      <Select
                        value={formData.target_id}
                        onValueChange={(value) =>
                          setFormData({ ...formData, target_id: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione uma categoria" />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map((category) => (
                            <SelectItem key={category.id} value={category.id}>
                              {category.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label>Descrição</Label>
                    <Textarea
                      value={formData.description}
                      onChange={(e) =>
                        setFormData({ ...formData, description: e.target.value })
                      }
                      placeholder="Descrição da promoção"
                    />
                  </div>

                  {formData.type !== "product" && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Tipo de Desconto *</Label>
                        <Select
                          value={formData.discount_type}
                          onValueChange={(value) => {
                            setFormData({ ...formData, discount_type: value });
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="percentage">Percentual</SelectItem>
                            <SelectItem value="fixed">Valor Fixo</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Valor do Desconto *</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={formData.discount_value}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              discount_value: parseFloat(e.target.value) || 0,
                            })
                          }
                          placeholder={formData.discount_type === "percentage" ? "%" : "R$"}
                        />
                      </div>
                    </div>
                  )}
                  {formData.type === "product" && (
                    <div className="space-y-2 p-3 bg-muted rounded-md">
                      <Label className="text-sm font-medium">Tipo de Promoção: Valor Fixo por Produto</Label>
                      <p className="text-xs text-muted-foreground">
                        Defina o valor promocional individual para cada produto adicionado acima. Cada produto pode ter seu próprio valor promocional.
                      </p>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Data Início *</Label>
                      <Input
                        type="date"
                        value={formData.start_date}
                        onChange={(e) =>
                          setFormData({ ...formData, start_date: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Data Fim *</Label>
                      <Input
                        type="date"
                        value={formData.end_date}
                        onChange={(e) =>
                          setFormData({ ...formData, end_date: e.target.value })
                        }
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Horário Início (opcional)</Label>
                      <Input
                        type="time"
                        value={formData.start_time}
                        onChange={(e) =>
                          setFormData({ ...formData, start_time: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Horário Fim (opcional)</Label>
                      <Input
                        type="time"
                        value={formData.end_time}
                        onChange={(e) =>
                          setFormData({ ...formData, end_time: e.target.value })
                        }
                      />
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={formData.active}
                      onCheckedChange={(checked) =>
                        setFormData({ ...formData, active: checked })
                      }
                    />
                    <Label>Ativa</Label>
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
            {promotions.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <Tag className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">
                    Nenhuma promoção cadastrada. Crie a primeira!
                  </p>
                </CardContent>
              </Card>
            ) : (
              promotions.map((promotion) => (
                <Card key={promotion.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <CardTitle className="flex items-center gap-2">
                          {promotion.name}
                          {promotion.active ? (
                            <Badge>Ativa</Badge>
                          ) : (
                            <Badge variant="secondary">Inativa</Badge>
                          )}
                        </CardTitle>
                        {promotion.description && (
                          <p className="text-sm text-muted-foreground">
                            {promotion.description}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEdit(promotion)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDelete(promotion.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Tipo</p>
                        <p className="font-medium capitalize">{promotion.type}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Alvo</p>
                        <p className="font-medium">
                          <TargetNameDisplay promotion={promotion} />
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Desconto</p>
                        <p className="font-medium">
                          {promotion.discount_type === "percentage"
                            ? `${promotion.discount_value}%`
                            : promotion.discount_type === "fixed_per_product"
                            ? "Valor fixo por produto"
                            : `R$ ${promotion.discount_value.toFixed(2)}`}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Período</p>
                        <p className="font-medium">
                          {new Date(promotion.start_date).toLocaleDateString("pt-BR")} até{" "}
                          {new Date(promotion.end_date).toLocaleDateString("pt-BR")}
                        </p>
                      </div>
                      {(promotion.start_time || promotion.end_time) && (
                        <div>
                          <p className="text-muted-foreground">Horário</p>
                          <p className="font-medium">
                            {promotion.start_time || "00:00"} -{" "}
                            {promotion.end_time || "23:59"}
                          </p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
    </div>
  );
}