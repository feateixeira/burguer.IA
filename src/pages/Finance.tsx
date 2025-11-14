import { useState } from "react";
import { Routes, Route, Link, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import Sidebar from "@/components/Sidebar";
import { useSidebarWidth } from "@/hooks/useSidebarWidth";
import { ChevronRight, Wallet, FileText, Receipt, CheckCircle2, BarChart3, Calculator } from "lucide-react";
import Cash from "./finance/CashRefactored";
import Reports from "./finance/Reports";
import AccountsPayableReceivable from "./finance/AccountsPayableReceivable";
import CashReview from "./finance/CashReview";
import Dashboard from "./Dashboard";
import Costs from "./Costs";
import { useTeamUser } from "@/components/TeamUserProvider";

const Finance = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const sidebarWidth = useSidebarWidth();
  const { teamUser } = useTeamUser();

  const canReview = teamUser?.role === "master" || teamUser?.role === "admin";
  const isAttendant = teamUser?.role === "atendente";

  const subPages = [
    { name: "Dashboard", path: "/finance/dashboard", icon: BarChart3 },
    { name: "Caixa", path: "/finance/cash", icon: Wallet },
    // Apenas master/admin veem relatórios e contas
    ...(!isAttendant ? [
      { name: "Relatórios", path: "/finance/reports", icon: FileText },
      { name: "Contas a Pagar/Receber", path: "/finance/accounts", icon: Receipt },
      { name: "Custos", path: "/finance/costs", icon: Calculator },
    ] : []),
    ...(canReview ? [{ name: "Conferência de Caixa", path: "/finance/cash-review", icon: CheckCircle2 }] : []),
  ];

  const currentPath = location.pathname;

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div
        className="flex-1 transition-all duration-300"
        style={{ marginLeft: `${sidebarWidth}px` }}
      >
        <div className="container mx-auto p-6">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-3xl font-bold mb-2">Financeiro</h1>
            <p className="text-muted-foreground">
              Gestão financeira e controle de caixa
            </p>
          </div>

          {/* Submenu Navigation */}
          <div className="mb-6 flex gap-2 border-b">
            {subPages.map((page) => {
              const IconComponent = page.icon;
              const isActive = currentPath === page.path || currentPath.startsWith(page.path + "/");
              return (
                <Link
                  key={page.path}
                  to={page.path}
                  className={cn(
                    "flex items-center gap-2 px-4 py-3 border-b-2 transition-colors",
                    isActive
                      ? "border-primary text-primary font-medium"
                      : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                  )}
                >
                  {IconComponent && <IconComponent className="h-4 w-4" />}
                  <span>{page.name}</span>
                </Link>
              );
            })}
          </div>

          {/* Content */}
          <Routes>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/cash/*" element={<Cash />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/accounts" element={<AccountsPayableReceivable />} />
            {!isAttendant && <Route path="/costs" element={<Costs />} />}
            {canReview && <Route path="/cash-review" element={<CashReview />} />}
            <Route path="/" element={<Dashboard />} />
          </Routes>
        </div>
      </div>
    </div>
  );
};

export default Finance;

