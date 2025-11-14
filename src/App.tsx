import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/hooks/useTheme";
import { OrderNotificationProvider } from "@/components/OrderNotificationProvider";
import { AdminNotificationDisplay } from "@/components/AdminNotificationDisplay";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Admin from "./pages/Admin";
import Dashboard from "./pages/Dashboard";
import PDV from "./pages/PDV";
import Products from "./pages/Products";
import Customers from "./pages/Customers";
import Settings from "./pages/Settings";
import Costs from "./pages/Costs";
import Orders from "./pages/Orders";
import Apps from "./pages/Apps";
import PasswordPanel from "./pages/PasswordPanel";
import PasswordDisplay from "./pages/PasswordDisplay";
import Totem from "./pages/Totem";
import Promotions from "./pages/Promotions";
import Menu from "./pages/Menu";
import MenuPublic from "./pages/MenuPublic";
import Finance from "./pages/Finance";
import Cadastros from "./pages/Cadastros";
import NotFound from "./pages/NotFound";
import { TeamUserProvider } from "@/components/TeamUserProvider";
import { ConfirmProvider } from "@/hooks/useConfirm";
import { SessionGuard } from "@/components/SessionGuard";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter
          future={{
            v7_startTransition: true,
            v7_relativeSplatPath: true,
          }}
        >
          <OrderNotificationProvider>
            <TeamUserProvider>
              <ConfirmProvider>
              <SessionGuard>
              <Routes>
                <Route path="/" element={<Auth />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/admin" element={<Admin />} />
                <Route path="/pdv" element={<PDV />} />
                <Route path="/orders" element={<Orders />} />
                <Route path="/apps" element={<Apps />} />
                <Route path="/password-panel" element={<PasswordPanel />} />
                <Route path="/password-display" element={<PasswordDisplay />} />
                <Route path="/totem" element={<Totem />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/menu" element={<Menu />} />
                <Route path="/menu-public/:slug" element={<MenuPublic />} />
                <Route path="/cardapio/:slug" element={<MenuPublic />} />
                <Route path="/finance/*" element={<Finance />} />
                <Route path="/cadastros/*" element={<Cadastros />} />
                <Route path="/landing" element={<Index />} />
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
              <AdminNotificationDisplay />
              </SessionGuard>
              </ConfirmProvider>
            </TeamUserProvider>
          </OrderNotificationProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
