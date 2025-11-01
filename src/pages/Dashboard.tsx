import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Area,
  AreaChart,
  ComposedChart
} from "recharts";
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  ShoppingCart, 
  Users, 
  Clock,
  Package,
  Target,
  Zap,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  CreditCard,
  Eye,
  MoreHorizontal,
  LogOut,
  Settings,
  Receipt,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Star,
  MapPin,
  Phone,
  Mail,
  Percent,
  Gift,
  Truck
} from "lucide-react";
import Sidebar from "@/components/Sidebar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useSidebarWidth } from "@/hooks/useSidebarWidth";

// Dados mock zerados inicialmente
const salesData = [
  { name: 'Jan', vendas: 0, pedidos: 0, meta: 15000 },
  { name: 'Fev', vendas: 0, pedidos: 0, meta: 15000 },
  { name: 'Mar', vendas: 0, pedidos: 0, meta: 15000 },
  { name: 'Abr', vendas: 0, pedidos: 0, meta: 15000 },
  { name: 'Mai', vendas: 0, pedidos: 0, meta: 15000 },
  { name: 'Jun', vendas: 0, pedidos: 0, meta: 15000 },
];

const dailyData = [
  { hora: '08:00', valor: 0, pedidos: 0 },
  { hora: '10:00', valor: 0, pedidos: 0 },
  { hora: '12:00', valor: 0, pedidos: 0 },
  { hora: '14:00', valor: 0, pedidos: 0 },
  { hora: '16:00', valor: 0, pedidos: 0 },
  { hora: '18:00', valor: 0, pedidos: 0 },
  { hora: '20:00', valor: 0, pedidos: 0 },
  { hora: '22:00', valor: 0, pedidos: 0 },
];

const categoryData = [
  { name: 'Lanches', value: 0, color: '#8884d8' },
  { name: 'Bebidas', value: 0, color: '#82ca9d' },
  { name: 'Sobremesas', value: 0, color: '#ffc658' },
  { name: 'Acompanhamentos', value: 0, color: '#ff7300' },
];

const recentOrders = [
  // Inicialmente vazio
];

const topProducts = [
  // Inicialmente vazio
];

const weeklyComparison = [
  { day: 'Seg', atual: 0, anterior: 0 },
  { day: 'Ter', atual: 0, anterior: 0 },
  { day: 'Qua', atual: 0, anterior: 0 },
  { day: 'Qui', atual: 0, anterior: 0 },
  { day: 'Sex', atual: 0, anterior: 0 },
  { day: 'Sáb', atual: 0, anterior: 0 },
  { day: 'Dom', atual: 0, anterior: 0 },
];

