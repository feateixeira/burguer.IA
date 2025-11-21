import { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function useOrderNotifications(establishmentId: string | null) {
  const lastNotificationTime = useRef<number>(0);
  const notificationPermissionAskedRef = useRef(false);
  const lastCheckedOrderId = useRef<string | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Tocar beep audível e chamativo (igual ao da página Orders)
  const playBeep = useCallback(async () => {
    // Throttle para evitar spam (mínimo 2 segundos entre notificações)
    const now = Date.now();
    if (now - lastNotificationTime.current < 2000) {
      return;
    }
    lastNotificationTime.current = now;

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
        // Two-tone alert: 1000Hz then 1200Hz (beep mais chamativo)
        mk(1000, 0, 0.25);
        mk(1200, 0.27, 0.35);
        setTimeout(() => { try { ctx.close(); } catch {} }, 800);
        return;
      }
    } catch (error) {
      // Ignorar erro WebAudio, tentar fallback
    }
    try {
      // Fallback WAV simples (mais alto)
      const audible = new Audio('data:audio/wav;base64,UklGRoQAAABXQVZFZm10IBAAAAABAAEAgD4AAAB9AAACABYBAGZmZmZmZmZmZmYAAAD//wD/4P8A/8AAAP//AP/g/wD/wAAA');
      audible.volume = 1; 
      await audible.play().catch(() => {});
    } catch (error) {
      // Ignorar erros de áudio
    }
  }, []);

  useEffect(() => {
    if (!establishmentId) {
      return;
    }


    // Solicitar permissão de notificação apenas uma vez
    if ('Notification' in window && !notificationPermissionAskedRef.current) {
      if (Notification.permission === 'default') {
        Notification.requestPermission().then(() => {
          notificationPermissionAskedRef.current = true;
        });
      } else {
        notificationPermissionAskedRef.current = true;
      }
    }

    // Subscribe to new orders (detecta todos e filtra pedidos do site)
    const channelName = `global-new-orders-notifications-${establishmentId}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'orders',
          filter: `establishment_id=eq.${establishmentId}`
        },
        (payload) => {
          const order = payload.new as any;
          const TEMPORARY_NOTIFY_ALL = false; // false = apenas pedidos do site, true = todos os pedidos
          
          // Variáveis de filtro (só serão usadas se TEMPORARY_NOTIFY_ALL for false)
          let channel = '';
          let origin = '';
          let sourceDomain = '';
          let isOnlineOrder = true; // Default true quando em modo teste
          
          if (!TEMPORARY_NOTIFY_ALL) {
            // Filtrar apenas pedidos do site (online/site)
            // Verifica múltiplos critérios para garantir que capture todos os pedidos do site
            
            // Normalizar valores para comparação
            channel = order.channel ? String(order.channel).toLowerCase().trim() : '';
            origin = order.origin ? String(order.origin).toLowerCase().trim() : '';
            sourceDomain = order.source_domain ? String(order.source_domain).trim() : '';
            
            isOnlineOrder = 
              channel === 'online' || 
              origin === 'site' || 
              sourceDomain.length > 0 ||
              // Também considerar pedidos sem channel que tenham source_domain
              (!channel && (sourceDomain.length > 0 || origin === 'site'));
            
            if (!isOnlineOrder) {
              return; // Ignorar pedidos do PDV ou outros canais
            }
          }
          
          // Tocar beep chamativo
          playBeep();
          
          // Disparar evento customizado para atualizar a lista de pedidos
          window.dispatchEvent(new CustomEvent('new-order-notification', { 
            detail: { orderId: order.id } 
          }));
          
          // Notificação toast
          const orderTypeText = order.order_type === 'delivery' ? 'Entrega' : 
                                order.order_type === 'balcao' ? 'Balcão' : 
                                order.order_type || 'Pedido';
          const orderSource = TEMPORARY_NOTIFY_ALL ? 
            (order.channel === 'online' || order.origin === 'site' || order.source_domain ? 'do Site' : 'do PDV') :
            'do Site';
          
          toast.success(`🔔 Novo Pedido ${orderSource}!`, {
            description: `Pedido #${order.order_number} - ${orderTypeText} - R$ ${Number(order.total_amount || 0).toFixed(2)}`,
            duration: 6000,
            action: {
              label: 'Ver Pedidos',
              onClick: () => {
                window.location.href = '/orders';
              }
            }
          });

          // Browser notification se permitido
          if ('Notification' in window && Notification.permission === 'granted') {
            const notificationBody = order.order_type === 'delivery' 
              ? `Pedido #${order.order_number} - Entrega - R$ ${Number(order.total_amount || 0).toFixed(2)}`
              : `Pedido #${order.order_number} - R$ ${Number(order.total_amount || 0).toFixed(2)}`;
            
            try {
              new Notification('🔔 Novo Pedido do Site!', {
                body: notificationBody,
                icon: '/logo.ico',
                tag: `order-${order.id}`,
                requireInteraction: false,
                badge: '/logo.ico'
              });
            } catch (error) {
              // Ignorar erros de notificação
            }
          }
        }
      )
      .subscribe();

    // POLLING como fallback (verifica novos pedidos a cada 3 segundos)
    // Isso garante que funcione mesmo se o Realtime não estiver configurado
    const checkForNewOrders = async () => {
      try {
        const { data: orders, error } = await supabase
          .from('orders')
          .select('id, order_number, channel, origin, source_domain, order_type, total_amount, status, created_at')
          .eq('establishment_id', establishmentId)
          .order('created_at', { ascending: false })
          .limit(5);

        if (error) {
          return;
        }

        if (orders && orders.length > 0) {
          const newestOrder = orders[0];
          
          if (!lastCheckedOrderId.current) {
            lastCheckedOrderId.current = newestOrder.id;
            return;
          }

          if (newestOrder.id !== lastCheckedOrderId.current) {
            lastCheckedOrderId.current = newestOrder.id;
            
            // Processar a notificação
            const TEMPORARY_NOTIFY_ALL = false; // false = apenas pedidos do site
            let isOnlineOrder = true;
            
            if (!TEMPORARY_NOTIFY_ALL) {
              const channel = newestOrder.channel ? String(newestOrder.channel).toLowerCase().trim() : '';
              const origin = newestOrder.origin ? String(newestOrder.origin).toLowerCase().trim() : '';
              const sourceDomain = newestOrder.source_domain ? String(newestOrder.source_domain).trim() : '';
              
              isOnlineOrder = 
                channel === 'online' || 
                origin === 'site' || 
                sourceDomain.length > 0 ||
                (!channel && (sourceDomain.length > 0 || origin === 'site'));
              
              if (!isOnlineOrder) {
                return;
              }
            }

            // Tocar beep
            playBeep();

            // Disparar evento customizado para atualizar a lista de pedidos
            window.dispatchEvent(new CustomEvent('new-order-notification', { 
              detail: { orderId: newestOrder.id } 
            }));

            // Notificação toast
            const orderTypeText = newestOrder.order_type === 'delivery' ? 'Entrega' : 
                                  newestOrder.order_type === 'balcao' ? 'Balcão' : 
                                  newestOrder.order_type || 'Pedido';
            const orderSource = TEMPORARY_NOTIFY_ALL ? 
              (newestOrder.channel === 'online' || newestOrder.origin === 'site' || newestOrder.source_domain ? 'do Site' : 'do PDV') :
              'do Site';

            toast.success(`🔔 Novo Pedido ${orderSource}!`, {
              description: `Pedido #${newestOrder.order_number} - ${orderTypeText} - R$ ${Number(newestOrder.total_amount || 0).toFixed(2)}`,
              duration: 6000,
              action: {
                label: 'Ver Pedidos',
                onClick: () => {
                  window.location.href = '/orders';
                }
              }
            });

            // Browser notification
            if ('Notification' in window && Notification.permission === 'granted') {
              const notificationBody = newestOrder.order_type === 'delivery' 
                ? `Pedido #${newestOrder.order_number} - Entrega - R$ ${Number(newestOrder.total_amount || 0).toFixed(2)}`
                : `Pedido #${newestOrder.order_number} - R$ ${Number(newestOrder.total_amount || 0).toFixed(2)}`;
              
              try {
                new Notification('🔔 Novo Pedido do Site!', {
                  body: notificationBody,
                  icon: '/logo.ico',
                  tag: `order-${newestOrder.id}`,
                  requireInteraction: false,
                  badge: '/logo.ico'
                });
              } catch (error) {
                // Ignorar erros de notificação
              }
            }
          }
        }
      } catch (error) {
        // Silencioso - não precisa logar erros de polling
      }
    };

    // Verificar imediatamente e depois a cada 3 segundos
    checkForNewOrders();
    pollingIntervalRef.current = setInterval(checkForNewOrders, 3000);

    return () => {
      supabase.removeChannel(channel);
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [establishmentId, playBeep]);

  return null;
}
