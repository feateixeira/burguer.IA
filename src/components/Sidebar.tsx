import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  BarChart3, Package, Receipt, Settings, Users, Menu, X, LogOut, Calculator, ChevronLeft, ChevronRight, Truck, Smartphone, Tag, ShoppingBag, UtensilsCrossed, Wallet, ChevronDown, FileText, AlertTriangle
} from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AdminStatusIndicator } from "./AdminStatusIndicator";
import { useTeamUser } from "@/components/TeamUserProvider";
import { useTrialCheck } from "@/hooks/useTrialCheck";

const items = [
  { name: "PDV", href: "/pdv", icon: Receipt, show: ["master", "admin", "atendente"] },
  { name: "Pedidos", href: "/orders", icon: ShoppingBag, show: ["master", "admin", "atendente", "cozinha"] },
  { name: "Cardápio Online", href: "/menu", icon: UtensilsCrossed, show: ["master", "admin"], excludeAdmin: true },
  { name: "Apps", href: "/apps", icon: Smartphone, show: ["master", "admin"] },
  { name: "Configurações", href: "/settings", icon: Settings, show: ["master", "admin"] },
];

// Submenu items para Financeiro
const financeSubItems = [
  { name: "Dashboard", href: "/finance/dashboard" },
  { name: "Caixa", href: "/finance/cash" },
  { name: "Relatórios", href: "/finance/reports" },
  { name: "Contas a Pagar/Receber", href: "/finance/accounts" },
  { name: "Custos", href: "/finance/costs" },
  { name: "Conferência de Caixa", href: "/finance/cash-review", show: ["master", "admin"] },
];

