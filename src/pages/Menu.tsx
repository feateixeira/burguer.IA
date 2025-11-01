import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Menu as MenuIcon, Lock, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Sidebar from "@/components/Sidebar";
import { useSidebarWidth } from "@/hooks/useSidebarWidth";

const Menu = () => {
  const [loading, setLoading] = useState(true);
  const [isNaBrasa, setIsNaBrasa] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const navigate = useNavigate();
  const sidebarWidth = useSidebarWidth();
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const checkDesktop = () => setIsDesktop(window.innerWidth >= 1024);
    checkDesktop();
    window.addEventListener('resize', checkDesktop);
    return () => window.removeEventListener('resize', checkDesktop);
  }, []);

  useEffect(() => {
    checkAccess();
  }, []);

  const checkAccess = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/");
        return;
      }

      setUserEmail(session.user.email || "");

      // Verifica se é admin do sistema
      const userIsSystemAdmin = session.user.email === 'fellipe_1693@outlook.com';

      // Load user profile e establishment
      const { data: profileData } = await supabase
        .from("profiles")
        .select("establishment_id")
        .eq("user_id", session.user.id)
        .single();

      if (profileData?.establishment_id) {
        const { data: establishmentData } = await supabase
          .from("establishments")
          .select("name")
          .eq("id", profileData.establishment_id)
          .single();

        if (establishmentData) {
          // Verifica se é Na Brasa (somente se não for admin do sistema)
          if (!userIsSystemAdmin) {
            const establishmentName = establishmentData.name?.toLowerCase() || '';
            const isNaBrasaUser = establishmentName.includes('na brasa') || 
                                  establishmentName.includes('nabrasa') ||
                                  establishmentName === 'hamburgueria na brasa';
            setIsNaBrasa(isNaBrasaUser);
          } else {
            setIsNaBrasa(false);
          }
        }
      }
    } catch (error) {
      console.error("Error checking access:", error);
      toast.error("Erro ao verificar acesso");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Sidebar />
        <main 
          className="transition-all duration-300 ease-in-out"
          style={{
            marginLeft: isDesktop ? `${sidebarWidth}px` : '0px',
            padding: '1.5rem',
            minHeight: '100vh',
            height: '100vh',
            overflowY: 'auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <div className="text-center">
            <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
            <p className="mt-4 text-muted-foreground">Carregando...</p>
          </div>
        </main>
      </div>
    );
  }

  // Verifica se deve desativar funcionalidade (Na Brasa ou admin do sistema)
  const userIsSystemAdmin = userEmail === 'fellipe_1693@outlook.com';
  const isDisabled = isNaBrasa || userIsSystemAdmin;

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      
      <main 
        className="space-y-6 transition-all duration-300 ease-in-out"
        style={{
          marginLeft: isDesktop ? `${sidebarWidth}px` : '0px',
          padding: '1.5rem',
          minHeight: '100vh',
          height: '100vh',
          overflowY: 'auto'
        }}
      >
        <div className="w-full">
          <h1 className="text-3xl font-bold text-foreground mb-6">Cardápio Online</h1>
          
          <p className="text-muted-foreground mb-6">
            Configure e gerencie seu cardápio digital para seus clientes.
          </p>

          <Card className={isDisabled ? "opacity-60 pointer-events-none" : ""}>
            <CardHeader>
              {isDisabled ? (
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-lg bg-muted">
                    <Lock className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <div>
                    <CardTitle>Funcionalidade Desativada</CardTitle>
                    <CardDescription className="mt-1">
                      Esta funcionalidade não está disponível para seu estabelecimento no momento.
                    </CardDescription>
                  </div>
                </div>
              ) : (
                <>
                  <CardTitle>Cardápio Online</CardTitle>
                  <CardDescription>
                    Gerencie seu cardápio digital e receba pedidos online
                  </CardDescription>
                </>
              )}
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="p-6 border-2 border-dashed rounded-lg text-center">
                  <MenuIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    {isDisabled 
                      ? "Esta funcionalidade não está disponível para seu estabelecimento no momento."
                      : "Esta funcionalidade está em desenvolvimento e estará disponível em breve."
                    }
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">
                    {isDisabled 
                      ? "O sistema de cardápio online permitirá que você configure seu cardápio digital, personalize categorias e produtos, gere um link público para compartilhamento e receba pedidos diretamente através do cardápio online."
                      : "Em breve você poderá configurar seu cardápio digital, personalizar categorias e produtos, gerar um link público para compartilhamento e receber pedidos diretamente através do cardápio online."
                    }
                  </p>
                </div>
                <div className="flex justify-start">
                  <Button 
                    onClick={() => navigate("/dashboard")} 
                    variant="outline"
                    disabled={isDisabled}
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Voltar ao Dashboard
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Menu;

