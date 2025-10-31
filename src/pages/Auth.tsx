import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";

const Auth = () => {
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Check if user is already logged in
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        navigate("/dashboard");
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
          emailRedirectTo: `${window.location.origin}/dashboard`,
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

      if (error) throw error;

      // Check user status first
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_admin, status')
        .eq('user_id', authData.user?.id)
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

      if (profile?.is_admin) {
        navigate("/admin");
      } else {
        navigate("/dashboard");
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

      if (error) throw error;

      // Check user status first
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_admin, status')
        .eq('user_id', authData.user?.id)
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

      navigate("/admin");
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-primary/5 to-transparent flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="text-2xl font-bold bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent mb-2">
            burguer.IA
          </div>
          <CardTitle>Acesse sua conta</CardTitle>
          <CardDescription>
            Gerencie seu estabelecimento com nossa plataforma completa
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="signin" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Entrar</TabsTrigger>
              <TabsTrigger value="admin">Admin</TabsTrigger>
            </TabsList>
            
            <TabsContent value="signin">
              <form onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                handleSignIn(formData);
              }} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input 
                    id="email" 
                    name="email" 
                    type="email" 
                    placeholder="seu@email.com"
                    required 
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
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Entrando..." : "Entrar"}
                </Button>
              </form>
            </TabsContent>
            
            <TabsContent value="admin">
              <form onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                handleAdminLogin(formData);
              }} className="space-y-4">
                <div className="text-center mb-4">
                  <p className="text-sm text-muted-foreground">Login de Administrador do Sistema</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="adminEmail">Email Admin</Label>
                  <Input 
                    id="adminEmail" 
                    name="adminEmail" 
                    type="email" 
                    placeholder="admin@burguer-ia.com"
                    required 
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
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Entrando..." : "Entrar como Admin"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
          
          <div className="mt-4 text-center">
            <Button variant="ghost" onClick={() => navigate("/")} className="text-sm">
              Voltar ao site
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;