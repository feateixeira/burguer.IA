/** Pedido originado do site / cardápio online (mesmo critério das notificações). */
export function isOnlineSiteOrder(order: {
  channel?: string | null;
  origin?: string | null;
  source_domain?: string | null;
}): boolean {
  const channel = order.channel ? String(order.channel).toLowerCase().trim() : "";
  const origin = order.origin ? String(order.origin).toLowerCase().trim() : "";
  const sourceDomain = order.source_domain ? String(order.source_domain).trim() : "";

  return (
    channel === "online" ||
    origin === "site" ||
    origin === "cardapio_online" ||
    sourceDomain.length > 0 ||
    (!channel && (sourceDomain.length > 0 || origin === "site"))
  );
}

export function isPendingSiteOrderForAutoAccept(order: {
  status: string;
  accepted_and_printed_at?: string | null;
  channel?: string | null;
  origin?: string | null;
  source_domain?: string | null;
}): boolean {
  return (
    order.status === "pending" &&
    !order.accepted_and_printed_at &&
    isOnlineSiteOrder(order)
  );
}
