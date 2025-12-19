import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CreditCard, Check, AlertCircle, Loader2, ExternalLink, Sparkles, Zap, Crown, TrendingUp, ArrowRight } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Profile {
  plan_type: 'gold' | 'platinum' | 'premium' | null;
  plan_amount: number | null;
  subscription_type: 'monthly' | 'trial' | null;
  payment_status: 'paid' | 'pending' | 'overdue' | null;
  next_payment_date: string | null;
  last_payment_date: string | null;
  mercadopago_status: string | null;
  mercadopago_init_point: string | null;
}

const planNames: Record<string, string> = {
  gold: 'Standard',
  platinum: 'Gold',
  premium: 'Premium'
};

const planPrices: Record<string, number> = {
  gold: 160.00,
  platinum: 180.00,
  premium: 220.00
};

const planFeatures: Record<string, string[]> = {
  gold: [
    'Gestão completa de pedidos',
    'Cardápio online personalizado',
    'Relatórios básicos',
    'Suporte por email'
  ],
  platinum: [
    'Tudo do Standard',
    'Relatórios avançados',
    'Integração WhatsApp',
    'Suporte prioritário',
    'Análise de vendas'
  ],
  premium: [
    'Tudo do Gold',
    'IA para otimização',
    'Marketing automatizado',
    'Suporte 24/7',
    'Consultoria personalizada',
    'API completa'
  ]
};

const planIcons: Record<string, any> = {
  gold: Zap,
  platinum: TrendingUp,
  premium: Crown
};

const planColors: Record<string, string> = {
  gold: 'from-yellow-500 to-orange-500',
  platinum: 'from-blue-500 to-purple-500',
  premium: 'from-purple-600 to-pink-600'
};

