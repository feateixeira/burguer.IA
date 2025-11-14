import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Button } from "@/components/ui/button";
import { Download, TrendingUp, TrendingDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface FixedCost {
  id: string;
  name: string;
  amount: number;
  recurrence: 'monthly' | 'yearly' | 'one_time';
}

interface Ingredient {
  id: string;
  name: string;
  unit_cost: number;
  total_cost: number;
}

interface Product {
  id: string;
  name: string;
  price: number;
  variable_cost: number;
  profit_margin: number;
  suggested_price: number;
}

interface CostsDashboardProps {
  fixedCosts: FixedCost[];
  ingredients: Ingredient[];
  establishmentId: string | null;
}

export const CostsDashboard = ({ fixedCosts, ingredients, establishmentId }: CostsDashboardProps) => {
  const [products, setProducts] = useState<Product[]>([]);

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

  // Calculate monthly fixed costs
  const monthlyFixedCosts = fixedCosts.reduce((sum, cost) => {
    if (cost.recurrence === 'monthly') return sum + cost.amount;
    if (cost.recurrence === 'yearly') return sum + (cost.amount / 12);
    return sum;
  }, 0);

  // Calculate total invested in ingredients
  const totalIngredientsInvestment = ingredients.reduce((sum, ingredient) => 
    sum + ingredient.total_cost, 0
  );

  // Prepare data for pie chart (Fixed Costs breakdown)
  const fixedCostsPieData = fixedCosts.map(cost => ({
    name: cost.name,
    value: cost.recurrence === 'monthly' ? cost.amount : 
           cost.recurrence === 'yearly' ? cost.amount / 12 : 0,
    fill: `hsl(${Math.random() * 360}, 70%, 50%)`
  })).filter(item => item.value > 0);

  // Prepare data for bar chart (Product profitability)
  const productProfitabilityData = products
    .filter(p => p.variable_cost > 0)
    .map(product => {
      const profit = product.price - product.variable_cost;
      const profitMargin = product.price > 0 ? (profit / product.price) * 100 : 0;
      
      return {
        name: product.name.length > 15 ? product.name.substring(0, 15) + '...' : product.name,
        currentPrice: product.price,
        variableCost: product.variable_cost,
        suggestedPrice: product.suggested_price,
        profit: profit,
        profitMargin: profitMargin
      };
    })
    .sort((a, b) => b.profitMargin - a.profitMargin);

  // Most profitable and least profitable products
  const mostProfitable = productProfitabilityData[0];
  const leastProfitable = productProfitabilityData[productProfitabilityData.length - 1];

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

  const exportReport = () => {
    const reportData = {
      summary: {
        monthlyFixedCosts,
        totalIngredientsInvestment,
        totalProducts: products.length,
        productsWithCosts: products.filter(p => p.variable_cost > 0).length
      },
      fixedCosts,
      ingredients,
      products,
      generatedAt: new Date().toISOString()
    };

    const dataStr = JSON.stringify(reportData, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `costs-report-${new Date().toISOString().split('T')[0]}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Dashboard Financeiro</h2>
        <Button onClick={exportReport} variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Exportar Relatório
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Custos Fixos Mensais</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R$ {monthlyFixedCosts.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              {fixedCosts.length} itens
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Investimento em Ingredientes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R$ {totalIngredientsInvestment.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              {ingredients.length} ingredientes
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Produtos com Custos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {products.filter(p => p.variable_cost > 0).length}/{products.length}
            </div>
            <p className="text-xs text-muted-foreground">
              Produtos configurados
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Custo Médio por Produto</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              R$ {products.length > 0 
                ? (products.reduce((sum, p) => sum + p.variable_cost, 0) / products.length).toFixed(2)
                : '0.00'
              }
            </div>
            <p className="text-xs text-muted-foreground">
              Custo variável médio
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Fixed Costs Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Distribuição dos Custos Fixos</CardTitle>
          </CardHeader>
          <CardContent>
            {fixedCostsPieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={fixedCostsPieData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {fixedCostsPieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => `R$ ${value.toFixed(2)}`} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                Nenhum custo fixo cadastrado
              </div>
            )}
          </CardContent>
        </Card>

        {/* Product Profitability Bar Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Rentabilidade dos Produtos</CardTitle>
          </CardHeader>
          <CardContent>
            {productProfitabilityData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={productProfitabilityData.slice(0, 8)}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="name" 
                    fontSize={12}
                    angle={-45}
                    textAnchor="end"
                    height={80}
                  />
                  <YAxis />
                  <Tooltip 
                    formatter={(value: number, name: string) => {
                      if (name === 'profitMargin') return [`${value.toFixed(1)}%`, 'Margem de Lucro'];
                      return [`R$ ${value.toFixed(2)}`, name === 'currentPrice' ? 'Preço Atual' : 
                              name === 'variableCost' ? 'Custo Variável' : 'Preço Sugerido'];
                    }}
                  />
                  <Legend />
                  <Bar dataKey="currentPrice" fill="#8884d8" name="Preço Atual" />
                  <Bar dataKey="variableCost" fill="#82ca9d" name="Custo Variável" />
                  <Bar dataKey="suggestedPrice" fill="#ffc658" name="Preço Sugerido" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                Configure os custos dos produtos primeiro
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top/Bottom Performers */}
      {productProfitabilityData.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {mostProfitable && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <TrendingUp className="h-5 w-5 mr-2 text-green-500" />
                  Produto Mais Rentável
                </CardTitle>
              </CardHeader>
              <CardContent>
                <h3 className="text-lg font-semibold mb-2">{mostProfitable.name}</h3>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Preço atual:</span>
                    <span>R$ {mostProfitable.currentPrice.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Custo variável:</span>
                    <span>R$ {mostProfitable.variableCost.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Lucro por unidade:</span>
                    <span className="text-green-600 font-medium">R$ {mostProfitable.profit.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Margem de lucro:</span>
                    <span className="text-green-600 font-bold">{mostProfitable.profitMargin.toFixed(1)}%</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {leastProfitable && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <TrendingDown className="h-5 w-5 mr-2 text-red-500" />
                  Produto Menos Rentável
                </CardTitle>
              </CardHeader>
              <CardContent>
                <h3 className="text-lg font-semibold mb-2">{leastProfitable.name}</h3>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Preço atual:</span>
                    <span>R$ {leastProfitable.currentPrice.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Custo variável:</span>
                    <span>R$ {leastProfitable.variableCost.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Lucro por unidade:</span>
                    <span className={`font-medium ${leastProfitable.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      R$ {leastProfitable.profit.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Margem de lucro:</span>
                    <span className={`font-bold ${leastProfitable.profitMargin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {leastProfitable.profitMargin.toFixed(1)}%
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
};