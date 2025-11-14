import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Monitor, Smartphone, Settings, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import Sidebar from "@/components/Sidebar";
import { useSidebarWidth } from "@/hooks/useSidebarWidth";

interface AppSettings {
  password_panel_enabled: boolean;
  totem_enabled: boolean;
  establishment_id: string;
}

export default function Apps() {
  const navigate = useNavigate();
  const [settings, setSettings] = useState<AppSettings>({
    password_panel_enabled: false,
    totem_enabled: false,
    establishment_id: "",
  });
  const [loading, setLoading] = useState(true);
  const sidebarWidth = useSidebarWidth();
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const checkDesktop = () => setIsDesktop(window.innerWidth >= 1024);
    checkDesktop();
    window.addEventListener('resize', checkDesktop);
    return () => window.removeEventListener('resize', checkDesktop);
  }, []);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("establishment_id")
        .eq("user_id", (await supabase.auth.getUser()).data.user?.id)
        .single();

      if (!profile?.establishment_id) return;

      const { data, error } = await supabase
        .from("app_settings")
        .select("*")
        .eq("establishment_id", profile.establishment_id)
        .single();

      if (error && error.code !== "PGRST116") throw error;

      if (data) {
        setSettings({
          password_panel_enabled: data.password_panel_enabled,
          totem_enabled: data.totem_enabled,
          establishment_id: data.establishment_id,
        });
      } else {
        // Create default settings
        const { data: newData, error: insertError } = await supabase
          .from("app_settings")
          .insert({
            establishment_id: profile.establishment_id,
            password_panel_enabled: false,
            totem_enabled: false,
          })
          .select()
          .single();

        if (insertError) throw insertError;

        // Update state with new data
        if (newData) {
          setSettings({
            password_panel_enabled: newData.password_panel_enabled,
            totem_enabled: newData.totem_enabled,
            establishment_id: newData.establishment_id,
          });
        }
      }
    } catch (error) {
      console.error("Error loading settings:", error);
      toast.error("Erro ao carregar configurações");
    } finally {
      setLoading(false);
    }
  };

  const toggleApp = async (app: "password_panel" | "totem", enabled: boolean) => {
    try {
      const field = `${app}_enabled`;
      const { error } = await supabase
        .from("app_settings")
        .update({ [field]: enabled })
        .eq("establishment_id", settings.establishment_id);

      if (error) throw error;

      setSettings({ ...settings, [`${app}_enabled`]: enabled });
      toast.success(`${app === "password_panel" ? "Painel de Senha" : "Totem"} ${enabled ? "ativado" : "desativado"}`);
    } catch (error) {
      console.error("Error toggling app:", error);
      toast.error("Erro ao atualizar configuração");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Sidebar />
        <main 
          className="transition-all duration-300 ease-in-out"
          style={{
            marginLeft: isDesktop ? `${sidebarWidth}px` : '0px',
            padding: '1.5rem',
            minHeight: '100vh',
            height: '100vh',
            overflowY: 'auto'
          }}
        >
          <div className="w-full">Carregando...</div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <main 
        className="transition-all duration-300 ease-in-out"
        style={{
          marginLeft: isDesktop ? `${sidebarWidth}px` : '0px',
          padding: '1.5rem',
          minHeight: '100vh',
          height: '100vh',
          overflowY: 'auto'
        }}
      >
        <div className="w-full space-y-6">
          <div>
            <h1 className="text-3xl font-bold">APPS</h1>
            <p className="text-muted-foreground">
              Gerencie aplicativos adicionais para seu estabelecimento
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Painel de Senha */}
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2">
                      <Monitor className="h-5 w-5" />
                      Painel de Senha
                    </CardTitle>
                    <CardDescription>
                      Sistema de gerenciamento de senhas para atendimento
                    </CardDescription>
                  </div>
                  <Switch
                    checked={settings.password_panel_enabled}
                    onCheckedChange={(checked) => toggleApp("password_panel", checked)}
                  />
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Organize o atendimento com senhas digitais. Ideal para estabelecimentos com múltiplos balcões.
                </p>
                
                {settings.password_panel_enabled && (
                  <div className="space-y-2">
                    <Button
                      className="w-full"
                      onClick={() => navigate("/password-panel")}
                    >
                      <Settings className="h-4 w-4 mr-2" />
                      Gerenciar Senhas
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => window.open("/password-display", "_blank")}
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Abrir Display
                    </Button>
                  </div>
                )}

                {!settings.password_panel_enabled && (
                  <div className="bg-muted p-4 rounded-md">
                    <p className="text-sm text-muted-foreground">
                      Ative o app para começar a usar
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Totem de Auto-Atendimento */}
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2">
                      <Smartphone className="h-5 w-5" />
                      Totem de Auto-Atendimento
                    </CardTitle>
                    <CardDescription>
                      Permita que clientes façam pedidos sem atendente
                    </CardDescription>
                  </div>
                  <Switch
                    checked={settings.totem_enabled}
                    onCheckedChange={(checked) => toggleApp("totem", checked)}
                  />
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Interface simplificada para clientes fazerem pedidos de forma autônoma. Reduz filas e agiliza o atendimento.
                </p>

                {settings.totem_enabled && (
                  <div className="space-y-2">
                    <Button
                      className="w-full"
                      onClick={() => window.open("/totem", "_blank")}
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Abrir Totem
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      Abra em um dispositivo dedicado em tela cheia
                    </p>
                  </div>
                )}

                {!settings.totem_enabled && (
                  <div className="bg-muted p-4 rounded-md">
                    <p className="text-sm text-muted-foreground">
                      Ative o app para começar a usar
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
