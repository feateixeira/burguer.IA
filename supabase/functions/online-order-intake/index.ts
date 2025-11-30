import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://hamburguerianabrasa.com.br',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-estab-key, idempotency-key',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Configuração do Supabase não encontrada');
    }

    // Use service role to bypass RLS
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Validate required headers
    const apiKey = req.headers.get('x-estab-key');
    const idempotencyKey = req.headers.get('idempotency-key');

    if (!apiKey) {
      return new Response(JSON.stringify({ 
        ok: false, 
        error: 'X-Estab-Key header obrigatório' 
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!idempotencyKey) {
      return new Response(JSON.stringify({ 
        ok: false, 
        error: 'Idempotency-Key header obrigatório' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate API key and get establishment
    const { data: establishment, error: estabError } = await supabase
      .from('establishments')
      .select('id, name')
      .eq('api_key', apiKey)
      .single();

    if (estabError || !establishment) {
      console.error('Invalid API key:', estabError);
      return new Response(JSON.stringify({ 
        ok: false, 
        error: 'API Key inválida' 
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check idempotency
    const { data: existingKey, error: idempotencyError } = await supabase
      .from('idempotency_keys')
      .select('order_id')
      .eq('key', idempotencyKey)
      .eq('establishment_id', establishment.id)
      .maybeSingle();

    if (existingKey) {
      return new Response(JSON.stringify({
        ok: true,
        order_id: existingKey.order_id,
        print_queued: true,
        idempotent: true
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse request body
    const body = await req.json();
    const { order, source_domain, estabelecimento_slug } = body;

    if (!order) {
      throw new Error('Order não encontrado no body');
    }

    // Extract category quantities from order (burger, side, drink)
    // These come from the external website
    
    const siteCategoryQuantities: Record<string, number> = {};
    
    // PRIMEIRO: Verificar em order.meta.categorySummary (formato atual do site)
    if (order.meta?.categorySummary && typeof order.meta.categorySummary === 'object') {
      if (order.meta.categorySummary.burger !== undefined && order.meta.categorySummary.burger !== null) {
        siteCategoryQuantities.burger = Number(order.meta.categorySummary.burger) || 0;
      }
      if (order.meta.categorySummary.side !== undefined && order.meta.categorySummary.side !== null) {
        siteCategoryQuantities.side = Number(order.meta.categorySummary.side) || 0;
      }
      if (order.meta.categorySummary.drink !== undefined && order.meta.categorySummary.drink !== null) {
        siteCategoryQuantities.drink = Number(order.meta.categorySummary.drink) || 0;
      }
    }
    
    // FALLBACK: Verificar diretamente no objeto order (caso venha no formato antigo)
    if (Object.keys(siteCategoryQuantities).length === 0) {
      if (order.burger !== undefined && order.burger !== null) {
        siteCategoryQuantities.burger = Number(order.burger) || 0;
      }
      if (order.side !== undefined && order.side !== null) {
        siteCategoryQuantities.side = Number(order.side) || 0;
      }
      if (order.drink !== undefined && order.drink !== null) {
        siteCategoryQuantities.drink = Number(order.drink) || 0;
      }
    }
    
    // FALLBACK: Verificar em order.categories se existir
    if (Object.keys(siteCategoryQuantities).length === 0 && order.categories && typeof order.categories === 'object') {
      if (order.categories.burger !== undefined) {
        siteCategoryQuantities.burger = Number(order.categories.burger) || 0;
      }
      if (order.categories.side !== undefined) {
        siteCategoryQuantities.side = Number(order.categories.side) || 0;
      }
      if (order.categories.drink !== undefined) {
        siteCategoryQuantities.drink = Number(order.categories.drink) || 0;
      }
    }

    // Generate order number
    // Gerar número de pedido sequencial usando função RPC
    // Se não houver caixa aberto, a função retorna número com timestamp
    let orderNumber: string;
    try {
      const { data: generatedNumber, error: orderNumberError } = await supabase.rpc(
        'get_next_order_number',
        { p_establishment_id: establishment.id }
      );
      
      if (orderNumberError || !generatedNumber) {
        console.warn('Error generating sequential order number, using fallback:', orderNumberError);
        orderNumber = `WEB-${Date.now()}`;
      } else {
        orderNumber = generatedNumber;
      }
    } catch (error) {
      console.warn('Exception generating sequential order number, using fallback:', error);
      orderNumber = `WEB-${Date.now()}`;
    }

    // Calculate totals
    const subtotal = order.totals?.subtotal || 0;
    const deliveryFee = order.totals?.delivery_fee || 0;
    const discountAmount = order.totals?.discount || 0;
    const totalAmount = order.totals?.final_total || (subtotal + deliveryFee - discountAmount);

    // Preparar nome do cliente ANTES de extrair serviceType (para poder verificar no nome)
    const customerNameRaw = order.customer?.name || 'Cliente Online';
    
    // Extrair informação de "comer no local" ou "embalar pra levar"
    // Essa informação deve aparecer ao lado do nome do cliente, não nas instruções
    let serviceType: string | null = null; // "comer no local" ou "embalar pra levar"
    
    // Verifica em vários lugares onde essa informação pode vir
    // PRIORIDADE 1: Campos específicos do pedido
    if (order.meta?.dine_in === true || order.meta?.dineIn === true || order.meta?.service_type === 'dine_in') {
      serviceType = 'comer no local';
    } else if (order.meta?.takeout === true || order.meta?.takeOut === true || order.meta?.service_type === 'takeout') {
      serviceType = 'embalar pra levar';
    } else if (order.dine_in === true || order.dineIn === true) {
      serviceType = 'comer no local';
    } else if (order.takeout === true || order.takeOut === true) {
      serviceType = 'embalar pra levar';
    }
    
    // PRIORIDADE 2: Verificar no nome do cliente (pode vir do site)
    if (!serviceType && customerNameRaw) {
      const customerNameLower = customerNameRaw.toLowerCase();
      if (customerNameLower.includes('comer no local') || customerNameLower.includes('comer no estabelecimento')) {
        serviceType = 'comer no local';
      } else if (customerNameLower.includes('embalar') && (customerNameLower.includes('para levar') || customerNameLower.includes('pra levar'))) {
        serviceType = 'embalar pra levar';
      } else if (customerNameLower.includes('embalar') || customerNameLower.includes('para levar') || customerNameLower.includes('pra levar')) {
        serviceType = 'embalar pra levar';
      }
    }
    
    // PRIORIDADE 3: Tenta extrair das instruções ou do whatsapp_message_preview
    if (!serviceType) {
      const instructionsText = order.instructions || order.general_instructions || order.order_instructions || '';
      const whatsappPreview = order.meta?.whatsapp_message_preview || '';
      const combinedText = `${instructionsText} ${whatsappPreview}`.toLowerCase();
      
      if (combinedText.includes('comer no local') || combinedText.includes('comer no estabelecimento')) {
        serviceType = 'comer no local';
      } else if (combinedText.includes('embalar') && (combinedText.includes('para levar') || combinedText.includes('pra levar'))) {
        serviceType = 'embalar pra levar';
      } else if (combinedText.includes('embalar') || combinedText.includes('para levar') || combinedText.includes('pra levar')) {
        serviceType = 'embalar pra levar';
      }
    }
    
    // Capturar instruções gerais do pedido (pode vir em vários campos)
    // Vamos remover serviceType depois, quando for adicionar ao orderNotes
    let generalInstructions = order.instructions || order.general_instructions || order.order_instructions || null;
    
    // Extrair informações de trio dos itens do pedido
    // O site envia de várias formas:
    // 1. No nome do item: "+ Trio (Batata pequena + Coca-Cola lata)"
    // 2. Como linha separada: "Trio: Batata pequena + Coca-Cola lata" 
    // 3. Nos complements do payload
    const trioInfo: string[] = [];
    
    // Primeiro, tenta buscar no whatsapp_message_preview que geralmente tem o texto completo
    const whatsappPreview = order.meta?.whatsapp_message_preview || '';
    if (whatsappPreview) {
      // Procura por padrões como "Trio: ..." no texto
      const trioMatch = whatsappPreview.match(/Trio\s*:\s*([^\n\[\]]+)/i);
      if (trioMatch && trioMatch[1]) {
        const trioText = trioMatch[1].trim();
        if (trioText && trioText.length > 0) {
          trioInfo.push(trioText);
        }
      }
    }
    
    // Depois, busca nos itens do pedido
    if (order.items && Array.isArray(order.items)) {
      for (const item of order.items) {
        const itemName = item.name || '';
        
        // 1. Extrair do nome do item: "+ Trio (conteúdo)"
        if (itemName.includes('+ Trio') || itemName.includes('+Trio')) {
          // Procura padrão: "+ Trio (conteúdo)"
          const trioInNameMatch = itemName.match(/\+\s*Trio\s*\(([^)]+)\)/i);
          if (trioInNameMatch && trioInNameMatch[1]) {
            const trioFromName = trioInNameMatch[1].trim();
            if (trioFromName && trioFromName.length > 0) {
              trioInfo.push(trioFromName);
            }
          }
          
          // Também procura por padrão: "+ Trio" seguido de texto entre parênteses
          const altMatch = itemName.match(/\+\s*Trio[^(]*\(([^)]+)\)/i);
          if (altMatch && altMatch[1]) {
            const trioFromName = altMatch[1].trim();
            if (trioFromName && trioFromName.length > 0) {
              trioInfo.push(trioFromName);
            }
          }
        }
        
        // 2. Verifica se o item tem informação de trio em campos específicos
        if (item.trio_info) {
          trioInfo.push(item.trio_info);
        } else if (item.trio) {
          trioInfo.push(item.trio);
        } else if (item.combo_info?.trio) {
          trioInfo.push(item.combo_info.trio);
        }
        
        // 3. Verifica nos complements (linha 282 mencionada pelo desenvolvedor)
        if (item.complements && Array.isArray(item.complements)) {
          for (const complement of item.complements) {
            const complementName = complement.name || '';
            // Procura por "Trio: ..." nos complements
            if (complementName.toLowerCase().includes('trio:')) {
              const trioFromComplement = complementName.replace(/^.*Trio\s*:\s*/i, '').trim();
              if (trioFromComplement && trioFromComplement.length > 0) {
                trioInfo.push(trioFromComplement);
              }
            }
          }
        }
        
        // 4. Verifica em campos de detalhes do combo
        if (item.combo_details) {
          const comboDetailsStr = typeof item.combo_details === 'string' 
            ? item.combo_details 
            : JSON.stringify(item.combo_details);
          
          const trioInDetails = comboDetailsStr.match(/Trio\s*:\s*([^\n]+)/i);
          if (trioInDetails && trioInDetails[1]) {
            const trioText = trioInDetails[1].trim();
            if (trioText && trioText.length > 0) {
              trioInfo.push(trioText);
            }
          }
        }
      }
    }
    
    // Também verifica em order.meta se tem informação de trio
    if (order.meta?.trio_info) {
      trioInfo.push(order.meta.trio_info);
    }
    if (order.meta?.trio) {
      trioInfo.push(order.meta.trio);
    }
    
    // Combinar notas do cliente e instruções gerais no campo notes
    // Usa whatsapp_message_preview se disponível, senão usa customer.notes
    let orderNotes = order.meta?.whatsapp_message_preview || order.customer?.notes || null;
    
    // Remove informações de serviceType e "Forma de consumo/embalagem" do orderNotes para evitar duplicação
    if (orderNotes) {
      orderNotes = orderNotes
        .replace(/comer\s+no\s+local/gi, '')
        .replace(/comer\s+no\s+estabelecimento/gi, '')
        .replace(/embalar\s+(para|pra)\s+levar/gi, '')
        .replace(/\bembalar\b/gi, '')
        .replace(/\bpara\s+levar\b/gi, '')
        .replace(/\bpra\s+levar\b/gi, '')
        // Remove "Forma de consumo/embalagem:" e variações
        .replace(/Forma\s+de\s+consumo[\/:]?\s*embalagem[:\s]*/gi, '')
        .replace(/Forma\s+de\s+embalagem[:\s]*/gi, '')
        .replace(/Forma\s+de\s+consumo[:\s]*/gi, '')
        .replace(/consumo[\/:]?\s*embalagem[:\s]*/gi, '')
        .replace(/\n\s*\n+/g, '\n') // Remove linhas vazias duplicadas
        .trim();
      if (!orderNotes || orderNotes.length < 3) {
        orderNotes = null;
      }
    }
    
    // Adicionar informações de trio ao notes se encontradas
    // Mas só adiciona se ainda não estiver presente no orderNotes
    if (trioInfo.length > 0) {
      const uniqueTrioInfo = [...new Set(trioInfo)].filter(Boolean);
      if (uniqueTrioInfo.length > 0) {
        const trioText = uniqueTrioInfo.map(t => {
          // Se já começa com "Trio:", usa como está, senão adiciona o prefixo
          return t.trim().toLowerCase().startsWith('trio:') ? t.trim() : `Trio: ${t.trim()}`;
        }).join('\n');
        
        // Verifica se o trio já está no orderNotes para evitar duplicação
        const hasTrioAlready = orderNotes && orderNotes.toLowerCase().includes('trio:');
        
        if (!hasTrioAlready) {
          if (orderNotes) {
            orderNotes = `${orderNotes}\n${trioText}`;
          } else {
            orderNotes = trioText;
          }
        }
      }
    }
    
    if (generalInstructions) {
      // Remove informações de serviceType das generalInstructions ANTES de adicionar ao notes
      // Isso garante que não apareça duplicado nas instruções
      let cleanedInstructions = generalInstructions;
      
      // Remove telefone das instruções (padrões brasileiros com ou sem formatação)
      // Remove números que parecem telefones (10 ou 11 dígitos, com ou sem formatação)
      cleanedInstructions = cleanedInstructions
        // Remove telefones formatados: (11) 99999-9999, (11)99999-9999, 11 99999-9999
        .replace(/\(?\d{2}\)?\s*\d{4,5}[-\s]?\d{4}/g, '')
        // Remove telefones sem formatação: 11999999999, 1199999999
        .replace(/\b\d{10,11}\b/g, '')
        // Remove padrões com "Tel:", "Telefone:", "Fone:", etc. (com ou sem número)
        .replace(/(Tel|Telefone|Fone|Phone)[:\s]*\(?\d{2}\)?\s*\d{4,5}[-\s]?\d{4}/gi, '')
        .replace(/(Tel|Telefone|Fone|Phone)[:\s]*\d{10,11}/gi, '')
        // Remove "Telefone:" isolado (sem número após)
        .replace(/^(Telefone|Tel|Fone|Phone)[:\s]*$/gmi, '')
        .replace(/\n(Telefone|Tel|Fone|Phone)[:\s]*$/gmi, '')
        .replace(/\n(Telefone|Tel|Fone|Phone)[:\s]*\n/gmi, '\n')
        .trim();
      
      if (serviceType) {
        cleanedInstructions = cleanedInstructions
          .replace(/comer\s+no\s+local/gi, '')
          .replace(/comer\s+no\s+estabelecimento/gi, '')
          .replace(/embalar\s+(para|pra)\s+levar/gi, '')
          .replace(/\bembalar\b/gi, '')
          .replace(/\bpara\s+levar\b/gi, '')
          .replace(/\bpra\s+levar\b/gi, '')
          // Remove "Forma de consumo/embalagem:" e variações
          .replace(/Forma\s+de\s+consumo[\/:]?\s*embalagem[:\s]*/gi, '')
          .replace(/Forma\s+de\s+embalagem[:\s]*/gi, '')
          .replace(/Forma\s+de\s+consumo[:\s]*/gi, '')
          .replace(/consumo[\/:]?\s*embalagem[:\s]*/gi, '')
          .replace(/\n\s*\n+/g, '\n') // Remove linhas vazias duplicadas
          .trim();
      } else {
        // Mesmo sem serviceType, remove campos de "Forma de consumo/embalagem" para evitar duplicação
        cleanedInstructions = cleanedInstructions
          .replace(/Forma\s+de\s+consumo[\/:]?\s*embalagem[:\s]*/gi, '')
          .replace(/Forma\s+de\s+embalagem[:\s]*/gi, '')
          .replace(/Forma\s+de\s+consumo[:\s]*/gi, '')
          .replace(/consumo[\/:]?\s*embalagem[:\s]*/gi, '')
          .replace(/\n\s*\n+/g, '\n')
          .trim();
      }
      
      // Remove linhas vazias e espaços extras após limpeza
      cleanedInstructions = cleanedInstructions
        .replace(/\n\s*\n+/g, '\n')
        .replace(/^\s+|\s+$/gm, '')
        .trim();
      
      // Só adiciona as instruções se sobrar conteúdo relevante após limpeza
      // Verifica se há conteúdo real (não apenas espaços, quebras de linha ou marcadores vazios)
      const hasRealContent = cleanedInstructions && 
                            cleanedInstructions.length > 3 && 
                            !cleanedInstructions.match(/^(Telefone|Tel|Fone|Phone)[:\s]*$/i) &&
                            cleanedInstructions.replace(/\s/g, '').length > 0;
      
      if (hasRealContent) {
        // Se já houver notes, adicionar as instruções separadamente
        if (orderNotes) {
          orderNotes = `${orderNotes}\n\nInstruções do Pedido: ${cleanedInstructions}`;
        } else {
          orderNotes = `Instruções do Pedido: ${cleanedInstructions}`;
        }
      }
    }

    // Preparar nome do cliente com informação de serviceType se houver
    let customerName = customerNameRaw;
    const customerPhone = order.customer?.phone || null;
    
    // Verificar se é do site hamburguerianabrasa.com.br
    const isNaBrasaSite = source_domain?.toLowerCase().includes('hamburguerianabrasa') || false;
    
    // Verificar se há endereço válido (para determinar se é realmente entrega)
    const hasValidAddress = order.customer?.address || 
                           order.delivery_address || 
                           order.meta?.delivery_address ||
                           (orderNotes && orderNotes.toLowerCase().includes('endereço:'));
    
    // Verificar se é pickup/retirada de várias formas
    const isPickupExplicit = order.meta?.deliveryType === 'pickup' || 
                            order.deliveryType === 'pickup' ||
                            order.order_type === 'pickup';
    
    // Verificar no nome do cliente se indica retirada
    const customerNameLower = customerName.toLowerCase();
    const indicatesPickup = customerNameLower.includes('balcão') || 
                            customerNameLower.includes('balcao') ||
                            customerNameLower.includes('retirar') ||
                            customerNameLower.includes('retirada') ||
                            customerNameLower.includes('comer aqui');
    
    const isPickup = isPickupExplicit || indicatesPickup;
    
    // Determinar se é realmente entrega ou retirada
    // Para Na Brasa: REGRA ULTRA RIGOROSA - apenas contar como entrega se:
    // 1. deliveryType for 'delivery' explicitamente
    // 2. E tiver endereço válido
    // 3. E NÃO for "embalar pra levar", "comer no local", "retirar no local" ou "comer aqui"
    // Qualquer indicação de retirada/balcão/takeout SEMPRE é pickup
    const isDeliveryExplicit = (order.meta?.deliveryType === 'delivery' || order.deliveryType === 'delivery') && hasValidAddress;
    const isTakeout = serviceType === 'embalar pra levar' || 
                     serviceType === 'comer no local' ||
                     serviceType === 'retirar no local' ||
                     serviceType === 'comer aqui';
    const isPickupOrTakeout = isPickup || isTakeout;
    
    // Determinar o tipo final do pedido
    let finalOrderType: string;
    if (isNaBrasaSite) {
      // Para Na Brasa: REGRA ULTRA RIGOROSA
      // PRIORIDADE 1: Se houver QUALQUER indicação de retirada/takeout, SEMPRE é pickup
      // Isso inclui: serviceType, nome do cliente, deliveryType='pickup', etc.
      if (isTakeout || isPickup || indicatesPickup || serviceType) {
        // Se tem serviceType (embalar pra levar, comer no local), SEMPRE é pickup
        // Mesmo que o site tenha enviado deliveryType='delivery' por engano
        finalOrderType = 'pickup';
      } else if (isDeliveryExplicit && hasValidAddress) {
        // PRIORIDADE 2: Apenas se deliveryType for explicitamente 'delivery' 
        // E tiver endereço válido
        // E NÃO tiver nenhuma indicação de retirada
        finalOrderType = 'delivery';
      } else {
        // PRIORIDADE 3: Caso padrão para Na Brasa: SEMPRE pickup (não assumir delivery)
        // Por segurança, se não tiver certeza absoluta de que é entrega, é pickup
        finalOrderType = 'pickup';
      }
    } else {
      // Para outros sites: se for pickup ou takeout, é pickup, senão verifica se é delivery
      finalOrderType = isPickupOrTakeout ? 'pickup' : (isDeliveryExplicit ? 'delivery' : 'pickup');
    }
    
    // LOG DE DEBUG (remover em produção se necessário)
    // console.log('Order Type Determination:', {
    //   isNaBrasaSite,
    //   serviceType,
    //   isPickup,
    //   indicatesPickup,
    //   isTakeout,
    //   isDeliveryExplicit,
    //   hasValidAddress,
    //   finalOrderType
    // });
    
    if (isPickup && serviceType) {
      // Para pedidos do site Na Brasa com "embalar pra levar" e telefone, incluir telefone no nome
      if (isNaBrasaSite && serviceType === 'embalar pra levar' && customerPhone) {
        customerName = `${customerName} - embalar pra levar ${customerPhone}`;
      } else {
        customerName = `${customerName} - ${serviceType}`;
      }
    }
    
    // Normalizar método de pagamento para valores aceitos pelo banco
    // Valores aceitos: 'dinheiro', 'pix', 'cartao_credito', 'cartao_debito', 'online', 'whatsapp', 'balcao'
    const normalizePaymentMethod = (method: string | null | undefined): string => {
      if (!method) return 'whatsapp'; // padrão para pedidos sem método especificado
      
      const normalized = method.toLowerCase().trim();
      
      // Mapear valores comuns para valores válidos
      if (normalized === 'cartao credito/debito' || normalized === 'cartao_credito_debito' || normalized === 'card') {
        return 'cartao_debito'; // default para cartão genérico é débito
      }
      if (normalized === 'cash' || normalized === 'money') {
        return 'dinheiro';
      }
      if (normalized === 'credito' || normalized === 'credit' || normalized === 'credit_card') {
        return 'cartao_credito';
      }
      if (normalized === 'debito' || normalized === 'debit' || normalized === 'debit_card') {
        return 'cartao_debito';
      }
      if (normalized === 'cartao' || normalized === 'cartão') {
        return 'cartao_debito'; // default para cartão genérico é débito
      }
      
      // Se já for um valor válido, retorna como está
      const validMethods = ['dinheiro', 'pix', 'cartao_credito', 'cartao_debito', 'online', 'whatsapp', 'balcao'];
      if (validMethods.includes(normalized)) {
        return normalized;
      }
      
      // Para qualquer outro valor desconhecido, usar 'online' como padrão genérico
      return 'online';
    };
    
    const rawPaymentMethod = order.payment?.method || order.payment_method || null;
    const normalizedPaymentMethod = normalizePaymentMethod(rawPaymentMethod);
    
    // Create order
    const orderData: any = {
      establishment_id: establishment.id,
      order_number: orderNumber,
      customer_name: customerName,
      customer_phone: order.customer?.phone || null,
      order_type: finalOrderType,
      subtotal: subtotal,
      delivery_fee: deliveryFee,
      discount_amount: discountAmount,
      total_amount: totalAmount,
      status: 'pending',
      payment_status: 'paid', // Pagamento já é considerado efetuado ao finalizar venda
      payment_method: normalizedPaymentMethod,
      notes: orderNotes,
      source_domain: source_domain || null,
      external_id: order.external_id || null,
      channel: order.channel || 'online',
      origin: order.origin || 'site',
    };

    // Adicionar site_category_quantities se houver dados
    if (Object.keys(siteCategoryQuantities).length > 0) {
      orderData.site_category_quantities = siteCategoryQuantities;
    }

    const { data: newOrder, error: orderError } = await supabase
      .from('orders')
      .insert(orderData)
      .select()
      .single();

    if (orderError) {
      console.error('Error creating order:', orderError);
      throw new Error('Erro ao criar pedido');
    }

    // Create order items
    if (order.items && order.items.length > 0) {
      // First, fetch product IDs by SKU and/or by Name (fallback)
      const skus = order.items.map((item: any) => item.sku).filter(Boolean);
      const names = order.items.map((item: any) => item.name).filter(Boolean);

      let productMap: Record<string, string> = {};
      if (skus.length > 0) {
        const { data: products } = await supabase
          .from('products')
          .select('id, sku')
          .eq('establishment_id', establishment.id)
          .in('sku', skus);
        if (products) {
          productMap = products.reduce((acc, p) => {
            if (p.sku) acc[p.sku] = p.id;
            return acc;
          }, {} as Record<string, string>);
        }
      }

      // Fallback map by exact name match when SKU not provided
      let nameMap: Record<string, string> = {};
      if (names.length > 0) {
        const uniqueNames = Array.from(new Set(names));
        const { data: byNames } = await supabase
          .from('products')
          .select('id, name')
          .eq('establishment_id', establishment.id)
          .in('name', uniqueNames);
        if (byNames) {
          nameMap = byNames.reduce((acc, p) => {
            acc[p.name] = p.id; return acc;
          }, {} as Record<string, string>);
        }
      }

      const orderItems = order.items
        .filter((item: any) => {
          // FILTRO DE SEGURANÇA: Remove itens que são apenas observações
          // Um item válido DEVE ter nome e preço
          const hasName = item.name && item.name.trim().length > 0;
          const hasPrice = (item.unit_price || 0) > 0 || (item.price || 0) > 0;
          const hasQuantity = (item.qty || item.quantity || 1) > 0;
          
          // Se é apenas uma observação sem preço/quantidade válida, ignora
          const isObservationOnly = !hasPrice && !hasQuantity && 
                                   (item.obs || item.notes || '').toLowerCase().includes('obs');
          
          return hasName && (hasPrice || hasQuantity) && !isObservationOnly;
        })
        .map((item: any) => {
          const unitPrice = item.unit_price || item.price || 0;
          const quantity = item.qty || item.quantity || 1;
          let productId = item.sku && productMap[item.sku] ? productMap[item.sku] : (item.name && nameMap[item.name] ? nameMap[item.name] : null);
          
          // Build notes with complements - garante que observações fiquem apenas em notes
          let itemNotes = '';
          
          // Adiciona obs se houver
          if (item.obs && item.obs.trim()) {
            itemNotes = item.obs.trim();
          }
          
          // Adiciona complements se houver
          if (item.complements && item.complements.length > 0) {
            const complementsText = item.complements
              .map((c: any) => {
                const compName = c.name || '';
                const compPrice = c.price || 0;
                return compPrice > 0 ? `${compName} (+R$ ${compPrice.toFixed(2)})` : compName;
              })
              .filter(Boolean)
              .join(', ');
            if (complementsText) {
              itemNotes += (itemNotes ? ' | ' : '') + `Molhos: ${complementsText}`;
            }
          }
          
          // Limpa o nome do item (remove observações que possam ter vindo misturadas)
          let cleanItemName = (item.name || '').trim();
          // Remove observações do nome se vieram misturadas
          cleanItemName = cleanItemName.replace(/\s*(Obs:|Observação:|Molhos?:).*$/i, '').trim();
          
          // Atualiza o nome do produto no productMap se necessário (para referência futura)
          // Mas não altera o item.name original pois pode ser usado em outros lugares

          return {
            order_id: newOrder.id,
            product_id: productId,
            quantity: quantity,
            unit_price: unitPrice,
            total_price: (unitPrice || 0) * (quantity || 1),
            notes: itemNotes || null,
            customizations: item.complements ? { complements: item.complements } : {},
          };
        });

      // Filtrar apenas items que têm product_id válido
      const validOrderItems = orderItems.filter((item: any) => item.product_id !== null && item.product_id !== undefined);
      
      if (validOrderItems.length > 0) {
        const { error: itemsError } = await supabase
          .from('order_items')
          .insert(validOrderItems);

        if (itemsError) {
          console.error('Error creating order items:', itemsError);
          // Don't fail the entire request, just log
        } else {
          // Abater estoque de ingredientes automaticamente
          try {
            const { data: stockResult, error: stockError } = await supabase.rpc(
              'apply_stock_deduction_for_order',
              {
                p_establishment_id: establishment.id,
                p_order_id: newOrder.id
              }
            );

            if (stockError) {
              // Log do erro mas não interrompe o pedido
              console.error('Erro ao abater estoque:', stockError);
            } else if (stockResult && !stockResult.success) {
              // Avisar sobre problemas no estoque mas não bloquear o pedido
              console.warn('Avisos no abatimento de estoque:', stockResult.errors);
            }
          } catch (stockErr) {
            // Não bloquear o pedido se houver erro no estoque
            console.error('Erro ao processar estoque:', stockErr);
          }
        }
      }
    }

    // Store idempotency key
    await supabase
      .from('idempotency_keys')
      .insert({
        key: idempotencyKey,
        establishment_id: establishment.id,
        order_id: newOrder.id,
      });

    return new Response(JSON.stringify({
      ok: true,
      order_id: newOrder.id,
      print_queued: true
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error in online-order-intake function:', error);
    return new Response(JSON.stringify({ 
      ok: false,
      error: error.message || 'Erro interno do servidor' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
