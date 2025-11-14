import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, DollarSign, Package, TrendingUp, Calculator } from "lucide-react";
import { FixedCostsSection } from "@/components/costs/FixedCostsSection";
import { IngredientsSection } from "@/components/costs/IngredientsSection";
import { ProductCostsSection } from "@/components/costs/ProductCostsSection";
import { CostsDashboard } from "@/components/costs/CostsDashboard";
import { useToast } from "@/components/ui/use-toast";

interface FixedCost {
  id: string;
  name: string;
  amount: number;
  start_date: string;
  recurrence: 'monthly' | 'yearly' | 'one_time';
  active: boolean;
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

const Costs = () => {
  const [loading, setLoading] = useState(true);
  const [establishmentId, setEstablishmentId] = useState<string | null>(null);
  const [fixedCosts, setFixedCosts] = useState<FixedCost[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        window.location.href = '/';
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('establishment_id')
        .eq('user_id', session.user.id)
        .single();

      if (profile?.establishment_id) {
        setEstablishmentId(profile.establishment_id);
        await loadData(profile.establishment_id);
      }
    } catch (error) {
      console.error('Error checking auth:', error);
      toast({
        title: "Error",
        description: "Failed to load user data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadData = async (estId: string) => {
    try {
      // Load fixed costs
      const { data: fixedCostsData, error: fixedCostsError } = await supabase
        .from('fixed_costs')
        .select('*')
        .eq('establishment_id', estId)
        .eq('active', true)
        .order('name');

      if (fixedCostsError) throw fixedCostsError;
      setFixedCosts((fixedCostsData || []) as FixedCost[]);

      // Load ingredients
      const { data: ingredientsData, error: ingredientsError } = await supabase
        .from('ingredients')
        .select('*')
        .eq('establishment_id', estId)
        .eq('active', true)
        .order('name');

      if (ingredientsError) throw ingredientsError;
      setIngredients(ingredientsData || []);

    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: "Error",
        description: "Failed to load costs data",
        variant: "destructive",
      });
    }
  };

  const totalFixedCosts = fixedCosts.reduce((sum, cost) => {
    if (cost.recurrence === 'monthly') return sum + cost.amount;
    if (cost.recurrence === 'yearly') return sum + (cost.amount / 12);
    return sum; // one_time costs are not included in monthly totals
  }, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-full">Loading...</div>
      </div>
    );
  }

  return (
    <div className="w-full">
        <div className="w-full">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold">Gestão de Custos</h1>
            <p className="text-muted-foreground">
              Gerencie custos fixos, variáveis e calcule preços de venda
            </p>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Custos Fixos Mensais
              </CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                R$ {totalFixedCosts.toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground">
                {fixedCosts.length} itens cadastrados
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Ingredientes
              </CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{ingredients.length}</div>
              <p className="text-xs text-muted-foreground">
                Itens cadastrados
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Custo Médio por Ingrediente
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                R$ {ingredients.length > 0 
                  ? (ingredients.reduce((sum, ing) => sum + ing.unit_cost, 0) / ingredients.length).toFixed(2)
                  : '0.00'
                }
              </div>
              <p className="text-xs text-muted-foreground">
                Por unidade
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Investido
              </CardTitle>
              <Calculator className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                R$ {ingredients.reduce((sum, ing) => sum + ing.total_cost, 0).toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground">
                Em ingredientes
              </p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="dashboard" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="fixed">Custos Fixos</TabsTrigger>
            <TabsTrigger value="ingredients">Ingredientes</TabsTrigger>
            <TabsTrigger value="products">Produtos</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="mt-6">
            <CostsDashboard 
              fixedCosts={fixedCosts}
              ingredients={ingredients}
              establishmentId={establishmentId}
            />
          </TabsContent>

          <TabsContent value="fixed" className="mt-6">
            <FixedCostsSection 
              fixedCosts={fixedCosts}
              establishmentId={establishmentId}
              onUpdate={() => establishmentId && loadData(establishmentId)}
            />
          </TabsContent>

          <TabsContent value="ingredients" className="mt-6">
            <IngredientsSection 
              ingredients={ingredients}
              establishmentId={establishmentId}
              onUpdate={() => establishmentId && loadData(establishmentId)}
            />
          </TabsContent>

          <TabsContent value="products" className="mt-6">
            <ProductCostsSection 
              establishmentId={establishmentId}
              ingredients={ingredients}
            />
          </TabsContent>
        </Tabs>
        </div>
    </div>
  );
};

export default Costs;