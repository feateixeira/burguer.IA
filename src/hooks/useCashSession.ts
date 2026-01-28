import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface CashSessionTotals {
  expected_cash: number;
  expected_pix: number;
  expected_debit: number;
  expected_credit: number;
  expected_total: number;
  rejected_total: number;
}

export interface CashSession {
  id: string;
  establishment_id: string;
  opened_by: string;
  opened_at: string;
  opening_amount: number;
  status: "open" | "closed";
  expected_cash: number | null;
  expected_pix: number | null;
  expected_debit: number | null;
  expected_credit: number | null;
  expected_total: number | null;
  counted_cash: number | null;
  difference_amount: number | null;
  closed_by: string | null;
  closed_at: string | null;
  notes: string | null;
}

export const useCashSession = (establishmentId: string | null) => {
  const [session, setSession] = useState<CashSession | null>(null);
  const [totals, setTotals] = useState<CashSessionTotals | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasOpenSession, setHasOpenSession] = useState(false);

  const loadOpenSession = async () => {
    if (!establishmentId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // Verificar se há sessão aberta usando a função SQL
      const { data: hasSession, error: checkError } = await supabase.rpc(
        "has_open_cash_session",
        { p_establishment_id: establishmentId }
      );

      if (checkError) throw checkError;

      setHasOpenSession(hasSession || false);

      if (!hasSession) {
        setSession(null);
        setTotals(null);
        setLoading(false);
        return;
      }

      // Buscar sessão aberta com totais calculados
      const { data: sessionData, error: sessionError } = await supabase
        .from("cash_sessions")
        .select("*")
        .eq("establishment_id", establishmentId)
        .eq("status", "open")
        .order("opened_at", { ascending: false })
        .limit(1)
        .single();

      if (sessionError) {
        if (sessionError.code !== "PGRST116") {
          throw sessionError;
        }
        setSession(null);
        setTotals(null);
        setLoading(false);
        return;
      }

      setSession(sessionData as CashSession);

      // Calcular totais esperados
      const { data: totalsData, error: totalsError } = await supabase.rpc(
        "compute_cash_session_totals",
        { p_session_id: sessionData.id }
      );

      if (totalsError) throw totalsError;

      if (totalsData && totalsData.length > 0) {
        const t = totalsData[0];
        setTotals({
          expected_cash: parseFloat(t.expected_cash || 0),
          expected_pix: parseFloat(t.expected_pix || 0),
          expected_debit: parseFloat(t.expected_debit || 0),
          expected_credit: parseFloat(t.expected_credit || 0),
          expected_total: parseFloat(t.expected_total || 0),
          rejected_total: parseFloat(t.rejected_total || 0),
        });
      }
    } catch (error: any) {
      console.error("Error loading cash session:", error);
      toast.error("Erro ao carregar sessão de caixa");
    } finally {
      setLoading(false);
    }
  };

  const closeSession = async (
    sessionId: string,
    countedCash: number,
    note?: string,
    countedPix?: number,
    countedDebit?: number,
    countedCredit?: number,
    isAttendant?: boolean
  ) => {
    try {
      const {
        data: { session: authSession },
      } = await supabase.auth.getSession();
      if (!authSession) throw new Error("Usuário não autenticado");

      const { data, error } = await supabase.rpc("close_cash_session", {
        p_session_id: sessionId,
        p_closed_by: authSession.user.id,
        p_counted_cash: countedCash,
        p_note: note || null,
        p_counted_pix: countedPix || null,
        p_counted_debit: countedDebit || null,
        p_counted_credit: countedCredit || null,
        p_is_attendant: isAttendant || false,
      });

      if (error) throw error;

      if (isAttendant) {
        toast.success("Caixa fechado! Aguardando conferência do supervisor.");
      } else {
        toast.success("Caixa fechado com sucesso!");
      }
      await loadOpenSession(); // Recarrega

      return data;
    } catch (error: any) {
      console.error("Error closing cash session:", error);
      if (error.message?.includes("obrigatória")) {
        toast.error("Observação obrigatória quando há diferença");
      } else {
        toast.error(error.message || "Erro ao fechar caixa");
      }
      throw error;
    }
  };

  useEffect(() => {
    loadOpenSession();
  }, [establishmentId]);

  return {
    session,
    totals,
    loading,
    hasOpenSession,
    reload: loadOpenSession,
    closeSession,
  };
};

