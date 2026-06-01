import { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getAutoAcceptOrdersEnabled } from "@/utils/orderAutoAcceptStorage";
import { isOnlineSiteOrder } from "@/utils/orderSiteOrder";
import { getAutoAcceptProcessor } from "@/lib/orderActionsBridge";
import {
  processAutoAcceptOrderId,
  fetchOrderForAutoAccept,
  acceptOrderInAutoFlow,
  checkAndRejectIfDuplicate,
} from "@/services/orderAutoAcceptService";
import { printOrderForAutoAccept } from "@/utils/orderAutoPrint";
import type { OrderDuplicateCandidate } from "@/utils/orderDuplicateDetection";
import { buildOrderDuplicateFingerprint } from "@/utils/orderDuplicateDetection";

const processingIds = new Set<string>();
const processingFingerprints = new Set<string>();

async function runAutoAcceptFallback(
  orderId: string,
  establishmentId: string,
  hasOpenCashSession: boolean
) {
  const order = await fetchOrderForAutoAccept(orderId);
  if (!order) return;

  const dup = await checkAndRejectIfDuplicate(
    order as OrderDuplicateCandidate,
    establishmentId
  );
  if (dup.isDuplicate) {
    toast.warning("Pedido duplicado recusado automaticamente", {
      description: `Mantido pedido #${dup.keptOrderNumber}`,
      duration: 8000,
    });
    window.dispatchEvent(
      new CustomEvent("new-order-notification", { detail: { orderId } })
    );
    return;
  }

  await acceptOrderInAutoFlow({
    order: order as Record<string, unknown>,
    establishmentId,
    hasOpenCashSession,
  });

  await printOrderForAutoAccept(orderId);

  toast.success("Pedido aceito e impresso automaticamente", {
    description: `Pedido #${order.order_number}`,
    duration: 5000,
  });

  window.dispatchEvent(
    new CustomEvent("new-order-notification", { detail: { orderId } })
  );
}

export function useAutoAcceptOrders(
  establishmentId: string | null,
  hasOpenCashSession: boolean
) {
  const hasOpenCashRef = useRef(hasOpenCashSession);
  hasOpenCashRef.current = hasOpenCashSession;

  const processOrder = useCallback(
    async (orderId: string) => {
      if (!establishmentId) return;
      if (!getAutoAcceptOrdersEnabled(establishmentId)) return;
      if (processingIds.has(orderId)) return;

      processingIds.add(orderId);

      let fingerprint: string | null = null;
      try {
        const preview = await fetchOrderForAutoAccept(orderId);
        if (preview) {
          fingerprint = buildOrderDuplicateFingerprint(preview);
          if (processingFingerprints.has(fingerprint)) return;
          processingFingerprints.add(fingerprint);
        }
      } catch {
        /* segue sem fingerprint */
      }

      try {
        const bridge = getAutoAcceptProcessor();
        if (bridge) {
          await bridge(orderId);
          return;
        }

        const result = await processAutoAcceptOrderId({
          orderId,
          establishmentId,
          hasOpenCashSession: hasOpenCashRef.current,
        });

        if (result === "duplicate") {
          toast.warning("Pedido duplicado recusado automaticamente", {
            duration: 8000,
          });
          window.dispatchEvent(
            new CustomEvent("new-order-notification", { detail: { orderId } })
          );
          return;
        }

        if (result === "accepted") {
          try {
            await printOrderForAutoAccept(orderId);
          } catch (printErr) {
            console.error(printErr);
          }
          toast.success("Pedido aceito e impresso automaticamente", {
            duration: 5000,
          });
          window.dispatchEvent(
            new CustomEvent("new-order-notification", { detail: { orderId } })
          );
          return;
        }

        if (result === "error") {
          const errMsg = !hasOpenCashRef.current
            ? "Abra o caixa para aceitar pedidos automaticamente."
            : undefined;
          if (errMsg) toast.error(errMsg);
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "";
        if (msg === "CAIXA_FECHADO") {
          toast.error(
            "Aceite automático: abra o caixa no PDV para aceitar pedidos do site."
          );
        } else {
          console.error("[auto-accept]", e);
        }
      } finally {
        setTimeout(() => {
          processingIds.delete(orderId);
          if (fingerprint) processingFingerprints.delete(fingerprint);
        }, 5000);
      }
    },
    [establishmentId]
  );

  useEffect(() => {
    if (!establishmentId) return;

    const handleInsert = (order: Record<string, unknown>) => {
      if (!getAutoAcceptOrdersEnabled(establishmentId)) return;
      if (!isOnlineSiteOrder(order as Parameters<typeof isOnlineSiteOrder>[0])) {
        return;
      }
      if (order.status !== "pending") return;
      if (order.accepted_and_printed_at) return;

      void processOrder(String(order.id));
    };

    const channel = supabase
      .channel(`auto-accept-orders-${establishmentId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "orders",
          filter: `establishment_id=eq.${establishmentId}`,
        },
        (payload) => {
          handleInsert(payload.new as Record<string, unknown>);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [establishmentId, processOrder]);
}
