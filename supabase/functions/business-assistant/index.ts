import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY não configurada');
    }
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Credenciais do Supabase não configuradas');
    }

    // Use service role to bypass RLS for backend operations
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get authentication token from request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user session
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user profile and check plan
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('establishment_id, plan_type, subscription_type')
      .eq('user_id', user.id)
      .single();

    if (profileError) {
      console.error('Erro ao buscar perfil:', profileError);
      return new Response(
        JSON.stringify({ 
          error: 'Erro ao buscar perfil do usuário',
          reply: 'Erro ao buscar perfil do usuário. Tente novamente.'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!profile) {
      return new Response(
        JSON.stringify({ 
          error: 'Perfil não encontrado',
          reply: 'Perfil não encontrado. Entre em contato com o suporte.'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar se usuário tem acesso ao Assistente IA
    // Acesso permitido apenas para: Platinum, Premium ou Trial
    const planType = (profile.plan_type as string | null) || null;
    const subscriptionType = (profile.subscription_type as string | null) || null;
    const isTrial = subscriptionType === 'trial';
    const hasAIAccess = isTrial || planType === 'platinum' || planType === 'premium';


    if (!hasAIAccess) {
      // Retornar status 200 mas com erro no body para evitar problemas com supabase.functions.invoke
      return new Response(
        JSON.stringify({ 
          error: 'Acesso negado. Esta funcionalidade requer Plano Platinum ou Premium.',
          reply: 'Acesso negado. Esta funcionalidade requer Plano Platinum ou Premium.'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tenantId = profile.establishment_id;
    
    if (!tenantId) {
      return new Response(
        JSON.stringify({ 
          error: 'Estabelecimento não encontrado. Entre em contato com o suporte.',
          reply: 'Estabelecimento não encontrado. Entre em contato com o suporte.'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar se é Na Brasa (mesma lógica do Dashboard)
    // Buscar establishment para verificar nome
    const { data: establishment } = await supabase
      .from('establishments')
      .select('id, name')
      .eq('id', tenantId)
      .single();

    const userIsSystemAdmin = user.email === 'fellipe_1693@outlook.com';
    let isNaBrasa = false;
    
    if (!userIsSystemAdmin && establishment) {
      const establishmentName = establishment.name?.toLowerCase() || '';
      isNaBrasa = establishmentName.includes('na brasa') || 
                  establishmentName.includes('nabrasa') ||
                  establishmentName === 'hamburgueria na brasa';
      
    }

    // Parse request body
    let body;
    try {
      body = await req.json();
    } catch (e) {
      return new Response(
        JSON.stringify({ 
          error: 'Invalid JSON body',
          reply: 'Erro ao processar a solicitação. Verifique o formato da mensagem.'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { message } = body;
    if (!message || typeof message !== 'string') {
      return new Response(
        JSON.stringify({ 
          error: 'Mensagem é obrigatória',
          reply: 'Por favor, envie uma mensagem válida.'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse date from message to determine which period to query
    const parseDateFromMessage = (msg: string): { start: Date; end: Date; period: string } => {
      const now = new Date();
      const msgLower = msg.toLowerCase();
      
      // Month names in Portuguese
      const months: { [key: string]: number } = {
        'janeiro': 0, 'fevereiro': 1, 'março': 2, 'marco': 2,
        'abril': 3, 'maio': 4, 'junho': 5,
        'julho': 6, 'agosto': 7, 'setembro': 8,
        'outubro': 9, 'novembro': 10, 'dezembro': 11
      };

      // Check for date range patterns: "do dia X ao dia Y" or "de X a Y" or "entre X e Y"
      // Examples: "do dia 12 ao dia 20", "de 12 a 20", "entre 12 e 20 do mês passado"
      const rangePattern = /(?:do\s+dia\s+|de\s+|entre\s+)(\d{1,2})(?:\s+ao\s+dia\s+|\s+a\s+|\s+e\s+)(\d{1,2})/i;
      const rangeMatch = msg.match(rangePattern);
      
      if (rangeMatch) {
        const day1 = parseInt(rangeMatch[1]);
        const day2 = parseInt(rangeMatch[2]);
        
        // Try to find month in message
        let targetMonth = now.getMonth();
        let targetYear = now.getFullYear();
        let monthFound = false;
        
        for (const [monthName, monthIndex] of Object.entries(months)) {
          if (msgLower.includes(monthName)) {
            targetMonth = monthIndex;
            monthFound = true;
            break;
          }
        }
        
        // Check for "mês passado" or "mês anterior"
        if (msgLower.includes('mês passado') || msgLower.includes('mes passado') || 
            msgLower.includes('mês anterior') || msgLower.includes('mes anterior')) {
          targetMonth = now.getMonth() - 1;
          if (targetMonth < 0) {
            targetMonth = 11;
            targetYear = now.getFullYear() - 1;
          } else {
            targetYear = now.getFullYear();
          }
          monthFound = true;
        }
        
        // Check for year in message
        const yearMatch = msg.match(/\b(20\d{2})\b/);
        if (yearMatch) {
          targetYear = parseInt(yearMatch[1]);
        }
        
        // If no month found, assume current month
        if (!monthFound) {
          targetMonth = now.getMonth();
          targetYear = now.getFullYear();
        }
        
        const start = new Date(targetYear, targetMonth, Math.min(day1, day2), 0, 0, 0, 0);
        const end = new Date(targetYear, targetMonth, Math.max(day1, day2), 23, 59, 59, 999);
        
        const monthName = Object.keys(months).find(k => months[k] === targetMonth) || '';
        return { 
          start, 
          end, 
          period: `do dia ${Math.min(day1, day2)} ao dia ${Math.max(day1, day2)} de ${monthName} de ${targetYear}` 
        };
      }

      // Check for specific month
      for (const [monthName, monthIndex] of Object.entries(months)) {
        if (msgLower.includes(monthName)) {
          // Check if year is mentioned in the message
          const yearMatch = msg.match(/\b(20\d{2})\b/);
          let year = yearMatch ? parseInt(yearMatch[1]) : null;
          
          // If no year mentioned, use current year (most recent data)
          // If asking about a future month, use previous year
          if (!year) {
            const currentMonth = now.getMonth();
            if (monthIndex > currentMonth) {
              // Month is in the future, use previous year
              year = now.getFullYear() - 1;
            } else {
              // Month is current or past, use current year
              year = now.getFullYear();
            }
          }
          
          // Check for date range within month: "do dia X ao dia Y de [mês]"
          const monthRangePattern = new RegExp(`(?:do\\s+dia\\s+|de\\s+|entre\\s+)(\\d{1,2})(?:\\s+ao\\s+dia\\s+|\\s+a\\s+|\\s+e\\s+)(\\d{1,2}).*${monthName}`, 'i');
          const monthRangeMatch = msg.match(monthRangePattern);
          
          if (monthRangeMatch) {
            const day1 = parseInt(monthRangeMatch[1]);
            const day2 = parseInt(monthRangeMatch[2]);
            const start = new Date(year, monthIndex, Math.min(day1, day2), 0, 0, 0, 0);
            const end = new Date(year, monthIndex, Math.max(day1, day2), 23, 59, 59, 999);
            return { 
              start, 
              end, 
              period: `do dia ${Math.min(day1, day2)} ao dia ${Math.max(day1, day2)} de ${monthName} de ${year}` 
            };
          }
          
          // Create dates in local timezone first, then convert to ISO
          // This matches how Dashboard calculates dates
          const start = new Date(year, monthIndex, 1, 0, 0, 0, 0);
          const end = new Date(year, monthIndex + 1, 0, 23, 59, 59, 999);
          
          
          return { start, end, period: `mês de ${monthName} de ${year}` };
        }
      }

      // Check for "hoje" / "today"
      if (msgLower.includes('hoje') || msgLower.includes('today')) {
        const start = new Date(now);
        start.setHours(0, 0, 0, 0);
        const end = new Date(now);
        end.setHours(23, 59, 59, 999);
        return { start, end, period: 'hoje' };
      }

      // Check for specific date patterns FIRST (DD/MM or DD/MM/YYYY)
      // This should be checked BEFORE "ontem" to prioritize specific dates
      // IMPORTANTE: Dashboard usa timezone local (Brasil UTC-3), então devemos fazer o mesmo
      // Dashboard cria: new Date(`${customRange.start}T00:00:00`) que interpreta como local time
      // Na Edge Function (UTC), precisamos ajustar para o timezone do Brasil (UTC-3)
      const datePattern = /(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?/;
      const dateMatch = msg.match(datePattern);
      if (dateMatch) {
        const day = parseInt(dateMatch[1]);
        const month = parseInt(dateMatch[2]) - 1;
        const year = dateMatch[3] ? parseInt(dateMatch[3]) : now.getFullYear();
        
        // Criar datas no formato do Dashboard (YYYY-MM-DDTHH:mm:ss)
        // IMPORTANTE: Dashboard interpreta como local time (Brasil UTC-3)
        // Na Edge Function, precisamos criar em UTC mas ajustar para o timezone do Brasil
        // Brasil UTC-3: quando é 00:00:00 no Brasil, é 03:00:00 UTC
        // Então: 14/11/2025 00:00:00 (Brasil) = 14/11/2025 03:00:00 UTC
        // E: 14/11/2025 23:59:59 (Brasil) = 15/11/2025 02:59:59 UTC
        
        // Criar data no timezone do Brasil (UTC-3)
        // Usar formato ISO com timezone explícito
        const startStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}T00:00:00-03:00`;
        const endStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}T23:59:59-03:00`;
        const start = new Date(startStr);
        const end = new Date(endStr);
        
        return { start, end, period: `${day}/${month + 1}/${year}` };
      }

      // Check for "ontem" / "yesterday" (only if no specific date was found)
      if (msgLower.includes('ontem') || msgLower.includes('yesterday')) {
        const start = new Date(now);
        start.setDate(start.getDate() - 1);
        start.setHours(0, 0, 0, 0);
        const end = new Date(now);
        end.setDate(end.getDate() - 1);
        end.setHours(23, 59, 59, 999);
        return { start, end, period: 'ontem' };
      }

      // Check for "semana" / "week"
      if (msgLower.includes('semana') || msgLower.includes('week')) {
        const start = new Date(now);
        start.setDate(start.getDate() - 7);
        start.setHours(0, 0, 0, 0);
        const end = new Date(now);
        end.setHours(23, 59, 59, 999);
        return { start, end, period: 'última semana' };
      }

      // Check for "mês" / "month" (current month)
      if (msgLower.includes('mês') || msgLower.includes('mes') || msgLower.includes('month')) {
        const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
        const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        return { start, end, period: 'mês atual' };
      }

      // Default: last 30 days
      const start = new Date(now);
      start.setDate(start.getDate() - 30);
      start.setHours(0, 0, 0, 0);
      const end = new Date(now);
      end.setHours(23, 59, 59, 999);
      return { start, end, period: 'últimos 30 dias' };
    };

    const { start: queryStart, end: queryEnd, period: initialQueryPeriod } = parseDateFromMessage(message);
    let queryPeriod = initialQueryPeriod;
    
    // Get current date ranges for general data
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);

    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);
    weekAgo.setHours(0, 0, 0, 0);

    const monthStart = new Date(now);
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    // Fetch sales data for the queried period - EXACT same logic as Dashboard
    // Dashboard: gets all orders in range, then calculates revenue with Number()
    
    // Now query for the specific period
    // IMPORTANTE: Aplicar o mesmo filtro do Dashboard
    let queriedOrders: any[] = [];
    let queriedOrdersError: any = null;
    
    // IMPORTANTE: Para TODOS os estabelecimentos (Premium/Platinum), buscar todos os pedidos no período
    // O filtro especial só se aplica ao Na Brasa
    let periodOrdersQuery = supabase
      .from('orders')
      .select('id, total_amount, created_at, status, source_domain, channel, origin, accepted_and_printed_at')
      .eq('establishment_id', tenantId)
      .gte('created_at', queryStart.toISOString())
      .lte('created_at', queryEnd.toISOString());
    
    
    // FILTRO ESPECIAL: Apenas para Na Brasa
    // Para outros estabelecimentos, TODOS os pedidos são contados (sem filtro)
    // Para Na Brasa: pedidos do site só contam se accepted_and_printed_at não for null
    // OU pedidos que não são do site (sem source_domain/channel online)
    if (isNaBrasa) {
      // Usar a mesma sintaxe exata do Dashboard
      periodOrdersQuery = periodOrdersQuery.or(`accepted_and_printed_at.not.is.null,source_domain.is.null,channel.neq.online,origin.neq.site`);
    }
    
    const { data: periodOrders, error: periodError } = await periodOrdersQuery.order('created_at', { ascending: false });

    if (periodError) {
      console.error('Error fetching queried orders:', periodError);
      queriedOrdersError = periodError;
    } else {
      queriedOrders = periodOrders || [];
    }

    // If no orders found and no year was specified, try current year
    if (queriedOrders.length === 0 && !message.match(/\b(20\d{2})\b/)) {
      const currentYear = new Date().getFullYear();
      const monthMatch = message.toLowerCase().match(/(janeiro|fevereiro|março|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)/);
      if (monthMatch) {
        const months: { [key: string]: number } = {
          'janeiro': 0, 'fevereiro': 1, 'março': 2, 'marco': 2,
          'abril': 3, 'maio': 4, 'junho': 5,
          'julho': 6, 'agosto': 7, 'setembro': 8,
          'outubro': 9, 'novembro': 10, 'dezembro': 11
        };
        const monthIndex = months[monthMatch[1]];
        const altStart = new Date(currentYear, monthIndex, 1, 0, 0, 0, 0);
        const altEnd = new Date(currentYear, monthIndex + 1, 0, 23, 59, 59, 999);
        
        let altOrdersQuery = supabase
          .from('orders')
          .select('id, total_amount, created_at, status, source_domain, channel, origin, accepted_and_printed_at')
          .eq('establishment_id', tenantId)
          .gte('created_at', altStart.toISOString())
          .lte('created_at', altEnd.toISOString());
        
        // Aplicar mesmo filtro para Na Brasa
        if (isNaBrasa) {
          altOrdersQuery = altOrdersQuery.or(`accepted_and_printed_at.not.is.null,source_domain.is.null,channel.neq.online,origin.neq.site`);
        }
        
        const { data: altOrders } = await altOrdersQuery.order('created_at', { ascending: false });
        
        if (altOrders && altOrders.length > 0) {
          queriedOrders = altOrders;
          // Update queryPeriod to reflect the actual year used
          queryPeriod = `mês de ${monthMatch[1]} de ${currentYear}`;
        }
      }
    }


    // IMPORTANTE: Dashboard calcula revenue com TODOS os pedidos, não apenas completed
    // Isso se aplica a TODOS os estabelecimentos (Premium/Platinum)
    // Line 463 do Dashboard: const totalRevenue = ordersArray.reduce((sum: number, order: any) => sum + (Number(order.total_amount) || 0), 0);
    // Então devemos fazer o mesmo aqui para garantir consistência
    const queriedRevenue = queriedOrders.reduce((sum: number, o: any) => sum + (Number(o.total_amount) || 0), 0);
    const queriedOrdersCount = queriedOrders.length;
    const queriedTicketAvg = queriedOrdersCount > 0 ? queriedRevenue / queriedOrdersCount : 0;

    // Also fetch general data for context (today, week, month)
    // IMPORTANTE: Para TODOS os estabelecimentos, buscar todos os pedidos
    // O filtro especial só se aplica ao Na Brasa
    const buildOrdersQuery = (start: Date, end: Date) => {
      let query = supabase
        .from('orders')
        .select('id, total_amount, created_at, status, source_domain, channel, origin, accepted_and_printed_at')
        .eq('establishment_id', tenantId)
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString());
      
      // FILTRO ESPECIAL: Apenas para Na Brasa
      // Para outros estabelecimentos, TODOS os pedidos são contados (sem filtro)
      if (isNaBrasa) {
        query = query.or(`accepted_and_printed_at.not.is.null,source_domain.is.null,channel.neq.online,origin.neq.site`);
      }
      
      return query;
    };

    const [todayOrders, weekOrders, monthOrders] = await Promise.all([
      buildOrdersQuery(todayStart, todayEnd),
      buildOrdersQuery(weekAgo, now),
      buildOrdersQuery(monthStart, now)
    ]);

    // IMPORTANTE: Dashboard calcula revenue com TODOS os pedidos, não apenas completed
    // Linha 463 do Dashboard: const totalRevenue = ordersArray.reduce((sum: number, order: any) => sum + (Number(order.total_amount) || 0), 0);
    // Então devemos fazer o mesmo aqui
    const todayOrdersArray = todayOrders.data || [];
    const weekOrdersArray = weekOrders.data || [];
    const monthOrdersArray = monthOrders.data || [];

    // Use Number() exactly like Dashboard does - TODOS os pedidos, não apenas completed
    const todayRevenue = todayOrdersArray.reduce((sum: number, o: any) => sum + (Number(o.total_amount) || 0), 0);
    const weekRevenue = weekOrdersArray.reduce((sum: number, o: any) => sum + (Number(o.total_amount) || 0), 0);
    const monthRevenue = monthOrdersArray.reduce((sum: number, o: any) => sum + (Number(o.total_amount) || 0), 0);
    
    // Para análise de produtos, usar apenas completed
    const todaySales = todayOrdersArray.filter(o => o.status === 'completed');
    const weekSales = weekOrdersArray.filter(o => o.status === 'completed');
    const monthSales = monthOrdersArray.filter(o => o.status === 'completed');

    const todayTicketAvg = todaySales.length > 0 ? todayRevenue / todaySales.length : 0;

    // Get top products for the queried period - use the same queriedOrders we already fetched
    // Filter completed for product analysis (products need completed orders)
    const completedOrdersForProducts = queriedOrders.filter(o => o.status === 'completed');
    const orderIds = completedOrdersForProducts.map(o => o.id);
    
    // Get order items for these orders
    let recentOrderItems: any[] = [];
    if (orderIds.length > 0) {
      const { data: orderItemsData, error: orderItemsError } = await supabase
        .from('order_items')
        .select('product_id, quantity, unit_price, total_price')
        .in('order_id', orderIds)
        .not('product_id', 'is', null);

      if (orderItemsError) {
        console.error('Error fetching order items:', orderItemsError);
      } else {
        recentOrderItems = orderItemsData || [];
      }
    }


    // Calculate product sales
    const productSales = new Map<string, { name: string; quantity: number; revenue: number; unit_price: number }>();
    
    for (const item of recentOrderItems) {
      if (!item.product_id) continue;
      
      const productId = item.product_id;
      if (!productSales.has(productId)) {
        productSales.set(productId, {
          name: '',
          quantity: 0,
          revenue: 0,
          unit_price: parseFloat(item.unit_price) || 0
        });
      }
      const product = productSales.get(productId)!;
      product.quantity += item.quantity || 0;
      product.revenue += parseFloat(item.total_price) || 0;
    }

    // Get product names and costs
    const productIds = Array.from(productSales.keys());
    let products: any[] = [];
    
    if (productIds.length > 0) {
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('id, name, price, variable_cost')
        .in('id', productIds)
        .eq('establishment_id', tenantId);

      if (productsError) {
        console.error('Error fetching products:', productsError);
      } else if (productsData) {
        products = productsData;
        for (const product of products) {
          const sales = productSales.get(product.id);
          if (sales) {
            sales.name = product.name;
          }
        }
      }
    }

    // If no sales data, get all products as fallback
    if (products.length === 0) {
      const { data: allProducts, error: allProductsError } = await supabase
        .from('products')
        .select('id, name, price, variable_cost')
        .eq('establishment_id', tenantId)
        .eq('active', true)
        .limit(50);

      if (!allProductsError && allProducts) {
        products = allProducts;
        // Initialize with zero sales
        for (const product of products) {
          if (!productSales.has(product.id)) {
            productSales.set(product.id, {
              name: product.name,
              quantity: 0,
              revenue: 0,
              unit_price: parseFloat(product.price) || 0
            });
          }
        }
      }
    }

    // Calculate profitability - match by product ID instead of name
    const productsWithProfit = Array.from(productSales.entries())
      .map(([productId, sales]) => {
        const product = products.find(p => p.id === productId);
        const cost = parseFloat(product?.variable_cost || '0');
        const revenue = sales.revenue;
        const profit = revenue - (cost * sales.quantity);
        const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
        return {
          id: productId,
          name: sales.name || product?.name || 'Produto sem nome',
          quantity: sales.quantity,
          revenue: revenue,
          cost: cost,
          profit: profit,
          margin: margin,
          unit_price: sales.unit_price || parseFloat(product?.price || '0')
        };
      })
      .filter(p => p.name && p.name !== 'Produto sem nome')
      .sort((a, b) => b.revenue - a.revenue);

    const topProducts = productsWithProfit.filter(p => p.quantity > 0).slice(0, 10);
    const mostProfitable = [...productsWithProfit]
      .filter(p => p.profit > 0)
      .sort((a, b) => b.profit - a.profit)
      .slice(0, 10);
    const lowMargin = productsWithProfit.filter(p => p.margin < 30 && p.margin > 0 && p.revenue > 0).slice(0, 10);
    

    // Get hourly sales pattern (last 30 days) - usar TODOS os pedidos, não apenas completed
    // Buscar pedidos dos últimos 30 dias
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    thirtyDaysAgo.setHours(0, 0, 0, 0);
    
    let last30DaysQuery = supabase
      .from('orders')
      .select('id, total_amount, created_at, status, source_domain, channel, origin, accepted_and_printed_at')
      .eq('establishment_id', tenantId)
      .gte('created_at', thirtyDaysAgo.toISOString())
      .lte('created_at', now.toISOString());
    
    // Para Na Brasa: aplicar mesmo filtro
    if (isNaBrasa) {
      last30DaysQuery = last30DaysQuery.or(`accepted_and_printed_at.not.is.null,source_domain.is.null,channel.neq.online,origin.neq.site`);
    }
    
    const { data: last30DaysOrders } = await last30DaysQuery;
    const last30DaysOrdersArray = last30DaysOrders || [];
    
    const hourlySales = new Map<number, { orders: number; revenue: number }>();
    for (let h = 0; h < 24; h++) {
      hourlySales.set(h, { orders: 0, revenue: 0 });
    }

    // Converter hora de UTC para horário local do Brasil (UTC-3)
    // O Supabase armazena created_at em UTC, então precisamos converter para o horário do Brasil
    // Usar toLocaleString com timezone 'America/Sao_Paulo' para garantir conversão correta
    last30DaysOrdersArray.forEach(order => {
      const orderDate = new Date(order.created_at);
      // Converter para horário local do Brasil usando toLocaleString
      // Isso garante que a conversão de timezone seja feita corretamente
      const brazilHourStr = orderDate.toLocaleString('pt-BR', { 
        timeZone: 'America/Sao_Paulo', 
        hour: '2-digit', 
        hour12: false 
      });
      const brazilHour = parseInt(brazilHourStr, 10);
      
      const current = hourlySales.get(brazilHour) || { orders: 0, revenue: 0 };
      hourlySales.set(brazilHour, {
        orders: current.orders + 1,
        revenue: current.revenue + (Number(order.total_amount) || 0)
      });
    });

    // Formatar horários como "HH:00" para melhor compreensão da IA
    const topHours = Array.from(hourlySales.entries())
      .map(([hour, data]) => ({ hour, hourFormatted: `${hour.toString().padStart(2, '0')}:00`, ...data }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5)
      .map(h => h.hourFormatted);

    const weakHours = Array.from(hourlySales.entries())
      .map(([hour, data]) => ({ hour, hourFormatted: `${hour.toString().padStart(2, '0')}:00`, ...data }))
      .filter(h => h.orders > 0)
      .sort((a, b) => a.revenue - b.revenue)
      .slice(0, 5)
      .map(h => h.hourFormatted);

    // Get day of week pattern
    const daySales = new Map<number, { orders: number; revenue: number }>();
    for (let d = 0; d < 7; d++) {
      daySales.set(d, { orders: 0, revenue: 0 });
    }

    weekSales.forEach(order => {
      const orderDate = new Date(order.created_at);
      const day = orderDate.getDay();
      const current = daySales.get(day) || { orders: 0, revenue: 0 };
      daySales.set(day, {
        orders: current.orders + 1,
        revenue: current.revenue + (parseFloat(order.total_amount) || 0)
      });
    });

    const topDays = Array.from(daySales.entries())
      .map(([day, data]) => ({ day, ...data }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 3)
      .map(d => d.day);

    // Check for declining products (compare last 7 days vs previous 7 days)
    const twoWeeksAgo = new Date(now);
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
    twoWeeksAgo.setHours(0, 0, 0, 0);

    // Get previous week orders
    const { data: previousWeekOrders } = await supabase
      .from('orders')
      .select('id')
      .eq('establishment_id', tenantId)
      .eq('status', 'completed')
      .gte('created_at', twoWeeksAgo.toISOString())
      .lt('created_at', weekAgo.toISOString());

    const previousWeekSales = new Map<string, number>();
    if (previousWeekOrders && previousWeekOrders.length > 0) {
      const prevOrderIds = previousWeekOrders.map(o => o.id);
      const { data: previousWeekItems } = await supabase
        .from('order_items')
        .select('product_id, quantity')
        .in('order_id', prevOrderIds)
        .not('product_id', 'is', null);

      previousWeekItems?.forEach(item => {
        if (item.product_id) {
          const current = previousWeekSales.get(item.product_id) || 0;
          previousWeekSales.set(item.product_id, current + (item.quantity || 0));
        }
      });
    }

    // Get current week sales from order items
    const currentWeekSales = new Map<string, number>();
    if (orderIds.length > 0) {
      // Get orders from last week
      const { data: weekOrdersData } = await supabase
        .from('orders')
        .select('id, created_at')
        .eq('establishment_id', tenantId)
        .eq('status', 'completed')
        .gte('created_at', weekAgo.toISOString())
        .lte('created_at', now.toISOString());

      if (weekOrdersData && weekOrdersData.length > 0) {
        const weekOrderIds = weekOrdersData.map(o => o.id);
        const { data: weekItems } = await supabase
          .from('order_items')
          .select('product_id, quantity')
          .in('order_id', weekOrderIds)
          .not('product_id', 'is', null);

        weekItems?.forEach(item => {
          if (item.product_id) {
            const current = currentWeekSales.get(item.product_id) || 0;
            currentWeekSales.set(item.product_id, current + (item.quantity || 0));
          }
        });
      }
    }

    const decliningProducts: string[] = [];
    previousWeekSales.forEach((prevQty, productId) => {
      const currentQty = currentWeekSales.get(productId) || 0;
      if (prevQty > 0 && currentQty < prevQty * 0.7) { // 30% decline
        const product = products.find(p => p.id === productId);
        if (product) {
          decliningProducts.push(product.name);
        }
      }
    });

    // Prepare data structure for AI
    const businessData = {
      question: message,
      data: {
        sales_summary: {
          queried_period: {
            period: queryPeriod,
            revenue: queriedRevenue,
            orders: queriedOrdersCount,
            ticket_avg: queriedTicketAvg,
            start_date: queryStart.toISOString(),
            end_date: queryEnd.toISOString()
          },
          today: {
            revenue: todayRevenue,
            orders: todaySales.length,
            ticket_avg: todayTicketAvg
          },
          week: {
            revenue: weekRevenue,
            orders: weekSales.length
          },
          month: {
            revenue: monthRevenue,
            orders: monthSales.length
          }
        },
        products: {
          top_selling: topProducts.map(p => ({
            name: p.name,
            quantity: p.quantity,
            revenue: p.revenue,
            margin: p.margin
          })),
          most_profitable: mostProfitable.map(p => ({
            name: p.name,
            profit: p.profit,
            margin: p.margin,
            revenue: p.revenue,
            quantity: p.quantity
          })),
          low_margin: lowMargin.map(p => ({
            name: p.name,
            margin: p.margin,
            revenue: p.revenue,
            quantity: p.quantity
          })),
          declining: decliningProducts,
          all_products: productsWithProfit.map(p => ({
            name: p.name,
            quantity: p.quantity,
            revenue: p.revenue,
            profit: p.profit,
            margin: p.margin,
            cost: p.cost
          }))
        },
        top_hours: topHours,
        weak_hours: weakHours,
        top_days: topDays,
        margins: productsWithProfit.map(p => ({
          name: p.name,
          margin: p.margin,
          revenue: p.revenue
        }))
      }
    };

    // Call OpenAI
    const systemPrompt = `Você é um assistente de negócios especializado em hamburguerias, pizzarias e lanchonetes.
Você recebe sempre:
1) uma pergunta do dono do restaurante
2) um JSON com dados reais da operação dele

REGRAS CRÍTICAS:
- Use SEMPRE os dados do JSON fornecido. Os dados estão presentes mesmo que algumas listas estejam vazias.
- IMPORTANTE: Se a pergunta mencionar um período específico (ex: "novembro", "dezembro", "hoje", "semana"), use SEMPRE os dados de "queried_period" que contém os dados EXATOS do período perguntado.
- "queried_period" contém: period (descrição), revenue (faturamento), orders (pedidos), ticket_avg (ticket médio), start_date e end_date.
- Se "top_selling" ou "most_profitable" estiverem vazios, use a lista "margins" que contém TODOS os produtos com suas margens.
- Se "margins" estiver vazio mas houver dados em "sales_summary", significa que há vendas mas sem detalhamento de produtos. Nesse caso, use os dados agregados de vendas.
- NUNCA diga que não há dados suficientes se houver qualquer informação no JSON (mesmo que sejam apenas totais de vendas).
- Se houver produtos em "margins", use-os para responder sobre produtos mais lucrativos, mesmo que "most_profitable" esteja vazio.
- Sempre dê respostas consultivas e práticas baseadas nos dados disponíveis.
- Quando sugerir promoções, mantenha margem mínima de 30%.
- Sempre responda em português do Brasil.
- Seja direto, amigável e objetivo.
- Se os dados de produtos estiverem vazios mas houver dados de vendas, foque em análises de vendas gerais, ticket médio e horários.
- Se a pergunta for sobre um período específico, use APENAS os dados de "queried_period" e ignore os outros períodos (today, week, month) a menos que seja para comparação.
- IMPORTANTE: Os horários em "top_hours" e "weak_hours" estão no formato "HH:00" (ex: "20:00", "21:00") e representam o horário local do Brasil. Use SEMPRE esses horários formatados ao responder sobre horários de pico.
- CRÍTICO: Se "top_hours" contiver horários como "00:00" ou "01:00" (madrugada), isso pode indicar um problema de conversão de timezone. Nesse caso, verifique se os horários fazem sentido para um estabelecimento de comida. Se não fizerem sentido, mencione que pode haver um problema nos dados e sugira verificar os horários de funcionamento.
- Se os horários de pico estiverem em horários noturnos normais (ex: "19:00", "20:00", "21:00", "22:00", "23:00"), mencione-os normalmente.
- NUNCA mencione horários de madrugada (00:00-06:00) como horários de pico a menos que realmente sejam os horários mais movimentados e isso faça sentido para o tipo de estabelecimento.
- Sempre liste os horários de pico no formato exato fornecido em "top_hours" (ex: "20:00", "21:00").`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: JSON.stringify(businessData, null, 2) }
        ],
        temperature: 0.7,
        max_tokens: 1000
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', errorText);
      throw new Error('Erro ao processar com IA');
    }

    const aiResponse = await response.json();
    const reply = aiResponse.choices[0]?.message?.content || 'Desculpe, não consegui processar sua pergunta.';

    return new Response(
      JSON.stringify({ reply }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error: any) {
    console.error('Error in business-assistant:', error);
    const errorMessage = error?.message || error?.toString() || 'Erro interno do servidor';
    console.error('Error details:', {
      message: errorMessage,
      stack: error?.stack,
      name: error?.name
    });
    
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        reply: 'Desculpe, ocorreu um erro ao processar sua solicitação. Por favor, verifique se você tem Plano Platinum ou Premium e tente novamente.'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

