import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  MonitorSpeaker, 
  BarChart3, 
  Users, 
  Smartphone, 
  ShoppingCart, 
  TrendingUp,
  QrCode,
  MessageSquare,
  Shield,
  Printer,
  DollarSign,
  Timer
} from "lucide-react";
import posImage from "@/assets/pos-system.jpg";
import analyticsImage from "@/assets/analytics-dashboard.jpg";

const Features = () => {
  const features = [
    {
      icon: MonitorSpeaker,
      title: "PDV Moderno",
      description: "Interface intuitiva para vendas rápidas, com suporte a combos, adicionais e múltiplos métodos de pagamento."
    },
    {
      icon: BarChart3,
      title: "Dashboard Inteligente",
      description: "Relatórios detalhados de vendas, produtos mais vendidos, horários de pico e performance em tempo real."
    },
    {
      icon: Users,
      title: "Multiestabelecimento",
      description: "Gerencie várias unidades com acessos independentes e visão centralizada para administradores."
    },
    {
      icon: Smartphone,
      title: "100% Responsivo",
      description: "Funciona perfeitamente em desktop, tablet e celular. Acesse de qualquer lugar, a qualquer hora."
    },
    {
      icon: ShoppingCart,
      title: "Controle de Estoque",
      description: "Gestão completa de ingredientes, alertas de estoque baixo e ficha técnica de produtos."
    },
    {
      icon: TrendingUp,
      title: "Upselling Inteligente",
      description: "Sugestões automáticas de combos e upgrades para aumentar o ticket médio das vendas."
    },
    {
      icon: QrCode,
      title: "Catálogo Digital",
      description: "QR Code para cardápio digital compartilhável, perfeito para marketing e acesso direto dos clientes."
    },
    {
      icon: MessageSquare,
      title: "Marketing Automático",
      description: "Campanhas via WhatsApp e e-mail, cupons personalizados e promoções para clientes inativos."
    },
    {
      icon: Shield,
      title: "Segurança Total",
      description: "Dados protegidos na nuvem, backup automático e autenticação segura para cada estabelecimento."
    },
    {
      icon: Printer,
      title: "Integração Completa",
      description: "Impressão de comandas, NFC-e automática e integração com apps de delivery como iFood."
    },
    {
      icon: DollarSign,
      title: "Gestão Financeira",
      description: "Controle de fluxo de caixa, ranking de vendedores e relatórios financeiros detalhados."
    },
    {
      icon: Timer,
      title: "Tempo Real",
      description: "Todas as informações atualizadas instantaneamente em todos os dispositivos conectados."
    }
  ];

  return (
    <section id="funcionalidades" className="py-20 bg-feature-bg">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center space-y-4 mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground">
            Funcionalidades que fazem a{" "}
            <span className="bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">
              diferença
            </span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Tudo que você precisa para gerenciar seu restaurante de forma moderna e eficiente, 
            aumentando suas vendas e otimizando sua operação.
          </p>
        </div>

        {/* Feature Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-20">
          {features.map((feature, index) => (
            <Card key={index} className="group hover:shadow-lg transition-all duration-300 border-border hover:border-primary/20">
              <CardHeader>
                <div className="w-12 h-12 bg-gradient-to-br from-primary to-primary-glow rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                  <feature.icon className="h-6 w-6 text-white" />
                </div>
                <CardTitle className="text-lg font-semibold text-foreground">
                  {feature.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-muted-foreground">
                  {feature.description}
                </CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Featured sections */}
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* PDV Section */}
          <div className="space-y-6">
            <div className="space-y-4">
              <h3 className="text-2xl sm:text-3xl font-bold text-foreground">
                PDV que acelera suas vendas
              </h3>
              <p className="text-lg text-muted-foreground">
                Interface moderna e intuitiva que permite vendas rápidas, controle de mesas, 
                montagem de combos e processamento de pagamentos em segundos.
              </p>
            </div>
            <ul className="space-y-3">
              <li className="flex items-center text-foreground">
                <div className="w-2 h-2 bg-primary rounded-full mr-3" />
                Vendas em 3 toques na tela
              </li>
              <li className="flex items-center text-foreground">
                <div className="w-2 h-2 bg-primary rounded-full mr-3" />
                Suporte a combos e adicionais
              </li>
              <li className="flex items-center text-foreground">
                <div className="w-2 h-2 bg-primary rounded-full mr-3" />
                Múltiplos métodos de pagamento
              </li>
              <li className="flex items-center text-foreground">
                <div className="w-2 h-2 bg-primary rounded-full mr-3" />
                Impressão automática de comandas
              </li>
            </ul>
          </div>
          <div className="relative">
            <img
              src={posImage}
              alt="Sistema PDV burguer.IA"
              className="rounded-2xl shadow-xl w-full"
            />
          </div>

          {/* Analytics Section */}
          <div className="relative lg:order-1">
            <img
              src={analyticsImage}
              alt="Dashboard Analytics burguer.IA"
              className="rounded-2xl shadow-xl w-full"
            />
          </div>
          <div className="space-y-6 lg:order-2">
            <div className="space-y-4">
              <h3 className="text-2xl sm:text-3xl font-bold text-foreground">
                Insights que impulsionam resultados
              </h3>
              <p className="text-lg text-muted-foreground">
                Dashboard completo com métricas essenciais para tomar decisões inteligentes 
                e aumentar a rentabilidade do seu negócio.
              </p>
            </div>
            <ul className="space-y-3">
              <li className="flex items-center text-foreground">
                <div className="w-2 h-2 bg-primary rounded-full mr-3" />
                Vendas por período e produto
              </li>
              <li className="flex items-center text-foreground">
                <div className="w-2 h-2 bg-primary rounded-full mr-3" />
                Horários de maior movimento
              </li>
              <li className="flex items-center text-foreground">
                <div className="w-2 h-2 bg-primary rounded-full mr-3" />
                Ticket médio e métodos de pagamento
              </li>
              <li className="flex items-center text-foreground">
                <div className="w-2 h-2 bg-primary rounded-full mr-3" />
                Ranking de produtos e colaboradores
              </li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Features;