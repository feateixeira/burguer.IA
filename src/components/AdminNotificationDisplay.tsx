import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface AdminNotification {
  id: string;
  title: string;
  message: string;
  type: string;
  created_at: string;
  created_by: string | null;
}

export function AdminNotificationDisplay() {
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const channelRef = useRef<any>(null);

  useEffect(() => {
    const loadNotifications = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        // Buscar notificações não lidas criadas por admin
        const { data: notificationsData, error } = await supabase
          .from("user_notifications")
          .select("*")
          .eq("user_id", session.user.id)
          .eq("read", false)
          .order("created_at", { ascending: false });

        if (error) {
          console.error("Error loading notifications:", error);
          return;
        }

        if (notificationsData) {
          // Filtrar apenas notificações criadas por admin (created_by não é null e não é o próprio usuário)
          // Verificar se o created_by é um admin
          const adminIds: string[] = [];
          const { data: adminProfiles } = await supabase
            .from("profiles")
            .select("user_id")
            .eq("is_admin", true);
          
          if (adminProfiles) {
            adminIds.push(...adminProfiles.map(p => p.user_id));
          }

          const adminNotifications = notificationsData.filter(
            (notif) => notif.created_by !== null && 
                       notif.created_by !== session.user.id &&
                       adminIds.includes(notif.created_by)
          );

          // Verificar se a notificação foi criada há menos de 10 minutos (600000ms)
          const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
          const recentNotifications = adminNotifications.filter((notif) => {
            const createdAt = new Date(notif.created_at);
            return createdAt > tenMinutesAgo;
          });

          setNotifications(recentNotifications);

          // Marcar como lida após 10 minutos
          recentNotifications.forEach((notif) => {
            const createdAt = new Date(notif.created_at);
            const tenMinutesFromCreation = createdAt.getTime() + 10 * 60 * 1000;
            const timeUntilDismiss = tenMinutesFromCreation - Date.now();

            if (timeUntilDismiss > 0) {
              setTimeout(async () => {
                // Marcar como lida após 10 minutos
                await supabase
                  .from("user_notifications")
                  .update({ read: true })
                  .eq("id", notif.id);
              }, timeUntilDismiss);
            }
          });
        }
      } catch (error) {
        console.error("Error in loadNotifications:", error);
      }
    };

    loadNotifications();

    // Atualizar a cada 5 segundos para pegar novas notificações
    const interval = setInterval(loadNotifications, 5000);

    // Verificar também via Realtime
    const setupRealtime = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      channelRef.current = supabase
        .channel("admin_notifications")
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "user_notifications",
            filter: `user_id=eq.${session.user.id}`,
          },
          () => {
            loadNotifications();
          }
        )
        .subscribe();
    };

    setupRealtime();

    return () => {
      clearInterval(interval);
      if (channelRef.current) {
        channelRef.current.unsubscribe();
      }
    };
  }, []);

  if (notifications.length === 0) {
    return null;
  }

  const getTypeStyles = (type: string) => {
    switch (type) {
      case "error":
        return "border-red-500 bg-red-50 dark:bg-red-950";
      case "warning":
        return "border-yellow-500 bg-yellow-50 dark:bg-yellow-950";
      case "payment":
        return "border-orange-500 bg-orange-50 dark:bg-orange-950";
      default:
        return "border-blue-500 bg-blue-50 dark:bg-blue-950";
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-[9999] space-y-3 max-w-md">
      {notifications.map((notification) => {
        const createdAt = new Date(notification.created_at);
        const tenMinutesFromCreation = createdAt.getTime() + 10 * 60 * 1000;
        const remainingTime = Math.max(0, tenMinutesFromCreation - Date.now());
        const remainingMinutes = Math.floor(remainingTime / 60000);
        const remainingSeconds = Math.floor((remainingTime % 60000) / 1000);

        return (
          <Card
            key={notification.id}
            className={cn(
              "shadow-2xl border-2 animate-in slide-in-from-bottom-5",
              getTypeStyles(notification.type || "info")
            )}
          >
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-primary" />
                  <CardTitle className="text-lg font-bold">
                    {notification.title}
                  </CardTitle>
                </div>
                {/* Não mostrar botão de fechar - notificação não pode ser fechada */}
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-foreground mb-2 whitespace-pre-wrap">
                {notification.message}
              </p>
              <p className="text-xs text-muted-foreground">
                Esta notificação desaparecerá automaticamente em{" "}
                {remainingMinutes > 0
                  ? `${remainingMinutes}m ${remainingSeconds}s`
                  : `${remainingSeconds}s`}
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

