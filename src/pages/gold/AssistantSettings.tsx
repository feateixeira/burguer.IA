import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Loader2, ArrowLeft, Save } from "lucide-react";
import { Link } from "react-router-dom";
import Sidebar from "@/components/Sidebar";
import { useSidebarWidth } from "@/hooks/useSidebarWidth";

const AssistantSettings = () => {
  const navigate = useNavigate();
  const sidebarWidth = useSidebarWidth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [settings, setSettings] = useState({
    monthly_goal: "",
    target_ticket_avg: "",
    alerts_enabled: true
  });

  useEffect(() => {
    checkGoldAccess();
  }, []);

  const checkGoldAccess = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }

      const { data: profile, error } = await supabase
        .from("profiles")
        .select("establishment_id, plan_type")
        .eq("user_id", session.user.id)
        .single();

      if (error || !profile) {
        toast.error("Erro ao carregar perfil");
        navigate("/dashboard");
        return;
      }

      if (profile.plan_type !== 'gold') {
        toast.error("Esta funcionalidade é exclusiva para o Plano Standard");
        navigate("/dashboard");
        return;
      }

      setTenantId(profile.establishment_id);
      loadSettings(profile.establishment_id);
    } catch (error) {
      console.error("Error checking access:", error);
      toast.error("Erro ao verificar acesso");
      navigate("/dashboard");
    }
  };

  const loadSettings = async (establishmentId: string) => {
    try {
      const { data, error } = await supabase
        .from("assistant_settings")
        .select("*")
        .eq("tenant_id", establishmentId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        setSettings({
          monthly_goal: data.monthly_goal ? data.monthly_goal.toString() : "",
          target_ticket_avg: data.target_ticket_avg ? data.target_ticket_avg.toString() : "",
          alerts_enabled: data.alerts_enabled ?? true
        });
      }
    } catch (error) {
      console.error("Error loading settings:", error);
      toast.error("Erro ao carregar configurações");
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    if (!tenantId) return;

    setSaving(true);
    try {
      const settingsData = {
        tenant_id: tenantId,
        monthly_goal: settings.monthly_goal ? parseFloat(settings.monthly_goal) : null,
        target_ticket_avg: settings.target_ticket_avg ? parseFloat(settings.target_ticket_avg) : null,
        alerts_enabled: settings.alerts_enabled
      };

      const { error } = await supabase
        .from("assistant_settings")
        .upsert(settingsData, {
          onConflict: 'tenant_id'
        });

      if (error) throw error;

      toast.success("Configurações salvas com sucesso!");
    } catch (error: any) {
      console.error("Error saving settings:", error);
      toast.error("Erro ao salvar configurações");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen bg-background">
        <Sidebar />
        <div
          className="flex-1 transition-all duration-300 flex items-center justify-center"
          style={{ marginLeft: `${sidebarWidth}px` }}
        >
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div
        className="flex-1 transition-all duration-300"
        style={{ marginLeft: `${sidebarWidth}px` }}
      >
        <div className="container mx-auto p-4 max-w-4xl">
      <div className="mb-6">
        <Link to="/gold/assistant">
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar ao Assistente
          </Button>
        </Link>
        <h1 className="text-3xl font-bold">Configurações do Assistente IA</h1>
        <p className="text-muted-foreground">
          Configure suas preferências e metas para o assistente
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Metas e Preferências</CardTitle>
          <CardDescription>
            Defina suas metas para receber insights mais personalizados
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="monthly_goal">Meta Mensal (R$)</Label>
            <Input
              id="monthly_goal"
              type="number"
              placeholder="Ex: 50000"
              value={settings.monthly_goal}
              onChange={(e) => setSettings(prev => ({ ...prev, monthly_goal: e.target.value }))}
            />
            <p className="text-xs text-muted-foreground">
              Meta de receita mensal (opcional)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="target_ticket_avg">Ticket Médio Desejado (R$)</Label>
            <Input
              id="target_ticket_avg"
              type="number"
              step="0.01"
              placeholder="Ex: 45.50"
              value={settings.target_ticket_avg}
              onChange={(e) => setSettings(prev => ({ ...prev, target_ticket_avg: e.target.value }))}
            />
            <p className="text-xs text-muted-foreground">
              Ticket médio que você deseja alcançar (opcional)
            </p>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="alerts_enabled">Ativar Alertas de Insights</Label>
              <p className="text-xs text-muted-foreground">
                Receba insights automáticos sobre horários fracos, picos e produtos
              </p>
            </div>
            <Switch
              id="alerts_enabled"
              checked={settings.alerts_enabled}
              onCheckedChange={(checked) => 
                setSettings(prev => ({ ...prev, alerts_enabled: checked }))
              }
            />
          </div>

          <div className="pt-4 border-t">
            <Button onClick={saveSettings} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Salvar Configurações
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Informações</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            As configurações são usadas pelo assistente IA para fornecer insights mais 
            personalizados e relevantes para o seu negócio. Você pode alterá-las a 
            qualquer momento.
          </p>
        </CardContent>
      </Card>
        </div>
      </div>
    </div>
  );
};

export default AssistantSettings;

