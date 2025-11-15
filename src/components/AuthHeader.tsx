import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MessageCircle, Check, X } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const AuthHeader = () => {
  const [showPlansModal, setShowPlansModal] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);

  const plans = [
    {
      name: "Standard",
      price: "R$ 160",
      description: "Plano básico com acesso completo ao sistema",
      color: "border-[#9CA3AF] bg-[#9CA3AF]/10",
      features: [
        "Gestão completa de produtos",
        "Controle de pedidos",
        "Gestão de clientes",
        "Dashboard executivo",
        "Relatórios de vendas",
        "Gestão de equipe",
      ],
      notIncluded: [
        "Assistente de IA",
        "WhatsApp Business",
      ],
    },
    {
      name: "Gold",
      price: "R$ 180",
      description: "Plano básico + Assistente de IA para negócios",
      color: "border-[#d4af37] bg-[#d4af37]/10",
      features: [
        "Tudo do plano Standard",
        "Assistente de Negócios IA",
        "Análises inteligentes",
        "Insights automáticos",
        "Recomendações estratégicas",
      ],
      notIncluded: [
        "WhatsApp Business",
      ],
    },
    {
      name: "Premium",
      price: "R$ 220",
      description: "Plano completo com IA + WhatsApp Business",
      color: "border-[#38A5B2] bg-[#38A5B2]/10",
      features: [
        "Tudo do plano Standard",
        "Integração WhatsApp Business",
        "Atendimento automatizado",
        "Campanhas via WhatsApp",
        "Suporte prioritário",
      ],
      notIncluded: [],
    },
  ];

  const handleWhatsAppContact = (planName: string) => {
    const whatsappNumber = "5561999098562";
    const message = encodeURIComponent(
      `Olá! Gostaria de contratar o Plano ${planName} do burguer.IA.`
    );
    window.open(`https://wa.me/${whatsappNumber}?text=${message}`, "_blank");
    setShowPlansModal(false);
  };

  const handleGeneralContact = () => {
    const whatsappNumber = "5561999098562";
    const message = encodeURIComponent(
      "Olá! Gostaria de saber mais sobre os planos do burguer.IA."
    );
    window.open(`https://wa.me/${whatsappNumber}?text=${message}`, "_blank");
    setShowContactModal(false);
  };

  return (
    <>
      <header className="w-full px-4 py-4 lg:px-8 lg:py-6 flex items-center justify-between relative z-20">
        <div className="flex items-center gap-2">
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            onClick={() => setShowPlansModal(true)}
            className="text-slate-700 dark:text-slate-300 hover:text-primary dark:hover:text-primary"
          >
            Planos
          </Button>
          <Button
            variant="outline"
            onClick={() => setShowContactModal(true)}
            className="bg-gradient-to-r from-primary/10 to-primary/5 hover:from-primary/20 hover:to-primary/10 border-primary/30 text-primary hover:text-primary"
          >
            <MessageCircle className="h-4 w-4 mr-2" />
            Entrar em Contato
          </Button>
        </div>
      </header>

      {/* Modal de Planos */}
      <Dialog open={showPlansModal} onOpenChange={setShowPlansModal}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-3xl font-bold text-center">
              Escolha o Plano Ideal para Você
            </DialogTitle>
            <DialogDescription className="text-center text-base">
              Compare os planos e escolha o que melhor se adapta ao seu negócio
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
            {plans.map((plan) => (
              <Card
                key={plan.name}
                className={`relative ${plan.color} border-2 hover:shadow-lg transition-all duration-300 flex flex-col ${plan.name === 'Gold' ? 'border-[#d4af37] border-3' : ''}`}
              >
                {plan.name === 'Gold' && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 z-10">
                    <Badge className="bg-gradient-to-r from-[#d4af37] to-[#f4d03f] text-white border-2 border-[#d4af37] px-3 py-1 text-xs font-bold shadow-lg">
                      ⭐ MAIS POPULAR
                    </Badge>
                  </div>
                )}
                <CardHeader className="text-center pb-4">
                  <Badge
                    variant="outline"
                    className={`mb-2 ${plan.color} border-2`}
                  >
                    {plan.name}
                  </Badge>
                  <CardTitle className="text-3xl font-bold mb-2">
                    {plan.price}
                    <span className="text-lg font-normal text-muted-foreground">
                      /mês
                    </span>
                  </CardTitle>
                  <CardDescription className="text-sm">
                    {plan.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col">
                  <div className="space-y-3 mb-6 flex-1">
                    <div>
                      <p className="text-sm font-semibold mb-2 text-green-600 dark:text-green-400">
                        Inclui:
                      </p>
                      <ul className="space-y-2">
                        {plan.features.map((feature, index) => (
                          <li key={index} className="flex items-start gap-2 text-sm">
                            <Check className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    {plan.notIncluded.length > 0 && (
                      <div>
                        <p className="text-sm font-semibold mb-2 text-red-600 dark:text-red-400">
                          Não inclui:
                        </p>
                        <ul className="space-y-2">
                          {plan.notIncluded.map((feature, index) => (
                            <li
                              key={index}
                              className="flex items-start gap-2 text-sm text-muted-foreground"
                            >
                              <X className="h-4 w-4 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                              <span>{feature}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                  <Button
                    onClick={() => handleWhatsAppContact(plan.name)}
                    className="w-full bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
                  >
                    <MessageCircle className="h-4 w-4 mr-2" />
                    Contratar {plan.name}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="mt-6 p-4 bg-primary/5 dark:bg-primary/10 rounded-lg border border-primary/20">
            <p className="text-sm text-slate-700 dark:text-slate-300 text-center">
              <strong className="text-primary">💡 Dica:</strong> Todos os planos incluem
              suporte e atualizações. Escolha o plano que melhor atende suas necessidades!
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Contato Geral */}
      <Dialog open={showContactModal} onOpenChange={setShowContactModal}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-slate-900 dark:text-white">
              Entre em Contato
            </DialogTitle>
            <DialogDescription className="text-base text-slate-600 dark:text-slate-300">
              Fale conosco para contratar um plano ou tirar suas dúvidas
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-6">
            <Button
              onClick={handleGeneralContact}
              className="w-full h-auto p-4 bg-green-600 hover:bg-green-700 text-white"
            >
              <MessageCircle className="h-5 w-5 mr-2" />
              <div className="text-left flex-1">
                <div className="font-semibold">WhatsApp</div>
                <div className="text-sm opacity-90">(61) 99909-8562</div>
              </div>
            </Button>

            <a
              href="mailto:fellipe_1693@outlook.com?subject=Contato - burguer.IA&body=Olá! Gostaria de saber mais sobre os planos do burguer.IA."
              className="flex items-center gap-4 p-4 rounded-xl border-2 border-primary/20 hover:border-primary/40 bg-white dark:bg-slate-800 hover:bg-primary/5 dark:hover:bg-primary/10 transition-all duration-300 group"
              onClick={() => setShowContactModal(false)}
            >
              <div className="p-3 bg-primary/10 dark:bg-primary/20 rounded-lg group-hover:bg-primary/20 dark:group-hover:bg-primary/30 transition-colors">
                <MessageCircle className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-slate-900 dark:text-white mb-1">
                  Enviar Email
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  fellipe_1693@outlook.com
                </p>
              </div>
            </a>
          </div>

          <div className="mt-6 p-4 bg-primary/5 dark:bg-primary/10 rounded-lg border border-primary/20">
            <p className="text-sm text-slate-700 dark:text-slate-300 text-center">
              <strong className="text-primary">💡 Dica:</strong> Escolha o método que
              preferir. Responderemos o mais rápido possível!
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AuthHeader;

