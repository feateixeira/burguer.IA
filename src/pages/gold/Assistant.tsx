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
        // Se for erro 403, a função provavelmente não está deployada
        const errorMsg = response.error.message || '';
        if (errorMsg.includes('403') || errorMsg.includes('Forbidden') || errorMsg.includes('non-2xx')) {
          throw new Error('⚠️ A Edge Function "business-assistant" não está deployada ou não está acessível.\n\nPara resolver:\n1. Acesse o Supabase Dashboard\n2. Vá em Edge Functions\n3. Faça o deploy da função "business-assistant"\n4. Configure a secret OPENAI_API_KEY\n\nOu use o CLI:\nsupabase functions deploy business-assistant');
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
      const errorMessage = error.message || 'Desculpe, ocorreu um erro. Tente novamente.';
      
      // Remove thinking message and add error
      setMessages(prev => {
        const filtered = prev.filter(m => m.id !== thinkingId);
        return [...filtered, {
          id: Date.now().toString(),
          role: 'assistant',
          content: `❌ ${errorMessage}\n\nPor favor, verifique:\n- Se você tem Plano Gold ou Premium\n- Se a Edge Function está deployada\n- Se a chave OPENAI_API_KEY está configurada`,
          timestamp: new Date()
        }];
      });
      
      toast.error(`Erro: ${errorMessage}`);
    } finally {
      setSending(false);
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

