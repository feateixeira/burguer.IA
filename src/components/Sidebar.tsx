import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  BarChart3, Package, Receipt, Settings, Users, Menu, X, LogOut, Calculator, ChevronLeft, ChevronRight, Truck, Smartphone, Tag, ShoppingBag, UtensilsCrossed
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AdminStatusIndicator } from "./AdminStatusIndicator";
import { useTeamUser } from "@/components/TeamUserProvider";

const items = [
  { name: "Dashboard", href: "/dashboard", icon: BarChart3, show: ["master", "admin"] },
  { name: "PDV", href: "/pdv", icon: Receipt, show: ["master", "admin", "atendente"] },
  { name: "Pedidos", href: "/orders", icon: ShoppingBag, show: ["master", "admin", "atendente", "cozinha"] },
  { name: "Clientes", href: "/customers", icon: Users, show: ["master", "admin", "atendente"] },
  { name: "Promoções", href: "/promotions", icon: Tag, show: ["master", "admin"] },
  { name: "Produtos", href: "/products", icon: Package, show: ["master", "admin", "atendente"] },
  { name: "Cardápio Online", href: "/menu", icon: UtensilsCrossed, show: ["master", "admin"], excludeAdmin: true },
  { name: "Custos", href: "/costs", icon: Calculator, show: ["master", "admin"] },
  { name: "Fornecedores", href: "/suppliers", icon: Truck, show: ["master", "admin"] },
  { name: "Apps", href: "/apps", icon: Smartphone, show: ["master", "admin"] },
  { name: "Configurações", href: "/settings", icon: Settings, show: ["master", "admin"] },
];

const Sidebar = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const saved = localStorage.getItem("sidebar_collapsed");
    return saved === "true";
  });
  const [establishmentName, setEstablishmentName] = useState<string>("burguer.IA");
  const [userEmail, setUserEmail] = useState<string>("");
  const [isNaBrasa, setIsNaBrasa] = useState(false);
  const location = useLocation();
  const { teamUser, resetTeamUser } = useTeamUser();

  useEffect(() => {
    const loadEstablishmentName = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        setUserEmail(session.user.email || "");

        const { data: profile } = await supabase
          .from("profiles")
          .select("establishment_id")
          .eq("user_id", session.user.id)
          .single();

        if (profile?.establishment_id) {
          const { data: establishment } = await supabase
            .from("establishments")
            .select("name")
            .eq("id", profile.establishment_id)
            .single();

          if (establishment?.name) {
            setEstablishmentName(establishment.name);
            
            // Verifica se é Na Brasa (somente se não for admin do sistema)
            const userIsSystemAdmin = session.user.email === 'fellipe_1693@outlook.com';
            if (!userIsSystemAdmin) {
              const establishmentNameLower = establishment.name?.toLowerCase() || '';
              const isNaBrasaUser = establishmentNameLower.includes('na brasa') || 
                                    establishmentNameLower.includes('nabrasa') ||
                                    establishmentNameLower === 'hamburgueria na brasa';
              setIsNaBrasa(isNaBrasaUser);
            } else {
              setIsNaBrasa(false);
            }
          }
        }
      } catch (error) {
        console.error("Error loading establishment name:", error);
      }
    };

    loadEstablishmentName();
  }, []);

  useEffect(() => {
    localStorage.setItem("sidebar_collapsed", isCollapsed.toString());
  }, [isCollapsed]);

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      toast.success("Logout realizado com sucesso");
      window.location.href = "/";
    } catch (error) {
      console.error("Logout error:", error);
      toast.error("Erro ao fazer logout");
    }
  };

  // Filtra itens baseado no role do teamUser e regras específicas
  // Se não há teamUser, não mostra itens (pois o modal de seleção deve aparecer)
  const visibleItems = teamUser 
    ? items.filter(it => {
        // Verifica se o role permite ver o item
        if (!it.show.includes(teamUser.role)) return false;
        
        // Se o item tem excludeNaBrasa, não mostrar para Na Brasa
        if (it.excludeNaBrasa && isNaBrasa) return false;
        
        // Se o item tem excludeAdmin, não mostrar para admin do sistema
        if (it.excludeAdmin && userEmail === 'fellipe_1693@outlook.com') return false;
        
        return true;
      })
    : [];

  return (
    <>
      {/* Mobile menu button */}
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <Button
          variant="outline"
          size="icon"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        >
          {isMobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </Button>
      </div>

      {/* Sidebar */}
      <aside className={cn(
        "fixed top-0 left-0 bottom-0 z-40 bg-card border-r border-border transition-all duration-300 ease-in-out",
        "h-screen overflow-hidden",
        isCollapsed ? "w-16" : "w-64",
        isMobileMenuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}
      style={{ height: '100vh' }}
      >
        <div className="flex h-full flex-col overflow-hidden">
          {/* Logo and Toggle */}
          <div className="flex h-16 items-center justify-between border-b border-border px-4">
            {!isCollapsed && (
              <div className="text-xl font-bold bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent truncate">
                {establishmentName}
              </div>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="hidden lg:flex ml-auto"
            >
              {isCollapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
            </Button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1 p-2 overflow-y-auto">
            {visibleItems.length > 0 ? (
              visibleItems.map((item) => {
                const IconComponent = item.icon;
                const isActive = location.pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent",
                      isCollapsed && "justify-center gap-0"
                    )}
                    title={isCollapsed ? item.name : undefined}
                  >
                    {IconComponent && (
                      <IconComponent 
                        className={cn(
                          "h-5 w-5 flex-shrink-0",
                          !isCollapsed && "mr-0"
                        )}
                        strokeWidth={2}
                      />
                    )}
                    {!isCollapsed && <span>{item.name}</span>}
                  </Link>
                );
              })
            ) : (
              <div className="px-3 py-2 text-sm text-muted-foreground">
                Carregando usuário...
              </div>
            )}
          </nav>

          {/* Botão minimalista para trocar usuário da equipe */}
          <div className="px-2 pb-1 flex flex-col gap-1">
            <button
              onClick={resetTeamUser}
              className={cn(
                "flex items-center w-full px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors",
                isCollapsed && "justify-center"
              )}
              title="Trocar usuário"
            >
              <Users className={cn("h-5 w-5 flex-shrink-0", !isCollapsed && "mr-3")}/>
              {!isCollapsed && "Trocar Usuário"}
            </button>
          </div>

          {/* Botão logout */}
          <div className="p-2">
            <button
              onClick={handleLogout}
              className={cn(
                "flex items-center w-full px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors",
                isCollapsed && "justify-center"
              )}
              title={isCollapsed ? "Sair" : undefined}
            >
              <LogOut className={cn("h-5 w-5 flex-shrink-0", !isCollapsed && "mr-3")} />
              {!isCollapsed && "Sair"}
            </button>
          </div>

          {/* Admin Status Indicator */}
          {!isCollapsed && (
            <div className="px-2 pb-2">
              <AdminStatusIndicator />
            </div>
          )}
        </div>
      </aside>

      {/* Mobile overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
    </>
  );
};

export default Sidebar;