// Submenu items para Cadastros
const cadastrosSubItems = [
  { name: "Produtos", href: "/cadastros/products" },
  { name: "Clientes", href: "/cadastros/customers" },
  { name: "Promoções", href: "/cadastros/promotions" },
  { name: "Fornecedores", href: "/cadastros/suppliers" },
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
  const [isFinanceOpen, setIsFinanceOpen] = useState(false);
  const [isCadastrosOpen, setIsCadastrosOpen] = useState(false);
  const location = useLocation();
  const { teamUser, resetTeamUser } = useTeamUser();
  const { trialStatus, loading: trialLoading } = useTrialCheck();

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

  // Abrir menu Financeiro se estiver na rota
  useEffect(() => {
    if (location.pathname.startsWith("/finance")) {
      setIsFinanceOpen(true);
    }
  }, [location.pathname]);

  // Abrir menu Cadastros se estiver na rota
  useEffect(() => {
    if (location.pathname.startsWith("/cadastros")) {
      setIsCadastrosOpen(true);
    }
  }, [location.pathname]);

  const handleLogout = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      // Invalidar sessão no banco antes de fazer logout
      if (session?.refresh_token) {
        try {
          await supabase.rpc('invalidate_user_session', {
            p_user_id: session.user.id,
            p_refresh_token: session.refresh_token
          });
        } catch (sessionError) {
          // Continuar mesmo se falhar
        }
      }

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
              <>
                {/* PDV e Pedidos */}
                {visibleItems.filter(item => item.name === "PDV" || item.name === "Pedidos").map((item) => {
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
                })}
                
                {/* Menu Cadastros com Dropdown */}
                {teamUser && (teamUser.role === "master" || teamUser.role === "admin" || teamUser.role === "atendente") ? (
                  !isCollapsed ? (
                    <Collapsible 
                      open={isCadastrosOpen} 
                      onOpenChange={setIsCadastrosOpen}
                    >
                      <CollapsibleTrigger
                        className={cn(
                          "flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors w-full",
                          location.pathname.startsWith("/cadastros")
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:text-foreground hover:bg-accent"
                        )}
                      >
                        <Package className="h-5 w-5 flex-shrink-0" strokeWidth={2} />
                        <span className="flex-1 text-left">Cadastros</span>
                        <ChevronDown 
                          className={cn(
                            "h-4 w-4 transition-transform",
                            isCadastrosOpen && "transform rotate-180"
                          )} 
                        />
                      </CollapsibleTrigger>
                      <CollapsibleContent className="pl-4 mt-1 space-y-1">
                        {cadastrosSubItems.map((subItem) => {
                          const isActive = location.pathname === subItem.href || location.pathname.startsWith(subItem.href + "/");
                          return (
                            <Link
                              key={subItem.name}
                              to={subItem.href}
                              onClick={() => setIsMobileMenuOpen(false)}
                              className={cn(
                                "flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors",
                                isActive
                                  ? "bg-primary/20 text-primary font-medium"
                                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
                              )}
                            >
                              <span>{subItem.name}</span>
                            </Link>
                          );
                        })}
                      </CollapsibleContent>
                    </Collapsible>
                  ) : (
                    // Quando colapsado, mostrar link direto para Produtos
                    <Link
                      to="/cadastros/products"
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors justify-center",
                        location.pathname.startsWith("/cadastros/products")
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:text-foreground hover:bg-accent"
                      )}
                      title="Cadastros"
                    >
                      <Package className="h-5 w-5 flex-shrink-0" strokeWidth={2} />
                    </Link>
                  )
                ) : null}
                
                {/* Cardápio Online e Apps */}
                {visibleItems.filter(item => item.name === "Cardápio Online" || item.name === "Apps").map((item) => {
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
                })}
                
                {/* Menu Financeiro com Dropdown */}
                {teamUser && (teamUser.role === "master" || teamUser.role === "admin" || teamUser.role === "atendente") ? (
                  !isCollapsed ? (
                    <Collapsible 
                      open={isFinanceOpen} 
                      onOpenChange={setIsFinanceOpen}
                    >
                      <CollapsibleTrigger
                        className={cn(
                          "flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors w-full",
                          location.pathname.startsWith("/finance")
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:text-foreground hover:bg-accent"
                        )}
                      >
                        <Wallet className="h-5 w-5 flex-shrink-0" strokeWidth={2} />
                        <span className="flex-1 text-left">Financeiro</span>
                        <ChevronDown 
                          className={cn(
                            "h-4 w-4 transition-transform",
                            isFinanceOpen && "transform rotate-180"
                          )} 
                        />
                      </CollapsibleTrigger>
                      <CollapsibleContent className="pl-4 mt-1 space-y-1">
                        {financeSubItems
                          .filter((subItem) => {
                            // Para atendentes, mostrar apenas Caixa
                            if (teamUser.role === "atendente") {
                              return subItem.name === "Caixa";
                            }
                            // Para master/admin, filtrar por show se existir
                            if (subItem.show) {
                              return subItem.show.includes(teamUser?.role || "");
                            }
                            return true;
                          })
                          .map((subItem) => {
                          const isActive = location.pathname === subItem.href || location.pathname.startsWith(subItem.href + "/");
                          return (
                            <Link
                              key={subItem.name}
                              to={subItem.href}
                              onClick={() => setIsMobileMenuOpen(false)}
                              className={cn(
                                "flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors",
                                isActive
                                  ? "bg-primary/20 text-primary font-medium"
                                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
                              )}
                            >
                              <span>{subItem.name}</span>
                            </Link>
                          );
                        })}
                      </CollapsibleContent>
                    </Collapsible>
                  ) : (
                    // Quando colapsado, mostrar link direto para Caixa
                    <Link
                      to="/finance/cash"
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors justify-center",
                        location.pathname.startsWith("/finance/cash")
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:text-foreground hover:bg-accent"
                      )}
                      title="Caixa"
                    >
                      <Wallet className="h-5 w-5 flex-shrink-0" strokeWidth={2} />
                    </Link>
                  )
                ) : null}
                
                {/* Configurações */}
                {visibleItems.filter(item => item.name === "Configurações").map((item) => {
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
                })}
              </>
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

          {/* Trial Days Indicator - Discreto */}
          {trialStatus.subscriptionType === 'trial' && trialStatus.trialDaysLeft !== null && trialStatus.trialDaysLeft >= 0 && (
            <div className="px-2 pb-2">
              {!isCollapsed ? (
                <div className={cn(
                  "flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs border transition-colors",
                  trialStatus.trialDaysLeft <= 3 
                    ? "bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400" 
                    : trialStatus.trialDaysLeft <= 7 
                    ? "bg-yellow-500/10 border-yellow-500/20 text-yellow-600 dark:text-yellow-400"
                    : "bg-primary/10 border-primary/20 text-primary"
                )}>
                  <AlertTriangle className={cn(
                    "h-3.5 w-3.5 flex-shrink-0",
                    trialStatus.trialDaysLeft <= 3 
                      ? "text-red-600 dark:text-red-400" 
                      : trialStatus.trialDaysLeft <= 7 
                      ? "text-yellow-600 dark:text-yellow-400"
                      : "text-primary"
                  )} />
                  <span className="flex-1 truncate font-medium">
                    {trialStatus.trialDaysLeft === 0 
                      ? 'Teste expirou'
                      : trialStatus.trialDaysLeft === 1
                      ? `${trialStatus.trialDaysLeft} dia`
                      : `${trialStatus.trialDaysLeft} dias`
                    }
                  </span>
                </div>
              ) : (
                <div 
                  className={cn(
                    "flex items-center justify-center p-1.5 rounded-md border transition-colors",
                    trialStatus.trialDaysLeft <= 3 
                      ? "bg-red-500/10 border-red-500/20" 
                      : trialStatus.trialDaysLeft <= 7 
                      ? "bg-yellow-500/10 border-yellow-500/20"
                      : "bg-primary/10 border-primary/20"
                  )} 
                  title={
                    trialStatus.trialDaysLeft === 0 
                      ? 'Teste expirou!'
                      : trialStatus.trialDaysLeft === 1
                      ? `${trialStatus.trialDaysLeft} dia restante`
                      : `${trialStatus.trialDaysLeft} dias restantes`
                  }
                >
                  <AlertTriangle className={cn(
                    "h-3.5 w-3.5",
                    trialStatus.trialDaysLeft <= 3 
                      ? "text-red-600 dark:text-red-400" 
                      : trialStatus.trialDaysLeft <= 7 
                      ? "text-yellow-600 dark:text-yellow-400"
                      : "text-primary"
                  )} />
                </div>
              )}
            </div>
          )}

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