export function PaymentManager() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [creatingSubscription, setCreatingSubscription] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<'gold' | 'platinum' | 'premium' | null>(null);
  const [showPlanDialog, setShowPlanDialog] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('profiles')
        .select('plan_type, plan_amount, subscription_type, payment_status, next_payment_date, last_payment_date, mercadopago_status, mercadopago_init_point')
        .eq('user_id', user.id)
        .single();

      if (error) throw error;
      setProfile(data);
    } catch (error: any) {
      console.error('Error loading profile:', error);
      toast.error('Erro ao carregar informações de pagamento');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSubscription = async (planType: 'gold' | 'platinum' | 'premium') => {
    setCreatingSubscription(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Você precisa estar autenticado');
        return;
      }

      const { data, error } = await supabase.functions.invoke('create-mercadopago-subscription', {
        body: { plan_type: planType },
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      if (error) {
        throw error;
      }

      if (data?.error) {
        throw new Error(data.error + (data.details ? ` - ${data.details}` : ''));
      }

      // Verificar se init_point existe
      const initPoint = data?.init_point;

      if (initPoint) {
        // Abrir checkout do Mercado Pago em nova aba
        window.open(initPoint, '_blank', 'noopener,noreferrer');
        toast.success('Abrindo página de pagamento... Recomendamos pagar via PIX para confirmação mais rápida!', {
          duration: 5000
        });
      } else {
        toast.error('Erro ao criar assinatura. A resposta não contém link de pagamento.');
      }
    } catch (error: any) {
      console.error('Error creating subscription:', error);
      const errorMessage = error?.message || error?.error || 'Erro desconhecido';
      toast.error(`Erro ao criar assinatura: ${errorMessage}`);
    } finally {
      setCreatingSubscription(false);
      setShowPlanDialog(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case 'paid':
        return <Badge className="bg-green-500">Pago</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-500">Pendente</Badge>;
      case 'overdue':
        return <Badge className="bg-red-500">Atrasado</Badge>;
      default:
        return <Badge variant="outline">N/A</Badge>;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-6">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Assinatura e Pagamento
          </CardTitle>
          <CardDescription>
            Gerencie sua assinatura mensal e pagamentos
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Status Atual */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-sm text-muted-foreground">Plano Atual</Label>
              <div className="mt-1">
                {profile?.plan_type ? (
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-base">
                      {planNames[profile.plan_type]}
                    </Badge>
                    <span className="text-lg font-semibold">
                      R$ {profile.plan_amount?.toFixed(2) || planPrices[profile.plan_type]?.toFixed(2)}/mês
                    </span>
                  </div>
                ) : (
                  <span className="text-muted-foreground">Nenhum plano ativo</span>
                )}
              </div>
            </div>

            <div>
              <Label className="text-sm text-muted-foreground">Status do Pagamento</Label>
              <div className="mt-1">
                {getStatusBadge(profile?.payment_status || null)}
              </div>
            </div>

            <div>
              <Label className="text-sm text-muted-foreground">Tipo de Assinatura</Label>
              <div className="mt-1">
                {profile?.subscription_type === 'monthly' ? (
                  <Badge>Mensal</Badge>
                ) : (
                  <Badge variant="outline">Trial</Badge>
                )}
              </div>
            </div>

            <div>
              <Label className="text-sm text-muted-foreground">Próximo Pagamento</Label>
              <div className="mt-1 font-medium">
                {formatDate(profile?.next_payment_date || null)}
              </div>
            </div>

            {profile?.last_payment_date && (
              <div>
                <Label className="text-sm text-muted-foreground">Último Pagamento</Label>
                <div className="mt-1 font-medium">
                  {formatDate(profile.last_payment_date)}
                </div>
              </div>
            )}
          </div>

          {/* Ações */}
          <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t">
            {profile?.subscription_type !== 'monthly' ? (
              <Button 
                onClick={() => setShowPlanDialog(true)}
                className="w-full sm:w-auto"
              >
                <CreditCard className="h-4 w-4 mr-2" />
                Assinar Plano Mensal
              </Button>
            ) : profile?.payment_status === 'pending' || profile?.payment_status === 'overdue' ? (
              <>
                {profile.mercadopago_init_point ? (
                  <Button 
                    onClick={() => {
                      if (profile.mercadopago_init_point) {
                        window.open(profile.mercadopago_init_point, '_blank', 'noopener,noreferrer');
                        toast.info('💡 Dica: Escolha PIX para pagamento instantâneo!', {
                          duration: 4000
                        });
                      }
                    }}
                    className="w-full sm:w-auto"
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Finalizar Pagamento
                  </Button>
                ) : (
                  <Button 
                    onClick={() => {
                      if (profile.plan_type) {
                        handleCreateSubscription(profile.plan_type);
                      } else {
                        setShowPlanDialog(true);
                      }
                    }}
                    disabled={creatingSubscription}
                    className="w-full sm:w-auto"
                  >
                    {creatingSubscription ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Processando...
                      </>
                    ) : (
                      <>
                        <CreditCard className="h-4 w-4 mr-2" />
                        Criar Link de Pagamento
                      </>
                    )}
                  </Button>
                )}
                <Button 
                  variant="outline"
                  onClick={() => setShowPlanDialog(true)}
                  className="w-full sm:w-auto"
                >
                  Alterar Plano
                </Button>
              </>
            ) : (
              <Button 
                variant="outline"
                onClick={() => setShowPlanDialog(true)}
                className="w-full sm:w-auto"
              >
                Alterar Plano
              </Button>
            )}
          </div>

          {/* Informações Adicionais */}
          {profile?.subscription_type === 'monthly' && (
            <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                    Lembrete de Pagamento
                  </p>
                  <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                    Você receberá um alerta no dia 05 de cada mês com o valor proporcional ao seu plano.
                    {profile.plan_amount && (
                      <span className="font-semibold"> Valor atual: R$ {profile.plan_amount.toFixed(2)}/mês</span>
                    )}
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog de Seleção de Plano */}
      <Dialog open={showPlanDialog} onOpenChange={setShowPlanDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold flex items-center gap-2">
              <Sparkles className="h-6 w-6 text-primary" />
              Escolha o Plano Ideal para Você
            </DialogTitle>
            <DialogDescription className="text-base">
              Faça upgrade e desbloqueie recursos exclusivos para acelerar seu negócio
            </DialogDescription>
          </DialogHeader>

          {/* Mensagem de Upgrade */}
          {profile?.plan_type && (
            <div className="bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20 rounded-lg p-4 mb-6">
              <div className="flex items-start gap-3">
                <TrendingUp className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="font-semibold text-sm">Por que fazer upgrade?</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Planos superiores oferecem mais recursos, suporte prioritário e ferramentas avançadas 
                    para maximizar suas vendas e otimizar suas operações.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Grid de Planos */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            {(['gold', 'platinum', 'premium'] as const).map((planType) => {
              const Icon = planIcons[planType];
              const isCurrentPlan = profile?.plan_type === planType;
              const isSelected = selectedPlan === planType;
              const isUpgrade = profile?.plan_type && 
                (planType === 'platinum' && profile.plan_type === 'gold') ||
                (planType === 'premium' && (profile.plan_type === 'gold' || profile.plan_type === 'platinum'));

              return (
                <Card 
                  key={planType}
                  className={`cursor-pointer transition-all relative overflow-hidden ${
                    isSelected 
                      ? 'border-primary ring-2 ring-primary shadow-lg scale-105' 
                      : isCurrentPlan
                      ? 'border-primary/50 bg-primary/5'
                      : 'hover:border-primary/50 hover:shadow-md'
                  }`}
                  onClick={() => setSelectedPlan(planType)}
                >
                  {/* Badge de Plano Atual */}
                  {isCurrentPlan && (
                    <div className="absolute top-2 right-2">
                      <Badge className="bg-primary text-primary-foreground">
                        Plano Atual
                      </Badge>
                    </div>
                  )}

                  {/* Badge de Upgrade Recomendado */}
                  {isUpgrade && !isCurrentPlan && (
                    <div className="absolute top-2 right-2">
                      <Badge className="bg-green-500 text-white animate-pulse">
                        <TrendingUp className="h-3 w-3 mr-1" />
                        Upgrade
                      </Badge>
                    </div>
                  )}

                  {/* Gradiente de Fundo */}
                  <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${planColors[planType]} opacity-60`} />

                  <CardContent className="p-6">
                    {/* Cabeçalho do Plano */}
                    <div className="flex items-center gap-3 mb-4">
                      <div className={`p-3 rounded-lg bg-gradient-to-br ${planColors[planType]} text-white`}>
                        <Icon className="h-6 w-6" />
                      </div>
                      <div>
                        <h3 className="font-bold text-lg">{planNames[planType]}</h3>
                        <div className="flex items-baseline gap-1">
                          <span className="text-2xl font-bold">R$ {planPrices[planType].toFixed(2)}</span>
                          <span className="text-sm text-muted-foreground">/mês</span>
                        </div>
                      </div>
                    </div>

                    {/* Features do Plano */}
                    <ul className="space-y-2 mb-4">
                      {planFeatures[planType].map((feature, index) => (
                        <li key={index} className="flex items-start gap-2 text-sm">
                          <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                          <span className="text-muted-foreground">{feature}</span>
                        </li>
                      ))}
                    </ul>

                    {/* Indicador de Seleção */}
                    {isSelected && (
                      <div className="mt-4 pt-4 border-t flex items-center justify-center gap-2 text-primary font-semibold">
                        <Check className="h-5 w-5" />
                        Plano Selecionado
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Informação Adicional */}
          <div className="mt-6 p-4 bg-muted/50 rounded-lg">
            <p className="text-sm text-center text-muted-foreground">
              💡 <strong>Dica:</strong> Todos os planos incluem atualizações automáticas e melhorias contínuas. 
              Você pode fazer upgrade a qualquer momento!
            </p>
          </div>

          {/* Botões de Ação */}
          <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
            <Button variant="outline" onClick={() => setShowPlanDialog(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={() => {
                if (selectedPlan) {
                  handleCreateSubscription(selectedPlan);
                }
              }}
              disabled={!selectedPlan || creatingSubscription}
              className="min-w-[200px]"
            >
              {creatingSubscription ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processando...
                </>
              ) : (
                <>
                  Continuar para Pagamento
                  <ArrowRight className="h-4 w-4 ml-2" />
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Componente Label auxiliar
function Label({ children, className }: { children: React.ReactNode; className?: string }) {
  return <label className={`text-sm font-medium ${className || ''}`}>{children}</label>;
}


