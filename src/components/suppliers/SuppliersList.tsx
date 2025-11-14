import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { SupplierDialog } from "./SupplierDialog";
import { useConfirm } from "@/hooks/useConfirm";

interface Supplier {
  id: string;
  name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  cnpj: string | null;
  active: boolean;
}

export function SuppliersList() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const confirm = useConfirm();

  useEffect(() => {
    loadSuppliers();
  }, []);

  const loadSuppliers = async () => {
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("establishment_id")
        .eq("user_id", (await supabase.auth.getUser()).data.user?.id)
        .single();

      if (!profile?.establishment_id) return;

      const { data, error } = await supabase
        .from("suppliers")
        .select("*")
        .eq("establishment_id", profile.establishment_id)
        .order("name");

      if (error) throw error;
      setSuppliers(data || []);
    } catch (error) {
      console.error("Error loading suppliers:", error);
      toast.error("Erro ao carregar fornecedores");
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setDialogOpen(true);
  };

  const handleNew = () => {
    setSelectedSupplier(null);
    setDialogOpen(true);
  };

  const handleSuccess = () => {
    loadSuppliers();
    setDialogOpen(false);
  };

  const handleDelete = async (supplier: Supplier, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click
    
    try {
      // Check if supplier has orders
      const { data: profile } = await supabase
        .from("profiles")
        .select("establishment_id")
        .eq("user_id", (await supabase.auth.getUser()).data.user?.id)
        .single();

      if (!profile?.establishment_id) {
        toast.error("Erro ao identificar estabelecimento");
        return;
      }

      const { data: orders, error: ordersError } = await supabase
        .from("supplier_orders")
        .select("id")
        .eq("establishment_id", profile.establishment_id)
        .eq("supplier_id", supplier.id)
        .limit(1);

      if (ordersError) {
        console.error("Error checking orders:", ordersError);
      }

      const hasOrders = orders && orders.length > 0;

      const confirmMessage = hasOrders
        ? `O fornecedor "${supplier.name}" possui pedidos associados. Ao excluir, os pedidos não serão removidos, mas o fornecedor será desvinculado. Deseja continuar?`
        : `Tem certeza que deseja excluir o fornecedor "${supplier.name}"? Esta ação não pode ser desfeita.`;

      const ok = await confirm({
        title: "Excluir Fornecedor",
        description: confirmMessage,
        confirmText: "Excluir",
        cancelText: "Cancelar",
      });

      if (!ok) return;

      // Delete supplier
      const { error } = await supabase
        .from("suppliers")
        .delete()
        .eq("id", supplier.id);

      if (error) {
        // Check if it's a foreign key constraint error
        if (error.code === "23503" || error.message.includes("foreign key")) {
          toast.error(
            "Não é possível excluir este fornecedor pois existem pedidos ou produtos associados a ele."
          );
          return;
        }
        throw error;
      }

      toast.success("Fornecedor excluído com sucesso");
      loadSuppliers();
    } catch (error: any) {
      console.error("Error deleting supplier:", error);
      toast.error(error?.message || "Erro ao excluir fornecedor");
    }
  };

  if (loading) {
    return <div>Carregando...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Fornecedores</h2>
          <p className="text-muted-foreground">
            Gerencie seus fornecedores
          </p>
        </div>
        <Button onClick={handleNew}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Fornecedor
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {suppliers.map((supplier) => (
          <Card key={supplier.id} className="hover:shadow-lg transition-shadow relative">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between">
                <span className="cursor-pointer" onClick={() => handleEdit(supplier)}>
                  {supplier.name}
                </span>
                <div className="flex items-center gap-2">
                  {!supplier.active && (
                    <span className="text-xs bg-muted px-2 py-1 rounded">Inativo</span>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10 -mr-2"
                    onClick={(e) => handleDelete(supplier, e)}
                    title="Excluir fornecedor"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent 
              className="space-y-2 cursor-pointer" 
              onClick={() => handleEdit(supplier)}
            >
              {supplier.contact_name && (
                <p className="text-sm"><strong>Contato:</strong> {supplier.contact_name}</p>
              )}
              {supplier.phone && (
                <p className="text-sm"><strong>Telefone:</strong> {supplier.phone}</p>
              )}
              {supplier.email && (
                <p className="text-sm"><strong>Email:</strong> {supplier.email}</p>
              )}
              {supplier.cnpj && (
                <p className="text-sm"><strong>CNPJ:</strong> {supplier.cnpj}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {suppliers.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground mb-4">
              Nenhum fornecedor cadastrado
            </p>
            <Button onClick={handleNew}>
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Primeiro Fornecedor
            </Button>
          </CardContent>
        </Card>
      )}

      <SupplierDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        supplier={selectedSupplier}
        onSuccess={handleSuccess}
      />
    </div>
  );
}
