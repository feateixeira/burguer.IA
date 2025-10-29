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
      return;
    }

    const loadEstablishment = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const { data: profile } = await supabase
          .from("profiles")
          .select("establishment_id")
          .eq("user_id", session.user.id)
          .single();

        if (profile?.establishment_id) {
          setEstablishmentId(profile.establishment_id);
        }
      } catch (error) {
        console.error('Error loading establishment:', error);
      }
    };

    loadEstablishment();
  }, [location.pathname]);

  // Hook for order notifications
  useOrderNotifications(establishmentId);

  return <>{children}</>;
}
