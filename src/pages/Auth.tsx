import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Eye, EyeOff, Store, TrendingUp, Users, Shield, Sparkles, ArrowRight } from "lucide-react";

const Auth = () => {
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const signinFormRef = useRef<HTMLFormElement>(null);
  const adminFormRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    // Check if user is already logged in
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        navigate("/pdv");
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

      // Block blocked users
      if (profile?.status === 'blocked') {
        await supabase.auth.signOut();
        toast.error('Acesso negado. Sua conta está bloqueada.');
        return;
      }

      // Verificar se trial expirou (apenas para usuários não-admin)
      if (profile && !profile.is_admin && profile.subscription_type === 'trial' && profile.trial_end_date) {
        const trialEnd = new Date(profile.trial_end_date);
        const now = new Date();
        
        if (now > trialEnd && profile.status === 'active') {
          // Bloquear usuário automaticamente
          await supabase
            .from('profiles')
            .update({ status: 'blocked' })
            .eq('user_id', authData.user.id);
          
          await supabase.auth.signOut();
          toast.error('Seu período de teste expirou. Entre em contato para converter para assinatura mensal.');
          return;
        }
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
    <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-background flex">
      {/* Seção de Boas-vindas */}
      <div className="hidden lg:flex lg:w-1/2 p-12 flex-col justify-center relative overflow-hidden">
        {/* Decoração de fundo */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-20 left-20 w-72 h-72 bg-primary rounded-full blur-3xl"></div>
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-primary rounded-full blur-3xl"></div>
        </div>
        
        <div className="relative z-10 space-y-8">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-primary/20 rounded-xl backdrop-blur-sm">
                <Sparkles className="h-8 w-8 text-primary" />
              </div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                burguer.IA
              </h1>
            </div>
            <h2 className="text-3xl font-bold text-foreground">
              Bem-vindo de volta!
            </h2>
            <p className="text-lg text-muted-foreground max-w-md">
              Gerencie seu estabelecimento de forma inteligente e eficiente com nossa plataforma completa de gestão.
            </p>
          </div>

          <div className="space-y-6 pt-8">
            <div className="flex items-start gap-4 group">
              <div className="p-2 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors">
                <Store className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-1">Gestão Completa</h3>
                <p className="text-sm text-muted-foreground">
                  Controle total sobre produtos, pedidos, clientes e muito mais em um só lugar.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4 group">
              <div className="p-2 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors">
                <TrendingUp className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-1">Relatórios Inteligentes</h3>
                <p className="text-sm text-muted-foreground">
                  Acompanhe suas vendas, custos e desempenho com dashboards em tempo real.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4 group">
              <div className="p-2 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-1">Equipe Integrada</h3>
                <p className="text-sm text-muted-foreground">
                  Gerencie sua equipe com diferentes níveis de acesso e permissões.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4 group">
              <div className="p-2 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors">
                <Shield className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-1">Seguro e Confiável</h3>
                <p className="text-sm text-muted-foreground">
                  Seus dados protegidos com criptografia de ponta e backup automático.
                </p>
              </div>
            </div>
          </div>

          <div className="pt-8 border-t border-primary/20">
            <p className="text-sm text-muted-foreground">
              Transforme a gestão do seu negócio com tecnologia de ponta
            </p>
          </div>
        </div>
      </div>

      {/* Seção de Login */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-4 lg:p-12">
        <Card className="w-full max-w-md shadow-xl border-2">
          <CardHeader className="text-center space-y-2 pb-6">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Sparkles className="h-6 w-6 text-primary" />
              <div className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                burguer.IA
              </div>
            </div>
            <CardTitle className="text-2xl">Acesse sua conta</CardTitle>
            <CardDescription className="text-base">
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
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input 
                      id="email" 
                      name="email" 
                      type="email" 
                      placeholder="seu@email.com"
                      required 
                      className="h-11"
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
                  <div className="space-y-2">
                    <Label htmlFor="password">Senha</Label>
                    <div className="relative">
                      <Input 
                        id="password" 
                        name="password" 
                        type={showPassword ? "text" : "password"}
                        placeholder="Sua senha"
                        required 
                        className="h-11 pr-10"
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
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => setShowPassword(!showPassword)}
                        tabIndex={-1}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                  <Button type="submit" className="w-full h-11 text-base font-semibold" disabled={loading}>
                    {loading ? (
                      <span className="flex items-center gap-2">
                        <span className="animate-spin">⏳</span>
                        Entrando...
                      </span>
                    ) : (
                      <span className="flex items-center gap-2 justify-center">
                        Entrar
                        <ArrowRight className="h-4 w-4" />
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
                  <div className="text-center mb-4 p-3 bg-primary/5 rounded-lg border border-primary/20">
                    <p className="text-sm font-medium text-foreground">Login de Administrador do Sistema</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="adminEmail">Email Admin</Label>
                    <Input 
                      id="adminEmail" 
                      name="adminEmail" 
                      type="email" 
                      placeholder="admin@burguer-ia.com"
                      required 
                      className="h-11"
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
                  <div className="space-y-2">
                    <Label htmlFor="adminPassword">Senha Admin</Label>
                    <div className="relative">
                      <Input 
                        id="adminPassword" 
                        name="adminPassword" 
                        type={showPassword ? "text" : "password"}
                        placeholder="Senha do administrador"
                        required 
                        className="h-11 pr-10"
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
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => setShowPassword(!showPassword)}
                        tabIndex={-1}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                  <Button type="submit" className="w-full h-11 text-base font-semibold" disabled={loading}>
                    {loading ? (
                      <span className="flex items-center gap-2">
                        <span className="animate-spin">⏳</span>
                        Entrando...
                      </span>
                    ) : (
                      <span className="flex items-center gap-2 justify-center">
                        Entrar como Admin
                        <ArrowRight className="h-4 w-4" />
                      </span>
                    )}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
            
            <div className="mt-6 text-center">
              <Button variant="ghost" onClick={() => navigate("/")} className="text-sm">
                Voltar ao site
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Auth;