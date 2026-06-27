/** Valor padrão no banco quando a forma de pagamento ainda não foi definida. */
export const PAYMENT_METHOD_A_CONFIRMAR = "a_confirmar" as const;

/** Forma unificada de cartão (crédito e débito). */
export const PAYMENT_METHOD_CARTAO = "cartao" as const;

/** Valores persistidos em orders.payment_method */
export type OrderPaymentMethod =
  | "dinheiro"
  | "pix"
  | typeof PAYMENT_METHOD_CARTAO
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
  { value: PAYMENT_METHOD_CARTAO, label: "Cartão", icon: "💳" },
  { value: "dinheiro", label: "Dinheiro", icon: "💵" },
];

const LEGACY_CARD_VALUES = new Set([
  "cartao_credito",
  "cartao_debito",
  "cartao credito/debito",
  "cartao_credito_debito",
  PAYMENT_METHOD_CARTAO,
]);

/** Cartão (crédito, débito ou valor unificado legado). */
export function isCardPaymentMethod(
  paymentMethod: string | null | undefined
): boolean {
  if (paymentMethod == null) return false;
  const m = String(paymentMethod).toLowerCase().trim();
  if (!m) return false;
  if (LEGACY_CARD_VALUES.has(m)) return true;
  return m.includes("cartao") || m.includes("cartão");
}

/** Agrupa chaves de cartão legadas em `cartao` para relatórios e fechamento. */
export function normalizePaymentMethodKey(
  paymentMethod: string | null | undefined
): string {
  if (isPaymentMethodToConfirm(paymentMethod)) return PAYMENT_METHOD_A_CONFIRMAR;
  if (!paymentMethod || !String(paymentMethod).trim()) {
    return PAYMENT_METHOD_A_CONFIRMAR;
  }
  const m = String(paymentMethod).toLowerCase().trim();
  if (m === "cash") return "dinheiro";
  if (isCardPaymentMethod(m)) return PAYMENT_METHOD_CARTAO;
  return m;
}

/** Total esperado de cartão (soma débito + crédito legados). */
export function getExpectedCardTotal(totals: {
  expected_debit?: number | null;
  expected_credit?: number | null;
}): number {
  return (totals.expected_debit || 0) + (totals.expected_credit || 0);
}

/** Total contado de cartão (soma campos legados do fechamento). */
export function getCountedCardTotal(session: {
  counted_debit?: number | null;
  counted_credit?: number | null;
}): number {
  return (session.counted_debit || 0) + (session.counted_credit || 0);
}

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
  if (isCardPaymentMethod(paymentMethod)) return "Cartão";
  switch (paymentMethod) {
    case "dinheiro":
      return "Dinheiro";
    case "pix":
      return "PIX";
    case "online":
      return "Online";
    case "whatsapp":
      return "WhatsApp";
    case "balcao":
      return "Balcão";
    case "other":
      return "Outros";
    default:
      return paymentMethod || "N/A";
  }
}

/** Rótulo completo para confirmação antes de aceitar pedido do site. */
export function getPaymentMethodSiteConfirmLabel(
  paymentMethod: string | null | undefined
): string {
  if (isPaymentMethodToConfirm(paymentMethod)) return "À confirmar";
  if (isCardPaymentMethod(paymentMethod)) return "Cartão";
  switch (paymentMethod) {
    case "dinheiro":
      return "Dinheiro";
    case "pix":
      return "PIX";
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
  if (isCardPaymentMethod(paymentMethod)) return PAYMENT_METHOD_CARTAO;
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
  if (isCardPaymentMethod(paymentMethod)) {
    return PAYMENT_METHOD_CARTAO;
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