const Dashboard = () => {
  const [user, setUser] = useState<any>(null);
  const [establishment, setEstablishment] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('hoje');
  const [monthlyTotals, setMonthlyTotals] = useState({ revenue: 0, orders: 0 });
  const [activeProductsCount, setActiveProductsCount] = useState(0);
  const [customRange, setCustomRange] = useState<{ start: string; end: string } | null>(null);
  const [dashboardData, setDashboardData] = useState({
    totalRevenue: 0,
    totalOrders: 0,
    averageTicket: 0,
    totalCustomers: 0,
    recentOrders: [] as any[],
    topProducts: [] as any[],
    topCustomers: [] as any[],
    categoryData: [
      { name: 'Lanches', value: 0, color: '#8884d8' },
      { name: 'Bebidas', value: 0, color: '#82ca9d' },
      { name: 'Sobremesas', value: 0, color: '#ffc658' },
      { name: 'Acompanhamentos', value: 0, color: '#ff7300' },
    ],
    salesData: [] as any[],
    dailyData: [] as any[],
    weeklyComparison: [] as any[],
    deliveryBoysData: [] as any[]
  });
  const navigate = useNavigate();
  const [showMasterSetup, setShowMasterSetup] = useState(false);
  const [masterName, setMasterName] = useState("");
  const [masterPin, setMasterPin] = useState("");
  const sidebarWidth = useSidebarWidth();
  const [isDesktop, setIsDesktop] = useState(false);
  const [trialDaysLeft, setTrialDaysLeft] = useState<number | null>(null);
  const [subscriptionType, setSubscriptionType] = useState<string | null>(null);

  useEffect(() => {
    const checkDesktop = () => setIsDesktop(window.innerWidth >= 1024);
    checkDesktop();
    window.addEventListener('resize', checkDesktop);
    return () => window.removeEventListener('resize', checkDesktop);
  }, []);

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (establishment) {
      loadDashboardData();
    }
  }, [establishment, timeRange, customRange]);

  // Após carregar estabelecimento, verificar se já existe MASTER
  useEffect(() => {
    const checkMaster = async () => {
      if (!establishment) return;
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, establishment_id')
          .eq('user_id', session.user.id)
          .maybeSingle();

        const { count } = await supabase
          .from('team_members')
          .select('*', { count: 'exact', head: true })
          .eq('establishment_id', establishment.id)
          .eq('role', 'master');

        if (!count || count === 0) {
          setMasterName(profile?.full_name || 'Master');
          setShowMasterSetup(true);
        }
      } catch (e) {
        console.error('checkMaster', e);
      }
    };
    checkMaster();
  }, [establishment]);

  // Expor função global para o modal do index.html
  useEffect(() => {
    (window as any).atualizarDashboard = (startISO: string, endISO: string) => {
      // Permite filtrar por 1 dia (quando startISO === endISO) ou vários dias
      // Se não forneceu endISO, usa startISO como endISO (filtro de 1 dia)
      const finalEndISO = endISO || startISO;
      setCustomRange({ start: startISO, end: finalEndISO });
      setTimeRange('custom');
    };
    return () => {
      try { delete (window as any).atualizarDashboard; } catch {}
    };
  }, []);

  // Real-time updates for orders
  useEffect(() => {
    if (!establishment) return;

    const channel = supabase
      .channel('dashboard-orders')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `establishment_id=eq.${establishment.id}`
        },
        () => {
          // Reload dashboard data when orders change
          loadDashboardData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [establishment]);

  const loadDashboardData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("establishment_id")
        .eq("user_id", session.user.id)
        .single();

      if (!profile?.establishment_id) return;

      // Verifica se é Na Brasa (não é admin do sistema)
      const userIsSystemAdmin = session.user.email === 'fellipe_1693@outlook.com';
      let isNaBrasa = false;
      
      // Buscar establishment se não estiver carregado
      let currentEstablishment = establishment;
      if (!currentEstablishment && profile?.establishment_id) {
        const { data: estabData } = await supabase
          .from('establishments')
          .select('id, name')
          .eq('id', profile.establishment_id)
          .single();
        currentEstablishment = estabData;
      }
      
      if (!userIsSystemAdmin && currentEstablishment) {
        const establishmentName = currentEstablishment.name?.toLowerCase() || '';
        isNaBrasa = establishmentName.includes('na brasa') || 
                    establishmentName.includes('nabrasa') ||
                    establishmentName === 'hamburgueria na brasa';
      }
      
      // Calculate date range (suporta customRange)
      let startDate = new Date();
      let endDate = new Date();
      
      if (timeRange === 'custom' && customRange) {
        // Filtro personalizado: permite 1 dia ou vários dias
        startDate = new Date(`${customRange.start}T00:00:00`);
        endDate = new Date(`${customRange.end}T23:59:59`);
      } else if (timeRange !== 'custom') {
        // Reseta customRange quando muda para outra opção
        setCustomRange(null);
        switch (timeRange) {
          case 'hoje':
            // Cria novas instâncias para evitar problemas de referência
            startDate = new Date();
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date();
            endDate.setHours(23, 59, 59, 999);
            break;
          case 'semana':
            startDate = new Date();
            startDate.setDate(startDate.getDate() - 7);
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date();
            endDate.setHours(23, 59, 59, 999);
            break;
          case 'mes':
            startDate = new Date();
            startDate.setMonth(startDate.getMonth() - 1);
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date();
            endDate.setHours(23, 59, 59, 999);
            break;
        }
      }

      // Calculate month start for monthly goals
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);

      // Get orders data (flat) - filter by range
      let ordersQuery = supabase
        .from("orders")
        .select("*, site_category_quantities")
        .eq("establishment_id", profile.establishment_id)
        .gte("created_at", startDate.toISOString())
        .lte("created_at", endDate.toISOString());
      
      // Para Na Brasa: contar apenas pedidos do site que foram aceitos e impressos
      // Ou pedidos que não são do site (PDV, balcão, etc)
      // Para outros usuários: contar todos os pedidos normalmente
      if (isNaBrasa) {
        // Filtrar: pedidos do site só contam se accepted_and_printed_at não for null
        // OU pedidos que não são do site (sem source_domain/channel online)
        ordersQuery = ordersQuery.or(`accepted_and_printed_at.not.is.null,source_domain.is.null,channel.neq.online,origin.neq.site`);
      }
      
      const { data: orders, error: ordersError } = await ordersQuery.order("created_at", { ascending: false });
      
      if (ordersError) {
        console.error('Erro ao carregar pedidos:', ordersError);
      }

      // Get monthly orders count for goals
      let monthlyOrdersQuery = supabase
        .from("orders")
        .select("id")
        .eq("establishment_id", profile.establishment_id)
        .gte("created_at", monthStart.toISOString());
      
      // Para Na Brasa: aplicar mesmo filtro
      if (isNaBrasa) {
        monthlyOrdersQuery = monthlyOrdersQuery.or(`accepted_and_printed_at.not.is.null,source_domain.is.null,channel.neq.online,origin.neq.site`);
      }
      
      const { data: monthlyOrders } = await monthlyOrdersQuery;

      // Get new customers count for the current month
      const { count: customersCount } = await supabase
        .from("customers")
        .select("*", { count: 'exact', head: true })
        .eq("establishment_id", profile.establishment_id)
        .gte("created_at", monthStart.toISOString());

      // Get active products count
      const { count: activeCount } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('establishment_id', profile.establishment_id)
        .eq('active', true);
      setActiveProductsCount(activeCount || 0);

      // Get top 5 customers by number of orders - apenas clientes cadastrados
      // Buscar clientes cadastrados e calcular quantidade de compras baseado em pedidos vinculados
      const { data: customersData } = await supabase
        .from("customers")
        .select("id, name, phone")
        .eq("establishment_id", profile.establishment_id)
        .eq("active", true);

      // Para cada cliente cadastrado, buscar seus pedidos (por customer_id OU por nome/telefone correspondente)
      const customerTotals: { [key: string]: { name: string, phone: string, total: number, orders: number } } = {};
      
      if (customersData && customersData.length > 0) {
        for (const customer of customersData) {
          // Buscar pedidos vinculados por customer_id
          let customerOrdersQueryById = supabase
            .from("orders")
            .select("id, total_amount, created_at")
            .eq("establishment_id", profile.establishment_id)
            .eq("customer_id", customer.id);
          
          // Para Na Brasa: aplicar mesmo filtro
          if (isNaBrasa) {
            customerOrdersQueryById = customerOrdersQueryById.or(`accepted_and_printed_at.not.is.null,source_domain.is.null,channel.neq.online,origin.neq.site`);
          }
          
          const { data: ordersById } = await customerOrdersQueryById;
          
          // Buscar pedidos por correspondência de nome/telefone (caso não tenha customer_id vinculado)
          let customerOrdersQueryByName = supabase
            .from("orders")
            .select("id, total_amount, created_at, customer_id")
            .eq("establishment_id", profile.establishment_id)
            .eq("customer_name", customer.name);
          
          if (customer.phone) {
            customerOrdersQueryByName = customerOrdersQueryByName.eq("customer_phone", customer.phone);
          }
          
          // Para Na Brasa: aplicar mesmo filtro
          if (isNaBrasa) {
            customerOrdersQueryByName = customerOrdersQueryByName.or(`accepted_and_printed_at.not.is.null,source_domain.is.null,channel.neq.online,origin.neq.site`);
          }
          
          const { data: ordersByName } = await customerOrdersQueryByName;
          
          // Combinar pedidos, evitando duplicatas
          const allCustomerOrders = new Map();
          
          // Adicionar pedidos por ID
          if (ordersById) {
            ordersById.forEach((order: any) => {
              allCustomerOrders.set(order.id, order);
            });
          }
          
          // Adicionar pedidos por nome/telefone que não têm customer_id (ou têm customer_id nulo)
          if (ordersByName) {
            ordersByName.forEach((order: any) => {
              // Só adicionar se não tiver customer_id ou se o customer_id for diferente (caso tenha sido atualizado)
              if (!order.customer_id || order.customer_id !== customer.id) {
                allCustomerOrders.set(order.id, order);
              }
            });
          }
          
          const customerOrders = Array.from(allCustomerOrders.values());
          
          if (customerOrders.length > 0) {
            const total = customerOrders.reduce((sum: number, order: any) => sum + (Number(order.total_amount) || 0), 0);
            customerTotals[customer.id] = {
              name: customer.name,
              phone: customer.phone || "",
              total: total,
              orders: customerOrders.length
            };
          }
        }
      }

      // Ordenar por quantidade de compras (orders), não por valor total
      const topCustomers = Object.values(customerTotals)
        .sort((a, b) => b.orders - a.orders)
        .slice(0, 5);

      // Sempre inicializa os dados, mesmo sem pedidos
      const ordersArray = orders || [];
      
      const totalRevenue = ordersArray.reduce((sum: number, order: any) => sum + (Number(order.total_amount) || 0), 0);
      const totalOrders = ordersArray.length;
      const averageTicket = totalOrders > 0 ? totalRevenue / totalOrders : 0;

      // Category analysis + Top products without FK embeddings
      const colorPalette = ['#8884d8','#82ca9d','#ffc658','#ff7300','#34d399','#f43f5e'];

      let categoryData: { name: string; value: number; color: string }[] = [];
      let topProducts: { name: string; quantity: number; revenue: number }[] = [];

      if (ordersArray.length > 0) {
        // Para Na Brasa: Processar categorias do site primeiro (site_category_quantities)
        if (isNaBrasa) {
          const siteCategoryTotals: Record<string, number> = {};

          // Processar pedidos do site que têm site_category_quantities
          // Apenas pedidos que foram aceitos e impressos devem contar
          for (const order of ordersArray) {
            // Verificar se é pedido do site, tem categorias e foi aceito/impresso
            const isFromSite = order.source_domain?.toLowerCase().includes('hamburguerianabrasa') || false;
            const wasAcceptedAndPrinted = order.accepted_and_printed_at !== null && order.accepted_and_printed_at !== undefined;
            
            // Tentar parsear se for string JSON
            let siteCategories = order.site_category_quantities;
            if (typeof siteCategories === 'string') {
              try {
                siteCategories = JSON.parse(siteCategories);
              } catch (e) {
                siteCategories = null;
              }
            }

            if (isFromSite && wasAcceptedAndPrinted && siteCategories && typeof siteCategories === 'object') {
              // Mapear categorias do site para nomes em português
              const categoryMapping: Record<string, string> = {
                'burger': 'Hambúrgueres',
                'side': 'Acompanhamentos',
                'drink': 'Bebidas'
              };
              
              // Processar cada categoria do site
              const entries = Object.entries(siteCategories);
              
              // Mapear valores reais do notes do pedido
              const categoryValueMap: Record<string, number> = {};
              
              // Extrair valores reais do notes do pedido para cada categoria
              if (order.notes && order.notes.includes('[')) {
                // Tentar extrair valores do notes e mapear para categorias
                const bracketMatches = [...order.notes.matchAll(/\[(\d+)x\s+([^\]]+?)\]/gs)];
                
                for (const match of bracketMatches) {
                  const qty = Number(match[1]) || 1;
                  const fullContent = match[2] || '';
                  
                  // Extrair preço
                  const priceMatch = fullContent.match(/R\$\s*([\d.,]+)/);
                  const priceStr = priceMatch ? priceMatch[1].replace(',', '.') : '';
                  const price = priceStr ? parseFloat(priceStr) : 0;
                  const totalValue = price * qty;
                  
                  if (price === 0) {
                    continue;
                  }
                  
                  // Tentar identificar a categoria pelo nome do produto
                  const contentLower = fullContent.toLowerCase();
                  let matchedCategory = '';
                  
                  if (contentLower.includes('hamburguer') || contentLower.includes('hambúrguer') || 
                      contentLower.includes('burger') || contentLower.includes('frango') ||
                      contentLower.includes('carne') || contentLower.includes('na brasa')) {
                    matchedCategory = 'burger';
                  } else if (contentLower.includes('batata') || contentLower.includes('frita') ||
                             contentLower.includes('acompanhamento') || contentLower.includes('side')) {
                    matchedCategory = 'side';
                  } else if (contentLower.includes('bebida') || contentLower.includes('refrigerante') ||
                             contentLower.includes('coca') || contentLower.includes('pepsi') ||
                             contentLower.includes('drink') || contentLower.includes('suco') ||
                             contentLower.includes('zero')) {
                    matchedCategory = 'drink';
                  }
                  
                  if (matchedCategory && siteCategories[matchedCategory]) {
                    categoryValueMap[matchedCategory] = (categoryValueMap[matchedCategory] || 0) + totalValue;
                  }
                }
              }
              
              // Processar categorias usando valores reais se disponíveis, senão usar estimativa
              entries.forEach(([catKey, catQuantity]) => {
                const catName = categoryMapping[catKey] || catKey;
                const quantity = Number(catQuantity) || 0;
                
                if (quantity > 0) {
                  let categoryValue = 0;
                  
                  // Se temos valor mapeado, usar ele
                  if (categoryValueMap[catKey]) {
                    categoryValue = categoryValueMap[catKey];
                  } else {
                    // Fallback: calcular proporcionalmente (menos preciso)
                    const totalItems = Object.values(siteCategories).reduce((sum: number, qty: any) => sum + (Number(qty) || 0), 0);
                    categoryValue = totalItems > 0 ? (order.subtotal / totalItems) * quantity : 0;
                  }

                  siteCategoryTotals[catName] = (siteCategoryTotals[catName] || 0) + categoryValue;
                }
              });
            }
          }

          // Adicionar categorias do site aos totais
          Object.entries(siteCategoryTotals).forEach(([name, value]) => {
            if (value > 0) {
              categoryData.push({
                name,
                value: Number(value) || 0,
                color: colorPalette[categoryData.length % colorPalette.length]
              });
            }
          });
        }

        const orderIds = ordersArray.map((o: any) => o.id);
        
        if (orderIds.length > 0) {
          const { data: items, error: itemsError } = await supabase
            .from('order_items')
            .select('order_id, product_id, quantity, total_price, notes')
            .in('order_id', orderIds);

          if (itemsError) {
            console.error('Error loading order items:', itemsError);
          }

          if (items && items.length > 0) {
            // Separar itens com e sem product_id
            // Para Na Brasa: identificar pedidos do site que já foram processados via site_category_quantities
            // Esses pedidos NÃO devem ser processados nas categorias normais para evitar duplicação
            const siteOrderIds = new Set<string>();
            if (isNaBrasa && ordersArray.length > 0) {
              ordersArray.forEach((order: any) => {
                const isFromSite = order.source_domain?.toLowerCase().includes('hamburguerianabrasa') || false;
                const wasAcceptedAndPrinted = order.accepted_and_printed_at !== null && order.accepted_and_printed_at !== undefined;
                let siteCategories = order.site_category_quantities;
                if (typeof siteCategories === 'string') {
                  try {
                    siteCategories = JSON.parse(siteCategories);
                  } catch (e) {
                    siteCategories = null;
                  }
                }
                
                if (isFromSite && wasAcceptedAndPrinted && siteCategories && typeof siteCategories === 'object' && Object.keys(siteCategories).length > 0) {
                  siteOrderIds.add(order.id);
                }
              });
            }
            
            // IMPORTANTE: Para o Top 5 Produtos, precisamos processar TODOS os itens (incluindo do site)
            // Mas para as categorias, excluímos pedidos do site que já foram processados via site_category_quantities
            const itemsWithProductId = items.filter((i: any) => i.product_id);
            const itemsWithoutProductId = items.filter((i: any) => !i.product_id);
            
            // Separar itens para categorias (excluindo pedidos do site) e para Top 5 (incluindo todos)
            const itemsWithProductIdForCategories = itemsWithProductId.filter((i: any) => !siteOrderIds.has(i.order_id));
            
            const categoryTotals: Record<string, number> = {};
            const productTotals: Record<string, { name: string; quantity: number; revenue: number }> = {};
            
            // Processar itens com product_id (buscar produtos no banco)
            // Para categorias: usar apenas itens que NÃO são de pedidos do site
            if (itemsWithProductIdForCategories.length > 0) {
              const productIds = Array.from(new Set(itemsWithProductIdForCategories.map((i: any) => i.product_id).filter(Boolean)));
              
              if (productIds.length > 0) {
                const { data: products, error: productsError } = await supabase
                  .from('products')
                  .select('id, name, category_id')
                  .in('id', productIds);

                if (productsError) {
                  console.error('Error loading products:', productsError);
                }

                if (products && products.length > 0) {
                  const categoryIds = Array.from(new Set(products.map((p: any) => p.category_id).filter(Boolean)));
                  
                  let categories: any[] = [];
                  if (categoryIds.length > 0) {
                    const { data: categoriesData, error: categoriesError } = await supabase
                      .from('categories')
                      .select('id, name')
                      .in('id', categoryIds);
                    
                    if (categoriesError) {
                      console.error('Error loading categories:', categoriesError);
                    }
                    
                    categories = categoriesData || [];
                  }

                  const productMap = new Map(products.map((p: any) => [p.id, p]));
                  const categoryMap = new Map(categories.map((c: any) => [c.id, c.name]));

                  itemsWithProductIdForCategories.forEach((item: any) => {
                    const prod = productMap.get(item.product_id);
                    const prodName = prod?.name || 'Produto';
                    const catName = prod?.category_id ? (categoryMap.get(prod.category_id) || 'Outros') : 'Outros';

                    categoryTotals[catName] = (categoryTotals[catName] || 0) + (Number(item.total_price) || 0);
                  });
                }
              }
            }
            
            // Processar TODOS os itens com product_id para o Top 5 Produtos (incluindo do site)
            if (itemsWithProductId.length > 0) {
              const productIds = Array.from(new Set(itemsWithProductId.map((i: any) => i.product_id).filter(Boolean)));
              
              if (productIds.length > 0) {
                const { data: products, error: productsError } = await supabase
                  .from('products')
                  .select('id, name')
                  .in('id', productIds);

                if (productsError) {
                  console.error('Error loading products:', productsError);
                }

                if (products && products.length > 0) {
                  const productMap = new Map(products.map((p: any) => [p.id, p]));

                  itemsWithProductId.forEach((item: any) => {
                    const prod = productMap.get(item.product_id);
                    const prodName = prod?.name || 'Produto';

                    if (!productTotals[prodName]) {
                      productTotals[prodName] = { name: prodName, quantity: 0, revenue: 0 };
                    }
                    productTotals[prodName].quantity += Number(item.quantity) || 0;
                    productTotals[prodName].revenue += Number(item.total_price) || 0;
                  });
                }
              }
            }
            
            // Processar itens sem product_id (do site) - buscar nomes a partir dos dados originais do pedido
            // IMPORTANTE: Processar TODOS os itens sem product_id para o Top 5, mesmo que sejam de pedidos do site
            if (itemsWithoutProductId.length > 0 && isNaBrasa) {
              // Buscar os pedidos relacionados para pegar os dados originais
              const orderIdsForItems = Array.from(new Set(itemsWithoutProductId.map((i: any) => i.order_id)));
              
              // Buscar os pedidos com notes para tentar extrair nomes dos produtos
              const { data: ordersWithItems } = await supabase
                .from('orders')
                .select('id, notes')
                .in('id', orderIdsForItems);
              
              // Criar um mapa de order_id -> notes para buscar nomes
              const orderNotesMap = new Map();
              if (ordersWithItems) {
                ordersWithItems.forEach((o: any) => {
                  orderNotesMap.set(o.id, o.notes);
                });
              }
              
              // Para cada item sem product_id, tentar extrair o nome do notes ou usar genérico
              itemsWithoutProductId.forEach((item: any) => {
                let prodName = `Produto do Site (R$ ${Number(item.total_price).toFixed(2)})`;
                
                // Tentar extrair nome do notes do pedido (formato: [1x Nome do Produto - ... R$ XX.XX])
                const orderNotes = orderNotesMap.get(item.order_id) || '';
                if (orderNotes && orderNotes.includes('[')) {
                  // Usar a mesma regex robusta usada na seção de categorias
                  const bracketMatches = [...orderNotes.matchAll(/\[(\d+)x\s+([^\]]+?)\]/gs)];
                  
                  if (bracketMatches.length > 0) {
                    // Tentar encontrar o match baseado no preço
                    for (const match of bracketMatches) {
                      const qty = Number(match[1]) || 1;
                      const fullContent = match[2] || '';
                      
                      // Extrair o preço primeiro (R$ 30.00)
                      const priceMatch = fullContent.match(/R\$\s*([\d.,]+)/);
                      const priceStr = priceMatch ? priceMatch[1].replace(',', '.') : '';
                      const price = priceStr ? parseFloat(priceStr) : 0;
                      const totalPrice = price * qty;
                      
                      // Verificar se o preço corresponde ao item atual
                      const itemTotalPrice = Number(item.total_price) || 0;
                      if (price > 0 && (Math.abs(totalPrice - itemTotalPrice) < 0.01 || Math.abs(price - (itemTotalPrice / item.quantity)) < 0.01)) {
                        // Extrair o nome (tudo antes do primeiro " - " ou antes de "R$")
                        let name = fullContent;
                        // Remover o preço da string
                        name = name.replace(/\s*R\$\s*[\d.,]+.*$/, '');
                        // Pegar tudo antes do primeiro " - " que precede informações extras
                        const nameMatch = name.match(/^([^-]+?)(?:\s*-\s*(?:Duplo|Simples|Normal|Pequena|Média|Grande|Outro|etc)[\s-]*|$)/i);
                        if (nameMatch) {
                          name = nameMatch[1];
                        } else {
                          // Se não encontrou, pegar tudo antes de " - "
                          const dashIndex = name.indexOf(' - ');
                          if (dashIndex > 0) {
                            name = name.substring(0, dashIndex);
                          }
                        }
                        
                        // Limpar o nome (remover quebras de linha, espaços extras, etc)
                        name = name
                          .replace(/\n+/g, ' ')  // Substituir quebras de linha por espaço
                          .replace(/\s+/g, ' ')  // Múltiplos espaços por um só
                          .trim();
                        
                        // Remover linhas que são apenas "Molhos:", "Obs:", etc
                        if (name && !name.match(/^(Molhos?:|Obs?:|Observação?:)$/i)) {
                          prodName = name;
                          break;
                        }
                      }
                    }
                  }
                }
                
                // Se não encontrou no notes, usar o nome do notes do próprio item se disponível
                if (prodName.startsWith('Produto do Site') && item.notes) {
                  // Tentar extrair nome do notes do item
                  const itemMatch = item.notes.match(/^([^-]+?)(?:\s*-|$)/);
                  if (itemMatch && itemMatch[1]) {
                    prodName = itemMatch[1].trim();
                  }
                }
                
                // Adicionar ao Top 5
                if (!productTotals[prodName]) {
                  productTotals[prodName] = { name: prodName, quantity: 0, revenue: 0 };
                }
                productTotals[prodName].quantity += Number(item.quantity) || 0;
                productTotals[prodName].revenue += Number(item.total_price) || 0;
              });
            }
            
            // Para pedidos do site que têm site_category_quantities mas podem não ter todos os order_items salvos
            // IMPORTANTE: Processar TODOS os pedidos do site (mesmo os já processados via site_category_quantities)
            // para garantir que TODOS os itens apareçam no Top 5 Produtos
            if (isNaBrasa && ordersArray.length > 0) {
              const siteOrdersToProcess = ordersArray.filter((o: any) => {
                const isFromSite = o.source_domain?.toLowerCase().includes('hamburguerianabrasa') || false;
                const wasAcceptedAndPrinted = o.accepted_and_printed_at !== null && o.accepted_and_printed_at !== undefined;
                // Processar TODOS os pedidos do site aceitos/impressos, independente de terem order_items ou não
                return isFromSite && wasAcceptedAndPrinted && o.notes && o.notes.includes('[');
              });
              
              // Para cada pedido do site, extrair TODOS os itens do notes para garantir que apareçam no Top 5
              for (const order of siteOrdersToProcess) {
                // Extrair TODOS os itens do notes (mesmo que já existam order_items)
                // Isso garante que todos os produtos apareçam no Top 5
                if (order.notes && order.notes.includes('[')) {
                  // Melhorar regex para capturar diferentes formatos (incluindo quebras de linha)
                  // Formato: [1x Nome do Produto - ... R$ 30.00 ...]
                  // Usar uma regex que captura todo o conteúdo do colchete e depois extrair nome e preço
                  const bracketMatches = [...order.notes.matchAll(/\[(\d+)x\s+([^\]]+?)\]/gs)];
                  
                  for (const match of bracketMatches) {
                    const qty = Number(match[1]) || 1;
                    const fullContent = match[2] || '';
                    
                    // Extrair o preço primeiro (R$ 30.00)
                    const priceMatch = fullContent.match(/R\$\s*([\d.,]+)/);
                    const priceStr = priceMatch ? priceMatch[1].replace(',', '.') : '';
                    const price = priceStr ? parseFloat(priceStr) : 0;
                    
                    // Extrair o nome (tudo antes do primeiro " - " ou antes de "R$")
                    let name = fullContent;
                    // Remover o preço da string
                    name = name.replace(/\s*R\$\s*[\d.,]+.*$/, '');
                    // Pegar tudo antes do primeiro " - " que precede informações extras
                    const nameMatch = name.match(/^([^-]+?)(?:\s*-\s*(?:Duplo|Simples|Normal|Pequena|Média|Grande|Outro|etc)[\s-]*|$)/i);
                    if (nameMatch) {
                      name = nameMatch[1];
                    } else {
                      // Se não encontrou, pegar tudo antes de " - "
                      const dashIndex = name.indexOf(' - ');
                      if (dashIndex > 0) {
                        name = name.substring(0, dashIndex);
                      }
                    }
                    
                    // Limpar o nome (remover quebras de linha, espaços extras, linhas vazias, etc)
                    name = name
                      .replace(/\n+/g, ' ')  // Substituir quebras de linha por espaço
                      .replace(/\s+/g, ' ')  // Múltiplos espaços por um só
                      .trim();
                    
                    // Remover linhas que são apenas "Molhos:", "Obs:", etc
                    if (name.match(/^(Molhos?:|Obs?:|Observação?:)$/i)) {
                      continue; // Pular este item
                    }
                    
                    if (name && price > 0) {
                      // Verificar se já existe nos productTotals com nome similar (para evitar duplicação)
                      const existingProdKey = Object.keys(productTotals).find((pName) => {
                        const pNameLower = pName.toLowerCase().trim();
                        const nameLower = name.toLowerCase().trim();
                        // Comparação exata ou muito similar
                        return pNameLower === nameLower || 
                               pNameLower.includes(nameLower) || 
                               nameLower.includes(pNameLower);
                      });
                      
                      if (existingProdKey) {
                        // Se já existe, usar o nome existente para consolidar
                        productTotals[existingProdKey].quantity += qty;
                        productTotals[existingProdKey].revenue += price * qty;
                      } else {
                        // Adicionar novo item
                        if (!productTotals[name]) {
                          productTotals[name] = { name, quantity: 0, revenue: 0 };
                        }
                        productTotals[name].quantity += qty;
                        productTotals[name].revenue += price * qty;
                      }
                    }
                  }
                }
              }
            }

            // Mesclar categorias do sistema com categorias do site (Na Brasa)
            Object.entries(categoryTotals).forEach(([name, value]) => {
              const existingCat = categoryData.find(c => c.name === name);
              if (existingCat) {
                existingCat.value += Number(value) || 0;
              } else {
                categoryData.push({
                  name,
                  value: Number(value) || 0,
                  color: colorPalette[categoryData.length % colorPalette.length]
                });
              }
            });

            // Mesclar produtos do sistema com produtos do site (Na Brasa)
            Object.entries(productTotals).forEach(([prodName, prodData]) => {
              const existingProd = topProducts.find(p => p.name === prodName);
              if (existingProd) {
                existingProd.quantity += prodData.quantity;
                existingProd.revenue += prodData.revenue;
              } else {
                topProducts.push({
                  name: prodData.name,
                  quantity: prodData.quantity,
                  revenue: prodData.revenue
                });
              }
            });

            // NÃO adicionar categorias do site ao Top 5 Produtos
            // As categorias do site (burger, side, drink) são apenas para "Vendas por Categoria"
            // O Top 5 deve mostrar apenas produtos individuais reais

            // Ordenar e limitar
            categoryData = categoryData
              .sort((a, b) => b.value - a.value);

            topProducts = topProducts
              .sort((a, b) => b.quantity - a.quantity)
              .slice(0, 5)
              .map(p => ({ ...p, quantity: Number(p.quantity) || 0, revenue: Number(p.revenue) || 0 }));
          }
        }
      }

      // Sales data por mês (últimos 6 meses)
      const salesData = [];
      const today = new Date();
      for (let i = 5; i >= 0; i--) {
        const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
        const monthName = date.toLocaleDateString('pt-BR', { month: 'short' });
        const monthOrders = ordersArray.filter((order: any) => {
          const orderDate = new Date(order.created_at);
          return orderDate.getMonth() === date.getMonth() && orderDate.getFullYear() === date.getFullYear();
        });
        salesData.push({
          name: monthName.charAt(0).toUpperCase() + monthName.slice(1),
          vendas: monthOrders.reduce((sum: number, order: any) => sum + (order.total_amount || 0), 0),
          pedidos: monthOrders.length,
          meta: establishment?.monthly_goal || 0
        });
      }

      // Daily data - horários de pico
      const hourlyTotals: { [key: string]: { valor: number, pedidos: number } } = {};
      ordersArray.forEach((order: any) => {
        const hour = new Date(order.created_at).getHours();
        const hourKey = `${hour.toString().padStart(2, '0')}:00`;
        if (!hourlyTotals[hourKey]) {
          hourlyTotals[hourKey] = { valor: 0, pedidos: 0 };
        }
        hourlyTotals[hourKey].valor += order.total_amount || 0;
        hourlyTotals[hourKey].pedidos += 1;
      });

      const dailyData = [
        { hora: '08:00', ...hourlyTotals['08:00'] || { valor: 0, pedidos: 0 } },
        { hora: '10:00', ...hourlyTotals['10:00'] || { valor: 0, pedidos: 0 } },
        { hora: '12:00', ...hourlyTotals['12:00'] || { valor: 0, pedidos: 0 } },
        { hora: '14:00', ...hourlyTotals['14:00'] || { valor: 0, pedidos: 0 } },
        { hora: '16:00', ...hourlyTotals['16:00'] || { valor: 0, pedidos: 0 } },
        { hora: '18:00', ...hourlyTotals['18:00'] || { valor: 0, pedidos: 0 } },
        { hora: '20:00', ...hourlyTotals['20:00'] || { valor: 0, pedidos: 0 } },
        { hora: '22:00', ...hourlyTotals['22:00'] || { valor: 0, pedidos: 0 } },
      ];

      // Weekly comparison
      const weeklyComparison = [];
      const currentWeekStart = new Date(today);
      currentWeekStart.setDate(today.getDate() - today.getDay());
      
      for (let i = 0; i < 7; i++) {
        const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
        const currentWeekDay = new Date(currentWeekStart);
        currentWeekDay.setDate(currentWeekStart.getDate() + i);
        
        const previousWeekDay = new Date(currentWeekDay);
        previousWeekDay.setDate(currentWeekDay.getDate() - 7);
        
        const currentDayOrders = ordersArray.filter((order: any) => {
          const orderDate = new Date(order.created_at);
          return orderDate.toDateString() === currentWeekDay.toDateString();
        });
        
        const previousDayOrders = ordersArray.filter((order: any) => {
          const orderDate = new Date(order.created_at);
          return orderDate.toDateString() === previousWeekDay.toDateString();
        });
        
        weeklyComparison.push({
          day: dayNames[i],
          atual: currentDayOrders.reduce((sum: number, order: any) => sum + (order.total_amount || 0), 0),
          anterior: previousDayOrders.reduce((sum: number, order: any) => sum + (order.total_amount || 0), 0)
        });
      }

      // Calculate monthly totals for goals
      const monthlyRevenue = ordersArray
        .filter((o: any) => new Date(o.created_at) >= monthStart)
        .reduce((sum: number, o: any) => sum + (o.total_amount || 0), 0);
      const monthlyOrdersCount = monthlyOrders?.length || 0;
      
      setMonthlyTotals({ revenue: monthlyRevenue, orders: monthlyOrdersCount });

      // Calculate delivery boys data
      const deliveryOrders = ordersArray.filter((o: any) => o.delivery_boy_id && o.order_type === 'delivery');
      const deliveryBoyIds = Array.from(new Set(deliveryOrders.map((o: any) => o.delivery_boy_id)));
      
      let deliveryBoysData: any[] = [];
      if (deliveryBoyIds.length > 0) {
        const { data: deliveryBoys } = await supabase
          .from('delivery_boys')
          .select('id, name, daily_rate, delivery_fee')
          .in('id', deliveryBoyIds);

        if (deliveryBoys) {
          deliveryBoysData = deliveryBoys.map(boy => {
            const deliveries = deliveryOrders.filter((o: any) => o.delivery_boy_id === boy.id);
            const deliveriesCount = deliveries.length;
            const dailyRate = Number(boy.daily_rate) || 0;
            const deliveryFee = Number(boy.delivery_fee) || 0;
            const deliveriesTotal = deliveriesCount * deliveryFee;
            // Diária aplicada apenas uma vez por período se houver entregas no período
            // Se não há entregas, não cobra diária
            const total = (deliveriesCount > 0 ? dailyRate : 0) + deliveriesTotal;

            return {
              id: boy.id,
              name: boy.name,
              dailyRate: deliveriesCount > 0 ? dailyRate : 0,
              deliveryFee,
              deliveriesCount,
              deliveriesTotal,
              total
            };
          }).sort((a, b) => b.total - a.total);
        }
      }

      setDashboardData({
        totalRevenue: timeRange === 'mes' ? monthlyRevenue : totalRevenue,
        totalOrders: timeRange === 'mes' ? monthlyOrdersCount : totalOrders,
        averageTicket,
        totalCustomers: customersCount || 0,
        recentOrders: ordersArray.slice(0, 10),
        topProducts,
        topCustomers,
        categoryData,
        salesData,
        dailyData,
        weeklyComparison,
        deliveryBoysData
      });
    } catch (error) {
      console.error("Error loading dashboard data:", error);
      toast.error("Erro ao carregar dados do dashboard");
    }
  };

  const checkAuth = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate("/auth");
        return;
      }

      setUser(session.user);

      // Get user profile and establishment id
      const { data: profile } = await supabase
        .from('profiles')
        .select('establishment_id, subscription_type, trial_end_date, status')
        .eq('user_id', session.user.id)
        .maybeSingle();

      setSubscriptionType(profile?.subscription_type || null);

      // Verificar se teste expirou e bloquear se necessário
      if (profile?.subscription_type === 'trial' && profile.trial_end_date) {
        const trialEnd = new Date(profile.trial_end_date);
        const now = new Date();
        
        // Calcular dias restantes
        const diffTime = trialEnd.getTime() - now.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        setTrialDaysLeft(diffDays > 0 ? diffDays : 0);

        if (now > trialEnd && profile.status === 'active') {
          // Bloquear usuário automaticamente
          await supabase
            .from('profiles')
            .update({ status: 'blocked' })
            .eq('user_id', session.user.id);
          
          toast.error('Seu período de teste expirou. Entre em contato para converter para assinatura mensal.');
          await supabase.auth.signOut();
          navigate('/auth');
          return;
        }
      } else {
        setTrialDaysLeft(null);
      }

      if (!profile?.establishment_id) {
        // Não redireciona imediatamente - permite que o TeamUserProvider mostre o dialog de criação de master
        // O usuário pode criar o master, que automaticamente criará/vincul fará um estabelecimento
        console.warn('Usuário sem estabelecimento vinculado. Aguardando criação de master...');
        setLoading(false);
        return;
      }

      const { data: estab } = await supabase
        .from('establishments')
        .select('*')
        .eq('id', profile.establishment_id)
        .maybeSingle();

      if (estab) setEstablishment(estab);
    } catch (error) {
      console.error("Auth error:", error);
      navigate("/auth");
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  const submitCreateMaster = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || !establishment) return;
      if (!/^\d{4}$/.test(masterPin)) {
        toast.error('PIN deve ter 4 dígitos');
        return;
      }
      const payload = {
        establishment_id: establishment.id,
        user_id: session.user.id,
        name: masterName || 'Master',
        role: 'master',
        pin: masterPin,
        active: true,
      } as any;
      const { error } = await supabase.from('team_members').insert([payload]);
      if (error) throw error;
      toast.success('Usuário master criado');
      setShowMasterSetup(false);
    } catch (e) {
      console.error(e);
      toast.error('Erro ao criar master');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
          <p className="mt-4 text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      
      <main 
        className="space-y-6 transition-all duration-300 ease-in-out"
        style={{
          marginLeft: isDesktop ? `${sidebarWidth}px` : '0px',
          padding: '1.5rem',
          minHeight: '100vh',
          height: '100vh',
          overflowY: 'auto'
        }}
      >
        <Dialog open={showMasterSetup}>
          <DialogContent className="form-dense">
            <DialogHeader>
              <DialogTitle>Configurar usuário Master</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Crie o usuário Master do estabelecimento. Ele terá acesso total.
              </p>
              <div>
                <label className="text-sm">Nome</label>
                <Input value={masterName} onChange={(e) => setMasterName(e.target.value)} placeholder="Nome do Master" />
              </div>
              <div>
                <label className="text-sm">PIN (4 dígitos)</label>
                <Input value={masterPin} onChange={(e) => setMasterPin(e.target.value.replace(/\D/g, '').slice(0,4))} placeholder="0000" maxLength={4} />
              </div>
              <div className="flex justify-end">
                <Button onClick={submitCreateMaster}>Salvar</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        {/* Trial Warning */}
        {subscriptionType === 'trial' && trialDaysLeft !== null && trialDaysLeft >= 0 && (
          <Card className={`border-2 ${trialDaysLeft <= 3 ? 'border-red-500 bg-red-50' : trialDaysLeft <= 7 ? 'border-yellow-500 bg-yellow-50' : 'border-blue-500 bg-blue-50'}`}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <AlertTriangle className={`h-5 w-5 ${trialDaysLeft <= 3 ? 'text-red-600' : trialDaysLeft <= 7 ? 'text-yellow-600' : 'text-blue-600'}`} />
                  <div>
                    <p className="font-semibold">
                      {trialDaysLeft === 0 
                        ? 'Seu período de teste expirou!'
                        : trialDaysLeft === 1
                        ? `Restam ${trialDaysLeft} dia de teste`
                        : `Restam ${trialDaysLeft} dias de teste`
                      }
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Entre em contato para converter para assinatura mensal e continuar usando o sistema.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Dashboard Executivo</h1>
            <p className="text-muted-foreground">
              {establishment?.name || "Bem-vindo ao burguer.IA"} - Visão completa do negócio
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <Tabs value={timeRange} onValueChange={(value) => {
              // Quando muda para outra aba, reseta customRange
              if (value !== 'custom') {
                setCustomRange(null);
              }
              setTimeRange(value);
            }} className="w-auto tabs-compact">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="hoje">Hoje</TabsTrigger>
                <TabsTrigger value="semana">Semana</TabsTrigger>
                <TabsTrigger value="mes">Mês</TabsTrigger>
              </TabsList>
            </Tabs>
            <Button id="btn-filtro" variant="outline" size="sm">
              <Calendar className="h-4 w-4 mr-2" />
              Filtrar
            </Button>
            <Button variant="outline" size="sm" onClick={handleSignOut}>
              <LogOut className="h-4 w-4 mr-2" />
              Sair
            </Button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="border-l-4 border-l-primary card-dense">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Faturamento {timeRange === 'hoje' ? 'Hoje' : timeRange === 'semana' ? 'na Semana' : 'no Mês'}
              </CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">R$ {dashboardData.totalRevenue.toFixed(2)}</div>
              <div className="flex items-center text-xs text-muted-foreground">
                <TrendingUp className="h-3 w-3 text-green-500 mr-1" />
                +{dashboardData.totalRevenue > 0 ? '100' : '0'}% em relação ao período anterior
              </div>
              <Progress 
                value={establishment?.daily_goal && establishment.daily_goal > 0 
                  ? Math.min((dashboardData.totalRevenue / (timeRange === 'hoje' ? establishment.daily_goal : timeRange === 'semana' ? establishment.weekly_goal || 1 : establishment.monthly_goal || 1)) * 100, 100) 
                  : 0
                } 
                className="mt-2 h-2" 
              />
              <p className="text-xs text-muted-foreground mt-1">
                Meta: R$ {(timeRange === 'hoje' ? establishment?.daily_goal || 0 : timeRange === 'semana' ? establishment?.weekly_goal || 0 : establishment?.monthly_goal || 0).toFixed(2)}
              </p>
            </CardContent>
          </Card>
          
          <Card className="border-l-4 border-l-blue-500 card-dense">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Pedidos {timeRange === 'hoje' ? 'Hoje' : timeRange === 'semana' ? 'na Semana' : 'no Mês'}
              </CardTitle>
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{dashboardData.totalOrders}</div>
              <div className="flex items-center text-xs text-muted-foreground">
                <TrendingUp className="h-3 w-3 text-green-500 mr-1" />
                +{dashboardData.totalOrders > 0 ? '100' : '0'}% em relação ao período anterior
              </div>
              <div className="flex space-x-2 mt-2">
                <Badge variant="secondary" className="text-xs">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  {dashboardData.totalOrders} Concluídos
                </Badge>
                <Badge variant="outline" className="text-xs">
                  <Clock className="h-3 w-3 mr-1" />
                  0 Pendentes
                </Badge>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-l-4 border-l-green-500 card-dense">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Ticket Médio
              </CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">R$ {dashboardData.averageTicket.toFixed(2)}</div>
              <div className="flex items-center text-xs text-muted-foreground">
                <TrendingUp className="h-3 w-3 text-green-500 mr-1" />
                +{dashboardData.averageTicket > 0 ? '100' : '0'}% em relação ao período anterior
              </div>
              <div className="mt-2">
                <p className="text-xs text-muted-foreground">
                  Baseado em {dashboardData.totalOrders} pedidos
                </p>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-l-4 border-l-orange-500 card-dense">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Clientes
              </CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{dashboardData.totalCustomers}</div>
              <div className="flex items-center text-xs text-muted-foreground">
                <Activity className="h-3 w-3 text-blue-500 mr-1" />
                {dashboardData.totalCustomers} cadastrados
              </div>
              <div className="flex space-x-2 mt-2">
                <Badge variant="secondary" className="text-xs">
                  <Star className="h-3 w-3 mr-1" />
                  0 VIPs
                </Badge>
                <Badge variant="outline" className="text-xs">
                  <Gift className="h-3 w-3 mr-1" />
                  {dashboardData.totalCustomers} Ativos
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts Section */}
        <div className="grid gap-6 lg:grid-cols-7">
          {/* Main Sales Chart */}
          <Card className="lg:col-span-4 card-dense">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Análise de Vendas
                <div className="flex space-x-2">
                  <Badge variant="outline">Últimos 6 meses</Badge>
                  <Button variant="ghost" size="sm">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="pl-2">
              <ResponsiveContainer width="100%" height={350}>
                <ComposedChart data={dashboardData.salesData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="name" 
                    stroke="#888888"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    yAxisId="vendas"
                    stroke="#888888"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => `R$ ${value}`}
                  />
                  <YAxis
                    yAxisId="pedidos"
                    orientation="right"
                    stroke="#888888"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip 
                    formatter={(value, name) => [
                      name === 'vendas' ? `R$ ${value}` : value,
                      name === 'vendas' ? 'Vendas' : name === 'pedidos' ? 'Pedidos' : 'Meta'
                    ]}
                  />
                  <Area 
                    yAxisId="vendas"
                    type="monotone" 
                    dataKey="vendas" 
                    stroke="hsl(var(--primary))" 
                    fill="hsl(var(--primary))" 
                    fillOpacity={0.6}
                  />
                  <Line 
                    yAxisId="vendas"
                    type="monotone" 
                    dataKey="meta" 
                    stroke="#ff7300" 
                    strokeDasharray="5 5"
                    dot={false}
                  />
                  <Bar 
                    yAxisId="pedidos"
                    dataKey="pedidos" 
                    fill="#82ca9d"
                    opacity={0.7}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Category Distribution */}
          <Card className="lg:col-span-3 card-dense">
            <CardHeader>
              <CardTitle>Vendas por Categoria</CardTitle>
              <CardDescription>
                Distribuição do faturamento por tipo de produto
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={dashboardData.categoryData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ name, percent }) => 
                      dashboardData.categoryData.some(item => item.value > 0) 
                        ? `${name} ${(percent * 100).toFixed(0)}%` 
                        : ''
                    }
                  >
                    {dashboardData.categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [`R$ ${value}`, 'Vendas']} />
                </PieChart>
              </ResponsiveContainer>
              {dashboardData.categoryData.every(item => item.value === 0) && (
                <div className="text-center py-4 text-muted-foreground">
                  <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Nenhuma venda por categoria</p>
                </div>
              )}
              <div className="mt-4 space-y-2">
                {dashboardData.categoryData.map((category, index) => (
                  <div key={index} className="flex items-center justify-between text-sm">
                    <div className="flex items-center">
                      <div 
                        className="w-3 h-3 rounded-full mr-2" 
                        style={{ backgroundColor: category.color }}
                      />
                      {category.name}
                    </div>
                    <span className="font-medium">R$ {category.value.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Performance Metrics */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center">
                <Target className="h-4 w-4 mr-2" />
                Metas do Mês
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Faturamento</span>
                  <span>R$ {monthlyTotals.revenue.toFixed(2)} / R$ {(establishment?.monthly_goal || 0).toFixed(2)}</span>
                </div>
                <Progress 
                  value={establishment?.monthly_goal && establishment.monthly_goal > 0 
                    ? Math.min((monthlyTotals.revenue / establishment.monthly_goal) * 100, 100) 
                    : 0
                  } 
                  className="h-2" 
                />
                <p className="text-xs text-muted-foreground">
                  {establishment?.monthly_goal && establishment.monthly_goal > 0 
                    ? ((monthlyTotals.revenue / establishment.monthly_goal) * 100).toFixed(1) 
                    : 0}% da meta
                </p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Pedidos</span>
                  <span>{monthlyTotals.orders} / {establishment?.monthly_orders_goal || 0}</span>
                </div>
                <Progress 
                  value={establishment?.monthly_orders_goal && establishment.monthly_orders_goal > 0 
                    ? Math.min((monthlyTotals.orders / establishment.monthly_orders_goal) * 100, 100) 
                    : 0
                  } 
                  className="h-2" 
                />
                <p className="text-xs text-muted-foreground">
                  {establishment?.monthly_orders_goal && establishment.monthly_orders_goal > 0 
                    ? ((monthlyTotals.orders / establishment.monthly_orders_goal) * 100).toFixed(1) 
                    : 0}% da meta
                </p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Novos Clientes</span>
                  <span>{dashboardData.totalCustomers} / {establishment?.monthly_customers_goal || 0}</span>
                </div>
                <Progress 
                  value={establishment?.monthly_customers_goal && establishment.monthly_customers_goal > 0 
                    ? Math.min((dashboardData.totalCustomers / establishment.monthly_customers_goal) * 100, 100) 
                    : 0
                  } 
                  className="h-2" 
                />
                <p className="text-xs text-muted-foreground">
                  {establishment?.monthly_customers_goal && establishment.monthly_customers_goal > 0 
                    ? ((dashboardData.totalCustomers / establishment.monthly_customers_goal) * 100).toFixed(1) 
                    : 0}% da meta
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center">
                <Clock className="h-4 w-4 mr-2" />
                Horários de Pico
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={150}>
                <LineChart data={dashboardData.dailyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="hora" 
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis hide />
                  <Tooltip 
                    formatter={(value, name) => [
                      name === 'valor' ? `R$ ${value}` : value,
                      name === 'valor' ? 'Vendas' : 'Pedidos'
                    ]}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="valor" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={2}
                    dot={{ fill: 'hsl(var(--primary))', r: 3 }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="pedidos" 
                    stroke="#82ca9d" 
                    strokeWidth={2}
                    dot={{ fill: '#82ca9d', r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
              {dashboardData.dailyData.every(item => item.valor === 0) && (
                <div className="text-center py-4 text-muted-foreground">
                  <Activity className="h-6 w-6 mx-auto mb-2 opacity-50" />
                  <p className="text-xs">Nenhuma atividade registrada</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center">
                <Zap className="h-4 w-4 mr-2" />
                Status Operacional
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="text-sm">Sistema Online</span>
                </div>
                <Badge variant="secondary" className="bg-green-100 text-green-700">
                  Ativo
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Package className="h-4 w-4 text-blue-500" />
                  <span className="text-sm">Produtos Ativos</span>
                </div>
                <Badge variant="secondary">
                  {activeProductsCount}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Clock className="h-4 w-4 text-orange-500" />
                  <span className="text-sm">Último Backup</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  Agora
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Activity className="h-4 w-4 text-purple-500" />
                  <span className="text-sm">Performance</span>
                </div>
                <Badge variant="outline" className="bg-green-50 text-green-700">
                  Excelente
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center">
                <BarChart className="h-4 w-4 mr-2" />
                Comparativo Semanal
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={150}>
                <BarChart data={dashboardData.weeklyComparison}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="day" 
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis hide />
                  <Tooltip 
                    formatter={(value, name) => [
                      `R$ ${value}`,
                      name === 'atual' ? 'Semana Atual' : 'Semana Anterior'
                    ]}
                  />
                  <Bar dataKey="anterior" fill="#e2e8f0" />
                  <Bar dataKey="atual" fill="hsl(var(--primary))" />
                </BarChart>
              </ResponsiveContainer>
              {dashboardData.weeklyComparison.every(item => item.atual === 0 && item.anterior === 0) && (
                <div className="text-center py-4 text-muted-foreground">
                  <BarChart className="h-6 w-6 mx-auto mb-2 opacity-50" />
                  <p className="text-xs">Dados insuficientes</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Data Tables */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Top Customers */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center">
                  <Users className="h-4 w-4 mr-2" />
                  Top 5 Clientes
                </span>
                <Button variant="ghost" size="sm" onClick={() => navigate("/customers")}>
                  Ver Todos
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {dashboardData.topCustomers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="font-medium">Nenhum cliente encontrado</p>
                  <p className="text-sm">Os melhores clientes aparecerão aqui</p>
                  <Button 
                    className="mt-4" 
                    variant="outline"
                    onClick={() => navigate("/customers")}
                  >
                    <Users className="h-4 w-4 mr-2" />
                    Gerenciar Clientes
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {dashboardData.topCustomers.map((customer, index) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="flex-shrink-0">
                          <Users className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="font-medium">{customer.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {customer.orders} pedidos • {customer.phone}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">R$ {customer.total.toFixed(2)}</p>
                        <Badge variant="outline">
                          #{index + 1}º lugar
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Top Products */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center">
                  <Star className="h-4 w-4 mr-2" />
                  Top 5 Produtos
                </span>
                <Button variant="ghost" size="sm" onClick={() => navigate("/products")}>
                  Ver Todos
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {dashboardData.topProducts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="font-medium">Nenhum produto vendido</p>
                  <p className="text-sm">Os produtos mais vendidos aparecerão aqui</p>
                  <Button 
                    className="mt-4" 
                    variant="outline"
                    onClick={() => navigate("/products")}
                  >
                    <Package className="h-4 w-4 mr-2" />
                    Gerenciar Produtos
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {dashboardData.topProducts.map((product, index) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="flex-shrink-0">
                          <Package className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="font-medium">{product.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {product.quantity} vendidos
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">R$ {product.revenue.toFixed(2)}</p>
                        <Badge variant="outline">
                          #{index + 1}º lugar
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent Orders, Delivery and Quick Actions */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Recent Orders */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center">
                  <Receipt className="h-4 w-4 mr-2" />
                  Pedidos Recentes
                </span>
                <Button variant="ghost" size="sm" onClick={() => navigate("/pdv")}>
                  Ver Todos
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {dashboardData.recentOrders.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <ShoppingCart className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="font-medium">Nenhum pedido encontrado</p>
                  <p className="text-sm">Os pedidos aparecerão aqui quando criados</p>
                  <Button 
                    className="mt-4" 
                    onClick={() => navigate("/pdv")}
                  >
                    <ShoppingCart className="h-4 w-4 mr-2" />
                    Criar Primeiro Pedido
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {dashboardData.recentOrders.map((order, index) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="flex-shrink-0">
                          <Receipt className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="font-medium">#{order.order_number}</p>
                          <p className="text-sm text-muted-foreground">
                            {order.customer_name || 'Cliente'} • {new Date(order.created_at).toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">R$ {order.total_amount.toFixed(2)}</p>
                        <Badge variant={order.status === 'completed' ? 'default' : 'secondary'}>
                          {order.status === 'completed' ? 'Concluído' : 'Pendente'}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Delivery Boys Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Truck className="h-4 w-4 mr-2" />
                Delivery - Pagamentos aos Motoboys
              </CardTitle>
              <CardDescription>
                Valores a pagar aos motoboys no período selecionado
              </CardDescription>
            </CardHeader>
            <CardContent>
              {dashboardData.deliveryBoysData.length > 0 ? (
                <div className="space-y-3">
                  {dashboardData.deliveryBoysData.map((boy) => (
                    <div key={boy.id} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold">{boy.name}</h3>
                        <Badge variant="default" className="text-base font-bold">
                          R$ {boy.total.toFixed(2)}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                        {boy.dailyRate > 0 && (
                          <div>
                            <span className="font-medium">Diária:</span> R$ {boy.dailyRate.toFixed(2)}
                          </div>
                        )}
                        <div>
                          <span className="font-medium">Entregas:</span> {boy.deliveriesCount}x
                        </div>
                        <div className="col-span-2">
                          <span className="font-medium">Total por entregas:</span> R$ {boy.deliveriesTotal.toFixed(2)}
                          {boy.deliveriesCount > 0 && (
                            <span className="text-xs ml-2">
                              ({boy.deliveriesCount} × R$ {boy.deliveryFee.toFixed(2)})
                            </span>
                          )}
                        </div>
                        {boy.dailyRate > 0 && (
                          <div className="col-span-2 pt-2 border-t">
                            <span className="font-medium text-foreground">Total: R$ {boy.dailyRate.toFixed(2)} + R$ {boy.deliveriesTotal.toFixed(2)} = R$ {boy.total.toFixed(2)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Truck className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-sm">Nenhuma entrega registrada no período selecionado</p>
                  <p className="text-xs mt-2">Os pagamentos aos motoboys aparecerão aqui após criar pedidos de entrega</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Zap className="h-4 w-4 mr-2" />
                Central de Ações
              </CardTitle>
              <CardDescription>
                Acesse rapidamente as principais funcionalidades do sistema
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-2">
                <Button 
                  className="h-20 flex-col space-y-2" 
                  onClick={() => navigate("/pdv")}
                >
                  <Receipt className="h-6 w-6" />
                  <span>Abrir PDV</span>
                </Button>
                <Button 
                  className="h-20 flex-col space-y-2" 
                  variant="outline"
                  onClick={() => navigate("/products")}
                >
                  <Package className="h-6 w-6" />
                  <span>Produtos</span>
                </Button>
                <Button 
                  className="h-20 flex-col space-y-2" 
                  variant="outline"
                  onClick={() => navigate("/customers")}
                >
                  <Users className="h-6 w-6" />
                  <span>Clientes</span>
                </Button>
                <Button 
                  className="h-20 flex-col space-y-2" 
                  variant="outline"
                  onClick={() => navigate("/orders")}
                >
                  <CreditCard className="h-6 w-6" />
                  <span>Pedidos</span>
                </Button>
              </div>
              
              <div className="mt-6 pt-6 border-t">
                <h4 className="text-sm font-medium mb-4 flex items-center">
                  <Settings className="h-4 w-4 mr-2" />
                  Configurações Rápidas
                </h4>
                <div className="grid gap-3 md:grid-cols-3">
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    className="justify-start"
                    onClick={() => navigate("/settings")}
                  >
                    <MapPin className="h-4 w-4 mr-2" />
                    Dados do Estabelecimento
                  </Button>
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    className="justify-start"
                    onClick={() => navigate("/costs")}
                  >
                    <Percent className="h-4 w-4 mr-2" />
                    Custos e Impostos
                  </Button>
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    className="justify-start"
                    onClick={() => navigate("/settings")}
                  >
                    <Truck className="h-4 w-4 mr-2" />
                    Delivery
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Additional Metrics */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Activity className="h-4 w-4 mr-2" />
              Resumo do Período
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center space-x-3">
                  <DollarSign className="h-5 w-5 text-green-500" />
                  <span className="text-sm">Faturamento Total</span>
                </div>
                <span className="font-medium">R$ {dashboardData.totalRevenue.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center space-x-3">
                  <ShoppingCart className="h-5 w-5 text-blue-500" />
                  <span className="text-sm">Total de Pedidos</span>
                </div>
                <span className="font-medium">{dashboardData.totalOrders}</span>
              </div>
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center space-x-3">
                  <Target className="h-5 w-5 text-orange-500" />
                  <span className="text-sm">Ticket Médio</span>
                </div>
                <span className="font-medium">R$ {dashboardData.averageTicket.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center space-x-3">
                  <Users className="h-5 w-5 text-purple-500" />
                  <span className="text-sm">Total de Clientes</span>
                </div>
                <span className="font-medium">{dashboardData.totalCustomers}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Dashboard;