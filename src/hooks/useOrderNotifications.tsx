import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function useOrderNotifications(establishmentId: string | null) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastNotificationTime = useRef<number>(0);

  useEffect(() => {
    // Create notification sound (using Web Audio API for a simple beep)
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    const playNotificationSound = () => {
      // Throttle notifications to avoid spam (minimum 2 seconds between notifications)
      const now = Date.now();
      if (now - lastNotificationTime.current < 2000) {
        return;
      }
      lastNotificationTime.current = now;

      try {
        // Create a simple beep sound
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        // First beep
        oscillator.frequency.value = 800;
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.1);
        
        // Second beep
        setTimeout(() => {
          const oscillator2 = audioContext.createOscillator();
          const gainNode2 = audioContext.createGain();
          
          oscillator2.connect(gainNode2);
          gainNode2.connect(audioContext.destination);
          
          oscillator2.frequency.value = 1000;
          gainNode2.gain.setValueAtTime(0.3, audioContext.currentTime);
          gainNode2.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
          
          oscillator2.start(audioContext.currentTime);
          oscillator2.stop(audioContext.currentTime + 0.1);
        }, 150);
      } catch (error) {
        console.error('Error playing notification sound:', error);
      }
    };

    if (!establishmentId) return;

    // Subscribe to new orders
    const channel = supabase
      .channel('new-orders-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'orders',
          filter: `establishment_id=eq.${establishmentId}`
        },
        (payload) => {
          console.log('New order received:', payload);
          
          const order = payload.new;
          playNotificationSound();
          
          toast.success('🔔 Novo Pedido Recebido!', {
            description: `Pedido #${order.order_number} - ${order.channel || 'Website'} - R$ ${Number(order.total_amount).toFixed(2)}`,
            duration: 5000,
            action: {
              label: 'Ver Pedido',
              onClick: () => {
                window.location.href = '/orders';
              }
            }
          });

          // Browser notification if permitted
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('Novo Pedido Recebido!', {
              body: `Pedido #${order.order_number} - R$ ${Number(order.total_amount).toFixed(2)}`,
              icon: '/favicon.ico',
              tag: 'new-order',
              requireInteraction: false
            });
          }
        }
      )
      .subscribe();

    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    return () => {
      supabase.removeChannel(channel);
    };
  }, [establishmentId]);

  return null;
}
