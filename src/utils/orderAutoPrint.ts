import { supabase } from "@/integrations/supabase/client";
import { printReceipt, type ReceiptData } from "@/utils/receiptPrinter";
import { printReceiptNaBrasa } from "@/utils/receiptPrinterNaBrasa";

/**
 * Impressão simplificada quando a página de Pedidos não está montada
 * (usa itens do banco; suficiente para conferência na cozinha).
 */
export async function printOrderForAutoAccept(orderId: string): Promise<void> {
  const { data: order, error } = await supabase
    .from("orders")
    .select(
      `
      *,
      order_items (
        quantity,
        unit_price,
        total_price,
        notes,
        products (name)
      )
    `
    )
    .eq("id", orderId)
    .single();

  if (error || !order) throw error || new Error("Pedido não encontrado");

  const { data: establishment } = await supabase
    .from("establishments")
    .select("name, address, phone")
    .eq("id", order.establishment_id)
    .single();

  const items =
    order.order_items?.map((item: {
      quantity: number;
      unit_price: number;
      total_price: number;
      notes?: string | null;
      products?: { name?: string } | null;
    }) => ({
      name: item.products?.name || "Item",
      quantity: item.quantity,
      unitPrice: item.unit_price,
      totalPrice: item.total_price,
      notes: item.notes || undefined,
    })) || [];

  if (items.length === 0) {
    items.push({
      name: "Pedido Online",
      quantity: 1,
      unitPrice: order.total_amount,
      totalPrice: order.total_amount,
    });
  }

  const isNaBrasa =
    order.source_domain?.toLowerCase().includes("hamburguerianabrasa") || false;

  const receiptData: ReceiptData = {
    orderNumber: String(order.order_number),
    customerName: order.customer_name || undefined,
    customerPhone: order.customer_phone || undefined,
    items,
    subtotal: order.subtotal ?? order.total_amount,
    discountAmount: order.discount_amount || 0,
    deliveryFee: order.delivery_fee || 0,
    totalAmount: order.total_amount,
    establishmentName: establishment?.name || "",
    establishmentAddress: establishment?.address || undefined,
    establishmentPhone: establishment?.phone || undefined,
    paymentMethod: order.payment_method || undefined,
    paymentMethod2: order.payment_method_2 || undefined,
    paymentAmount1: order.payment_amount_1 ?? undefined,
    paymentAmount2: order.payment_amount_2 ?? undefined,
    orderType: order.order_type || "delivery",
    createdAt: order.created_at,
  };

  const handler = isNaBrasa ? printReceiptNaBrasa : printReceipt;
  await handler(receiptData);
}
