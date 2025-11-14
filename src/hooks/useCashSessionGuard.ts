import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCashSession } from "./useCashSession";

export const useCashSessionGuard = (establishmentId: string | null) => {
  const navigate = useNavigate();
  const { hasOpenSession, loading } = useCashSession(establishmentId);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    if (!loading && establishmentId) {
      if (!hasOpenSession) {
        setBlocked(true);
      } else {
        setBlocked(false);
      }
    }
  }, [hasOpenSession, loading, establishmentId]);

  const showCashRequiredModal = () => {
    // Retorna informações para o componente exibir modal
    return {
      show: blocked,
      onOpenCash: () => navigate("/finance/cash"),
    };
  };

  return {
    hasOpenSession,
    blocked,
    loading,
    showCashRequiredModal,
  };
};

