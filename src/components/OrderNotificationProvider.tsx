import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useOrderNotifications } from "@/hooks/useOrderNotifications";

export function OrderNotificationProvider({ children }: { children: React.ReactNode }) {
  const [establishmentId, setEstablishmentId] = useState<string | null>(null);
  const location = useLocation();

  useEffect(() => {
    // Only load establishment on authenticated pages
    const publicRoutes = ['/', '/landing', '/totem', '/password-display'];
    if (publicRoutes.includes(location.pathname)) {
      setEstablishmentId(null); // Limpar quando em rota pública
      return;
    }

    const loadEstablishment = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          setEstablishmentId(null);
          return;
        }

        const { data: profile } = await supabase
          .from("profiles")
          .select("establishment_id")
          .eq("user_id", session.user.id)
          .single();

        if (profile?.establishment_id) {
          setEstablishmentId(profile.establishment_id);
        } else {
          setEstablishmentId(null);
        }
      } catch (error) {
        setEstablishmentId(null);
      }
    };

    loadEstablishment();

    // Listener para mudanças de autenticação (login/logout)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        loadEstablishment();
      } else {
        setEstablishmentId(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [location.pathname]);

  // Hook for order notifications (funciona em qualquer página autenticada)
  useOrderNotifications(establishmentId);

  return <>{children}</>;
}
