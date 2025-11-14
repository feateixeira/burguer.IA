import { Button } from "@/components/ui/button";
import { ArrowRight, Zap } from "lucide-react";

const CTA = () => {
  return (
    <section className="py-20 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary to-primary-glow" />
      <div className="absolute inset-0 bg-black/10" />
      
      {/* Decorative elements */}
      <div className="absolute top-0 left-0 w-64 h-64 bg-white/5 rounded-full -translate-x-32 -translate-y-32" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-white/5 rounded-full translate-x-48 translate-y-48" />
      
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center space-y-8 max-w-4xl mx-auto">
          <div className="space-y-4">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white">
              Pronto para revolucionar 
              <br />seu restaurante?
            </h2>
            <p className="text-xl text-white/90 max-w-2xl mx-auto">
              Junte-se a centenas de estabelecimentos que já aumentaram suas vendas 
              com o burguer.IA. Teste grátis por 7 dias, sem compromisso.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Button 
              variant="outline" 
              size="lg" 
              className="bg-white text-primary hover:bg-white/90 border-white group text-lg px-8 py-6 h-auto"
            >
              <Zap className="mr-2 h-6 w-6" />
              Começar Teste Grátis
              <ArrowRight className="ml-2 h-6 w-6 transition-transform group-hover:translate-x-1" />
            </Button>
            <Button 
              variant="ghost" 
              size="lg" 
              className="text-white hover:bg-white/10 border border-white/20 text-lg px-8 py-6 h-auto"
            >
              Falar com Especialista
            </Button>
          </div>

          <div className="grid sm:grid-cols-3 gap-8 pt-12 text-white">
            <div className="space-y-2">
              <div className="text-3xl sm:text-4xl font-bold">500+</div>
              <div className="text-white/80">Estabelecimentos ativos</div>
            </div>
            <div className="space-y-2">
              <div className="text-3xl sm:text-4xl font-bold">98%</div>
              <div className="text-white/80">Satisfação dos clientes</div>
            </div>
            <div className="space-y-2">
              <div className="text-3xl sm:text-4xl font-bold">24/7</div>
              <div className="text-white/80">Suporte disponível</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CTA;