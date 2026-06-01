import { supabase } from "@/integrations/supabase/client";
import {
  findDuplicateOf,
  type OrderDuplicateCandidate,
} from "@/utils/orderDuplicateDetection";
import { isPendingSiteOrderForAutoAccept } from "@/utils/orderSiteOrder";

const ORDER_SELECT = `
  id,
  order_number,
  customer_name,
  customer_phone,
  total_amount,
  subtotal,
  discount_amount,
  delivery_fee,
  order_type,
  status,
  payment_status,
  payment_method,
  payment_method_2,
  payment_amount_1,
  payment_amount_2,
  notes,
  created_at,
  updated_at,
  source_domain,
  channel,
  origin,
  external_id,
  accepted_and_printed_at,
  delivery_boy_id,
  order_items (
    *,
    products (name, categories(name))
  )
`;

export async function fetchOrderForAutoAccept(orderId: string) {
  const { data, error } = await supabase
    .from("orders")
    .select(ORDER_SELECT)
    .eq("id", orderId)
    .single();

  if (error) throw error;
  return data;
}

export async function fetchRecentOrdersForDuplicateCheck(
  establishmentId: string,
  excludeOrderId: string
): Promise<OrderDuplicateCandidate[]> {
  const since = new Date(Date.now() - 20 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("orders")
    .select(
      "id, order_number, customer_phone, customer_name, total_amount, order_type, external_id, created_at, status, accepted_and_printed_at"
    )
    .eq("establishment_id", establishmentId)
    .neq("id", excludeOrderId)
    .gte("created_at", since)
    .in("status", ["pending", "preparing", "ready", "completed"])
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data || []) as OrderDuplicateCandidate[];
}

export async function rejectOrderAsDuplicate(
  orderId: string,
  originalOrderNumber: string | number
): Promise<void> {
  const { error } = await supabase
    .from("orders")
    .update({
      status: "cancelled",
      rejection_reason: `Pedido duplicado detectado automaticamente. Mantido pedido #${originalOrderNumber}.`,
    })
    .eq("id", orderId);

  if (error) throw error;
}

function isFromNaBrasaSite(order: { source_domain?: string | null }): boolean {
  return (
    order.source_domain?.toLowerCase().includes("hamburguerianabrasa") || false
  );
}

function orderRequiresCashToAccept(order: {
  source_domain?: string | null;
  channel?: string | null;
  origin?: string | null;
}): boolean {
  if (isFromNaBrasaSite(order)) return true;
  const channel = order.channel || "";
  const origin = order.origin || "";
  if (channel === "online" || origin === "site" || origin === "cardapio_online") {
    return true;
  }
  if (order.source_domain && String(order.source_domain).trim() !== "") {
    return true;
  }
  return false;
}

export async function acceptOrderInAutoFlow(params: {
  order: Record<string, unknown>;
  establishmentId: string;
  hasOpenCashSession: boolean;
}): Promise<Record<string, unknown>> {
  const { order, establishmentId, hasOpenCashSession } = params;

  if (orderRequiresCashToAccept(order as Parameters<typeof orderRequiresCashToAccept>[0])) {
    if (!hasOpenCashSession) {
      throw new Error("CAIXA_FECHADO");
    }
  }

  const updateData: Record<string, unknown> = {
    accepted_and_printed_at: new Date().toISOString(),
  };

  if (
    orderRequiresCashToAccept(order as Parameters<typeof orderRequiresCashToAccept>[0])
  ) {
    const { data: newOrderNumber, error: orderNumberError } = await supabase.rpc(
      "get_next_order_number",
      { p_establishment_id: establishmentId }
    );
    if (!orderNumberError && newOrderNumber) {
      updateData.order_number = newOrderNumber;
    }
  }

  const isDelivery = order.order_type === "delivery";
  const hasAddress = String(order.notes || "")
    .toLowerCase()
    .includes("endereço:");
  const hasDeliveryBoy = order.delivery_boy_id != null;

  if (isDelivery && !hasDeliveryBoy) {
    const { data: deliveryBoys } = await (supabase as any)
      .from("delivery_boys")
      .select("id")
      .eq("establishment_id", establishmentId)
      .eq("active", true)
      .order("name")
      .limit(1);

    if (deliveryBoys?.[0]?.id) {
      updateData.delivery_boy_id = deliveryBoys[0].id;
    }
  }

  const { data: updatedOrder, error } = await supabase
    .from("orders")
    .update(updateData)
    .eq("id", order.id as string)
    .select(ORDER_SELECT)
    .single();

  if (error) throw error;

  try {
    await supabase.rpc("apply_stock_deduction_for_order", {
      p_establishment_id: establishmentId,
      p_order_id: order.id as string,
    });
  } catch {
    /* não bloqueia */
  }

  return updatedOrder as Record<string, unknown>;
}

export async function checkAndRejectIfDuplicate(
  order: OrderDuplicateCandidate,
  establishmentId: string
): Promise<{ isDuplicate: boolean; keptOrderNumber?: string | number }> {
  const recent = await fetchRecentOrdersForDuplicateCheck(
    establishmentId,
    order.id
  );
  const original = findDuplicateOf(order, recent);
  if (!original) return { isDuplicate: false };

  await rejectOrderAsDuplicate(order.id, original.order_number);
  return { isDuplicate: true, keptOrderNumber: original.order_number };
}

export async function processAutoAcceptOrderId(params: {
  orderId: string;
  establishmentId: string;
  hasOpenCashSession: boolean;
}): Promise<"accepted" | "duplicate" | "skipped" | "error"> {
  const { orderId, establishmentId, hasOpenCashSession } = params;

  try {
    const order = await fetchOrderForAutoAccept(orderId);
    if (!order) return "skipped";

    if (!isPendingSiteOrderForAutoAccept(order)) return "skipped";

    const dup = await checkAndRejectIfDuplicate(
      order as OrderDuplicateCandidate,
      establishmentId
    );
    if (dup.isDuplicate) return "duplicate";

    await acceptOrderInAutoFlow({
      order: order as Record<string, unknown>,
      establishmentId,
      hasOpenCashSession,
    });

    return "accepted";
  } catch (e) {
    console.error("[auto-accept]", e);
    return "error";
  }
}
