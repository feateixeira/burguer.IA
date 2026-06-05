import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

/** Origens permitidas (site pode ser apex ou www — ambos precisam funcionar). */
const ALLOWED_CORS_ORIGINS = [
  'https://hamburguerianabrasa.com.br',
  'https://www.hamburguerianabrasa.com.br',
];

function isBaguetteOrSmashItemName(name: string): boolean {
  const n = (name || '').toLowerCase();
  return n.includes('baguete') || n.includes('smash');
}

function isDrinkItemName(name: string): boolean {
  if (isBaguetteOrSmashItemName(name)) return false;
  const n = (name || '').toLowerCase();
  const keywords = [
    'coca', 'guarana', 'pepsi', 'fanta', 'sprite', 'refri', 'refrigerante',
    'suco', 'agua', 'água', 'lata', 'latinha', 'del vale', 'schweppes',
    'h2oh', 'monster', 'red bull', 'bebida', 'creme', 'vitamina', 'milkshake',
  ];
  return keywords.some((k) => n.includes(k));
}

/** Normaliza slug de unidade (Brazlândia → brazlandia). */
function normalizeSiteUnitSlug(raw: string | null | undefined): string {
  if (!raw || !String(raw).trim()) return '';
  let s = String(raw).trim().toLowerCase();
  s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  s = s.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return s;
}

const SITE_UNIT_ALIASES: Record<string, string> = {
  brazlandia: 'brazlandia',
  'unidade-brazlandia': 'brazlandia',
  'na-brasa-brazlandia': 'brazlandia',
  'vicente-pires': 'vicente-pires',
  vicentepires: 'vicente-pires',
  'unidade-vicente-pires': 'vicente-pires',
  'na-brasa-vicente-pires': 'vicente-pires',
};

function canonicalSiteUnitSlug(raw: string | null | undefined): string {
  const n = normalizeSiteUnitSlug(raw);
  if (!n) return '';
  return SITE_UNIT_ALIASES[n] ?? n;
}

const SITE_PLACEHOLDER_SKU = '__SITE_ITEM__';

