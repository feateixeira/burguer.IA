import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Edit, Trash2, Package, HelpCircle, ExternalLink } from "lucide-react";
import Sidebar from "@/components/Sidebar";
import CombosManager from "@/components/CombosManager";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface Product {
  id: string;
  name: string;
  description?: string;
  price: number;
  active: boolean;
  category_id?: string;
  image_url?: string | null;
}

interface Category {
  id: string;
  name: string;
  description?: string;
}

function CategoryManager({ categories, onRefresh, establishmentId }) {
  const [isOpen, setIsOpen] = useState(false);
  const [newCat, setNewCat] = useState("");
  const [editingCat, setEditingCat] = useState<Category | null>(null);

  const handleAdd = async () => {
    if (!newCat.trim()) return toast.error("Digite o nome da categoria");
    const { error } = await supabase.from("categories").insert({
      name: newCat,
      establishment_id: establishmentId,
      active: true,
      sort_order: categories.length + 1
    });
    if (error) return toast.error(error.message);
    setNewCat("");
    onRefresh();
  };

  const handleDelete = async (cat: Category) => {
    if (!window.confirm(`Excluir categoria ${cat.name}?`)) return;
    const { error } = await supabase.from("categories").delete().eq('id', cat.id);
    if (error) return toast.error(error.message);
    onRefresh();
  };

  const handleEdit = async () => {
    if (!editingCat || !editingCat.name.trim()) return;
    const { error } = await supabase.from("categories").update({ name: editingCat.name }).eq("id", editingCat.id);
    if (error) return toast.error(error.message);
    setEditingCat(null);
    onRefresh();
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="ml-3">Gerenciar Categorias</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Categorias</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <div>
            <Label htmlFor="new-category">Nova Categoria</Label>
            <Input
              id="new-category"
              value={newCat}
              onChange={e => setNewCat(e.target.value)}
              placeholder="Nome da categoria"
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
            />
            <Button onClick={handleAdd} size="sm" className="mt-2">Adicionar</Button>
          </div>
          <div className="mt-4">
            <h4 className="font-bold">Suas Categorias:</h4>
            {categories.map(cat => (
              <div key={cat.id} className="flex items-center gap-2 py-1">
                {editingCat?.id === cat.id ? (
                  <>
                    <Input value={editingCat.name}
                      onChange={e => setEditingCat({ ...editingCat, name: e.target.value })} size="sm"
                    />
                    <Button size="sm" onClick={handleEdit}>Salvar</Button>
                    <Button size="sm" variant="outline" onClick={() => setEditingCat(null)}>Cancelar</Button>
                  </>
                ) : (
                  <>
                    <span>{cat.name}</span>
                    <Button size="sm" variant="ghost" onClick={() => setEditingCat(cat)}>Editar</Button>
                    <Button size="sm" variant="destructive" onClick={() => handleDelete(cat)}>Excluir</Button>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const Products = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [establishmentId, setEstablishmentId] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Get establishment ID
      const { data: profile } = await supabase
        .from("profiles")
        .select("establishment_id")
        .eq("user_id", session.user.id)
        .single();

      if (!profile?.establishment_id) return;
      
      setEstablishmentId(profile.establishment_id);

      // Load products and categories
      const [productsResult, categoriesResult] = await Promise.all([
        supabase
          .from("products")
          .select("*")
          .eq("establishment_id", profile.establishment_id)
          .order("name"),
        supabase
          .from("categories")
          .select("*")
          .eq("establishment_id", profile.establishment_id)
          .order("name")
      ]);

      if (productsResult.error) throw productsResult.error;
      if (categoriesResult.error) throw categoriesResult.error;

      setProducts(productsResult.data || []);
      setCategories(categoriesResult.data || []);
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const productData = {
      name: formData.get("name") as string,
      description: formData.get("description") as string || null,
      price: parseFloat(formData.get("price") as string),
      category_id: formData.get("category_id") as string || null,
      image_url: (formData.get("image_url") as string) || null,
      establishment_id: establishmentId,
      active: true
    };

    try {
      if (editingProduct) {
        const { error } = await supabase
          .from("products")
          .update(productData)
          .eq("id", editingProduct.id);

        if (error) throw error;
        toast.success("Produto atualizado com sucesso!");
      } else {
        const { error } = await supabase
          .from("products")
          .insert(productData);

        if (error) throw error;
        toast.success("Produto criado com sucesso!");
      }

      setIsDialogOpen(false);
      setEditingProduct(null);
      loadData();
    } catch (error) {
      console.error("Error saving product:", error);
      toast.error("Erro ao salvar produto");
    }
  };

  const handleDelete = async (product: Product) => {
    if (!confirm(`Tem certeza que deseja excluir "${product.name}"?`)) return;

    try {
      const { error } = await supabase
        .from("products")
        .delete()
        .eq("id", product.id);

      if (error) throw error;
      
      toast.success("Produto excluído com sucesso!");
      loadData();
    } catch (error) {
      console.error("Error deleting product:", error);
      toast.error("Erro ao excluir produto");
    }
  };

  const openEditDialog = (product: Product) => {
    setEditingProduct(product);
    setIsDialogOpen(true);
  };

  const openCreateDialog = () => {
    setEditingProduct(null);
    setIsDialogOpen(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
          <p className="mt-4 text-muted-foreground">Carregando produtos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar />
      
      <main className="flex-1 p-6">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold text-foreground mb-6">Produtos e Combos</h1>
          
          <Tabs defaultValue="products" className="w-full">
            <TabsList className="grid w-full max-w-md grid-cols-2">
              <TabsTrigger value="products">Produtos</TabsTrigger>
              <TabsTrigger value="combos">Combos</TabsTrigger>
            </TabsList>

            <TabsContent value="products" className="space-y-4">
              <div className="flex justify-between items-center">
                <p className="text-muted-foreground">
                  Gerencie os produtos do seu estabelecimento
                </p>
                <div className="flex items-center">
                  <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                      <Button onClick={openCreateDialog}>
                        <Plus className="h-4 w-4 mr-2" />
                        Adicionar Produto
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>
                          {editingProduct ? "Editar Produto" : "Novo Produto"}
                        </DialogTitle>
                      </DialogHeader>
                      <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                          <Label htmlFor="name">Nome</Label>
                          <Input
                            id="name"
                            name="name"
                            defaultValue={editingProduct?.name || ""}
                            required
                          />
                        </div>
                        <div>
                          <Label htmlFor="description">Descrição</Label>
                          <Textarea
                            id="description"
                            name="description"
                            defaultValue={editingProduct?.description || ""}
                          />
                        </div>
                        <div>
                          <Label htmlFor="price">Preço</Label>
                          <Input
                            id="price"
                            name="price"
                            type="number"
                            step="0.01"
                            defaultValue={editingProduct?.price || ""}
                            required
                          />
                        </div>
                        <div>
                          <Label htmlFor="category_id">Categoria</Label>
                          <select
                            id="category_id"
                            name="category_id"
                            defaultValue={editingProduct?.category_id || ""}
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <option value="">Selecionar categoria</option>
                            {categories.map((category) => (
                              <option key={category.id} value={category.id}>
                                {category.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <Label htmlFor="image_url">Imagem do Produto (URL)</Label>
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0">
                                  <HelpCircle className="h-4 w-4" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-80">
                                <Alert>
                                  <HelpCircle className="h-4 w-4" />
                                  <AlertTitle>Como adicionar imagem usando Imgur</AlertTitle>
                                  <AlertDescription className="space-y-2 mt-2">
                                    <ol className="list-decimal list-inside space-y-2 text-sm">
                                      <li>Acesse <a href="https://imgur.com/upload" target="_blank" rel="noopener noreferrer" className="text-primary underline inline-flex items-center gap-1">imgur.com/upload <ExternalLink className="h-3 w-3" /></a></li>
                                      <li>Arraste sua imagem ou clique em "Escolher imagens"</li>
                                      <li>Após o upload, clique com botão direito na imagem</li>
                                      <li>Selecione "Copiar link da imagem" ou "Copy image address"</li>
                                      <li>Cole o link aqui (deve começar com https://i.imgur.com/...)</li>
                                    </ol>
                                    <p className="text-xs text-muted-foreground mt-3">
                                      <strong>Dica:</strong> Use imagens quadradas (1:1) para melhor visualização no totem. 
                                      O tamanho ideal é 500x500px ou 800x800px.
                                    </p>
                                  </AlertDescription>
                                </Alert>
                              </PopoverContent>
                            </Popover>
                          </div>
                          <Input
                            id="image_url"
                            name="image_url"
                            type="url"
                            placeholder="https://i.imgur.com/exemplo.jpg"
                            defaultValue={editingProduct?.image_url || ""}
                          />
                          {editingProduct?.image_url && (
                            <div className="mt-2">
                              <img 
                                src={editingProduct.image_url} 
                                alt="Preview" 
                                className="w-24 h-24 object-cover rounded-md border"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = 'none';
                                }}
                              />
                            </div>
                          )}
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
                            {editingProduct ? "Atualizar" : "Criar"}
                          </Button>
                        </div>
                      </form>
                    </DialogContent>
                  </Dialog>
                  <CategoryManager
                    categories={categories}
                    onRefresh={loadData}
                    establishmentId={establishmentId}
                  />
                </div>
              </div>

              {/* Busca de produtos */}
              <div className="flex justify-end">
                <div className="relative w-full max-w-sm">
                  <Input
                    placeholder="Buscar por nome ou descrição..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-3"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {products
                  .filter(p => {
                    if (!searchTerm.trim()) return true;
                    const t = searchTerm.toLowerCase();
                    return (
                      p.name.toLowerCase().includes(t) ||
                      (p.description || "").toLowerCase().includes(t)
                    );
                  })
                  .map((product) => (
                  <Card key={product.id}>
                    <CardHeader className="pb-2">
                      {product.image_url && (
                        <div className="aspect-square rounded-md overflow-hidden bg-muted mb-2">
                          <img
                            src={product.image_url}
                            alt={product.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        </div>
                      )}
                      <CardTitle className="text-lg">{product.name}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {product.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {product.description}
                          </p>
                        )}
                        <p className="text-lg font-semibold">
                          R$ {product.price.toFixed(2)}
                        </p>
                        <div className="flex justify-between pt-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditDialog(product)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDelete(product)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {products.length === 0 && (
                <Card>
                  <CardContent className="text-center py-12">
                    <Package className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Nenhum produto cadastrado</h3>
                    <p className="text-muted-foreground">
                      Os produtos serão carregados automaticamente pelo sistema.
                    </p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="combos">
              <CombosManager establishmentId={establishmentId} />
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
};

export default Products;