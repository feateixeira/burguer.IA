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
import { Plus, Pencil, Trash2, Tag } from "lucide-react";
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
          .select("id, name")
          .eq("establishment_id", profile.establishment_id)
          .eq("active", true),
        supabase
          .from("categories")
          .select("id, name")
          .eq("establishment_id", profile.establishment_id)
          .eq("active", true),
      ]);

      setPromotions(promotionsRes.data || []);
      setProducts(productsRes.data || []);
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

    try {
      const promotionData = {
        ...formData,
        establishment_id: establishmentId,
        target_id: formData.type === "global" ? null : formData.target_id || null,
        start_time: formData.start_time || null,
        end_time: formData.end_time || null,
      };

      if (editingPromotion) {
        const { error } = await supabase
          .from("promotions")
          .update(promotionData)
          .eq("id", editingPromotion.id);

        if (error) throw error;
        toast.success("Promoção atualizada!");
      } else {
        const { error } = await supabase.from("promotions").insert(promotionData);
        if (error) throw error;
        toast.success("Promoção criada!");
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

  const handleEdit = (promotion: Promotion) => {
    setEditingPromotion(promotion);
    setFormData({
      name: promotion.name,
      description: promotion.description || "",
      type: promotion.type,
      target_id: promotion.target_id || "",
      discount_type: promotion.discount_type,
      discount_value: promotion.discount_value,
      start_date: promotion.start_date,
      end_date: promotion.end_date,
      start_time: promotion.start_time || "",
      end_time: promotion.end_time || "",
      active: promotion.active,
    });
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
  };

  const getTargetName = (promotion: Promotion) => {
    if (promotion.type === "global") return "Global";
    if (promotion.type === "product") {
      const product = products.find((p) => p.id === promotion.target_id);
      return product?.name || "-";
    }
    if (promotion.type === "category") {
      const category = categories.find((c) => c.id === promotion.target_id);
      return category?.name || "-";
    }
    return "-";
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
                        onValueChange={(value) =>
                          setFormData({ ...formData, type: value, target_id: "" })
                        }
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
                      <Label>Produto *</Label>
                      <Select
                        value={formData.target_id}
                        onValueChange={(value) =>
                          setFormData({ ...formData, target_id: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione um produto" />
                        </SelectTrigger>
                        <SelectContent>
                          {products.map((product) => (
                            <SelectItem key={product.id} value={product.id}>
                              {product.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Tipo de Desconto *</Label>
                      <Select
                        value={formData.discount_type}
                        onValueChange={(value) =>
                          setFormData({ ...formData, discount_type: value })
                        }
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
                            discount_value: parseFloat(e.target.value),
                          })
                        }
                        placeholder={formData.discount_type === "percentage" ? "%" : "R$"}
                      />
                    </div>
                  </div>

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
                        <p className="font-medium">{getTargetName(promotion)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Desconto</p>
                        <p className="font-medium">
                          {promotion.discount_type === "percentage"
                            ? `${promotion.discount_value}%`
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