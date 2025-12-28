import { useEffect, useRef, useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface CreditOrder {
  id: string;
  order_number: string;
  customer_name: string;
  total_amount: number;
  credit_due_date: string;
}

export function useCreditDueDateAlerts(establishmentId: string | null) {
  const [dueTodayOrders, setDueTodayOrders] = useState<CreditOrder[]>([]);
  const [hasAlerted, setHasAlerted] = useState(false);
  const lastCheckTime = useRef<number>(0);
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Tocar beep
  const playBeep = useCallback(async () => {
    try {
      const AudioContextRef = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (AudioContextRef) {
        const ctx = new AudioContextRef();
        const g = ctx.createGain();
        g.connect(ctx.destination);
        const mk = (freq: number, start: number, dur: number) => {
          const o = ctx.createOscillator();
          o.type = 'square';
          o.frequency.setValueAtTime(freq, ctx.currentTime + start);
          o.connect(g);
          g.gain.setValueAtTime(0.0001, ctx.currentTime + start);
          g.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + start + 0.02);
          g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + dur);
          o.start(ctx.currentTime + start);
          o.stop(ctx.currentTime + start + dur + 0.01);
        };
        mk(1000, 0, 0.25);
        mk(1200, 0.27, 0.35);
        setTimeout(() => { try { ctx.close(); } catch {} }, 800);
      }
    } catch (error) {
      // Ignorar erro
    }
  }, []);

  const checkDueTodayOrders = useCallback(async () => {
    if (!establishmentId) return;

    const now = Date.now();
    // Verificar no máximo a cada 30 segundos
    if (now - lastCheckTime.current < 30000) {
      return;
    }
    lastCheckTime.current = now;

    try {
      const today = new Date().toISOString().split('T')[0];

      const { data: orders, error } = await supabase
        .from('orders')
        .select('id, order_number, customer_name, total_amount, credit_due_date')
        .eq('establishment_id', establishmentId)
        .eq('is_credit_sale', true)
        .eq('credit_due_date', today)
        .is('credit_received_at', null)
        .neq('payment_status', 'cancelled');

      if (error) {
        console.error('Erro ao verificar pedidos vencendo hoje:', error);
        return;
      }

      if (orders && orders.length > 0) {
        setDueTodayOrders(orders as CreditOrder[]);
        
        // Tocar beep apenas uma vez quando detectar pela primeira vez
        if (!hasAlerted && orders.length > 0) {
          playBeep();
          setHasAlerted(true);
        }
      } else {
        setDueTodayOrders([]);
        setHasAlerted(false);
      }
    } catch (error) {
      console.error('Erro ao verificar pedidos vencendo hoje:', error);
    }
  }, [establishmentId, hasAlerted, playBeep]);

  useEffect(() => {
    if (!establishmentId) return;

    // Verificar imediatamente
    checkDueTodayOrders();

    // Verificar a cada minuto
    checkIntervalRef.current = setInterval(() => {
      checkDueTodayOrders();
    }, 60000);

    // Real-time subscription
    const channel = supabase
      .channel('credit_due_date_alerts')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `establishment_id=eq.${establishmentId}`
        },
        () => {
          // Verificar novamente quando houver mudanças
          setTimeout(() => checkDueTodayOrders(), 1000);
        }
      )
      .subscribe();

    return () => {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
      supabase.removeChannel(channel);
    };
  }, [establishmentId, checkDueTodayOrders]);

  return {
    dueTodayOrders,
    hasAlerts: dueTodayOrders.length > 0,
    dismissAlert: () => {
      setHasAlerted(false);
    }
  };
}

