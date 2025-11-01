import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://hamburguerianabrasa.com.br',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-estab-key, idempotency-key',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  console.log('🚀 Edge Function online-order-intake chamada!');
  console.log('📥 Método:', req.method);
  console.log('🔗 URL:', req.url);
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('✅ CORS preflight request');
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔧 Iniciando processamento...');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    console.log('🔑 Variáveis de ambiente:', {
      hasSUPABASE_URL: !!SUPABASE_URL,
      hasSUPABASE_SERVICE_ROLE_KEY: !!SUPABASE_SERVICE_ROLE_KEY
    });

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

    console.log('Processing online order with idempotency key:', idempotencyKey);

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

    console.log('Establishment validated:', establishment.name);

    // Check idempotency
    const { data: existingKey, error: idempotencyError } = await supabase
      .from('idempotency_keys')
      .select('order_id')
      .eq('key', idempotencyKey)
      .eq('establishment_id', establishment.id)
      .maybeSingle();

    if (existingKey) {
      console.log('Idempotent request detected, returning existing order:', existingKey.order_id);
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
    console.log('📦 Parseando body da requisição...');
    const body = await req.json();
    console.log('✅ Body parseado. Keys do body:', Object.keys(body || {}));
    console.log('📋 Body completo (primeiros 3000 chars):', JSON.stringify(body, null, 2).substring(0, 3000));
    const { order, source_domain, estabelecimento_slug } = body;

    if (!order) {
      console.error('❌ ERRO: order não encontrado no body!');
      console.log('📋 Body completo:', JSON.stringify(body, null, 2));
      throw new Error('Order não encontrado no body');
    }

    console.log('🏢 Creating order for establishment:', establishment.id);
    console.log('📋 Order object keys:', Object.keys(order || {}));
    console.log('📋 Order data (primeiros 2000 chars):', JSON.stringify(order, null, 2).substring(0, 2000));

    // Extract category quantities from order (burger, side, drink)
    // These come from the external website
    console.log('🔍 Verificando categorias no pedido...');
    
    const siteCategoryQuantities: Record<string, number> = {};
    
    // PRIMEIRO: Verificar em order.meta.categorySummary (formato atual do site)
    if (order.meta?.categorySummary && typeof order.meta.categorySummary === 'object') {
      console.log('✅ Order.meta.categorySummary encontrado:', JSON.stringify(order.meta.categorySummary));
      if (order.meta.categorySummary.burger !== undefined && order.meta.categorySummary.burger !== null) {
        siteCategoryQuantities.burger = Number(order.meta.categorySummary.burger) || 0;
        console.log('✅ Burger encontrado em order.meta.categorySummary.burger:', siteCategoryQuantities.burger);
      }
      if (order.meta.categorySummary.side !== undefined && order.meta.categorySummary.side !== null) {
        siteCategoryQuantities.side = Number(order.meta.categorySummary.side) || 0;
        console.log('✅ Side encontrado em order.meta.categorySummary.side:', siteCategoryQuantities.side);
      }
      if (order.meta.categorySummary.drink !== undefined && order.meta.categorySummary.drink !== null) {
        siteCategoryQuantities.drink = Number(order.meta.categorySummary.drink) || 0;
        console.log('✅ Drink encontrado em order.meta.categorySummary.drink:', siteCategoryQuantities.drink);
      }
    }
    
    // FALLBACK: Verificar diretamente no objeto order (caso venha no formato antigo)
    if (Object.keys(siteCategoryQuantities).length === 0) {
      if (order.burger !== undefined && order.burger !== null) {
        siteCategoryQuantities.burger = Number(order.burger) || 0;
        console.log('✅ Burger encontrado em order.burger:', siteCategoryQuantities.burger);
      }
      if (order.side !== undefined && order.side !== null) {
        siteCategoryQuantities.side = Number(order.side) || 0;
        console.log('✅ Side encontrado em order.side:', siteCategoryQuantities.side);
      }
      if (order.drink !== undefined && order.drink !== null) {
        siteCategoryQuantities.drink = Number(order.drink) || 0;
        console.log('✅ Drink encontrado em order.drink:', siteCategoryQuantities.drink);
      }
    }
    
    // FALLBACK: Verificar em order.categories se existir
    if (Object.keys(siteCategoryQuantities).length === 0 && order.categories && typeof order.categories === 'object') {
      console.log('📦 Order.categories encontrado:', JSON.stringify(order.categories));
      if (order.categories.burger !== undefined) {
        siteCategoryQuantities.burger = Number(order.categories.burger) || 0;
        console.log('✅ Burger encontrado em order.categories.burger:', siteCategoryQuantities.burger);
      }
      if (order.categories.side !== undefined) {
        siteCategoryQuantities.side = Number(order.categories.side) || 0;
        console.log('✅ Side encontrado em order.categories.side:', siteCategoryQuantities.side);
      }
      if (order.categories.drink !== undefined) {
        siteCategoryQuantities.drink = Number(order.categories.drink) || 0;
        console.log('✅ Drink encontrado em order.categories.drink:', siteCategoryQuantities.drink);
      }
    }
    
    console.log('📊 Site category quantities final:', JSON.stringify(siteCategoryQuantities));
    console.log('📊 Total de categorias encontradas:', Object.keys(siteCategoryQuantities).length);

    // Generate order number
    const orderNumber = `WEB-${Date.now()}`;

    // Calculate totals
    const subtotal = order.totals?.subtotal || 0;
    const deliveryFee = order.totals?.delivery_fee || 0;
    const discountAmount = order.totals?.discount || 0;
    const totalAmount = order.totals?.final_total || (subtotal + deliveryFee - discountAmount);

    // Capturar instruções gerais do pedido (pode vir em vários campos)
    const generalInstructions = order.instructions || order.general_instructions || order.order_instructions || null;
    
    // Combinar notas do cliente e instruções gerais no campo notes
    let orderNotes = order.customer?.notes || order.meta?.whatsapp_message_preview || null;
    if (generalInstructions) {
      // Se já houver notes, adicionar as instruções separadamente
      if (orderNotes) {
        orderNotes = `${orderNotes}\n\nInstruções do Pedido: ${generalInstructions}`;
      } else {
        orderNotes = `Instruções do Pedido: ${generalInstructions}`;
      }
    }

    // Create order
    const orderData: any = {
      establishment_id: establishment.id,
      order_number: orderNumber,
      customer_name: order.customer?.name || 'Cliente Online',
      customer_phone: order.customer?.phone || null,
      order_type: 'delivery',
      subtotal: subtotal,
      delivery_fee: deliveryFee,
      discount_amount: discountAmount,
      total_amount: totalAmount,
      status: 'pending',
      payment_status: order.payment?.status || 'pending',
      payment_method: order.payment?.method || 'whatsapp',
      notes: orderNotes,
      source_domain: source_domain || null,
      external_id: order.external_id || null,
      channel: order.channel || 'online',
      origin: order.origin || 'site',
    };

    // Adicionar site_category_quantities se houver dados
    if (Object.keys(siteCategoryQuantities).length > 0) {
      orderData.site_category_quantities = siteCategoryQuantities;
      console.log('✅ Site category quantities adicionadas ao pedido:', JSON.stringify(siteCategoryQuantities));
      console.log('✅ orderData.site_category_quantities antes do insert:', JSON.stringify(orderData.site_category_quantities));
    } else {
      console.log('⚠️ Nenhuma categoria do site encontrada no pedido');
      console.log('⚠️ siteCategoryQuantities estava vazio:', JSON.stringify(siteCategoryQuantities));
    }

    const { data: newOrder, error: orderError } = await supabase
      .from('orders')
      .insert(orderData)
      .select()
      .single();

    if (orderError) {
      console.error('❌ Error creating order:', orderError);
      console.error('Order data that failed:', JSON.stringify(orderData, null, 2));
      throw new Error('Erro ao criar pedido');
    }

    console.log('✅ Order created:', newOrder.id);
    console.log('📦 Order site_category_quantities retornado:', JSON.stringify(newOrder.site_category_quantities) || 'null');
    console.log('📦 Tipo do site_category_quantities:', typeof newOrder.site_category_quantities);
    
    // Verificar se realmente foi salvo
    if (!newOrder.site_category_quantities || Object.keys(newOrder.site_category_quantities).length === 0) {
      console.error('❌ ATENÇÃO: site_category_quantities não foi salvo corretamente!');
      console.error('❌ orderData que foi enviado:', JSON.stringify(orderData.site_category_quantities));
    } else {
      console.log('✅ site_category_quantities foi salvo corretamente:', JSON.stringify(newOrder.site_category_quantities));
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
          console.log('✅ Order items created:', validOrderItems.length);
        }
      } else {
        console.log('⚠️ Nenhum order_item válido (todos sem product_id) - pulando criação de items');
      }
      
      if (orderItems.length > validOrderItems.length) {
        console.log(`⚠️ ${orderItems.length - validOrderItems.length} items ignorados por falta de product_id`);
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

    console.log('Idempotency key stored');

    // TODO: Trigger print queue (future enhancement)
    // For now, return success and the order will appear in the orders page

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
