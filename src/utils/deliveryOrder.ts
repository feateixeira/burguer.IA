/** Identifica pedido de entrega (fechamento de caixa, motoboy, relatórios). */

export type DeliveryOrderLike = {
  order_type?: string | null;
  delivery_type?: string | null;
  delivery_fee?: number | null;
  notes?: string | null;
  status?: string | null;
};

export function isDeliveryOrder(order: DeliveryOrderLike): boolean {
  const ot = (order.order_type || "").toLowerCase().trim();
  const dt = (order.delivery_type || "").toLowerCase().trim();

  if (ot === "delivery" || dt === "delivery") return true;
  if (ot === "entrega" || dt === "entrega") return true;

  const fee = Number(order.delivery_fee) || 0;
  if (fee > 0) return true;

  const notes = (order.notes || "").toLowerCase();
  if (notes.includes("endereço:") || notes.includes("endereco:")) {
    const pickupOnly =
      notes.includes("retirar no local") &&
      !notes.includes("forma de entrega: entrega") &&
      !notes.includes("entrega");
    if (!pickupOnly) return true;
  }

  return false;
}

export function isCancelledOrder(status?: string | null): boolean {
  return (status || "").toLowerCase() === "cancelled";
}
