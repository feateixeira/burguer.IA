import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Trash2, ArrowRight, Package } from "lucide-react";
import { useConfirm } from "@/hooks/useConfirm";

interface PrinterRoute {
  id: string;
  printer_id: string;
  category_id: string | null;
  product_id: string | null;
  printer: {
    name: string;
    location: string | null;
  };
  category?: {
    name: string;
  };
  product?: {
    name: string;
  };
}

interface Printer {
  id: string;
  name: string;
  location: string | null;
}

interface Category {
  id: string;
  name: string;
}

interface Product {
  id: string;
  name: string;
}

export function PrinterRouting({ establishmentId }: { establishmentId: string }) {
  const confirmDialog = useConfirm();
  const [routes, setRoutes] = useState<PrinterRoute[]>([]);
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    printer_id: '',
    route_type: 'category' as 'category' | 'product',
    category_id: '',
    product_id: ''
  });

  useEffect(() => {
    loadData();
  }, [establishmentId]);

  const loadData = async () => {
    try {
      // Load printers
      const { data: printersData } = await supabase
        .from('printers')
        .select('id, name, location')
        .eq('establishment_id', establishmentId)
        .eq('active', true)
        .order('name');

      // Load categories
      const { data: categoriesData } = await supabase
        .from('categories')
        .select('id, name')
        .eq('establishment_id', establishmentId)
        .eq('active', true)
        .order('name');

      // Load products
      const { data: productsData } = await supabase
        .from('products')
        .select('id, name')
        .eq('establishment_id', establishmentId)
        .eq('active', true)
        .order('name');

      // Load routes
      const { data: routesData } = await supabase
        .from('printer_routing')
        .select(`
          *,
          printer:printers(name, location),
          category:categories(name),
          product:products(name)
        `)
        .eq('establishment_id', establishmentId);

      setPrinters(printersData || []);
      setCategories(categoriesData || []);
      setProducts(productsData || []);
      setRoutes(routesData || []);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.printer_id) {
      toast.error('Selecione uma impressora');
      return;
    }

    if (formData.route_type === 'category' && !formData.category_id) {
      toast.error('Selecione uma categoria');
      return;
    }

    if (formData.route_type === 'product' && !formData.product_id) {
      toast.error('Selecione um produto');
      return;
    }

    try {
      const { error } = await supabase
        .from('printer_routing')
        .insert([{
          establishment_id: establishmentId,
          printer_id: formData.printer_id,
          category_id: formData.route_type === 'category' ? formData.category_id : null,
          product_id: formData.route_type === 'product' ? formData.product_id : null
        }]);

      if (error) throw error;

      toast.success('Rota de impressão criada com sucesso');
      setDialogOpen(false);
      resetForm();
      loadData();
    } catch (error: any) {
      console.error('Error creating route:', error);
      if (error.code === '23505') {
        toast.error('Esta rota já existe');
      } else {
        toast.error('Erro ao criar rota de impressão');
      }
    }
  };

  const handleDelete = async (id: string) => {
    const ok = await confirmDialog({ title: 'Excluir rota', description: 'Deseja realmente excluir esta rota?' });
    if (!ok) return;

    try {
      const { error } = await supabase
        .from('printer_routing')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Rota excluída com sucesso');
      loadData();
    } catch (error) {
      console.error('Error deleting route:', error);
      toast.error('Erro ao excluir rota');
    }
  };

  const resetForm = () => {
    setFormData({
      printer_id: '',
      route_type: 'category',
      category_id: '',
      product_id: ''
    });
  };

  if (loading) {
    return <div className="text-center py-8">Carregando rotas...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Roteamento de Impressão</h3>
          <p className="text-sm text-muted-foreground">
            Configure quais produtos ou categorias imprimem em cada impressora
          </p>
        </div>
        <Button onClick={() => { resetForm(); setDialogOpen(true); }} disabled={printers.length === 0}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Rota
        </Button>
      </div>

      {printers.length === 0 ? (
        <Card>
          <CardContent className="text-center py-8">
            <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">
              Cadastre impressoras antes de configurar rotas
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {routes.map((route) => (
            <Card key={route.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 flex-1">
                    <div className="flex-1">
                      <Badge variant="outline">
                        {route.category ? route.category.name : route.product?.name}
                      </Badge>
                      <p className="text-xs text-muted-foreground mt-1">
                        {route.category ? 'Categoria' : 'Produto'}
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    <div className="flex-1">
                      <div className="font-medium">{route.printer.name}</div>
                      {route.printer.location && (
                        <p className="text-xs text-muted-foreground">{route.printer.location}</p>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(route.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}

          {routes.length === 0 && (
            <Card>
              <CardContent className="text-center py-8">
                <p className="text-muted-foreground mb-4">
                  Nenhuma rota configurada
                </p>
                <p className="text-sm text-muted-foreground">
                  Configure rotas para direcionar impressões para impressoras específicas
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Rota de Impressão</DialogTitle>
            <DialogDescription>
              Configure para onde os pedidos devem ser impressos
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Impressora *</Label>
              <Select
                value={formData.printer_id}
                onValueChange={(value) => setFormData({ ...formData, printer_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a impressora" />
                </SelectTrigger>
                <SelectContent>
                  {printers.map((printer) => (
                    <SelectItem key={printer.id} value={printer.id}>
                      {printer.name} {printer.location && `(${printer.location})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Tipo de Rota *</Label>
              <Select
                value={formData.route_type}
                onValueChange={(value: 'category' | 'product') => 
                  setFormData({ ...formData, route_type: value, category_id: '', product_id: '' })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="category">Por Categoria</SelectItem>
                  <SelectItem value="product">Por Produto</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.route_type === 'category' && (
              <div className="space-y-2">
                <Label>Categoria *</Label>
                <Select
                  value={formData.category_id}
                  onValueChange={(value) => setFormData({ ...formData, category_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a categoria" />
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

            {formData.route_type === 'product' && (
              <div className="space-y-2">
                <Label>Produto *</Label>
                <Select
                  value={formData.product_id}
                  onValueChange={(value) => setFormData({ ...formData, product_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o produto" />
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

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit">
                Criar Rota
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
