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
      setCustomRange({ start: startISO, end: endISO });
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
      if (!session) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("establishment_id")
        .eq("user_id", session.user.id)
        .single();

      if (!profile?.establishment_id) return;

      // Calculate date range (suporta customRange)
      let startDate = new Date();
      let endDate = new Date();
      if (customRange) {
        startDate = new Date(`${customRange.start}T00:00:00`);
        endDate = new Date(`${customRange.end}T23:59:59`);
      } else {
        switch (timeRange) {
          case 'hoje':
            startDate.setHours(0, 0, 0, 0);
            break;
          case 'semana':
            startDate.setDate(startDate.getDate() - 7);
            break;
          case 'mes':
            startDate.setMonth(startDate.getMonth() - 1);
            break;
        }
      }

      // Calculate month start for monthly goals
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);

      // Get orders data (flat) - filter by range
      const { data: orders } = await supabase
        .from("orders")
        .select("*")
        .eq("establishment_id", profile.establishment_id)
        .gte("created_at", startDate.toISOString())
        .lte("created_at", endDate.toISOString())
        .order("created_at", { ascending: false });

      // Get monthly orders count for goals
      const { data: monthlyOrders } = await supabase
        .from("orders")
        .select("id")
        .eq("establishment_id", profile.establishment_id)
        .gte("created_at", monthStart.toISOString());

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

      // Get top 5 customers by total spending
      const { data: topCustomersData } = await supabase
        .from("orders")
        .select("customer_name, customer_phone, total_amount")
        .eq("establishment_id", profile.establishment_id)
        .not("customer_name", "is", null)
        .order("created_at", { ascending: false });

      // Aggregate customer data
      const customerTotals: { [key: string]: { name: string, phone: string, total: number, orders: number } } = {};
      topCustomersData?.forEach(order => {
        const key = order.customer_phone || order.customer_name;
        if (!customerTotals[key]) {
          customerTotals[key] = {
            name: order.customer_name || "Cliente",
            phone: order.customer_phone || "",
            total: 0,
            orders: 0
          };
        }
        customerTotals[key].total += order.total_amount;
        customerTotals[key].orders += 1;
      });

      const topCustomers = Object.values(customerTotals)
        .sort((a, b) => b.total - a.total)
        .slice(0, 5);

      if (orders) {
        const totalRevenue = orders.reduce((sum, order) => sum + order.total_amount, 0);
        const totalOrders = orders.length;
        const averageTicket = totalOrders > 0 ? totalRevenue / totalOrders : 0;

        // Category analysis + Top products without FK embeddings
        const colorPalette = ['#8884d8','#82ca9d','#ffc658','#ff7300','#34d399','#f43f5e'];

        let categoryData: { name: string; value: number; color: string }[] = [];
        let topProducts: { name: string; quantity: number; revenue: number }[] = [];

        if (orders.length > 0) {
          const orderIds = orders.map((o: any) => o.id);
          const { data: items } = await supabase
            .from('order_items')
            .select('order_id, product_id, quantity, total_price')
            .in('order_id', orderIds);

          const productIds = Array.from(new Set((items || []).map((i: any) => i.product_id).filter(Boolean)));
          const { data: products } = await supabase
            .from('products')
            .select('id, name, category_id')
            .in('id', productIds);

          const categoryIds = Array.from(new Set((products || []).map((p: any) => p.category_id).filter(Boolean)));
          const { data: categories } = await supabase
            .from('categories')
            .select('id, name')
            .in('id', categoryIds);

          const productMap = new Map((products || []).map((p: any) => [p.id, p]));
          const categoryMap = new Map((categories || []).map((c: any) => [c.id, c.name]));

          const categoryTotals: Record<string, number> = {};
          const productTotals: Record<string, { name: string; quantity: number; revenue: number }> = {};

          (items || []).forEach((item: any) => {
            const prod = productMap.get(item.product_id);
            const prodName = prod?.name || 'Produto';
            const catName = prod?.category_id ? (categoryMap.get(prod.category_id) || 'Outros') : 'Outros';

            categoryTotals[catName] = (categoryTotals[catName] || 0) + (item.total_price || 0);

            if (!productTotals[prodName]) {
              productTotals[prodName] = { name: prodName, quantity: 0, revenue: 0 };
            }
            productTotals[prodName].quantity += item.quantity || 0;
            productTotals[prodName].revenue += item.total_price || 0;
          });

          categoryData = Object.entries(categoryTotals).map(([name, value], idx) => ({
            name,
            value,
            color: colorPalette[idx % colorPalette.length]
          }));

          topProducts = Object.values(productTotals)
            .sort((a, b) => b.quantity - a.quantity)
            .slice(0, 5);
        }

        // Sales data por mês (últimos 6 meses)
        const salesData = [];
        const today = new Date();
        for (let i = 5; i >= 0; i--) {
          const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
          const monthName = date.toLocaleDateString('pt-BR', { month: 'short' });
          const monthOrders = orders.filter(order => {
            const orderDate = new Date(order.created_at);
            return orderDate.getMonth() === date.getMonth() && orderDate.getFullYear() === date.getFullYear();
          });
          salesData.push({
            name: monthName.charAt(0).toUpperCase() + monthName.slice(1),
            vendas: monthOrders.reduce((sum, order) => sum + order.total_amount, 0),
            pedidos: monthOrders.length,
            meta: establishment?.monthly_goal || 0
          });
        }

        // Daily data - horários de pico
        const hourlyTotals: { [key: string]: { valor: number, pedidos: number } } = {};
        orders.forEach(order => {
          const hour = new Date(order.created_at).getHours();
          const hourKey = `${hour.toString().padStart(2, '0')}:00`;
          if (!hourlyTotals[hourKey]) {
            hourlyTotals[hourKey] = { valor: 0, pedidos: 0 };
          }
          hourlyTotals[hourKey].valor += order.total_amount;
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
          
          const currentDayOrders = orders.filter(order => {
            const orderDate = new Date(order.created_at);
            return orderDate.toDateString() === currentWeekDay.toDateString();
          });
          
          const previousDayOrders = orders.filter(order => {
            const orderDate = new Date(order.created_at);
            return orderDate.toDateString() === previousWeekDay.toDateString();
          });
          
          weeklyComparison.push({
            day: dayNames[i],
            atual: currentDayOrders.reduce((sum, order) => sum + order.total_amount, 0),
            anterior: previousDayOrders.reduce((sum, order) => sum + order.total_amount, 0)
          });
        }

        // Calculate monthly totals for goals
        const monthlyRevenue = orders
          .filter((o: any) => new Date(o.created_at) >= monthStart)
          .reduce((sum: number, o: any) => sum + (o.total_amount || 0), 0);
        const monthlyOrdersCount = monthlyOrders?.length || 0;
        
        setMonthlyTotals({ revenue: monthlyRevenue, orders: monthlyOrdersCount });

        // Calculate delivery boys data
        const deliveryOrders = orders.filter((o: any) => o.delivery_boy_id && o.order_type === 'delivery');
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
          recentOrders: orders.slice(0, 10),
          topProducts,
          topCustomers,
          categoryData,
          salesData,
          dailyData,
          weeklyComparison,
          deliveryBoysData
        });
      }
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
        .select('establishment_id')
        .eq('user_id', session.user.id)
        .maybeSingle();

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
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Dashboard Executivo</h1>
            <p className="text-muted-foreground">
              {establishment?.name || "Bem-vindo ao burguer.IA"} - Visão completa do negócio
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <Tabs value={timeRange} onValueChange={setTimeRange} className="w-auto tabs-compact">
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