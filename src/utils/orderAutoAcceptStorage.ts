const STORAGE_PREFIX = "burguer_auto_accept_orders_";

export function getAutoAcceptOrdersEnabled(establishmentId: string): boolean {
  try {
    return localStorage.getItem(`${STORAGE_PREFIX}${establishmentId}`) === "1";
  } catch {
    return false;
  }
}

export function setAutoAcceptOrdersEnabled(
  establishmentId: string,
  enabled: boolean
): void {
  try {
    if (enabled) {
      localStorage.setItem(`${STORAGE_PREFIX}${establishmentId}`, "1");
    } else {
      localStorage.removeItem(`${STORAGE_PREFIX}${establishmentId}`);
    }
    window.dispatchEvent(
      new CustomEvent("auto-accept-orders-changed", {
        detail: { establishmentId, enabled },
      })
    );
  } catch {
    /* ignore */
  }
}
