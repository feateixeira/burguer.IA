import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Loader2, Send, Sparkles, Brain, TrendingUp, Package, Clock, Settings } from "lucide-react";
import { Link } from "react-router-dom";
import Sidebar from "@/components/Sidebar";
import { useSidebarWidth } from "@/hooks/useSidebarWidth";
import { usePlanAccess } from "@/hooks/usePlanAccess";

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const Assistant = () => {
  const navigate = useNavigate();
  const sidebarWidth = useSidebarWidth();
  const planAccess = usePlanAccess();
  const [checkingPlan, setCheckingPlan] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [hasInitialized, setHasInitialized] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);


  useEffect(() => {
    // Scroll to bottom when messages change
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current;
      scrollContainer.scrollTop = scrollContainer.scrollHeight;
    }
  }, [messages]);

  const scrollToBottom = () => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current;
      scrollContainer.scrollTop = scrollContainer.scrollHeight;
    }
  };

  const checkGoldAccess = async () => {
    try {
      if (planAccess.loading) return;

      // Verificar acesso usando o hook
      if (!planAccess.hasAIAccess) {
        toast.error("Esta funcionalidade requer Plano Gold ou Premium");
        navigate("/dashboard");
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }

      const { data: profile, error } = await supabase
        .from("profiles")
        .select("establishment_id")
        .eq("user_id", session.user.id)
        .single();

      if (error || !profile) {
        toast.error("Erro ao carregar perfil");
        navigate("/dashboard");
        return;
      }

      const profileData = profile as unknown as { establishment_id: string };
      setTenantId(profileData.establishment_id);
      setCheckingPlan(false);
      setHasInitialized(true);

      // Add welcome message apenas se ainda não foi inicializado
      if (!hasInitialized) {
        const welcomeMessage = planAccess.isTrial
          ? 'Olá! Sou seu Assistente de Negócios IA. ⚠️ Você está em período de teste. Para continuar usando após o teste, contrate o Plano Premium. Como posso ajudar hoje?'
          : 'Olá! Sou seu Assistente de Negócios IA. Posso ajudar você a entender suas vendas, produtos mais lucrativos, horários de pico e muito mais. Como posso ajudar hoje?';

        setMessages([{
          id: 'welcome',
          role: 'assistant',
          content: welcomeMessage,
          timestamp: new Date()
        }]);
      }
    } catch (error) {
      toast.error("Erro ao verificar acesso");
      navigate("/dashboard");
    }
  };

  useEffect(() => {
    // Só verificar se:
    // 1. O loading terminou E ainda não temos tenantId (primeira vez)
    // 2. OU se já inicializou mas perdeu o tenantId (caso raro)
    if (!planAccess.loading && !tenantId) {
      checkGoldAccess();
    }
    // Se já temos tenantId, não fazer nada (evita re-verificações desnecessárias)
  }, [planAccess.loading, planAccess.hasAIAccess, tenantId]);

  const sendMessage = async () => {
    if (!inputMessage.trim() || sending || !tenantId) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputMessage.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage("");
    setSending(true);

    // Add thinking message
    const thinkingId = 'thinking-' + Date.now();
    setMessages(prev => [...prev, {
      id: thinkingId,
      role: 'assistant',
      content: 'IA está analisando seus dados...',
      timestamp: new Date()
    }]);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("Sessão não encontrada. Por favor, faça login novamente.");
      }

      // Use supabase.functions.invoke() como outras funções do projeto
      // O supabase.functions.invoke() automaticamente adiciona o token de autenticação
      const response = await supabase.functions.invoke('business-assistant', {
        body: {
          message: userMessage.content
        }
      });

      // Verificar se há erro na resposta
      if (response.error) {
        // Se a função não estiver disponível, usar fallback local
        const errorMsg = response.error.message || '';
        if (errorMsg.includes('403') || errorMsg.includes('Forbidden') || errorMsg.includes('non-2xx') || errorMsg.includes('Function not found')) {
          // Usar fallback local com dados do dashboard
          const fallbackResponse = await getLocalFallbackResponse(userMessage.content, tenantId);
          setMessages(prev => {
            const filtered = prev.filter(m => m.id !== thinkingId);
            return [...filtered, {
              id: Date.now().toString(),
              role: 'assistant',
              content: fallbackResponse,
              timestamp: new Date()
            }];
          });
          setSending(false);
          return;
        }
        
        const errorMessage = response.error.message || 
                           (response.data?.error) || 
                           'Erro ao comunicar com o servidor';
        throw new Error(errorMessage);
      }

      const data = response.data;
      
      // Se a resposta contém um erro, tratar como erro
      if (data?.error) {
        // Se houver reply, usar o reply como mensagem de erro
        const errorMessage = data.reply || data.error;
        throw new Error(errorMessage);
      }
      
      if (!data || !data.reply) {
        throw new Error('Resposta inválida do servidor');
      }
      
      // Remove thinking message and add response
      setMessages(prev => {
        const filtered = prev.filter(m => m.id !== thinkingId);
        return [...filtered, {
          id: Date.now().toString(),
          role: 'assistant',
          content: data.reply,
          timestamp: new Date()
        }];
      });
    } catch (error: any) {
      // Tentar fallback local antes de mostrar erro
      try {
        const fallbackResponse = await getLocalFallbackResponse(userMessage.content, tenantId);
        setMessages(prev => {
          const filtered = prev.filter(m => m.id !== thinkingId);
          return [...filtered, {
            id: Date.now().toString(),
            role: 'assistant',
            content: fallbackResponse,
            timestamp: new Date()
          }];
        });
      } catch (fallbackError) {
        // Se o fallback também falhar, mostrar mensagem amigável
        const errorMessage = 'Desculpe, não consegui processar sua solicitação no momento. Por favor, tente novamente em alguns instantes.';
        setMessages(prev => {
          const filtered = prev.filter(m => m.id !== thinkingId);
          return [...filtered, {
            id: Date.now().toString(),
            role: 'assistant',
            content: errorMessage,
            timestamp: new Date()
          }];
        });
        toast.error('Erro ao processar solicitação');
      }
    } finally {
      setSending(false);
    }
  };

  // Função de fallback local que usa dados do dashboard
  const getLocalFallbackResponse = async (message: string, establishmentId: string): Promise<string> => {
    const msgLower = message.toLowerCase();
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        return 'Por favor, faça login novamente para acessar seus dados.';
      }

      const now = new Date();
      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);
      
      // Buscar dados básicos
      const { data: todayOrders } = await supabase
        .from('orders')
        .select('id, total_amount, created_at, status')
        .eq('establishment_id', establishmentId)
        .gte('created_at', todayStart.toISOString())
        .lte('created_at', now.toISOString());

      const { data: weekOrders } = await supabase
        .from('orders')
        .select('id, total_amount, created_at, status')
        .eq('establishment_id', establishmentId)
        .gte('created_at', new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString());

      const { data: monthOrders } = await supabase
        .from('orders')
        .select('id, total_amount, created_at, status')
        .eq('establishment_id', establishmentId)
        .gte('created_at', new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString());

      const todayOrdersArray = todayOrders || [];
      const weekOrdersArray = weekOrders || [];
      const monthOrdersArray = monthOrders || [];

      // Calcular totais
      const todayRevenue = todayOrdersArray.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);
      const weekRevenue = weekOrdersArray.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);
      const monthRevenue = monthOrdersArray.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);
      
      const todayCount = todayOrdersArray.length;
      const weekCount = weekOrdersArray.length;
      const monthCount = monthOrdersArray.length;

      const todayTicketAvg = todayCount > 0 ? todayRevenue / todayCount : 0;
      const weekTicketAvg = weekCount > 0 ? weekRevenue / weekCount : 0;

      // Análise de horários de pico (apenas horários que já passaram hoje)
      const hourlySales = new Map<number, { orders: number; revenue: number }>();
      const currentHourBrazil = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' })).getHours();
      
      todayOrdersArray.forEach(order => {
        const orderDate = new Date(order.created_at);
        const brazilHourStr = orderDate.toLocaleString('pt-BR', { 
          timeZone: 'America/Sao_Paulo', 
          hour: '2-digit', 
          hour12: false 
        });
        const brazilHour = parseInt(brazilHourStr, 10);
        
        if (brazilHour <= currentHourBrazil) {
          const current = hourlySales.get(brazilHour) || { orders: 0, revenue: 0 };
          hourlySales.set(brazilHour, {
            orders: current.orders + 1,
            revenue: current.revenue + (Number(order.total_amount) || 0)
          });
        }
      });

      const topHours = Array.from(hourlySales.entries())
        .map(([hour, data]) => ({ hour, hourFormatted: `${hour.toString().padStart(2, '0')}:00`, ...data }))
        .filter(h => h.hour <= currentHourBrazil && h.orders > 0)
        .sort((a, b) => b.orders - a.orders)
        .slice(0, 5)
        .map(h => h.hourFormatted);

      // Respostas baseadas em palavras-chave
      if (msgLower.includes('hoje') || msgLower.includes('vendas hoje')) {
        return `📊 **Vendas de Hoje**\n\n` +
               `💰 Faturamento: R$ ${todayRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n` +
               `🛒 Pedidos: ${todayCount}\n` +
               `📈 Ticket Médio: R$ ${todayTicketAvg.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n\n` +
               (topHours.length > 0 
                 ? `⏰ Horários de pico (até agora): ${topHours.join(', ')}\n\n` 
                 : '⏰ Ainda não há dados suficientes de horários de pico hoje.\n\n') +
               `💡 Dica: Compare com a semana passada para identificar tendências!`;
      }

      if (msgLower.includes('semana') || msgLower.includes('7 dias')) {
        return `📊 **Vendas da Semana**\n\n` +
               `💰 Faturamento: R$ ${weekRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n` +
               `🛒 Pedidos: ${weekCount}\n` +
               `📈 Ticket Médio: R$ ${weekTicketAvg.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n\n` +
               `💡 Compare com o mês para ver a evolução!`;
      }

      if (msgLower.includes('mês') || msgLower.includes('30 dias')) {
        return `📊 **Vendas do Mês**\n\n` +
               `💰 Faturamento: R$ ${monthRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n` +
               `🛒 Pedidos: ${monthCount}\n` +
               `📈 Média diária: R$ ${(monthRevenue / 30).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n\n` +
               `💡 Analise os produtos mais vendidos para otimizar seu cardápio!`;
      }

      if (msgLower.includes('pico') || msgLower.includes('horário')) {
        if (topHours.length > 0) {
          return `⏰ **Horários de Pico de Hoje**\n\n` +
                 `Os horários com mais pedidos até agora são:\n${topHours.map((h, i) => `${i + 1}. ${h}`).join('\n')}\n\n` +
                 `💡 Considere aumentar a equipe ou oferecer promoções durante esses períodos!`;
        } else {
          return `⏰ **Horários de Pico**\n\n` +
                 `Ainda não há dados suficientes de hoje para identificar horários de pico.\n\n` +
                 `💡 Os dados serão atualizados conforme os pedidos chegarem!`;
        }
      }

      if (msgLower.includes('ticket') || msgLower.includes('médio')) {
        return `📈 **Ticket Médio**\n\n` +
               `Hoje: R$ ${todayTicketAvg.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n` +
               `Semana: R$ ${weekTicketAvg.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n\n` +
               `💡 Para aumentar o ticket médio, considere:\n` +
               `• Sugerir combos e adicionais\n` +
               `• Criar promoções para pedidos acima de determinado valor\n` +
               `• Treinar a equipe para sugerir produtos complementares`;
      }

      // Resposta genérica
      return `📊 **Resumo das Vendas**\n\n` +
             `**Hoje:**\n` +
             `💰 R$ ${todayRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} | 🛒 ${todayCount} pedidos\n\n` +
             `**Semana:**\n` +
             `💰 R$ ${weekRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} | 🛒 ${weekCount} pedidos\n\n` +
             `**Mês:**\n` +
             `💰 R$ ${monthRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} | 🛒 ${monthCount} pedidos\n\n` +
             `💡 Faça perguntas específicas como:\n` +
             `• "Como estão minhas vendas hoje?"\n` +
             `• "Quais são meus horários de pico?"\n` +
             `• "Qual é meu ticket médio?"`;
    } catch (error) {
      return 'Desculpe, não consegui acessar seus dados no momento. Por favor, tente novamente em alguns instantes.';
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const exampleQuestions = [
    "Como estão minhas vendas hoje?",
    "Qual é meu produto mais lucrativo?",
    "Crie uma promoção pro horário fraco de hoje à noite.",
    "Quais produtos têm margem baixa?",
    "Quais são meus horários de pico?",
    "Como posso aumentar meu ticket médio?"
  ];

  // Só mostrar loader se realmente está verificando E ainda não tem tenantId
  // Se já temos tenantId, renderizar normalmente (evita "piscar" ao navegar)
  if (checkingPlan && !tenantId) {
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
        <div className="container mx-auto p-4 max-w-6xl">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Brain className="h-6 w-6 text-primary" />
            <h1 className="text-3xl font-bold">Assistente de Negócios IA</h1>
            <Badge variant="secondary" className="ml-2">Gold</Badge>
          </div>
          <Link to="/gold/assistant/settings">
            <Button variant="outline" size="sm">
              <Settings className="h-4 w-4 mr-2" />
              Configurações
            </Button>
          </Link>
        </div>
        <p className="text-muted-foreground">
          Converse com a IA sobre suas vendas, produtos e estratégias de negócio
        </p>
      </div>

      {/* Example Questions */}
      <div className="mb-4">
        <p className="text-sm font-medium mb-2">Perguntas de exemplo:</p>
        <div className="flex flex-wrap gap-2">
          {exampleQuestions.map((question, idx) => (
            <Button
              key={idx}
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => {
                setInputMessage(question);
                setTimeout(() => sendMessage(), 100);
              }}
              disabled={sending}
            >
              {question}
            </Button>
          ))}
        </div>
      </div>

      {/* Chat Container */}
      <Card className="h-[600px] flex flex-col overflow-hidden">
        <CardHeader className="border-b flex-shrink-0">
          <CardTitle className="text-lg">Conversa</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 p-0 flex flex-col min-h-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4" ref={scrollAreaRef}>
            <div className="space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${
                    message.role === 'user' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg p-3 ${
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                    }`}
                    style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}
                  >
                    <p className="text-sm whitespace-pre-wrap" style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>{message.content}</p>
                    <p className={`text-xs mt-1 ${
                      message.role === 'user' 
                        ? 'text-primary-foreground/70' 
                        : 'text-muted-foreground'
                    }`}>
                      {message.timestamp.toLocaleTimeString('pt-BR', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          </div>
          <div className="border-t p-4 flex-shrink-0">
            <div className="flex gap-2">
              <Input
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Pergunte sobre suas vendas, produtos e estratégias..."
                disabled={sending}
                className="flex-1"
              />
              <Button
                onClick={sendMessage}
                disabled={!inputMessage.trim() || sending}
              >
                {sending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
        </div>
      </div>
    </div>
  );
};

export default Assistant;

