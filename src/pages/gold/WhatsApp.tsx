import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MessageCircle, Construction, Smartphone, RefreshCw, CheckCircle2, ShieldAlert } from "lucide-react";
import Sidebar from "@/components/Sidebar";
import { useSidebarWidth } from "@/hooks/useSidebarWidth";
import { usePlanAccess } from "@/hooks/usePlanAccess";
import { useTrialCheck } from "@/hooks/useTrialCheck";
import { supabase } from "@/integrations/supabase/client";
import { QRCodeSVG } from 'qrcode.react';
import { toast } from "sonner";

const WhatsApp = () => {
  const sidebarWidth = useSidebarWidth();
  const planAccess = usePlanAccess();
  const { trialStatus } = useTrialCheck();

  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [establishmentId, setEstablishmentId] = useState<string | null>(null);

  const hasAccess = planAccess?.hasWhatsAppAccess || false;

  useEffect(() => {
    fetchEstablishmentData();
  }, []);

  useEffect(() => {
    if (!establishmentId) return;

    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'establishments',
          filter: `id=eq.${establishmentId}`
        },
        (payload) => {
          const newData = payload.new as any;
          if (newData.whatsapp_status) setStatus(newData.whatsapp_status);
          if (newData.whatsapp_qr !== undefined) setQrCode(newData.whatsapp_qr);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [establishmentId]);

  const fetchEstablishmentData = async () => {
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

        const { data: establishment } = await supabase
          .from("establishments")
          .select("whatsapp_status, whatsapp_qr")
          .eq("id", profile.establishment_id)
          .single();

        if (establishment) {
          setStatus(establishment.whatsapp_status as any || 'disconnected');
          setQrCode(establishment.whatsapp_qr);
        }
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    if (!establishmentId) return;
    setLoading(true);
    try {
      // Use localhost assuming client is running it locally OR server is accessible
      // NOTE: In production SaaS, this URL should be your deployed server URL (e.g., https://api.burguer.ia/sessions/start)
      const response = await fetch('http://localhost:3000/sessions/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ establishmentId })
      });
      if (!response.ok) throw new Error('Falha ao iniciar sessão');
      toast.success('Iniciando conexão com WhatsApp...');
    } catch (error) {
      console.error(error);
      toast.error('Erro ao conectar. Verifique se o Bot Server está rodando.');
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!establishmentId) return;
    try {
      await fetch('http://localhost:3000/sessions/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ establishmentId })
      });
      toast.success('Sessão encerrada');
    } catch (error) {
      toast.error('Erro ao desconectar');
    }
  };

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div
        className="flex-1 transition-all duration-300"
        style={{ marginLeft: `${sidebarWidth}px` }}
      >
        <div className="container mx-auto p-4 max-w-4xl">
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-2">
              <MessageCircle className="h-6 w-6 text-green-500" />
              <h1 className="text-3xl font-bold">WhatsApp Business</h1>
              <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100 border-green-200">
                Premium
              </Badge>
            </div>
            <p className="text-muted-foreground">
              Conecte seu WhatsApp para responder clientes e aceitar pedidos automaticamente com IA.
            </p>
          </div>

          {!hasAccess ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldAlert className="h-5 w-5 text-orange-500" />
                  Funcionalidade Premium
                </CardTitle>
                <CardDescription>
                  Esta funcionalidade está disponível apenas no Plano Premium
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">Atualize seu plano para acessar o Bot de WhatsApp com IA.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6 md:grid-cols-2">
              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle>Status da Conexão</CardTitle>
                  <CardDescription>Gerencie a conexão do seu Bot WhatsApp</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col items-center justify-center py-8 min-h-[300px]">

                  {loading ? (
                    <div className="flex flex-col items-center gap-4">
                      <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                      <p>Carregando status...</p>
                    </div>
                  ) : status === 'connected' ? (
                    <div className="flex flex-col items-center gap-4 text-center animate-in fade-in zoom-in duration-500">
                      <div className="h-24 w-24 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                        <CheckCircle2 className="h-12 w-12 text-green-600 dark:text-green-400" />
                      </div>
                      <h3 className="text-2xl font-bold text-green-600 dark:text-green-400">Bot Conectado!</h3>
                      <p className="text-muted-foreground max-w-md">
                        Seu WhatsApp está ativo e respondendo clientes. Os pedidos aparecerão automaticamente no painel.
                      </p>
                      <Badge variant="outline" className="px-4 py-1 border-green-500 text-green-600">
                        Online
                      </Badge>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-6 max-w-md text-center">
                      <div className="space-y-4">
                        <h3 className="text-xl font-semibold">Conectar WhatsApp</h3>
                        <p className="text-sm text-muted-foreground">
                          Clique abaixo para iniciar a conexão. Um QR Code será gerado.
                        </p>
                        {status === 'disconnected' && (
                          <Button onClick={handleConnect} disabled={loading} className="w-full bg-green-600 hover:bg-green-700">
                            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                            Iniciar Conexão
                          </Button>
                        )}
                      </div>

                      <div className="p-4 bg-white rounded-xl shadow-sm border">
                        {qrCode ? (
                          <div className="space-y-4">
                            <QRCodeSVG value={qrCode} size={256} />
                            <p className="text-xs text-muted-foreground animate-pulse">Aguardando leitura...</p>
                          </div>
                        ) : (
                          <div className="h-64 w-64 bg-muted/30 flex flex-col items-center justify-center gap-4 text-muted-foreground rounded-lg">
                            <Smartphone className="h-10 w-10 opacity-20" />
                            <p className="text-sm px-4">
                              {status === 'connecting' ? 'Gerando QR Code...' : 'Clique em Iniciar para gerar o QR Code'}
                            </p>
                          </div>
                        )}
                      </div>

                      {status !== 'disconnected' && (
                        <Button variant="outline" onClick={handleDisconnect} className="text-red-500 hover:text-red-600 border-red-200 hover:bg-red-50">
                          Cancelar / Desconectar
                        </Button>
                      )}
                    </div>
                  )}

                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Instruções de Instalação</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <p>1. Certifique-se que o "Bot Server" está rodando no servidor.</p>
                  <p>2. Clique em "Iniciar Conexão" acima.</p>
                  <p>3. Aguarde o QR Code e escaneie com seu WhatsApp.</p>
                  {/* <p className="text-xs text-muted-foreground mt-2">API URL: http://localhost:3000 (Dev)</p> */}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Diagnóstico</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between py-2 border-b">
                      <span>Serviço Web</span>
                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Ativo</Badge>
                    </div>
                    <div className="flex justify-between py-2 border-b">
                      <span>Status do Bot</span>
                      <Badge variant={status === 'connected' ? 'default' : 'secondary'}>
                        {status === 'connected' ? 'Ativo' : status === 'connecting' ? 'Conectando...' : 'Desconectado'}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WhatsApp;
