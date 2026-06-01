import { supabase } from "@/integrations/supabase/client";
import { CashSessionTotals } from "@/hooks/useCashSession";
import {
  getPaymentMethodSiteConfirmLabel,
  isPaymentMethodToConfirm,
  PAYMENT_METHOD_A_CONFIRMAR,
} from "@/utils/paymentMethod";

export interface CashReportOrderLine {
  orderNumber: string;
  time: string;
  amount: number;
  sortAt: number;
}

export interface CashReportPaymentGroup {
  methodKey: string;
  label: string;
  total: number;
  lines: CashReportOrderLine[];
}

export interface CashReportDeliveryBoyGroup {
  id: string;
  name: string;
  deliveriesCount: number;
  ordersTotal: number;
  dailyRate: number;
  deliveryFeesTotal: number;
  motoboyTotal: number;
  lines: CashReportOrderLine[];
}

export interface CashClosingReportData {
  establishmentName: string;
  sessionOpenedAt: string;
  sessionClosedAt: string | null;
  openingAmount: number;
  totals: CashSessionTotals | null;
  paymentGroups: CashReportPaymentGroup[];
  deliveryBoyGroups: CashReportDeliveryBoyGroup[];
  pedidosAConfirmar: number;
  ordersInCashCount: number;
}

interface SessionOrderRow {
  id: string;
  order_number: string | number;
  total_amount: number;
  payment_method: string | null;
  payment_method_2?: string | null;
  payment_amount_1?: number | null;
  payment_amount_2?: number | null;
  status: string;
  payment_status: string;
  created_at: string;
  updated_at?: string | null;
  credit_received_at?: string | null;
  is_credit_sale?: boolean | null;
  credit_total_with_interest?: number | null;
  source_domain?: string | null;
  channel?: string | null;
  origin?: string | null;
  accepted_and_printed_at?: string | null;
  delivery_boy_id?: string | null;
  order_type?: string | null;
}

const PAYMENT_METHOD_ORDER = [
  "dinheiro",
  "cash",
  "pix",
  "cartao_debito",
  "cartao credito/debito",
  "cartao_credito",
  "online",
  "whatsapp",
  "balcao",
  PAYMENT_METHOD_A_CONFIRMAR,
] as const;

function normalizeMethodKey(method: string | null | undefined): string {
  if (!method || !String(method).trim()) return PAYMENT_METHOD_A_CONFIRMAR;
  const m = String(method).toLowerCase().trim();
  if (m === "cash") return "dinheiro";
  if (m === "cartao credito/debito" || m === "cartao_credito_debito") return "cartao_debito";
  return m;
}

function methodSortIndex(key: string): number {
  const idx = PAYMENT_METHOD_ORDER.indexOf(key as (typeof PAYMENT_METHOD_ORDER)[number]);
  return idx === -1 ? 999 : idx;
}

