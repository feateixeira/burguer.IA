export interface OrderDuplicateCandidate {
  id: string;
  order_number: string | number;
  customer_phone?: string | null;
  customer_name?: string | null;
  total_amount: number;
  order_type?: string | null;
  external_id?: string | null;
  created_at: string;
  status: string;
  accepted_and_printed_at?: string | null;
}

const DUPLICATE_WINDOW_MS = 15 * 60 * 1000;

export function normalizePhoneForDuplicate(
  phone: string | null | undefined
): string {
  return String(phone ?? "").replace(/\D/g, "");
}

export function buildOrderDuplicateFingerprint(order: {
  customer_phone?: string | null;
  customer_name?: string | null;
  total_amount: number;
  order_type?: string | null;
}): string {
  const phone = normalizePhoneForDuplicate(order.customer_phone);
  const total = Number(order.total_amount).toFixed(2);
  const type = (order.order_type || "").toLowerCase().trim();
  const name = (order.customer_name || "").trim().toLowerCase().slice(0, 50);
  return `${phone}|${total}|${type}|${name}`;
}

/**
 * Retorna o pedido “original” se o novo for duplicata (mantém o mais antigo).
 */
export function findDuplicateOf(
  newOrder: OrderDuplicateCandidate,
  existingOrders: OrderDuplicateCandidate[]
): OrderDuplicateCandidate | null {
  if (newOrder.external_id?.trim()) {
    const byExternal = existingOrders.find(
      (o) =>
        o.id !== newOrder.id &&
        o.status !== "cancelled" &&
        o.external_id?.trim() === newOrder.external_id.trim()
    );
    if (byExternal) return byExternal;
  }

  const newTime = new Date(newOrder.created_at).getTime();
  const fingerprint = buildOrderDuplicateFingerprint(newOrder);

  let oldestMatch: OrderDuplicateCandidate | null = null;
  let oldestTime = Infinity;

  for (const o of existingOrders) {
    if (o.id === newOrder.id) continue;
    if (o.status === "cancelled") continue;

    const oTime = new Date(o.created_at).getTime();
    if (Math.abs(newTime - oTime) > DUPLICATE_WINDOW_MS) continue;

    if (buildOrderDuplicateFingerprint(o) !== fingerprint) continue;

    if (oTime < oldestTime) {
      oldestTime = oTime;
      oldestMatch = o;
    }
  }

  return oldestMatch;
}
