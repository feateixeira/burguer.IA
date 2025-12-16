import { supabase } from "@/integrations/supabase/client";

/**
 * Verifica se existe uma promoção de frete grátis ativa para o estabelecimento
 * e se ela se aplica ao pedido atual (considerando condições como limite de pedidos e horário)
 * 
 * @param establishmentId ID do estabelecimento
 * @returns ID da promoção se aplicável, null caso contrário
 */
export async function checkFreeDeliveryPromotion(
  establishmentId: string
): Promise<string | null> {
  try {
    const { data, error } = await supabase.rpc('check_free_delivery_promotion', {
      p_establishment_id: establishmentId,
      p_order_time: new Date().toISOString()
    });

    if (error) {
      console.error('Error checking free delivery promotion:', error);
      return null;
    }

    return data || null;
  } catch (error) {
    console.error('Error checking free delivery promotion:', error);
    return null;
  }
}

/**
 * Registra que um pedido usou uma promoção de frete grátis
 * 
 * @param orderId ID do pedido
 * @param promotionId ID da promoção
 */
export async function registerFreeDeliveryUsage(
  orderId: string,
  promotionId: string
): Promise<void> {
  try {
    // Atualizar o pedido com a promoção usada
    await supabase
      .from('orders')
      .update({ free_delivery_promotion_id: promotionId })
      .eq('id', orderId);

    // Incrementar contador da promoção
    await supabase.rpc('increment_free_delivery_usage', {
      p_promotion_id: promotionId
    });
  } catch (error) {
    console.error('Error registering free delivery usage:', error);
  }
}

