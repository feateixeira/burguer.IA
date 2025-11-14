import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  FileText,
  Package,
  TrendingUp,
  Download,
} from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Product {
  id: string;
  name: string;
  category_id: string | null;
}

interface Category {
  id: string;
  name: string;
}

interface SalesReportItem {
  category_id: string | null;
  category_name: string;
  product_id: string;
  product_name: string;
  total_quantity: number;
  total_revenue: number;
  unit_price: number;
}

const Reports = () => {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [reportData, setReportData] = useState<SalesReportItem[]>([]);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (profile && products.length > 0 && categories.length >= 0) {
      loadReportData();
    }
  }, [profile, products, categories]);

  // Função para atualizar produtos existentes sem categoria
  const updateProductsCategories = async (establishmentId: string) => {
    try {
      // Buscar ou criar categoria "Combos"
      let combosCategoryId: string | null = null;
      const { data: existingCombosCategory } = await supabase
        .from("categories")
        .select("id")
        .eq("establishment_id", establishmentId)
        .eq("name", "Combos")
        .eq("active", true)
        .maybeSingle();

      if (existingCombosCategory) {
        combosCategoryId = existingCombosCategory.id;
      } else {
        const { data: newCombosCategory } = await supabase
          .from("categories")
          .insert({
            establishment_id: establishmentId,
            name: "Combos",
            description: "Combos e promoções",
            active: true,
            sort_order: 999,
          })
          .select("id")
          .single();
        if (newCombosCategory) {
          combosCategoryId = newCombosCategory.id;
        }
      }

      // Buscar ou criar categoria "Adicionais"
      let addonsCategoryId: string | null = null;
      const { data: existingAddonsCategory } = await supabase
        .from("categories")
        .select("id")
        .eq("establishment_id", establishmentId)
        .eq("name", "Adicionais")
        .eq("active", true)
        .maybeSingle();

      if (existingAddonsCategory) {
        addonsCategoryId = existingAddonsCategory.id;
      } else {
        const { data: newAddonsCategory } = await supabase
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
        if (newAddonsCategory) {
          addonsCategoryId = newAddonsCategory.id;
        }
      }

      // Atualizar produtos com is_combo = true que não têm categoria
      if (combosCategoryId) {
        await supabase
          .from("products")
          .update({ category_id: combosCategoryId })
          .eq("establishment_id", establishmentId)
          .eq("is_combo", true)
          .is("category_id", null);
      }

      // Buscar todos os adicionais para comparar com produtos
      const { data: addons } = await supabase
        .from("addons")
        .select("name")
        .eq("establishment_id", establishmentId);

      if (addons && addons.length > 0 && addonsCategoryId) {
        const addonNames = new Set(addons.map(a => a.name.toLowerCase().trim()));
        
        // Buscar produtos sem categoria que não são combos
        const { data: productsWithoutCategory } = await supabase
          .from("products")
          .select("id, name, is_combo")
          .eq("establishment_id", establishmentId)
          .is("category_id", null);
        
        // Filtrar apenas produtos que não são combos
        const nonComboProducts = productsWithoutCategory?.filter(
          p => !p.is_combo
        ) || [];

        // Atualizar apenas produtos cujo nome corresponde exatamente a um adicional
        const productsToUpdate = nonComboProducts.filter(
          p => addonNames.has(p.name.toLowerCase().trim())
        );

        if (productsToUpdate.length > 0) {
          const productIds = productsToUpdate.map(p => p.id);
          await supabase
            .from("products")
            .update({ category_id: addonsCategoryId })
            .in("id", productIds);
        }
      }
    } catch (error) {
      // Silenciosamente falhar - não queremos interromper o carregamento
    }
  };

  const loadInitialData = async () => {
    try {
      setLoading(true);
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: profileData } = await supabase
        .from("profiles")
        .select("*, establishment_id")
        .eq("user_id", session.user.id)
        .single();
      
      if (profileData) {
        setProfile(profileData);
        
        // Atualizar produtos existentes sem categoria
        await updateProductsCategories(profileData.establishment_id);
        
        // Load ALL products (active and inactive)
        const { data: productsData } = await supabase
          .from("products")
          .select("id, name, category_id")
          .eq("establishment_id", profileData.establishment_id)
          .order("name");
        
        if (productsData) {
          setProducts(productsData);
        }
        
        // Load categories
        const { data: categoriesData } = await supabase
          .from("categories")
          .select("id, name")
          .eq("establishment_id", profileData.establishment_id)
          .eq("active", true)
          .order("name");
        
        if (categoriesData) {
          setCategories(categoriesData);
        }
      }
    } catch (error) {
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  const loadReportData = async () => {
    if (!profile) return;

    try {
      setLoading(true);

      // Get current month range
      const now = new Date();
      const startDate = startOfMonth(now);
      const endDate = endOfMonth(now);

      // Get orders in the current month
      const { data: orders, error: ordersError } = await supabase
        .from("orders")
        .select("id")
        .eq("establishment_id", profile.establishment_id)
        .eq("status", "completed")
        .gte("created_at", startDate.toISOString())
        .lte("created_at", endDate.toISOString());

      if (ordersError) {
        throw ordersError;
      }

      const orderIds = orders?.map((o) => o.id) || [];

      // Get order items for current month
      let orderItems: any[] = [];
      if (orderIds.length > 0) {
        const { data: items, error: itemsError } = await supabase
          .from("order_items")
          .select("id, product_id, quantity, unit_price, total_price")
          .in("order_id", orderIds)
          .not("product_id", "is", null);

        if (itemsError) {
          throw itemsError;
        }

        orderItems = items || [];
      }

      // Get all categories (ensure they're loaded)
      const categoryMap = new Map<string, string>();
      if (categories.length > 0) {
        categories.forEach((cat) => {
          categoryMap.set(cat.id, cat.name);
        });
      }

      // Create a map of sales by product_id
      const salesMap = new Map<string, { quantity: number; revenue: number; unit_price: number }>();

      orderItems.forEach((item: any) => {
        if (!item.product_id) return;

        const productId = item.product_id;
        if (salesMap.has(productId)) {
          const existing = salesMap.get(productId)!;
          existing.quantity += item.quantity || 0;
          existing.revenue += parseFloat(item.total_price) || 0;
        } else {
          salesMap.set(productId, {
            quantity: item.quantity || 0,
            revenue: parseFloat(item.total_price) || 0,
            unit_price: parseFloat(item.unit_price) || 0,
          });
        }
      });

      // Create report data for ALL products
      const reportArray: SalesReportItem[] = products.map((product) => {
        const sales = salesMap.get(product.id);
        const categoryId = product.category_id || null;
        const categoryName = categoryId
          ? categoryMap.get(categoryId) || "Sem Categoria"
          : "Sem Categoria";

        return {
          category_id: categoryId,
          category_name: categoryName,
          product_id: product.id,
          product_name: product.name,
          total_quantity: sales?.quantity || 0,
          total_revenue: sales?.revenue || 0,
          unit_price: sales && sales.quantity > 0 
            ? sales.revenue / sales.quantity 
            : sales?.unit_price || 0,
        };
      });

      // Sort by category name, then by quantity sold (descending - most sold first)
      reportArray.sort((a, b) => {
        if (a.category_name !== b.category_name) {
          return a.category_name.localeCompare(b.category_name);
        }
        // Within same category, sort by quantity (descending - most sold first)
        return b.total_quantity - a.total_quantity;
      });

      setReportData(reportArray);
    } catch (error: any) {
      toast.error(error.message || "Erro ao carregar relatório");
    } finally {
      setLoading(false);
    }
  };

  const getCurrentMonthLabel = () => {
    return format(new Date(), "MMMM yyyy", { locale: ptBR });
  };

  const getTotalQuantity = () => {
    return reportData.reduce((sum, item) => sum + item.total_quantity, 0);
  };

  const getTotalRevenue = () => {
    return reportData.reduce((sum, item) => sum + item.total_revenue, 0);
  };

  const exportToCSV = () => {
    const headers = ["Categoria", "Produto", "Quantidade", "Receita Total (R$)", "Preço Unitário (R$)"];
    const rows = reportData.map((item) => [
      item.category_name,
      item.product_name,
      item.total_quantity.toString(),
      item.total_revenue.toFixed(2).replace(".", ","),
      item.unit_price.toFixed(2).replace(".", ","),
    ]);

    const csvContent = [
      headers.join(";"),
      ...rows.map((row) => row.join(";")),
    ].join("\n");

    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `relatorio-vendas-${format(new Date(), "yyyy-MM-dd")}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Group data by category for display
  // Items are already sorted by quantity within each category
  const groupedByCategory = reportData.reduce((acc, item) => {
    const categoryName = item.category_name;
    if (!acc[categoryName]) {
      acc[categoryName] = [];
    }
    acc[categoryName].push(item);
    return acc;
  }, {} as Record<string, SalesReportItem[]>);
  
  // Ensure items within each category are sorted by quantity (descending)
  Object.keys(groupedByCategory).forEach((categoryName) => {
    groupedByCategory[categoryName].sort((a, b) => b.total_quantity - a.total_quantity);
  });

  if (loading && reportData.length === 0) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-muted-foreground">Carregando relatório...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="h-6 w-6" />
            Relatórios de Vendas
          </h2>
          <p className="text-muted-foreground mt-1">
            Vendas do mês atual - Todos os produtos cadastrados
          </p>
        </div>
        {reportData.length > 0 && (
          <Button onClick={exportToCSV} variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Exportar CSV
          </Button>
        )}
      </div>

      {/* Summary Cards */}
      {reportData.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Mês Atual
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold capitalize">{getCurrentMonthLabel()}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Package className="h-4 w-4" />
                Total de Itens Vendidos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{getTotalQuantity()}</div>
              <p className="text-xs text-muted-foreground mt-1">unidades</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Receita Total
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                R$ {getTotalRevenue().toFixed(2).replace(".", ",")}
              </div>
              <p className="text-xs text-muted-foreground mt-1">no mês</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Report Data */}
      {reportData.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground">
              Nenhum produto cadastrado.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedByCategory).map(([categoryName, items]) => (
            <Card key={categoryName}>
              <CardHeader>
                <CardTitle className="text-lg">{categoryName}</CardTitle>
                <CardDescription>
                  {items.length} {items.length === 1 ? "produto" : "produtos"} nesta categoria
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produto</TableHead>
                      <TableHead className="text-right">Quantidade</TableHead>
                      <TableHead className="text-right">Preço Unitário</TableHead>
                      <TableHead className="text-right">Receita Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item) => (
                      <TableRow key={item.product_id}>
                        <TableCell className="font-medium">
                          {item.product_name}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant="secondary">{item.total_quantity}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          R$ {item.unit_price.toFixed(2).replace(".", ",")}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          R$ {item.total_revenue.toFixed(2).replace(".", ",")}
                        </TableCell>
                      </TableRow>
                    ))}
                    {/* Category Total */}
                    <TableRow className="bg-muted/50 font-semibold">
                      <TableCell>Total da Categoria</TableCell>
                      <TableCell className="text-right">
                        <Badge>
                          {items.reduce((sum, item) => sum + item.total_quantity, 0)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">-</TableCell>
                      <TableCell className="text-right">
                        R$ {items
                          .reduce((sum, item) => sum + item.total_revenue, 0)
                          .toFixed(2)
                          .replace(".", ",")}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default Reports;

