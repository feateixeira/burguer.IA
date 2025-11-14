import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, Star } from "lucide-react";

const Pricing = () => {
  const plans = [
    {
      name: "Essencial",
      price: "R$ 89",
      period: "/mês",
      description: "Perfeito para estabelecimentos iniciantes",
      features: [
        "1 Estabelecimento",
        "PDV completo",
        "Dashboard básico",
        "Controle de estoque",
        "Suporte por email",
        "Backup automático"
      ],
      popular: false
    },
    {
      name: "Profissional",
      price: "R$ 149",
      period: "/mês",
      description: "Ideal para negócios em crescimento",
      features: [
        "Até 3 Estabelecimentos",
        "PDV avançado",
        "Dashboard completo",
        "Marketing automático",
        "Integração delivery",
        "QR Code cardápio",
        "Suporte prioritário",
        "Relatórios avançados"
      ],
      popular: true
    },
    {
      name: "Enterprise",
      price: "R$ 299",
      period: "/mês",
      description: "Para redes e grandes operações",
      features: [
        "Estabelecimentos ilimitados",
        "Gestão centralizada",
        "API personalizada",
        "Suporte 24/7",
        "Treinamento incluso",
        "Customizações",
        "Gerente de conta",
        "SLA garantido"
      ],
      popular: false
    }
  ];

  return (
    <section id="preco" className="py-20 bg-background">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center space-y-4 mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground">
            Planos que se adaptam ao seu{" "}
            <span className="bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">
              negócio
            </span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Escolha o plano ideal para o seu estabelecimento. Teste grátis por 7 dias, 
            sem compromisso e com todo o suporte incluído.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {plans.map((plan, index) => (
            <Card 
              key={index} 
              className={`relative transition-all duration-300 hover:shadow-xl ${
                plan.popular 
                  ? 'border-primary ring-2 ring-primary/20 scale-105' 
                  : 'border-border hover:border-primary/30'
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <div className="bg-gradient-to-r from-primary to-primary-glow text-white px-4 py-1 rounded-full text-sm font-semibold flex items-center space-x-1">
                    <Star className="h-4 w-4" />
                    <span>Mais Popular</span>
                  </div>
                </div>
              )}
              
              <CardHeader className="text-center pb-6">
                <CardTitle className="text-xl font-bold text-foreground">
                  {plan.name}
                </CardTitle>
                <div className="space-y-2">
                  <div className="flex items-baseline justify-center">
                    <span className="text-4xl font-bold text-foreground">
                      {plan.price}
                    </span>
                    <span className="text-muted-foreground ml-1">
                      {plan.period}
                    </span>
                  </div>
                  <CardDescription>
                    {plan.description}
                  </CardDescription>
                </div>
              </CardHeader>

              <CardContent className="space-y-6">
                <ul className="space-y-3">
                  {plan.features.map((feature, featureIndex) => (
                    <li key={featureIndex} className="flex items-center">
                      <Check className="h-5 w-5 text-primary mr-3 flex-shrink-0" />
                      <span className="text-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button 
                  variant={plan.popular ? "hero" : "outline"} 
                  className="w-full"
                  size="lg"
                >
                  {plan.popular ? "Começar Agora" : "Teste Grátis"}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="text-center mt-12 space-y-4">
          <p className="text-muted-foreground">
            Todas as transações são seguras e criptografadas
          </p>
          <div className="flex justify-center items-center space-x-8 text-sm text-muted-foreground">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-primary rounded-full"></div>
              <span>7 dias grátis</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-primary rounded-full"></div>
              <span>Cancele quando quiser</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-primary rounded-full"></div>
              <span>Suporte incluído</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Pricing;