function normalizeProductKey(name: string): string {
  return (name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeSku(sku: unknown): string {
  if (sku === null || sku === undefined) return '';
  return String(sku).trim();
}

function extractIncomingOrderItems(order: Record<string, unknown>): unknown[] {
  const items = order.items;
  if (Array.isArray(items) && items.length > 0) return items;
  const cart = order.cart;
  if (Array.isArray(cart) && cart.length > 0) return cart;
  const lineItems = order.line_items ?? order.lineItems;
  if (Array.isArray(lineItems) && lineItems.length > 0) return lineItems;
  return [];
}

function parseBracketItemsFromText(text: string): Array<Record<string, unknown>> {
  if (!text?.trim()) return [];

  const parsePrice = (raw: string) => {
    const s = raw.trim();
    if (s.includes(',')) {
      return parseFloat(s.replace(/\./g, '').replace(',', '.')) || 0;
    }
    return parseFloat(s) || 0;
  };

  const parsed: Array<Record<string, unknown>> = [];
  const bracketRegex = /\[([^\]]+)\]/g;
  let match: RegExpExecArray | null;

  while ((match = bracketRegex.exec(text)) !== null) {
    const itemText = match[1].trim();
    if (!itemText) continue;

    const qtyMatch = itemText.match(/^(\d+)x\s+/i);
    if (!qtyMatch) continue;

    const quantity = parseInt(qtyMatch[1], 10) || 1;
    if (quantity <= 0) continue;

    let remaining = itemText.replace(/^\d+x\s+/i, '').trim();
    const priceMatch = remaining.match(/R\$\s*([\d.,]+)/i);
    if (!priceMatch) continue;

    const totalPrice = parsePrice(priceMatch[1]);
    if (totalPrice <= 0) continue;

    remaining = remaining.replace(/R\$\s*[\d.,]+\s*/i, '').trim();
    const name = remaining
      .replace(/\s*(Obs:|Observação:|Molhos?:|Molho especial:).*$/i, '')
      .trim();

    if (!name) continue;

    parsed.push({
      name,
      quantity,
      unit_price: totalPrice / quantity,
      price: totalPrice / quantity,
    });
  }

  return parsed;
}

async function getSiteOrderPlaceholderProductId(
  supabase: ReturnType<typeof createClient>,
  establishmentId: string
): Promise<string> {
  const { data: existing } = await supabase
    .from('products')
    .select('id')
    .eq('establishment_id', establishmentId)
    .eq('sku', SITE_PLACEHOLDER_SKU)
    .maybeSingle();

  if (existing?.id) return existing.id;

  const { data: created, error } = await supabase
    .from('products')
    .insert({
      establishment_id: establishmentId,
      name: 'Item do Site',
      sku: SITE_PLACEHOLDER_SKU,
      price: 0,
      active: false,
    })
    .select('id')
    .single();

  if (error || !created?.id) {
    throw new Error('Não foi possível criar produto placeholder para itens do site');
  }

  return created.id;
}

function resolveProductIdFromCatalog(
  item: Record<string, unknown>,
  allProducts: Array<{ id: string; name: string; sku: string | null }>
): string | null {
  const productId = item.product_id ?? item.productId;
  if (productId && typeof productId === 'string') {
    const byId = allProducts.find((p) => p.id === productId);
    if (byId) return byId.id;
  }

  const sku = normalizeSku(item.sku);
  if (sku) {
    const bySku = allProducts.find((p) => normalizeSku(p.sku) === sku);
    if (bySku) return bySku.id;
  }

  const rawName = String(item.name ?? item.title ?? item.product_name ?? '').trim();
  if (!rawName) return null;

  const key = normalizeProductKey(rawName);
  const byExactName = allProducts.find((p) => normalizeProductKey(p.name) === key);
  if (byExactName) return byExactName.id;

  const byContains = allProducts.find((p) => {
    const n = normalizeProductKey(p.name);
    return n.includes(key) || key.includes(n);
  });
  if (byContains) return byContains.id;

  return null;
}

/** Lê o slug da unidade enviado pelo site (body ou headers). */
function extractSiteUnitSlug(body: Record<string, unknown>, req: Request): string {
  const headerSlug =
    req.headers.get('x-site-unit-slug') ||
    req.headers.get('x-estabelecimento-slug');
  if (headerSlug?.trim()) {
    return canonicalSiteUnitSlug(headerSlug);
  }

  const order = body.order as Record<string, unknown> | undefined;
  const meta = order?.meta as Record<string, unknown> | undefined;

  const candidates: unknown[] = [
    body.estabelecimento_slug,
    body.estabelecimentoSlug,
    body.unidade_slug,
    body.unit_slug,
    order?.estabelecimento_slug,
    order?.unidade_slug,
    meta?.estabelecimento_slug,
    meta?.unidade_slug,
    meta?.unidade,
    meta?.unit_slug,
  ];

  for (const c of candidates) {
    if (c != null && String(c).trim()) {
      return canonicalSiteUnitSlug(String(c));
    }
  }
  return '';
}

function corsHeadersFor(req: Request): Record<string, string> {
  const origin = req.headers.get('origin');
  const allow =
    origin && ALLOWED_CORS_ORIGINS.includes(origin)
      ? origin
      : ALLOWED_CORS_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Headers':
      'authorization, x-client-info, apikey, content-type, x-estab-key, idempotency-key, x-site-unit-slug, x-estabelecimento-slug',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeadersFor(req) });
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
        headers: { ...corsHeadersFor(req), 'Content-Type': 'application/json' },
      });
    }

    if (!idempotencyKey) {
      return new Response(JSON.stringify({ 
        ok: false, 
        error: 'Idempotency-Key header obrigatório' 
      }), {
        status: 400,
        headers: { ...corsHeadersFor(req), 'Content-Type': 'application/json' },
      });
    }

    // Validate API key and get establishment (autenticação do site)
    const { data: authEstablishment, error: estabError } = await supabase
      .from('establishments')
      .select('id, name, slug, site_unit_slug, settings')
      .eq('api_key', apiKey)
      .single();

    if (estabError || !authEstablishment) {
      console.error('Invalid API key:', estabError);
      return new Response(JSON.stringify({ 
        ok: false, 
        error: 'API Key inválida' 
      }), {
        status: 401,
        headers: { ...corsHeadersFor(req), 'Content-Type': 'application/json' },
      });
    }

    // Parse request body
    const body = await req.json();
    const { order, source_domain } = body;

    const siteUnitSlug = extractSiteUnitSlug(body as Record<string, unknown>, req);

    let targetEstablishmentId = authEstablishment.id;

    if (siteUnitSlug) {
      const { data: resolvedId, error: resolveError } = await supabase.rpc(
        'resolve_site_unit_establishment',
        {
          p_auth_establishment_id: authEstablishment.id,
          p_unit_slug: siteUnitSlug,
        }
      );

      if (resolveError) {
        console.error('resolve_site_unit_establishment error:', resolveError);
        return new Response(JSON.stringify({
          ok: false,
          error: 'Erro ao identificar a unidade do pedido',
          details: resolveError.message,
        }), {
          status: 500,
          headers: { ...corsHeadersFor(req), 'Content-Type': 'application/json' },
        });
      }

      if (!resolvedId) {
        return new Response(JSON.stringify({
          ok: false,
          error: 'Unidade não encontrada',
          estabelecimento_slug: siteUnitSlug,
          hint: 'Verifique site_unit_slug no cadastro da loja (ex: brazlandia, vicente-pires)',
        }), {
          status: 400,
          headers: { ...corsHeadersFor(req), 'Content-Type': 'application/json' },
        });
      }

      targetEstablishmentId = resolvedId as string;

      if (targetEstablishmentId !== authEstablishment.id) {
        console.log(
          `Pedido roteado: API key de "${authEstablishment.name}" → unidade slug "${siteUnitSlug}" → establishment ${targetEstablishmentId}`
        );
      }
    }

    const establishment = { id: targetEstablishmentId, name: authEstablishment.name };

    if (targetEstablishmentId !== authEstablishment.id) {
      const { data: targetRow } = await supabase
        .from('establishments')
        .select('name')
        .eq('id', targetEstablishmentId)
        .maybeSingle();
      if (targetRow?.name) {
        establishment.name = targetRow.name;
      }
    }

    // Idempotência por unidade de destino (evita colisão entre lojas)
    const { data: existingKey } = await supabase
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
        idempotent: true,
        establishment_id: establishment.id,
      }), {
        headers: { ...corsHeadersFor(req), 'Content-Type': 'application/json' },
      });
    }

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

    // Calculate totals (garantir número válido — payload às vezes manda string)
    const subtotal = Number(order.totals?.subtotal ?? 0) || 0;
    let deliveryFee = Number(order.totals?.delivery_fee ?? 0) || 0;
    const discountAmount = Number(order.totals?.discount ?? 0) || 0;
    
    // Verificar se há promoção de frete grátis ativa (apenas para pedidos de entrega)
    let freeDeliveryPromotionId: string | null = null;
    if (order.order_type === 'delivery' || order.delivery_type === 'delivery') {
      try {
        const { data: promotionId, error: promotionError } = await supabase.rpc(
          'check_free_delivery_promotion',
          {
            p_establishment_id: establishment.id,
            p_order_time: new Date().toISOString()
          }
        );
        
        if (!promotionError && promotionId) {
          freeDeliveryPromotionId = promotionId;
          deliveryFee = 0; // Aplicar frete grátis
        }
      } catch (error) {
        console.warn('Error checking free delivery promotion:', error);
        // Continuar com o frete normal em caso de erro
      }
    }
    
    let totalAmount = subtotal + deliveryFee - discountAmount;
    if (order.totals?.final_total !== undefined && order.totals?.final_total !== null) {
      const n = Number(order.totals.final_total);
      if (!Number.isNaN(n)) totalAmount = n;
    }

    // Preparar nome do cliente ANTES de extrair serviceType (para poder verificar no nome)
    const customerNameRaw = order.customer?.name || 'Cliente Online';
    
    // PRIORIDADE MÁXIMA: Extrair "Forma de entrega" e "Forma de consumo/embalagem" ANTES de tudo
    // Esses campos são explícitos e devem ter prioridade absoluta
    let deliveryForm: string | null = null; // "Retirar no local", "Entrega", etc.
    let consumptionForm: string | null = null; // "Embalar pra levar", "Comer no local", etc.
    
    // Buscar em todos os campos de texto possíveis (manter case original para melhor matching)
    const allTextFieldsOriginal = [
      order.meta?.whatsapp_message_preview || '',
      order.customer?.notes || '',
      order.instructions || '',
      order.general_instructions || '',
      order.order_instructions || '',
      JSON.stringify(order.meta || {}),
      JSON.stringify(order.customer || {})
    ].join(' ');
    
    const allTextFieldsLower = allTextFieldsOriginal.toLowerCase();
    
    // Extrair "Forma de entrega: ..." (case-insensitive, mas manter valor original)
    const deliveryFormMatch = allTextFieldsOriginal.match(/forma\s+de\s+entrega[:\s]+([^\n\r]+)/i);
    if (deliveryFormMatch && deliveryFormMatch[1]) {
      deliveryForm = deliveryFormMatch[1].trim();
    }
    
    // Extrair "Forma de consumo/embalagem: ..." ou variações
    const consumptionFormMatch = allTextFieldsOriginal.match(/forma\s+de\s+(?:consumo[\/:]?\s*)?embalagem[:\s]+([^\n\r]+)/i) ||
                                 allTextFieldsOriginal.match(/forma\s+de\s+consumo[:\s]+([^\n\r]+)/i);
    if (consumptionFormMatch && consumptionFormMatch[1]) {
      consumptionForm = consumptionFormMatch[1].trim();
    }
    
    // Se não encontrou com ":", tentar sem ":" (pode vir como "Forma de entrega Retirar no local")
    if (!deliveryForm) {
      const deliveryFormMatch2 = allTextFieldsLower.match(/forma\s+de\s+entrega\s+(retirar|entrega|delivery|pickup)/i);
      if (deliveryFormMatch2 && deliveryFormMatch2[1]) {
        deliveryForm = deliveryFormMatch2[1].trim();
      }
    }
    
    if (!consumptionForm) {
      const consumptionFormMatch2 = allTextFieldsLower.match(/forma\s+de\s+(?:consumo[\/:]?\s*)?embalagem\s+(embalar|comer)/i);
      if (consumptionFormMatch2 && consumptionFormMatch2[1]) {
        consumptionForm = consumptionFormMatch2[1].trim();
      }
    }
    
    // Extrair informação de "comer no local" ou "embalar pra levar"
    // Essa informação deve aparecer ao lado do nome do cliente, não nas instruções
    let serviceType: string | null = null; // "comer no local" ou "embalar pra levar"
    
    // PRIORIDADE 1: "Forma de consumo/embalagem" (PRIORIDADE MÁXIMA)
    if (consumptionForm) {
      const consumptionLower = consumptionForm.toLowerCase();
      if (consumptionLower.includes('embalar') || consumptionLower.includes('pra levar') || consumptionLower.includes('para levar')) {
        serviceType = 'embalar pra levar';
      } else if (consumptionLower.includes('comer no local') || consumptionLower.includes('comer no estabelecimento')) {
        serviceType = 'comer no local';
      }
    }
    
    // PRIORIDADE 2: "Forma de entrega: Retirar no local" (PRIORIDADE MÁXIMA)
    if (deliveryForm) {
      const deliveryFormLower = deliveryForm.toLowerCase();
      if (deliveryFormLower.includes('retirar') || deliveryFormLower.includes('retirada') || deliveryFormLower.includes('pickup')) {
        // Se "Forma de entrega" diz "Retirar no local", SEMPRE é pickup
        serviceType = serviceType || 'retirar no local';
      }
    }
    
    // PRIORIDADE 3: Campos específicos do pedido
    if (!serviceType) {
    if (order.meta?.dine_in === true || order.meta?.dineIn === true || order.meta?.service_type === 'dine_in') {
      serviceType = 'comer no local';
    } else if (order.meta?.takeout === true || order.meta?.takeOut === true || order.meta?.service_type === 'takeout') {
      serviceType = 'embalar pra levar';
    } else if (order.dine_in === true || order.dineIn === true) {
      serviceType = 'comer no local';
    } else if (order.takeout === true || order.takeOut === true) {
      serviceType = 'embalar pra levar';
    }
    }
    
    // PRIORIDADE 4: Verificar no nome do cliente (pode vir do site)
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
    
    // PRIORIDADE 5: Tenta extrair das instruções ou do whatsapp_message_preview
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
    // Verificar em múltiplos lugares onde o endereço pode estar
    const addressFromCustomer = (order.customer?.address || '').trim();
    const addressFromDelivery = (order.delivery_address || '').trim();
    const addressFromMeta = (order.meta?.delivery_address || '').trim();
    const addressFromMetaCustomer = (order.meta?.customer?.address || '').trim();
    const addressFromShipping = (order.shipping_address || order.meta?.shipping_address || '').toString().trim();
    const addressFromNotes = orderNotes ? ((orderNotes.match(/Endereço:\s*(.+?)(?:\n|$)/i)?.[1] || '').trim()) : '';
    
    // Verificar também em campos genéricos que possam conter endereço
    const allTextFields = [
      addressFromCustomer,
      addressFromDelivery,
      addressFromMeta,
      addressFromMetaCustomer,
      addressFromShipping,
      addressFromNotes,
      (order.customer?.street || '').trim(),
      (order.customer?.full_address || '').trim(),
      (order.meta?.address || '').trim()
    ].filter(addr => addr && addr.length > 0);
    
    // Endereço válido = conteúdo suficiente + indicadores comuns (inclui DF: quadra/conjunto/casa)
    const hasValidAddress = allTextFields.some(addr => {
      const addrLower = addr.toLowerCase();
      const hasMinLength = addr.length >= 8;
      const hasAddressIndicators =
        addrLower.includes('rua') ||
        addrLower.includes('avenida') ||
        addrLower.includes('av.') ||
        addrLower.includes('av ') ||
        addrLower.includes('bairro') ||
        addrLower.includes('número') ||
        addrLower.includes('numero') ||
        addrLower.includes('nº') ||
        addrLower.includes('n°') ||
        addrLower.includes('quadra') ||
        addrLower.includes('q.') ||
        addrLower.includes(' q ') ||
        addrLower.includes('conjunto') ||
        addrLower.includes('cj.') ||
        addrLower.includes('cj ') ||
        addrLower.includes('casa') ||
        addrLower.includes('lote') ||
        addrLower.includes('setor') ||
        addrLower.includes('vila') ||
        addrLower.includes('chácara') ||
        addrLower.includes('chacara') ||
        addrLower.includes('condom') ||
        addrLower.includes('apto') ||
        addrLower.includes('apartamento') ||
        addrLower.includes('bloco') ||
        addrLower.includes('cep') ||
        /\d/.test(addr);
      return hasMinLength && hasAddressIndicators;
    });
    
    // Verificar se é pickup/retirada de várias formas (camelCase e snake_case)
    const isPickupExplicit =
      order.meta?.deliveryType === 'pickup' ||
      order.deliveryType === 'pickup' ||
      order.delivery_type === 'pickup' ||
      order.meta?.delivery_type === 'pickup' ||
      order.order_type === 'pickup' ||
      order.meta?.order_type === 'pickup' ||
      order.orderType === 'pickup' ||
      order.meta?.orderType === 'pickup';
    
    // Verificar no nome do cliente se indica retirada
    const customerNameLower = customerName.toLowerCase();
    const indicatesPickup = customerNameLower.includes('balcão') || 
                            customerNameLower.includes('balcao') ||
                            customerNameLower.includes('retirar') ||
                            customerNameLower.includes('retirada') ||
                            customerNameLower.includes('comer aqui');
    
    const isPickup = isPickupExplicit || indicatesPickup;
    
    // Verificar se tem serviceType indicando retirada
    const isTakeout = serviceType === 'embalar pra levar' || 
                     serviceType === 'comer no local' ||
                     serviceType === 'retirar no local' ||
                     serviceType === 'comer aqui';
    
    // Verificar se indica entrega (site pode enviar snake_case, camelCase ou só em meta)
    const deliveryTypeLower = (
      order.meta?.deliveryType ??
      order.deliveryType ??
      order.delivery_type ??
      order.meta?.delivery_type ??
      ''
    )
      .toString()
      .toLowerCase();
    const orderTypeLower = (
      order.order_type ??
      order.meta?.order_type ??
      order.orderType ??
      order.meta?.orderType ??
      ''
    )
      .toString()
      .toLowerCase();
    const indicatesDelivery =
      deliveryTypeLower === 'delivery' ||
      orderTypeLower === 'delivery' ||
      deliveryTypeLower === 'entrega' ||
      orderTypeLower === 'entrega';
    
    const isPickupOrTakeout = isPickup || isTakeout;
    
    // Sinais explícitos para evitar falso "COMER AQUI" quando o pedido é delivery com endereço
    const explicitPickupFromDeliveryForm = !!(deliveryForm && (
      deliveryForm.toLowerCase().includes('retirar') ||
      deliveryForm.toLowerCase().includes('retirada') ||
      deliveryForm.toLowerCase().includes('pickup')
    ));
    const explicitPickupFromConsumptionForm = !!(consumptionForm && (
      consumptionForm.toLowerCase().includes('embalar') ||
      consumptionForm.toLowerCase().includes('levar') ||
      consumptionForm.toLowerCase().includes('comer no local') ||
      consumptionForm.toLowerCase().includes('comer no estabelecimento') ||
      consumptionForm.toLowerCase().includes('comer aqui')
    ));
    
    // Determinar o tipo final do pedido
    let finalOrderType: string;
    const deliveryFormIsEntrega = !!(deliveryForm && (
      deliveryForm.toLowerCase().includes('entrega') &&
      !deliveryForm.toLowerCase().includes('retirar')
    ));
    const strongDeliverySignal =
      (deliveryFee > 0 && hasValidAddress) ||
      deliveryFormIsEntrega ||
      (indicatesDelivery && hasValidAddress);

    if (isNaBrasaSite) {
      // Para Na Brasa: prioridade corrigida para evitar falso "COMER AQUI" em pedidos delivery
      // 1) Pickup explícito por campos de entrega/retirada sempre vence
      if (explicitPickupFromDeliveryForm || isPickupExplicit) {
        finalOrderType = 'pickup';
      }
      // 2) Entrega explícita (taxa, forma de entrega ou tipo delivery + endereço)
      else if (strongDeliverySignal) {
        finalOrderType = 'delivery';
      }
      // Legado: indicação delivery + endereço
      else if (indicatesDelivery && hasValidAddress) {
        finalOrderType = 'delivery';
      }
      // 3) Pickup por consumo/embalagem explícito (quando não há delivery explícito válido)
      else if (explicitPickupFromConsumptionForm) {
        finalOrderType = 'pickup';
      }
      // 4) Sem endereço válido: pickup
      else if (!hasValidAddress) {
        finalOrderType = 'pickup';
      }
      // 5) Demais indícios de retirada/takeout
      else if (isTakeout || isPickup || indicatesPickup) {
        finalOrderType = 'pickup';
      }
      // 6) Fallback de segurança
      else {
        finalOrderType = 'pickup';
      }
    } else {
      // Para outros sites: se for pickup ou takeout, é pickup, senão verifica se é delivery
      const isDeliveryExplicit = indicatesDelivery && hasValidAddress;
      finalOrderType = isPickupOrTakeout ? 'pickup' : (isDeliveryExplicit ? 'delivery' : 'pickup');
    }
    
    // LOG DE DEBUG (remover em produção se necessário)
    // console.log('Order Type Determination (Na Brasa):', {
    //   isNaBrasaSite,
    //   deliveryForm,
    //   consumptionForm,
    //   serviceType,
    //   isPickup,
    //   indicatesPickup,
    //   isTakeout,
    //   indicatesDelivery,
    //   hasValidAddress,
    //   originalOrderType: order.order_type,
    //   originalDeliveryType: order.deliveryType || order.meta?.deliveryType,
    //   finalOrderType
    // });
    
    // Para Na Brasa: Sempre adicionar tipo de pedido ao nome do cliente para impressão na cozinha
    // Isso é importante para a cozinha saber como preparar o pedido
    if (isNaBrasaSite) {
      let typeToAdd: string | null = null;
      
      // Prioridade 1: Usar consumptionForm se disponível (mais específico - vem de "Forma de consumo/embalagem")
      if (consumptionForm) {
        const consumptionLower = consumptionForm.toLowerCase().trim();
        if (consumptionLower.includes('embalar') || consumptionLower.includes('levar')) {
          typeToAdd = 'Embalar pra levar';
        } else if (consumptionLower.includes('comer') || consumptionLower.includes('local')) {
          typeToAdd = 'Comer aqui';
        }
      }
      // Prioridade 2: Usar serviceType se disponível (extraído de vários campos)
      if (!typeToAdd && serviceType) {
        if (serviceType === 'embalar pra levar') {
          typeToAdd = 'Embalar pra levar';
        } else if (serviceType === 'comer no local' || serviceType === 'comer aqui') {
          typeToAdd = 'Comer aqui';
        } else if (serviceType === 'retirar no local') {
          typeToAdd = 'Retirar no local';
        } else {
          typeToAdd = serviceType.charAt(0).toUpperCase() + serviceType.slice(1);
        }
      }
      // Prioridade 3: Se deliveryForm diz "Retirar no local", adicionar ao nome
      if (!typeToAdd && deliveryForm) {
        const deliveryFormLower = deliveryForm.toLowerCase().trim();
        if (deliveryFormLower.includes('retirar')) {
          typeToAdd = 'Retirar no local';
        }
      }
      
      // Adicionar ao nome somente para pedidos pickup/takeout
      if (typeToAdd && finalOrderType === 'pickup') {
        // Verificar se já não está no nome (evitar duplicação)
        const customerNameLower = customerName.toLowerCase();
        const typeToAddLower = typeToAdd.toLowerCase();
        if (!customerNameLower.includes(typeToAddLower) && 
            !customerNameLower.includes('embalar') && 
            !customerNameLower.includes('comer aqui') &&
            !customerNameLower.includes('retirar')) {
          customerName = `${customerName} - ${typeToAdd}`;
        }
      }
    } else if (isPickup && serviceType) {
      // Para outros sites: adicionar serviceType ao nome
      const formattedServiceType = serviceType.charAt(0).toUpperCase() + serviceType.slice(1);
      if (!customerName.toLowerCase().includes(formattedServiceType.toLowerCase())) {
        customerName = `${customerName} - ${formattedServiceType}`;
      }
    }
    
    // Normalizar método de pagamento para valores aceitos pelo banco
    // Valores aceitos: 'dinheiro', 'pix', 'cartao_credito', 'cartao_debito', 'online', 'whatsapp', 'balcao', 'a_confirmar'
    const normalizePaymentMethod = (method: string | null | undefined): string => {
      if (!method) return 'a_confirmar';
      
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
      const validMethods = ['dinheiro', 'pix', 'cartao_credito', 'cartao_debito', 'online', 'whatsapp', 'balcao', 'a_confirmar'];
      if (validMethods.includes(normalized)) {
        return normalized;
      }
      if (normalized === 'a confirmar' || normalized === 'à confirmar') {
        return 'a_confirmar';
      }
      
      // Valor desconhecido: operador define no atendimento
      return 'a_confirmar';
    };
    
    const rawPaymentMethod = order.payment?.method || order.payment_method || null;
    const normalizedPaymentMethod = normalizePaymentMethod(rawPaymentMethod);

    // Cupom no PDV: garantir "Endereço:" em notes quando a entrega veio só em campos JSON (comum no site Na Brasa)
    if (finalOrderType === 'delivery' && hasValidAddress && allTextFields.length > 0) {
      const enc = orderNotes || '';
      if (!/\bendereç[oa]\s*:/i.test(enc)) {
        const bestAddr = [...allTextFields].sort((a, b) => b.length - a.length)[0];
        if (bestAddr && bestAddr.length >= 8) {
          orderNotes = enc ? `Endereço: ${bestAddr}\n\n${enc}` : `Endereço: ${bestAddr}`;
        }
      }
    }

    // Create order
    const orderData: any = {
      establishment_id: establishment.id,
      order_number: orderNumber,
      customer_name: customerName,
      customer_phone: order.customer?.phone || null,
      order_type: finalOrderType,
      delivery_type: finalOrderType,
      subtotal: subtotal,
      delivery_fee: deliveryFee,
      discount_amount: discountAmount,
      total_amount: totalAmount,
      status: 'pending',
      payment_status: 'pending', // Confirmado pelo estabelecimento na página Pedidos (Pendentes)
      payment_method: normalizedPaymentMethod,
      notes: orderNotes,
      source_domain: source_domain || null,
      external_id: order.external_id || null,
      channel: order.channel || 'online',
      origin: order.origin || 'site',
      free_delivery_promotion_id: freeDeliveryPromotionId,
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

    // Registrar uso da promoção de frete grátis se aplicável
    if (freeDeliveryPromotionId && newOrder?.id) {
      try {
        await supabase.rpc('increment_free_delivery_usage', {
          p_promotion_id: freeDeliveryPromotionId
        });
      } catch (error) {
        console.warn('Error incrementing free delivery usage:', error);
        // Não falhar o pedido por causa disso
      }
    }

    // Create order items
    let incomingItems = extractIncomingOrderItems(order as Record<string, unknown>);
    if (incomingItems.length === 0) {
      const meta = order.meta as Record<string, unknown> | undefined;
      const customer = order.customer as Record<string, unknown> | undefined;
      const previewText = String(
        meta?.whatsapp_message_preview ?? customer?.notes ?? ''
      );
      const fromPreview = parseBracketItemsFromText(previewText);
      if (fromPreview.length > 0) {
        console.log(`Itens extraídos do preview WhatsApp: ${fromPreview.length}`);
        incomingItems = fromPreview;
      }
    }

    if (incomingItems.length > 0) {
      const { data: catalogProducts } = await supabase
        .from('products')
        .select('id, name, sku')
        .eq('establishment_id', establishment.id);

      const allProducts = catalogProducts || [];
      let placeholderProductId: string | null = null;

      const orderItems = incomingItems
        .filter((rawItem: unknown) => {
          const item = rawItem as Record<string, unknown>;
          const name = String(item.name ?? item.title ?? item.product_name ?? '').trim();
          const unitPrice = Number(item.unit_price ?? item.unitPrice ?? item.price ?? 0);
          const quantity = Number(item.qty ?? item.quantity ?? 1);
          const obsText = String(item.obs ?? item.notes ?? '').toLowerCase();

          const hasName = name.length > 0;
          const hasPrice = unitPrice > 0;
          const hasQuantity = quantity > 0;
          const isObservationOnly =
            !hasPrice && !hasQuantity && obsText.includes('obs');

          return hasName && (hasPrice || hasQuantity) && !isObservationOnly;
        })
        .map((rawItem: unknown) => {
          const item = rawItem as Record<string, unknown>;
          const unitPrice = Number(item.unit_price ?? item.unitPrice ?? item.price ?? 0);
          const quantity = Math.max(1, Number(item.qty ?? item.quantity ?? 1) || 1);
          let productId = resolveProductIdFromCatalog(item, allProducts);
          const usedPlaceholder = !productId;

          let itemNotes = '';
          if (item.obs && String(item.obs).trim()) {
            itemNotes = String(item.obs).trim();
          }

          let cleanItemName = String(
            item.name ?? item.title ?? item.product_name ?? ''
          ).trim();

          const complements = item.complements;
          if (Array.isArray(complements) && complements.length > 0) {
            const complementsText = complements
              .map((c: Record<string, unknown>) => {
                const compName = String(c.name || '')
                  .replace(/^Variante\s*:\s*/i, '')
                  .trim();
                const compPrice = Number(c.price || 0);
                return compPrice > 0
                  ? `${compName} (+R$ ${compPrice.toFixed(2)})`
                  : compName;
              })
              .filter(Boolean)
              .join(', ');
            if (complementsText && !isDrinkItemName(cleanItemName)) {
              const label = isBaguetteOrSmashItemName(cleanItemName)
                ? 'Molho especial'
                : 'Molhos';
              itemNotes += (itemNotes ? ' | ' : '') + `${label}: ${complementsText}`;
            }
          }

          cleanItemName = cleanItemName
            .replace(/\s*(Obs:|Observação:|Molhos?:|Molho especial:).*$/i, '')
            .trim();

          const customizations: Record<string, unknown> = {};
          if (Array.isArray(complements) && complements.length > 0) {
            customizations.complements = complements;
          }
          if (usedPlaceholder && cleanItemName) {
            customizations.site_item_name = cleanItemName;
          }

          return {
            order_id: newOrder.id,
            product_id: productId,
            quantity,
            unit_price: unitPrice,
            total_price: unitPrice * quantity,
            notes: itemNotes || null,
            customizations,
            _usedPlaceholder: usedPlaceholder,
            _cleanItemName: cleanItemName,
          };
        });

      const needsPlaceholder = orderItems.some((item: { _usedPlaceholder?: boolean }) => item._usedPlaceholder);
      if (needsPlaceholder) {
        placeholderProductId = await getSiteOrderPlaceholderProductId(supabase, establishment.id);
      }

      const validOrderItems = orderItems
        .map((item: {
          order_id: string;
          product_id: string | null;
          quantity: number;
          unit_price: number;
          total_price: number;
          notes: string | null;
          customizations: Record<string, unknown>;
          _usedPlaceholder?: boolean;
          _cleanItemName?: string;
        }) => {
          if (!item.product_id && placeholderProductId) {
            return {
              order_id: item.order_id,
              product_id: placeholderProductId,
              quantity: item.quantity,
              unit_price: item.unit_price,
              total_price: item.total_price,
              notes: item.notes,
              customizations: {
                ...item.customizations,
                site_item_name: item._cleanItemName || item.customizations.site_item_name,
              },
            };
          }
          const { _usedPlaceholder, _cleanItemName, ...rest } = item;
          return rest;
        })
        .filter((item: { product_id: string | null }) => item.product_id);

      if (validOrderItems.length > 0) {
        const unmatched = orderItems.filter((i: { _usedPlaceholder?: boolean }) => i._usedPlaceholder).length;
        if (unmatched > 0) {
          console.warn(
            `${unmatched} item(ns) do site sem match no cardápio da unidade ${establishment.id}; usando placeholder com site_item_name`
          );
        }
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
      print_queued: true,
      establishment_id: establishment.id,
      site_unit_slug: siteUnitSlug || null,
    }), {
      headers: { ...corsHeadersFor(req), 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error in online-order-intake function:', error);
    return new Response(JSON.stringify({
      ok: false,
      error: error?.message || 'Erro interno do servidor',
    }), {
      status: 500,
      headers: { ...corsHeadersFor(req), 'Content-Type': 'application/json' },
    });
  }
});
