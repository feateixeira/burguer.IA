import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MessageCircle, Construction, Sparkles } from "lucide-react";
import Sidebar from "@/components/Sidebar";
import { useSidebarWidth } from "@/hooks/useSidebarWidth";
import { usePlanAccess } from "@/hooks/usePlanAccess";
import { useTrialCheck } from "@/hooks/useTrialCheck";

const WhatsApp = () => {
  const sidebarWidth = useSidebarWidth();
  const planAccess = usePlanAccess();
  const { trialStatus } = useTrialCheck();

  const isTrial = planAccess?.isTrial || false;
  const hasAccess = planAccess?.hasWhatsAppAccess || false;

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
              <MessageCircle className="h-6 w-6 text-primary" />
              <h1 className="text-3xl font-bold">WhatsApp Business</h1>
              <Badge variant="secondary" className="ml-2">Premium</Badge>
            </div>
            <p className="text-muted-foreground">
              Integração com WhatsApp para envio de mensagens automáticas
            </p>
          </div>

          {!hasAccess ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Construction className="h-5 w-5 text-orange-500" />
                  Funcionalidade em Construção
                </CardTitle>
                <CardDescription>
                  Esta funcionalidade está disponível apenas no Plano Premium
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground mb-4">
                    Para usar esta funcionalidade, contrate o Plano Premium que inclui:
                  </p>
                  <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
                    <li>Acesso completo ao sistema</li>
                    <li>Assistente de Negócios IA</li>
                    <li>Integração com WhatsApp Business</li>
                  </ul>
                </div>
                <Button
                  onClick={() => {
                    const whatsappNumber = '5511999999999'; // Substituir pelo número real
                    const message = encodeURIComponent('Olá! Gostaria de contratar o Plano Premium.');
                    window.open(`https://wa.me/${whatsappNumber}?text=${message}`, '_blank');
                  }}
                  className="w-full"
                >
                  <MessageCircle className="h-4 w-4 mr-2" />
                  Contatar para Contratar Premium
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Construction className="h-5 w-5 text-orange-500" />
                  Em Construção
                </CardTitle>
                <CardDescription>
                  Esta funcionalidade está sendo desenvolvida
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-8 text-center">
                  <Construction className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-xl font-semibold mb-2">Em Breve</h3>
                  <p className="text-muted-foreground mb-4">
                    Estamos trabalhando para trazer a integração com WhatsApp Business em breve.
                  </p>
                  {isTrial && (
                    <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                      <p className="text-sm text-yellow-700 dark:text-yellow-400">
                        ⚠️ Você está em período de teste. Para continuar usando após o teste, contrate o Plano Premium.
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default WhatsApp;

