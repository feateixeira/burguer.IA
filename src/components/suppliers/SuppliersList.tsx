import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { SupplierDialog } from "./SupplierDialog";

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
          <Card key={supplier.id} className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => handleEdit(supplier)}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>{supplier.name}</span>
                {!supplier.active && (
                  <span className="text-xs bg-muted px-2 py-1 rounded">Inativo</span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
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
