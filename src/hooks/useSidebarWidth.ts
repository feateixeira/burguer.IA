import { useEffect, useState } from "react";

/**
 * Hook para obter a largura atual do sidebar
 * Usa localStorage para sincronizar entre componentes
 */
export const useSidebarWidth = () => {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem("sidebar_collapsed");
    return saved === "true" ? 64 : 256;
  });

  useEffect(() => {
    const checkSidebarState = () => {
      const saved = localStorage.getItem("sidebar_collapsed");
      const isCollapsed = saved === "true";
      setSidebarWidth(isCollapsed ? 64 : 256);
    };

    // Verifica estado inicial
    checkSidebarState();

    // Polling para detectar mudanças no localStorage
    const interval = setInterval(checkSidebarState, 100);

    // Event listener para mudanças no storage (entre tabs)
    window.addEventListener("storage", checkSidebarState);

    return () => {
      clearInterval(interval);
      window.removeEventListener("storage", checkSidebarState);
    };
  }, []);

  return sidebarWidth;
};

