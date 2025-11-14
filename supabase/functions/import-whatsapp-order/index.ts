import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    // Use service role to bypass RLS for this backend workflow (safe: no secrets exposed)
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get request body
    const { whatsappText, establishmentId } = await req.json();

    if (!whatsappText || !establishmentId) {
      throw new Error('Texto do WhatsApp e ID do estabelecimento são obrigatórios');
    }

    console.log('Processing WhatsApp order for establishment:', establishmentId);
    console.log('WhatsApp text:', whatsappText);

    // Get products from establishment
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id, name, price, description')
      .eq('establishment_id', establishmentId)
      .eq('active', true);

    if (productsError) {
      console.error('Error fetching products:', productsError);
      throw new Error('Erro ao buscar produtos');
    }

    console.log('Found products:', products?.length || 0);

    // Create products list for AI context
    const productsContext = products?.map(p => ({
      id: p.id,
      name: p.name,
      price: p.price,
      description: p.description
    })) || [];

    // Create AI prompt
    const prompt = `
Você é um assistente especializado em interpretar pedidos de WhatsApp para restaurantes/estabelecimentos.

PRODUTOS DISPONÍVEIS:
${JSON.stringify(productsContext, null, 2)}

TEXTO DO PEDIDO:
${whatsappText}

Analise o texto do pedido e retorne um JSON estruturado seguindo EXATAMENTE este formato:
{
  "items": [
    {
      "product_id": "uuid_do_produto_correspondente",
      "product_name": "nome_do_produto_encontrado",
      "quantity": numero_da_quantidade,
      "notes": "observações_especiais_como_molho_recheado_etc",
      "unit_price": preco_unitario_do_catalogo
    }
  ],
  "customer_info": {
    "name": "nome_do_cliente_se_mencionado",
    "phone": "telefone_se_mencionado"
  },
  "delivery_info": {
    "is_delivery": true_ou_false,
    "address": "endereco_se_mencionado",
    "delivery_fee": valor_da_taxa_se_mencionada
  },
  "payment_info": {
    "method": "metodo_de_pagamento_se_mencionado",
    "total_mentioned": valor_total_se_cliente_calculou
  },
  "general_notes": "observacoes_gerais_do_pedido"
}

INSTRUÇÕES IMPORTANTES:
1. Faça o mapeamento mais próximo possível entre o que o cliente escreveu e os produtos disponíveis
2. Tolere diferenças de nome (ex: "X-Burger" pode ser "X-Burguer" ou "Hambúrguer X")
3. Se não conseguir mapear um item, coloque product_id como null mas mantenha o product_name com o que o cliente escreveu
4. Extraia quantidades mesmo que escritas por extenso (ex: "dois" = 2)
5. Inclua observações como "sem cebola", "com molho extra", "ponto da carne", etc. no campo notes
6. Se mencionado "entrega" ou "delivery", marque is_delivery como true
7. Retorne APENAS o JSON, sem texto adicional
`;

    // Call OpenAI API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'Você é um especialista em interpretar pedidos de WhatsApp. Sempre responda apenas com JSON válido.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('OpenAI API error:', errorData);
      throw new Error('Erro ao processar com IA');
    }

    const aiResponse = await response.json();
    console.log('AI Response:', aiResponse);

    const aiContent = aiResponse.choices[0].message.content;
    console.log('AI Content:', aiContent);

    // Parse AI response
    let parsedOrder;
    try {
      parsedOrder = JSON.parse(aiContent);
    } catch (parseError) {
      console.error('Error parsing AI response:', parseError);
      console.error('AI Content was:', aiContent);
      throw new Error('Erro ao interpretar resposta da IA');
    }

    console.log('Parsed order:', parsedOrder);

    // Calculate totals
    let subtotal = 0;
    const validItems = parsedOrder.items.filter((item: any) => item.product_id);
    
    for (const item of validItems) {
      subtotal += (item.unit_price || 0) * (item.quantity || 1);
    }

    const deliveryFee = parsedOrder.delivery_info?.delivery_fee || 0;
    const totalAmount = subtotal + deliveryFee;

    // Gerar número de pedido sequencial usando função RPC
    // Se não houver caixa aberto, a função retorna número com timestamp
    let orderNumber: string;
    try {
      const { data: generatedNumber, error: orderNumberError } = await supabase.rpc(
        'get_next_order_number',
        { p_establishment_id: establishmentId }
      );
      
      if (orderNumberError || !generatedNumber) {
        console.warn('Error generating sequential order number, using fallback:', orderNumberError);
        orderNumber = `WA-${Date.now()}`;
      } else {
        orderNumber = generatedNumber;
      }
    } catch (error) {
      console.warn('Exception generating sequential order number, using fallback:', error);
      orderNumber = `WA-${Date.now()}`;
    }

    // Create order
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        establishment_id: establishmentId,
        order_number: orderNumber,
        customer_name: parsedOrder.customer_info?.name || 'Cliente WhatsApp',
        customer_phone: parsedOrder.customer_info?.phone || null,
        order_type: parsedOrder.delivery_info?.is_delivery ? 'delivery' : 'balcao',
        subtotal: subtotal,
        delivery_fee: deliveryFee,
        total_amount: totalAmount,
        status: 'pending',
        payment_status: 'paid', // Pagamento já é considerado efetuado ao finalizar venda
        payment_method: parsedOrder.payment_info?.method || null,
        notes: parsedOrder.general_notes || null,
      })
      .select()
      .single();

    if (orderError) {
      console.error('Error creating order:', orderError);
      throw new Error('Erro ao criar pedido no sistema');
    }

    console.log('Order created:', order.id);

    // Create order items
    if (validItems.length > 0) {
      const orderItems = validItems.map((item: any) => ({
        order_id: order.id,
        product_id: item.product_id,
        quantity: item.quantity || 1,
        unit_price: item.unit_price || 0,
        total_price: (item.unit_price || 0) * (item.quantity || 1),
        notes: item.notes || null,
      }));

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems);

      if (itemsError) {
        console.error('Error creating order items:', itemsError);
        throw new Error('Erro ao criar itens do pedido');
      }

      console.log('Order items created:', orderItems.length);
    }

    return new Response(JSON.stringify({
      success: true,
      order_id: order.id,
      order_number: orderNumber,
      total_amount: totalAmount,
      items_count: validItems.length,
      parsed_order: parsedOrder,
      original_text: whatsappText
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error in import-whatsapp-order function:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message || 'Erro interno do servidor' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});