function formatOrderNumber(n: string | number): string {
  const s = String(n ?? "").trim();
  if (!s) return "#—";
  return s.startsWith("#") ? s : `#${s}`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isNaBrasaEstablishment(name: string): boolean {
  return name.toLowerCase().trim() === "na brasa";
}

/** Mesmos critérios de compute_cash_session_totals (versão cliente). */
export function matchesCashSessionForReport(
  order: SessionOrderRow,
  sessionOpenedAt: string,
  sessionClosedAt: string | null,
  isNaBrasa: boolean
): boolean {
  if (order.status === "cancelled") return false;
  if (!["completed", "ready"].includes(order.status)) return false;
  if (order.payment_status !== "paid") return false;

  const opened = new Date(sessionOpenedAt).getTime();
  const closed = sessionClosedAt
    ? new Date(sessionClosedAt).getTime()
    : Date.now();

  const inWindow = (iso: string) => {
    const t = new Date(iso).getTime();
    return t >= opened && t < closed;
  };

  if (order.is_credit_sale && order.credit_received_at) {
    if (!inWindow(order.credit_received_at)) return false;
  } else {
    const createdOk = inWindow(order.created_at);
    const updatedOk = inWindow(order.updated_at || order.created_at);
    if (!createdOk && !updatedOk) return false;
  }

  if (isNaBrasa) {
    const domain = (order.source_domain || "").toLowerCase();
    const isNaBrasaSite = domain.includes("hamburguerianabrasa");
    const isOnlineSite =
      order.channel === "online" || order.origin === "site";

    if (isNaBrasaSite) {
      return !!order.accepted_and_printed_at;
    }
    if (isOnlineSite && order.source_domain) {
      return false;
    }
  }

  return true;
}

function orderAmount(order: SessionOrderRow): number {
  if (order.is_credit_sale && order.credit_received_at) {
    return Number(order.credit_total_with_interest) || Number(order.total_amount) || 0;
  }
  return Number(order.total_amount) || 0;
}

function orderReferenceTime(order: SessionOrderRow): string {
  if (order.is_credit_sale && order.credit_received_at) {
    return order.credit_received_at;
  }
  return order.updated_at || order.created_at;
}

function expandOrderPaymentLines(order: SessionOrderRow): Array<{
  methodKey: string;
  amount: number;
  sortAt: number;
  time: string;
  orderNumber: string;
}> {
  const orderNumber = formatOrderNumber(order.order_number);
  const sortAt = new Date(orderReferenceTime(order)).getTime();
  const time = formatTime(orderReferenceTime(order));

  const hasSplit =
    order.payment_method_2 &&
    order.payment_amount_1 != null &&
    order.payment_amount_2 != null;

  if (hasSplit) {
    return [
      {
        methodKey: normalizeMethodKey(order.payment_method),
        amount: Number(order.payment_amount_1) || 0,
        sortAt,
        time,
        orderNumber,
      },
      {
        methodKey: normalizeMethodKey(order.payment_method_2),
        amount: Number(order.payment_amount_2) || 0,
        sortAt: sortAt + 1,
        time,
        orderNumber: `${orderNumber} (2)`,
      },
    ];
  }

  return [
    {
      methodKey: normalizeMethodKey(order.payment_method),
      amount: orderAmount(order),
      sortAt,
      time,
      orderNumber,
    },
  ];
}

export async function fetchCashClosingReportData(params: {
  establishmentId: string;
  establishmentName: string;
  sessionId: string;
  sessionOpenedAt: string;
  sessionClosedAt: string | null;
  openingAmount: number;
  totals: CashSessionTotals | null;
}): Promise<CashClosingReportData> {
  const {
    establishmentId,
    establishmentName,
    sessionOpenedAt,
    sessionClosedAt,
    openingAmount,
    totals,
  } = params;

  const isNaBrasa = isNaBrasaEstablishment(establishmentName);
  const openedIso = new Date(sessionOpenedAt).toISOString();

  const { data: orders, error } = await supabase
    .from("orders")
    .select(
      `
      id,
      order_number,
      total_amount,
      payment_method,
      payment_method_2,
      payment_amount_1,
      payment_amount_2,
      status,
      payment_status,
      created_at,
      updated_at,
      credit_received_at,
      is_credit_sale,
      credit_total_with_interest,
      source_domain,
      channel,
      origin,
      accepted_and_printed_at,
      delivery_boy_id,
      order_type
    `
    )
    .eq("establishment_id", establishmentId)
    .neq("status", "cancelled")
    .or(
      `created_at.gte.${openedIso},updated_at.gte.${openedIso},credit_received_at.gte.${openedIso}`
    )
    .order("created_at", { ascending: true });

  if (error) throw error;

  const rows = (orders || []) as SessionOrderRow[];

  const cashOrders = rows.filter((o) =>
    matchesCashSessionForReport(o, sessionOpenedAt, sessionClosedAt, isNaBrasa)
  );

  const groupMap = new Map<string, CashReportPaymentGroup>();

  for (const order of cashOrders) {
    for (const line of expandOrderPaymentLines(order)) {
      if (!groupMap.has(line.methodKey)) {
        groupMap.set(line.methodKey, {
          methodKey: line.methodKey,
          label: getPaymentMethodSiteConfirmLabel(line.methodKey),
          total: 0,
          lines: [],
        });
      }
      const group = groupMap.get(line.methodKey)!;
      group.total += line.amount;
      group.lines.push({
        orderNumber: line.orderNumber,
        time: line.time,
        amount: line.amount,
        sortAt: line.sortAt,
      });
    }
  }

  const paymentGroups = Array.from(groupMap.values())
    .map((g) => ({
      ...g,
      lines: g.lines.sort((a, b) => a.sortAt - b.sortAt),
    }))
    .sort(
      (a, b) =>
        methodSortIndex(a.methodKey) - methodSortIndex(b.methodKey) ||
        a.label.localeCompare(b.label, "pt-BR")
    );

  const pedidosAConfirmarSession = rows.filter((o) => {
    const opened = new Date(sessionOpenedAt).getTime();
    const closed = sessionClosedAt
      ? new Date(sessionClosedAt).getTime()
      : Date.now();
    const t = new Date(o.updated_at || o.created_at).getTime();
    const inSession = t >= opened && t < closed;
    return inSession && isPaymentMethodToConfirm(o.payment_method);
  }).length;

  const sessionOpened = new Date(sessionOpenedAt).getTime();
  const sessionEnd = sessionClosedAt
    ? new Date(sessionClosedAt).getTime()
    : Date.now();

  const deliveryOrders = rows.filter((o) => {
    if (o.order_type !== "delivery" || !o.delivery_boy_id) return false;
    const t = new Date(o.created_at).getTime();
    return t >= sessionOpened && t < sessionEnd;
  });

  const boyIds = [
    ...new Set(deliveryOrders.map((o) => o.delivery_boy_id).filter(Boolean)),
  ] as string[];

  let deliveryBoyGroups: CashReportDeliveryBoyGroup[] = [];

  if (boyIds.length > 0) {
    const { data: boys } = await (supabase as any)
      .from("delivery_boys")
      .select("id, name, daily_rate, delivery_fee")
      .in("id", boyIds);

    deliveryBoyGroups = (boys || [])
      .map((boy: { id: string; name: string; daily_rate: number; delivery_fee: number }) => {
        const deliveries = deliveryOrders.filter((o) => o.delivery_boy_id === boy.id);
        const lines: CashReportOrderLine[] = deliveries
          .map((o) => ({
            orderNumber: formatOrderNumber(o.order_number),
            time: formatTime(o.created_at),
            amount: orderAmount(o),
            sortAt: new Date(o.created_at).getTime(),
          }))
          .sort((a, b) => a.sortAt - b.sortAt);

        const deliveriesCount = deliveries.length;
        const ordersTotal = lines.reduce((s, l) => s + l.amount, 0);
        const dailyRate = deliveriesCount > 0 ? Number(boy.daily_rate) || 0 : 0;
        const deliveryFee = Number(boy.delivery_fee) || 0;
        const deliveryFeesTotal = deliveriesCount * deliveryFee;

        return {
          id: boy.id,
          name: boy.name,
          deliveriesCount,
          ordersTotal,
          dailyRate,
          deliveryFeesTotal,
          motoboyTotal: dailyRate + deliveryFeesTotal,
          lines,
        };
      })
      .sort((a, b) => b.deliveriesCount - a.deliveriesCount);
  }

  return {
    establishmentName,
    sessionOpenedAt,
    sessionClosedAt,
    openingAmount,
    totals,
    paymentGroups,
    deliveryBoyGroups,
    pedidosAConfirmar: pedidosAConfirmarSession,
    ordersInCashCount: cashOrders.length,
  };
}
