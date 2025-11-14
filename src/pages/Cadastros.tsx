import { useState } from "react";
import { Routes, Route, Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import Sidebar from "@/components/Sidebar";
import { useSidebarWidth } from "@/hooks/useSidebarWidth";
import { Package, Users, Tag, Truck } from "lucide-react";
import Products from "./Products";
import Customers from "./Customers";
import Promotions from "./Promotions";
import Suppliers from "./Suppliers";

const Cadastros = () => {
  const location = useLocation();
  const sidebarWidth = useSidebarWidth();

  const subPages = [
    { name: "Produtos", path: "/cadastros/products", icon: Package },
    { name: "Clientes", path: "/cadastros/customers", icon: Users },
    { name: "Promoções", path: "/cadastros/promotions", icon: Tag },
    { name: "Fornecedores", path: "/cadastros/suppliers", icon: Truck },
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
            <h1 className="text-3xl font-bold mb-2">Cadastros</h1>
            <p className="text-muted-foreground">
              Gerenciamento de produtos, clientes, promoções e fornecedores
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
            <Route path="/products/*" element={<Products />} />
            <Route path="/customers/*" element={<Customers />} />
            <Route path="/promotions/*" element={<Promotions />} />
            <Route path="/suppliers/*" element={<Suppliers />} />
            <Route path="/" element={<Products />} />
          </Routes>
        </div>
      </div>
    </div>
  );
};

export default Cadastros;

