import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Phone, Check, X, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import Sidebar from "@/components/Sidebar";

interface Password {
  id: string;
  password_number: number;
  customer_name: string | null;
  service_type: string;
  status: string;
  counter_number: string | null;
  created_at: string;
}

export default function PasswordPanel() {
  const [passwords, setPasswords] = useState<Password[]>([]);
  const [establishmentId, setEstablishmentId] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadEstablishmentAndPasswords();
    
    // Subscribe to real-time updates
    const channel = supabase
      .channel('password-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'password_queue',
        },
        () => {
          loadPasswords(establishmentId);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [establishmentId]);

  const loadEstablishmentAndPasswords = async () => {
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("establishment_id")
        .eq("user_id", (await supabase.auth.getUser()).data.user?.id)
        .single();

      if (!profile?.establishment_id) {
        toast.error("Estabelecimento não encontrado");
        return;
      }

      setEstablishmentId(profile.establishment_id);
      await loadPasswords(profile.establishment_id);
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  const loadPasswords = async (estId: string) => {
    if (!estId) return;

    try {
      const { data, error } = await supabase
        .from("password_queue")
        .select("*")
        .eq("establishment_id", estId)
        .in("status", ["waiting", "calling"])
        .order("created_at");

      if (error) throw error;
      setPasswords(data || []);
    } catch (error) {
      console.error("Error loading passwords:", error);
    }
  };

  const callPassword = async (passwordId: string) => {
    try {
      const { error } = await supabase
        .from("password_queue")
        .update({
          status: "calling",
          called_at: new Date().toISOString(),
        })
        .eq("id", passwordId);

      if (error) throw error;
      toast.success("Senha chamada!");
    } catch (error) {
      console.error("Error calling password:", error);
      toast.error("Erro ao chamar senha");
    }
  };

  const completePassword = async (passwordId: string) => {
    try {
      const { error } = await supabase
        .from("password_queue")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", passwordId);

      if (error) throw error;
      toast.success("Atendimento concluído!");
    } catch (error) {
      console.error("Error completing password:", error);
      toast.error("Erro ao concluir atendimento");
    }
  };

  const cancelPassword = async (passwordId: string) => {
    try {
      const { error } = await supabase
        .from("password_queue")
        .update({
          status: "cancelled",
          cancelled_at: new Date().toISOString(),
        })
        .eq("id", passwordId);

      if (error) throw error;
      toast.success("Senha cancelada!");
    } catch (error) {
      console.error("Error cancelling password:", error);
      toast.error("Erro ao cancelar senha");
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      waiting: "secondary",
      calling: "default",
    };
    const labels: Record<string, string> = {
      waiting: "Aguardando",
      calling: "Chamando",
    };
    return (
      <Badge variant={variants[status] || "secondary"}>
        {labels[status] || status}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex-1 p-6">
          <p>Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex-1 p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold">Painel de Senhas</h1>
              <p className="text-muted-foreground">
                Gerencie o atendimento por senhas
              </p>
            </div>
            <Button onClick={() => loadPasswords(establishmentId)}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Atualizar
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {passwords.map((password) => (
              <Card key={password.id}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="text-4xl font-bold">
                      S{String(password.password_number).padStart(3, "0")}
                    </span>
                    {getStatusBadge(password.status)}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {password.customer_name && (
                    <p className="text-sm font-medium">{password.customer_name}</p>
                  )}
                  
                  <p className="text-xs text-muted-foreground">
                    Tipo: {password.service_type === "priority" ? "Prioritário" : "Normal"}
                  </p>

                  <div className="flex gap-2">
                    {password.status === "waiting" && (
                      <Button
                        className="flex-1"
                        onClick={() => callPassword(password.id)}
                      >
                        <Phone className="h-4 w-4 mr-2" />
                        Chamar
                      </Button>
                    )}

                    {password.status === "calling" && (
                      <>
                        <Button
                          className="flex-1"
                          onClick={() => completePassword(password.id)}
                        >
                          <Check className="h-4 w-4 mr-2" />
                          Concluir
                        </Button>
                        <Button
                          variant="outline"
                          className="flex-1"
                          onClick={() => cancelPassword(password.id)}
                        >
                          <X className="h-4 w-4 mr-2" />
                          Cancelar
                        </Button>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {passwords.length === 0 && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <p className="text-muted-foreground">
                  Nenhuma senha na fila
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
