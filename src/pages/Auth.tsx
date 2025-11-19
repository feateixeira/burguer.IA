import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Eye, EyeOff, Store, TrendingUp, Users, Shield, Sparkles, ArrowRight, Brain, Zap, Cpu, Network } from "lucide-react";
import AuthHeader from "@/components/AuthHeader";
import { TrialExpiredModal } from "@/components/TrialExpiredModal";

const Auth = () => {
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [showTrialExpiredModal, setShowTrialExpiredModal] = useState(false);
  const navigate = useNavigate();
  const signinFormRef = useRef<HTMLFormElement>(null);
  const adminFormRef = useRef<HTMLFormElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Rastrear posição do mouse para efeitos interativos
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  useEffect(() => {
    // Check if user is already logged in
    // Adicionar delay para evitar redirecionamento prematuro após logout
    const checkAuth = async () => {
      // Aguardar um pouco para garantir que logout foi processado
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const { data: { session }, error } = await supabase.auth.getSession();
      
      // Verificar se há sessão válida (não apenas se existe, mas se é válida)
      if (session && !error) {
        // Verificar se a sessão não expirou
        const now = Math.floor(Date.now() / 1000);
        if (session.expires_at && session.expires_at > now) {
          navigate("/pdv");
        } else {
          // Sessão expirada, fazer logout silencioso
          await supabase.auth.signOut();
        }
      }
    };
    checkAuth();
  }, [navigate]);

  const handleSignUp = async (formData: FormData) => {
    setLoading(true);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const name = formData.get("name") as string;
    const establishmentName = formData.get("establishmentName") as string;

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/pdv`,
          data: {
            name,
            establishment_name: establishmentName
          }
        }
      });

      if (error) throw error;

      if (data.user) {
        toast.success("Cadastro realizado! Verifique seu email para confirmar a conta.");
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async (formData: FormData) => {
    setLoading(true);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    try {
      const { data: authData, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        // Mensagens mais amigáveis para diferentes tipos de erro
        // PRIMEIRO verificar se é erro de credenciais (mais comum)
        if (error.message?.includes('Invalid login credentials') || 
            error.message?.includes('Invalid credentials') ||
            error.message?.includes('Email not confirmed') ||
            (error.status === 400 && error.message?.toLowerCase().includes('invalid'))) {
          throw new Error('Email ou senha incorretos. Verifique suas credenciais e tente novamente.');
        }
        
        // DEPOIS verificar se é erro de API Key (menos comum, apenas se não for erro de credenciais)
        if (error.message?.includes('Invalid API key') || 
            (error.status === 401 && error.message?.includes('API') && !error.message?.includes('credentials')) ||
            (error.name === 'AuthApiError' && error.message?.includes('API key'))) {
            throw new Error(
            '❌ Erro de configuração: API Key inválida ou não configurada.\n\n' +
            '📝 Como corrigir:\n' +
            '1. Verifique se o arquivo .env existe na raiz do projeto\n' +
            '2. Confirme que VITE_SUPABASE_ANON_KEY está configurada\n' +
            '3. Use a chave "anon public" (NÃO a "service_role")\n' +
            '4. Reinicie o servidor após alterar o .env\n\n' +
            '💡 Obtenha a chave em: Supabase Dashboard → Settings → API → anon public'
          );
        } else if (error.message?.includes('Email not confirmed')) {
          throw new Error('Por favor, confirme seu email antes de fazer login.');
        } else {
          throw error;
        }
      }

      if (!authData.session || !authData.user) {
        throw new Error('Erro ao criar sessão');
      }

      // Check user status first
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_admin, status, subscription_type, trial_end_date')
        .eq('user_id', authData.user.id)
        .single();

      // Block cancelled users
      if (profile?.status === 'cancelled') {
        await supabase.auth.signOut();
        toast.error('Acesso negado. Sua conta foi cancelada.');
        return;
      }

      // Verificar se trial expirou PRIMEIRO (antes de verificar bloqueio manual)
      // Se for trial expirado, BLOQUEAR login e mostrar modal na página de autenticação
      if (profile && !profile.is_admin && profile.subscription_type === 'trial' && profile.trial_end_date) {
        const trialEnd = new Date(profile.trial_end_date);
        const now = new Date();
        
        // Normalizar datas para comparar apenas dias
        const trialEndDateOnly = new Date(trialEnd.getFullYear(), trialEnd.getMonth(), trialEnd.getDate());
        const nowDateOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        
        if (nowDateOnly > trialEndDateOnly) {
          // Trial expirado - bloquear se ainda não estiver bloqueado
          if (profile.status === 'active') {
            await supabase
              .from('profiles')
              .update({ status: 'blocked' })
              .eq('user_id', authData.user.id);
          }
          
          // Fazer logout e mostrar modal na página de autenticação
          await supabase.auth.signOut();
          setShowTrialExpiredModal(true);
          setLoading(false);
          return;
        }
      }

      // Block blocked users (apenas se NÃO for trial expirado)
      // Se for trial expirado, já foi tratado acima
      if (profile?.status === 'blocked' && profile?.subscription_type !== 'trial') {
        await supabase.auth.signOut();
        toast.error('Acesso negado. Sua conta está bloqueada.');
        return;
      }

      // Criar/invalidar sessão (garantir apenas 1 dispositivo ativo)
      try {
        const deviceInfo = `${navigator.userAgent} - ${navigator.platform}`;
        const expiresAt = authData.session.expires_at 
          ? new Date(authData.session.expires_at * 1000).toISOString()
          : null;

        const { data: sessionId, error: sessionError } = await supabase.rpc('create_user_session', {
          p_user_id: authData.user.id,
          p_session_token: authData.session.access_token,
          p_refresh_token: authData.session.refresh_token,
          p_device_info: deviceInfo,
          p_ip_address: null,
          p_user_agent: navigator.userAgent,
          p_expires_at: expiresAt
        });

        // Erros de API key ou função não existente não devem bloquear login
        // Continuar silenciosamente
      } catch (sessionError: any) {
        // NUNCA bloquear login por erro na criação de sessão
        // Continuar silenciosamente
      }

      if (profile?.is_admin) {
        navigate("/admin");
      } else {
        navigate("/pdv");
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAdminLogin = async (formData: FormData) => {
    setLoading(true);
    const email = formData.get("adminEmail") as string;
    const password = formData.get("adminPassword") as string;

    try {
      const { data: authData, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        // Mensagens mais amigáveis para diferentes tipos de erro
        // PRIMEIRO verificar se é erro de credenciais (mais comum)
        if (error.message?.includes('Invalid login credentials') || 
            error.message?.includes('Invalid credentials') ||
            error.message?.includes('Email not confirmed') ||
            (error.status === 400 && error.message?.toLowerCase().includes('invalid'))) {
          throw new Error('Email ou senha incorretos. Verifique suas credenciais e tente novamente.');
        }
        
        // DEPOIS verificar se é erro de API Key (menos comum, apenas se não for erro de credenciais)
        if (error.message?.includes('Invalid API key') || 
            (error.status === 401 && error.message?.includes('API') && !error.message?.includes('credentials')) ||
            (error.name === 'AuthApiError' && error.message?.includes('API key'))) {
            throw new Error(
            '❌ Erro de configuração: API Key inválida ou não configurada.\n\n' +
            '📝 Como corrigir:\n' +
            '1. Verifique se o arquivo .env existe na raiz do projeto\n' +
            '2. Confirme que VITE_SUPABASE_ANON_KEY está configurada\n' +
            '3. Use a chave "anon public" (NÃO a "service_role")\n' +
            '4. Reinicie o servidor após alterar o .env\n\n' +
            '💡 Obtenha a chave em: Supabase Dashboard → Settings → API → anon public'
          );
        } else if (error.message?.includes('Email not confirmed')) {
          throw new Error('Por favor, confirme seu email antes de fazer login.');
        } else {
          // Para outros erros, mostrar mensagem amigável
          const errorMessage = error.message || 'Erro ao fazer login';
          if (errorMessage.toLowerCase().includes('email') || errorMessage.toLowerCase().includes('senha') || errorMessage.toLowerCase().includes('password')) {
            throw new Error('Email ou senha incorretos. Verifique suas credenciais e tente novamente.');
          }
          throw new Error(errorMessage);
        }
      }

      if (!authData.session || !authData.user) {
        throw new Error('Erro ao criar sessão');
      }

      // Check user status first
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_admin, status')
        .eq('user_id', authData.user.id)
        .single();

      // Block cancelled users
      if (profile?.status === 'cancelled') {
        await supabase.auth.signOut();
        toast.error('Acesso negado. Sua conta foi cancelada.');
        return;
      }

      // Block blocked users
      if (profile?.status === 'blocked') {
        await supabase.auth.signOut();
        toast.error('Acesso negado. Sua conta está bloqueada.');
        return;
      }

      // Verify admin status
      if (!profile?.is_admin) {
        await supabase.auth.signOut();
        throw new Error("Acesso negado. Usuário não é administrador.");
      }

      // Criar/invalidar sessão (garantir apenas 1 dispositivo ativo)
      try {
        const deviceInfo = `${navigator.userAgent} - ${navigator.platform}`;
        const expiresAt = authData.session.expires_at 
          ? new Date(authData.session.expires_at * 1000).toISOString()
          : null;

        const { data: sessionId, error: sessionError } = await supabase.rpc('create_user_session', {
          p_user_id: authData.user.id,
          p_session_token: authData.session.access_token,
          p_refresh_token: authData.session.refresh_token,
          p_device_info: deviceInfo,
          p_ip_address: null,
          p_user_agent: navigator.userAgent,
          p_expires_at: expiresAt
        });

        // Erros de API key ou função não existente não devem bloquear login
        // Continuar silenciosamente
      } catch (sessionError: any) {
        // NUNCA bloquear login por erro na criação de sessão
        // Continuar silenciosamente
      }

      navigate("/admin");
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      ref={containerRef}
      className="h-screen bg-gradient-to-br from-orange-50 via-white to-orange-50/50 dark:from-slate-950 dark:via-primary/10 dark:to-slate-900 flex flex-col relative overflow-hidden"
      style={{
        background: `radial-gradient(circle at ${mousePosition.x}px ${mousePosition.y}px, rgba(249, 116, 21, 0.15) 0%, transparent 50%)`
      }}
    >
      {/* Header */}
      <AuthHeader />
      
      {/* Conteúdo Principal */}
      <div className="flex-1 flex relative">
      {/* Partículas animadas de fundo */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-primary/20 animate-float"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              width: `${Math.random() * 4 + 2}px`,
              height: `${Math.random() * 4 + 2}px`,
              animationDelay: `${Math.random() * 5}s`,
              animationDuration: `${Math.random() * 3 + 2}s`,
            }}
          />
        ))}
      </div>

      {/* Grid animado de fundo */}
      <div className="absolute inset-0 opacity-10">
        <div 
          className="absolute inset-0"
          style={{
            backgroundImage: `
              linear-gradient(rgba(249, 116, 21, 0.1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(249, 116, 21, 0.1) 1px, transparent 1px)
            `,
            backgroundSize: '50px 50px',
            animation: 'grid-move 20s linear infinite',
          }}
        />
      </div>

      {/* Círculos de luz animados */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div 
          className="absolute top-20 left-20 w-96 h-96 bg-primary rounded-full blur-3xl opacity-20 animate-pulse"
          style={{
            transform: `translate(${(mousePosition.x - window.innerWidth / 2) * 0.02}px, ${(mousePosition.y - window.innerHeight / 2) * 0.02}px)`
          }}
        />
        <div 
          className="absolute bottom-20 right-20 w-[500px] h-[500px] bg-primary rounded-full blur-3xl opacity-20 animate-pulse"
          style={{
            animationDelay: '1s',
            transform: `translate(${(mousePosition.x - window.innerWidth / 2) * -0.02}px, ${(mousePosition.y - window.innerHeight / 2) * -0.02}px)`
          }}
        />
        <div 
          className="absolute top-1/2 left-1/2 w-72 h-72 bg-primary rounded-full blur-3xl opacity-10 animate-pulse"
          style={{
            animationDelay: '2s',
            transform: `translate(${(mousePosition.x - window.innerWidth / 2) * 0.01}px, ${(mousePosition.y - window.innerHeight / 2) * 0.01}px)`
          }}
        />
      </div>

      {/* Seção de Boas-vindas */}
      <div className="hidden lg:flex lg:w-1/2 pl-12 pr-8 py-6 flex-col justify-start pt-12 relative z-10 overflow-y-auto">
        <div className="relative space-y-4 animate-fade-in">
          <div className="space-y-4">
            <div className="flex items-center gap-3 group">
              <div className="relative">
                <div className="absolute inset-0 bg-primary/30 rounded-xl blur-lg group-hover:blur-xl transition-all duration-300"></div>
                <div className="relative p-3 bg-gradient-to-br from-primary/20 to-primary/10 rounded-xl backdrop-blur-sm border border-primary/30 group-hover:border-primary/50 transition-all duration-300 group-hover:scale-105">
                  <Brain className="h-8 w-8 text-primary animate-pulse" />
                </div>
              </div>
              <div>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-primary via-primary/80 to-primary/60 bg-clip-text text-transparent animate-gradient select-none cursor-default">
                  burguer.IA
                </h1>
                <p className="text-xs text-slate-600 dark:text-primary/70 font-medium mt-0.5 select-none cursor-default">Inteligência Artificial para Gestão</p>
              </div>
            </div>
            
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white leading-tight select-none cursor-default">
              Bem-vindo ao futuro da
              <span className="block bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent">
                gestão inteligente
              </span>
            </h2>
            
            <p className="text-base text-slate-700 dark:text-white/90 max-w-md leading-relaxed select-none cursor-default">
              Transforme seu estabelecimento com tecnologia de ponta, IA e automação completa.
            </p>
          </div>

          <div className="space-y-2.5 pt-3">
            <div className="group relative">
              <div className="absolute -inset-1 bg-gradient-to-r from-primary/50 to-primary/20 rounded-xl blur opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="relative flex items-start gap-3 p-3 bg-gradient-to-br from-primary/10 to-primary/5 dark:from-primary/20 dark:to-primary/10 backdrop-blur-md rounded-xl border-2 border-primary/30 dark:border-primary/40 group-hover:border-primary/60 transition-all duration-300 group-hover:bg-gradient-to-br group-hover:from-primary/15 group-hover:to-primary/10 dark:group-hover:from-primary/25 dark:group-hover:to-primary/15 shadow-lg shadow-primary/10">
                <div className="p-2 bg-primary/30 dark:bg-primary/40 rounded-lg group-hover:bg-primary/40 dark:group-hover:bg-primary/50 transition-colors group-hover:scale-110 transform duration-300">
                  <Brain className="h-5 w-5 text-primary animate-pulse" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <h3 className="font-semibold text-sm text-slate-900 dark:text-white group-hover:text-primary transition-colors select-none cursor-default">Assistente de IA</h3>
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-primary/20 text-primary border-primary/30 select-none cursor-default">
                      Novo
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-700 dark:text-white/80 leading-relaxed select-none cursor-default">
                    Converse com inteligência artificial sobre suas vendas, produtos mais lucrativos, horários de pico e receba insights automáticos para otimizar seu negócio.
                  </p>
                </div>
              </div>
            </div>

            <div className="group relative">
              <div className="absolute -inset-1 bg-gradient-to-r from-primary/50 to-primary/20 rounded-xl blur opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="relative flex items-start gap-3 p-3 bg-white/80 dark:bg-white/10 backdrop-blur-md rounded-xl border border-primary/20 dark:border-white/20 group-hover:border-primary/50 transition-all duration-300 group-hover:bg-white dark:group-hover:bg-white/15 shadow-sm">
                <div className="p-2 bg-primary/20 dark:bg-primary/30 rounded-lg group-hover:bg-primary/30 dark:group-hover:bg-primary/40 transition-colors group-hover:scale-110 transform duration-300">
                  <Store className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-sm text-slate-900 dark:text-white mb-0.5 group-hover:text-primary transition-colors select-none cursor-default">Gestão Completa</h3>
                  <p className="text-xs text-slate-700 dark:text-white/80 leading-relaxed select-none cursor-default">
                    Controle total sobre produtos, pedidos, clientes e muito mais em um só lugar.
                  </p>
                </div>
              </div>
            </div>

            <div className="group relative">
              <div className="absolute -inset-1 bg-gradient-to-r from-primary/50 to-primary/20 rounded-xl blur opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="relative flex items-start gap-3 p-3 bg-white/80 dark:bg-white/10 backdrop-blur-md rounded-xl border border-primary/20 dark:border-white/20 group-hover:border-primary/50 transition-all duration-300 group-hover:bg-white dark:group-hover:bg-white/15 shadow-sm">
                <div className="p-2 bg-primary/20 dark:bg-primary/30 rounded-lg group-hover:bg-primary/30 dark:group-hover:bg-primary/40 transition-colors group-hover:scale-110 transform duration-300">
                  <TrendingUp className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-sm text-slate-900 dark:text-white mb-0.5 group-hover:text-primary transition-colors select-none cursor-default">Relatórios Inteligentes</h3>
                  <p className="text-xs text-slate-700 dark:text-white/80 leading-relaxed select-none cursor-default">
                    Acompanhe suas vendas, custos e desempenho com dashboards em tempo real.
                  </p>
                </div>
              </div>
            </div>

            <div className="group relative">
              <div className="absolute -inset-1 bg-gradient-to-r from-primary/50 to-primary/20 rounded-xl blur opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="relative flex items-start gap-3 p-3 bg-white/80 dark:bg-white/10 backdrop-blur-md rounded-xl border border-primary/20 dark:border-white/20 group-hover:border-primary/50 transition-all duration-300 group-hover:bg-white dark:group-hover:bg-white/15 shadow-sm">
                <div className="p-2 bg-primary/20 dark:bg-primary/30 rounded-lg group-hover:bg-primary/30 dark:group-hover:bg-primary/40 transition-colors group-hover:scale-110 transform duration-300">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-sm text-slate-900 dark:text-white mb-0.5 group-hover:text-primary transition-colors select-none cursor-default">Equipe Integrada</h3>
                  <p className="text-xs text-slate-700 dark:text-white/80 leading-relaxed select-none cursor-default">
                    Gerencie sua equipe com diferentes níveis de acesso e permissões.
                  </p>
                </div>
              </div>
            </div>

            <div className="group relative">
              <div className="absolute -inset-1 bg-gradient-to-r from-primary/50 to-primary/20 rounded-xl blur opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="relative flex items-start gap-3 p-3 bg-white/80 dark:bg-white/10 backdrop-blur-md rounded-xl border border-primary/20 dark:border-white/20 group-hover:border-primary/50 transition-all duration-300 group-hover:bg-white dark:group-hover:bg-white/15 shadow-sm">
                <div className="p-2 bg-primary/20 dark:bg-primary/30 rounded-lg group-hover:bg-primary/30 dark:group-hover:bg-primary/40 transition-colors group-hover:scale-110 transform duration-300">
                  <Shield className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-sm text-slate-900 dark:text-white mb-0.5 group-hover:text-primary transition-colors select-none cursor-default">Seguro e Confiável</h3>
                  <p className="text-xs text-slate-700 dark:text-white/80 leading-relaxed select-none cursor-default">
                    Seus dados protegidos com criptografia de ponta e backup automático.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Elementos de tecnologia flutuantes */}
          <div className="pt-4 flex items-center gap-4">
            <div className="flex items-center gap-2 text-slate-700 dark:text-white/80 text-sm select-none cursor-default">
              <Cpu className="h-4 w-4 animate-pulse text-primary" />
              <span>IA Integrada</span>
            </div>
            <div className="flex items-center gap-2 text-slate-700 dark:text-white/80 text-sm select-none cursor-default">
              <Zap className="h-4 w-4 animate-pulse text-primary" />
              <span>Alta Performance</span>
            </div>
            <div className="flex items-center gap-2 text-slate-700 dark:text-white/80 text-sm select-none cursor-default">
              <Network className="h-4 w-4 animate-pulse text-primary" />
              <span>Cloud Native</span>
            </div>
          </div>
        </div>
      </div>

      {/* Seção de Login */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-4 lg:p-8 relative z-10">
        <div className="relative group w-full max-w-lg">
          {/* Efeito de brilho ao redor do card */}
          <div className="absolute -inset-0.5 bg-gradient-to-r from-primary via-primary/50 to-primary rounded-2xl blur-xl opacity-30 group-hover:opacity-50 transition-opacity duration-500"></div>
          
          <Card className="relative w-full shadow-2xl border-2 border-primary/30 bg-white dark:bg-slate-900">
            <CardHeader className="text-center space-y-3 pb-6 relative">
              {/* Partículas decorativas */}
              <div className="absolute top-0 right-0 w-20 h-20 bg-primary/10 rounded-full blur-2xl"></div>
              <div className="absolute bottom-0 left-0 w-16 h-16 bg-primary/10 rounded-full blur-2xl"></div>
              
              <div className="relative flex items-center justify-center gap-3 mb-3">
                <div className="relative">
                  <div className="absolute inset-0 bg-primary/30 rounded-xl blur-lg animate-pulse"></div>
                  <div className="relative p-2.5 bg-gradient-to-br from-primary/20 to-primary/10 rounded-xl">
                    <Sparkles className="h-7 w-7 text-primary animate-pulse" />
                  </div>
                </div>
                <div className="text-3xl font-bold bg-gradient-to-r from-primary via-primary/80 to-primary/60 bg-clip-text text-transparent animate-gradient select-none cursor-default">
                  burguer.IA
                </div>
              </div>
              <CardTitle className="text-2xl font-bold text-slate-900 dark:text-white select-none cursor-default">Acesse sua conta</CardTitle>
              <CardDescription className="text-base text-slate-700 dark:text-slate-300 select-none cursor-default">
                Entre para gerenciar seu estabelecimento
              </CardDescription>
            </CardHeader>
          <CardContent>
            <Tabs defaultValue="signin" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="signin">Entrar</TabsTrigger>
                <TabsTrigger value="admin">Admin</TabsTrigger>
              </TabsList>
              
              <TabsContent value="signin" className="space-y-4">
                <form 
                  ref={signinFormRef}
                  onSubmit={(e) => {
                    e.preventDefault();
                    const formData = new FormData(e.currentTarget);
                    handleSignIn(formData);
                  }} 
                  className="space-y-4"
                >
                  <div className="space-y-2 group">
                    <Label htmlFor="email" className="text-sm font-medium text-slate-900 dark:text-white">Email</Label>
                    <div className="relative">
                      <Input 
                        id="email" 
                        name="email" 
                        type="email" 
                        placeholder="seu@email.com"
                        required 
                        className="h-12 transition-all duration-300 focus:ring-2 focus:ring-primary/50 focus:border-primary group-hover:border-primary/50 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            if (signinFormRef.current) {
                              const submitButton = signinFormRef.current.querySelector('button[type="submit"]') as HTMLButtonElement;
                              if (submitButton && !submitButton.disabled) {
                                submitButton.click();
                              }
                            }
                          }
                        }}
                      />
                    </div>
                  </div>
                  <div className="space-y-2 group">
                    <Label htmlFor="password" className="text-sm font-medium text-slate-900 dark:text-white">Senha</Label>
                    <div className="relative">
                      <Input 
                        id="password" 
                        name="password" 
                        type={showPassword ? "text" : "password"}
                        placeholder="Sua senha"
                        required 
                        autoComplete="off"
                        autoSave="off"
                        data-form-type="other"
                        className="h-12 pr-12 transition-all duration-300 focus:ring-2 focus:ring-primary/50 focus:border-primary group-hover:border-primary/50 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !loading) {
                            e.preventDefault();
                            e.stopPropagation();
                            if (signinFormRef.current) {
                              const form = signinFormRef.current;
                              const formData = new FormData(form);
                              handleSignIn(formData);
                            }
                          }
                        }}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent hover:text-primary transition-colors"
                        onClick={() => setShowPassword(!showPassword)}
                        tabIndex={-1}
                      >
                        {showPassword ? (
                          <EyeOff className="h-5 w-5" />
                        ) : (
                          <Eye className="h-5 w-5" />
                        )}
                      </Button>
                    </div>
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full h-12 text-base font-semibold bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 transition-all duration-300 shadow-lg hover:shadow-xl hover:shadow-primary/25 hover:scale-[1.02] active:scale-[0.98]" 
                    disabled={loading}
                  >
                    {loading ? (
                      <span className="flex items-center gap-2">
                        <span className="animate-spin">⏳</span>
                        Entrando...
                      </span>
                    ) : (
                      <span className="flex items-center gap-2 justify-center">
                        Entrar
                        <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                      </span>
                    )}
                  </Button>
                </form>
              </TabsContent>
              
              <TabsContent value="admin" className="space-y-4">
                <form 
                  ref={adminFormRef}
                  onSubmit={(e) => {
                    e.preventDefault();
                    const formData = new FormData(e.currentTarget);
                    handleAdminLogin(formData);
                  }} 
                  className="space-y-4"
                >
                  <div className="text-center mb-4 p-4 bg-gradient-to-r from-primary/10 to-primary/5 rounded-xl border border-primary/20 relative overflow-hidden group">
                    <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    <p className="relative text-sm font-semibold text-slate-900 dark:text-white flex items-center justify-center gap-2">
                      <Shield className="h-4 w-4 text-primary" />
                      Login de Administrador do Sistema
                    </p>
                  </div>
                  <div className="space-y-2 group">
                    <Label htmlFor="adminEmail" className="text-sm font-medium text-slate-900 dark:text-white">Email Admin</Label>
                    <Input 
                      id="adminEmail" 
                      name="adminEmail" 
                      type="email" 
                      placeholder="admin@burguer-ia.com"
                      required 
                      className="h-12 transition-all duration-300 focus:ring-2 focus:ring-primary/50 focus:border-primary group-hover:border-primary/50 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          if (adminFormRef.current) {
                            const submitButton = adminFormRef.current.querySelector('button[type="submit"]') as HTMLButtonElement;
                            if (submitButton && !submitButton.disabled) {
                              submitButton.click();
                            }
                          }
                        }
                      }}
                    />
                  </div>
                  <div className="space-y-2 group">
                    <Label htmlFor="adminPassword" className="text-sm font-medium text-slate-900 dark:text-white">Senha Admin</Label>
                    <div className="relative">
                      <Input 
                        id="adminPassword" 
                        name="adminPassword" 
                        type={showPassword ? "text" : "password"}
                        placeholder="Senha do administrador"
                        required 
                        autoComplete="off"
                        autoSave="off"
                        data-form-type="other"
                        className="h-12 pr-12 transition-all duration-300 focus:ring-2 focus:ring-primary/50 focus:border-primary group-hover:border-primary/50 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !loading) {
                            e.preventDefault();
                            e.stopPropagation();
                            if (adminFormRef.current) {
                              const form = adminFormRef.current;
                              const formData = new FormData(form);
                              handleAdminLogin(formData);
                            }
                          }
                        }}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent hover:text-primary transition-colors"
                        onClick={() => setShowPassword(!showPassword)}
                        tabIndex={-1}
                      >
                        {showPassword ? (
                          <EyeOff className="h-5 w-5" />
                        ) : (
                          <Eye className="h-5 w-5" />
                        )}
                      </Button>
                    </div>
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full h-12 text-base font-semibold bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 transition-all duration-300 shadow-lg hover:shadow-xl hover:shadow-primary/25 hover:scale-[1.02] active:scale-[0.98]" 
                    disabled={loading}
                  >
                    {loading ? (
                      <span className="flex items-center gap-2">
                        <span className="animate-spin">⏳</span>
                        Entrando...
                      </span>
                    ) : (
                      <span className="flex items-center gap-2 justify-center">
                        Entrar como Admin
                        <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                      </span>
                    )}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
        </div>
      </div>
      </div>
      <TrialExpiredModal 
        open={showTrialExpiredModal} 
        onOpenChange={setShowTrialExpiredModal} 
      />
    </div>
  );
};

export default Auth;