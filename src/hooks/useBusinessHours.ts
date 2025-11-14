import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  getTodayStatus,
  getNextOpen,
  type WeeklyHours,
  type HoursOverride,
  type EstablishmentSettings,
} from "@/utils/businessHours";

interface UseBusinessHoursResult {
  isOpen: boolean;
  nextOpenAt: Date | null;
  nextCloseAt: Date | null;
  loading: boolean;
  error: Error | null;
}

export function useBusinessHours(
  establishmentId: string | null
): UseBusinessHoursResult {
  const [isOpen, setIsOpen] = useState(false);
  const [nextOpenAt, setNextOpenAt] = useState<Date | null>(null);
  const [nextCloseAt, setNextCloseAt] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!establishmentId) {
      setLoading(false);
      return;
    }

    const loadAndCalculate = async () => {
      try {
        setLoading(true);
        setError(null);

        // Carregar configurações do estabelecimento
        const { data: estabData, error: estabError } = await supabase
          .from("establishments")
          .select("timezone, allow_orders_when_closed, show_schedule_on_menu")
          .eq("id", establishmentId)
          .single();

        if (estabError || !estabData?.timezone) {
          // Se não há configuração, considerar sempre aberto
          setIsOpen(true);
          setNextOpenAt(null);
          setNextCloseAt(null);
          setLoading(false);
          return;
        }

        const timezone = estabData.timezone || "America/Sao_Paulo";

        // Carregar horários semanais
        const { data: weeklyData, error: weeklyError } = await supabase
          .from("establishment_hours")
          .select("*")
          .eq("estab_id", establishmentId);

        if (weeklyError) throw weeklyError;

        const weekly: WeeklyHours[] =
          weeklyData?.map((w) => ({
            estab_id: w.estab_id,
            day_of_week: w.day_of_week,
            enabled: w.enabled,
            intervals: (w.intervals as any) || [],
          })) || [];

        // Carregar exceções (próximos 30 dias)
        const today = new Date();
        const futureDate = new Date(today);
        futureDate.setDate(futureDate.getDate() + 30);

        const { data: overridesData, error: overridesError } = await supabase
          .from("establishment_hours_overrides")
          .select("*")
          .eq("estab_id", establishmentId)
          .gte("date", today.toISOString().split("T")[0])
          .lte("date", futureDate.toISOString().split("T")[0]);

        if (overridesError) throw overridesError;

        const overrides: HoursOverride[] =
          overridesData?.map((o) => ({
            estab_id: o.estab_id,
            date: o.date,
            is_closed: o.is_closed,
            intervals: o.intervals ? (o.intervals as any) : null,
            note: o.note || null,
          })) || [];

        // Calcular status atual
        const now = new Date();
        const status = getTodayStatus(now, timezone, weekly, overrides);

        setIsOpen(status.isOpen);
        setNextOpenAt(status.nextOpenAt || null);
        setNextCloseAt(status.nextCloseAt || null);

        // Se não há próximo aberto calculado e está fechado, calcular
        if (!status.isOpen && !status.nextOpenAt) {
          const nextOpen = getNextOpen(now, timezone, weekly, overrides);
          setNextOpenAt(nextOpen);
        }
      } catch (err) {
        console.error("Error loading business hours:", err);
        setError(err as Error);
        // Em caso de erro, considerar aberto por padrão
        setIsOpen(true);
      } finally {
        setLoading(false);
      }
    };

    loadAndCalculate();

    // Revalidar a cada 5 minutos
    const interval = setInterval(loadAndCalculate, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [establishmentId]);

  return {
    isOpen,
    nextOpenAt,
    nextCloseAt,
    loading,
    error,
  };
}

