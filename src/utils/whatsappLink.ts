import { normalizePhoneBRToE164 } from "./phoneNormalizer";

interface Order {
  id: string;
  order_number: string;
  customer_name?: string;
  customer_phone?: string;
  total_amount: number;
  notes?: string;
  delivery_type?: string;
  order_type?: string;
  payment_method?: string;
  channel?: string;
  origin?: string;
  source_domain?: string;
}

interface Establishment {
  id: string;
  name: string;
  pix_key?: string | null; // Deprecated - usar pix_key_value
  pix_key_value?: string | null;
}

/**
 * Gera link do WhatsApp com mensagem pré-preenchida para envio de PIX
 */
export function buildWhatsLink(order: Order, estab: Establishment): string {
  if (!order.customer_phone) {
    return '#';
  }

  // Normalizar telefone para E.164
  const phoneE164 = normalizePhoneBRToE164(order.customer_phone);
  
  // Verificar se tem chave PIX (priorizar pix_key_value, fallback para pix_key antigo)
  const pixKey = estab.pix_key_value || estab.pix_key || '';
  
  if (!pixKey) {
    return '#';
  }

  // Extrair endereço das notas se houver (formato: "Endereço: ...")
  let shortAddress = '';
  if (order.notes) {
    const addressMatch = order.notes.match(/Endereço:\s*(.+?)(?:\n|$)/i);
    if (addressMatch) {
      shortAddress = addressMatch[1].trim();
      // Limitar a 80-100 caracteres
      if (shortAddress.length > 100) {
        shortAddress = shortAddress.substring(0, 97) + '...';
      }
    }
  }

  // Formatar total em BRL
  const totalBrl = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(order.total_amount);

  // Order code pode ser order_number ou id curto
  const orderCode = order.order_number || order.id.substring(0, 8).toUpperCase();

  // Verificar se é entrega ou retirada
  const isDelivery = order.delivery_type === 'delivery' || order.order_type === 'delivery';
  const deliveryInfo = isDelivery && shortAddress ? `\n• Entrega em: ${shortAddress}` : `\n• Tipo: Retirada no local`;

  // Montar mensagem
  const message = `Olá, aqui é do ${estab.name} 👋

Recebemos seu pedido pelo site e o método selecionado foi PIX.

💳 Nossa chave PIX é:
${pixKey}

Por favor, envie o comprovante aqui neste chat para confirmarmos seu pedido.

Resumo:
• Nome: ${order.customer_name || 'Cliente'}
• Pedido: #${orderCode}
• Total: ${totalBrl}${deliveryInfo}

Assim que confirmarmos o pagamento, seguimos com o preparo. Obrigado!`;

  // Codificar mensagem para URL
  const encodedMessage = encodeURIComponent(message);

  // Retornar link do WhatsApp
  return `https://wa.me/${phoneE164}?text=${encodedMessage}`;
}

/**
 * Verifica se o botão WhatsApp deve ser exibido
 * Mostra APENAS para pedidos PIX + Entrega do cardápio online
 */
export function shouldShowWhatsButton(order: Order): boolean {
  const isPix = order.payment_method === 'pix';
  const hasPhone = !!order.customer_phone && order.customer_phone.trim().length > 0;
  
  // Deve ser Entrega (não Retirada)
  const isDelivery = order.delivery_type === 'delivery' || order.order_type === 'delivery';
  
  if (!isPix || !hasPhone || !isDelivery) {
    return false;
  }
  
  // Verificar se é pedido do cardápio online
  // Pode ser identificado por:
  // 1. channel = 'online'
  // 2. origin = 'cardapio_online' ou 'site'
  // 3. source_domain não vazio (indica pedido do site)
  // 4. order_number começa com 'ONLINE-'
  const isOnlineOrder = 
    order.channel === 'online' || 
    order.origin === 'cardapio_online' || 
    order.origin === 'site' ||
    (order.source_domain && order.source_domain.trim().length > 0) ||
    (order.order_number && order.order_number.startsWith('ONLINE-'));
  
  return isOnlineOrder;
}

