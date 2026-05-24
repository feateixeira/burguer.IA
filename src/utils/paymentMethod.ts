/** Valor padrão no banco quando a forma de pagamento ainda não foi definida. */
export const PAYMENT_METHOD_A_CONFIRMAR = "a_confirmar" as const;

/** Valores persistidos em orders.payment_method */
export type OrderPaymentMethod =
  | "dinheiro"
  | "pix"
  | "cartao_debito"
  | "cartao_credito"
  | "online"
  | "whatsapp"
  | "balcao"
  | typeof PAYMENT_METHOD_A_CONFIRMAR;

export const PAYMENT_METHOD_OPTIONS: {
  value: OrderPaymentMethod;
  label: string;
  icon: string;
}[] = [
  { value: "pix", label: "PIX", icon: "📱" },
  { value: "cartao_credito", label: "Crédito", icon: "💳" },
  { value: "cartao_debito", label: "Débito", icon: "💳" },
  { value: "dinheiro", label: "Dinheiro", icon: "💵" },
];

/** Pagamento ainda não definido (null/vazio legado) ou explicitamente a_confirmar. */
export function isPaymentMethodToConfirm(
  paymentMethod: string | null | undefined
): boolean {
  if (paymentMethod == null) return true;
  const trimmed = String(paymentMethod).trim();
  if (!trimmed) return true;
  const lower = trimmed.toLowerCase();
  if (lower === PAYMENT_METHOD_A_CONFIRMAR) return true;
  const normalized = trimmed.toUpperCase().replace(/_/g, " ");
  return normalized === "A CONFIRMAR";
}

export function getPaymentMethodLabel(
  paymentMethod: string | null | undefined
): string {
  if (isPaymentMethodToConfirm(paymentMethod)) return "À CONFIRMAR";
  switch (paymentMethod) {
    case "dinheiro":
      return "Dinheiro";
    case "pix":
      return "PIX";
    case "cartao_debito":
      return "Débito";
    case "cartao_credito":
      return "Crédito";
    case "online":
      return "Online";
    default:
      return paymentMethod || "N/A";
  }
}

/** Rótulo completo para confirmação antes de aceitar pedido do site. */
export function getPaymentMethodSiteConfirmLabel(
  paymentMethod: string | null | undefined
): string {
  if (isPaymentMethodToConfirm(paymentMethod)) return "À confirmar";
  switch (paymentMethod) {
    case "dinheiro":
      return "Dinheiro";
    case "pix":
      return "PIX";
    case "cartao_debito":
      return "Cartão de Débito";
    case "cartao_credito":
      return "Cartão de Crédito";
    case "online":
      return "Online";
    case "whatsapp":
      return "WhatsApp";
    case "balcao":
      return "Balcão";
    default:
      return paymentMethod || "Não informado";
  }
}

/** Valor inicial do modal: null se ainda não definido. */
export function getInitialPaymentMethodSelection(
  paymentMethod: string | null | undefined
): OrderPaymentMethod | null {
  if (isPaymentMethodToConfirm(paymentMethod)) return null;
  const valid = PAYMENT_METHOD_OPTIONS.find((o) => o.value === paymentMethod);
  return valid ? valid.value : null;
}

/** Normaliza para persistência em orders.payment_method. */
export function paymentMethodForInsert(
  paymentMethod: string | null | undefined
): string {
  if (isPaymentMethodToConfirm(paymentMethod)) {
    return PAYMENT_METHOD_A_CONFIRMAR;
  }
  return String(paymentMethod).trim();
}

/** Pedido pertence à janela da sessão de caixa (criado ou atualizado após abertura). */
export function isOrderInCashSessionWindow(
  order: { created_at: string; updated_at?: string | null },
  sessionOpenedAt: string | Date
): boolean {
  const opened = new Date(sessionOpenedAt).getTime();
  const created = new Date(order.created_at).getTime();
  const updated = new Date(order.updated_at || order.created_at).getTime();
  return created >= opened || updated >= opened;
}
