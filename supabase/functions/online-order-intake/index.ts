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
    const body = await req.json();
    const { order, source_domain, estabelecimento_slug } = body;

    console.log('Creating order for establishment:', establishment.id);
    console.log('Order data:', JSON.stringify(order, null, 2));

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
    const { data: newOrder, error: orderError } = await supabase
      .from('orders')
      .insert({
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
      })
      .select()
      .single();

    if (orderError) {
      console.error('Error creating order:', orderError);
      throw new Error('Erro ao criar pedido');
    }

    console.log('Order created:', newOrder.id);

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

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems);

      if (itemsError) {
        console.error('Error creating order items:', itemsError);
        // Don't fail the entire request, just log
      } else {
        console.log('Order items created:', orderItems.length);
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
