import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SuppliersList } from "@/components/suppliers/SuppliersList";
import { SuppliersDashboard } from "@/components/suppliers/SuppliersDashboard";
import { SupplierOrders } from "@/components/suppliers/SupplierOrders";
import { Package, BarChart3, ShoppingCart } from "lucide-react";
import Sidebar from "@/components/Sidebar";
import { useSidebarWidth } from "@/hooks/useSidebarWidth";

export default function Suppliers() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const sidebarWidth = useSidebarWidth();
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const checkDesktop = () => setIsDesktop(window.innerWidth >= 1024);
    checkDesktop();
    window.addEventListener('resize', checkDesktop);
    return () => window.removeEventListener('resize', checkDesktop);
  }, []);

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
          overflowY: 'auto'
        }}
      >
      <div className="w-full space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Fornecedores</h1>
          <p className="text-muted-foreground">
            Gerencie fornecedores, pedidos e pagamentos
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="dashboard" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="suppliers" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Fornecedores
            </TabsTrigger>
            <TabsTrigger value="orders" className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4" />
              Pedidos
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="mt-6">
            <SuppliersDashboard />
          </TabsContent>

          <TabsContent value="suppliers" className="mt-6">
            <SuppliersList />
          </TabsContent>

          <TabsContent value="orders" className="mt-6">
            <SupplierOrders />
          </TabsContent>
        </Tabs>
      </div>
      </main>
    </div>
  );
}
