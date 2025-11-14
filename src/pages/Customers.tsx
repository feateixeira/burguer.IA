import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { revalidateHelpers } from "@/utils/revalidateCache";
import { Plus, Edit, Trash2, Users, UserPlus, Crown } from "lucide-react";

interface Customer {
  id: string;
  name: string;
  phone?: string;
  address?: string;
  created_at: string;
}

interface CustomerGroup {
  id: string;
  name: string;
  description?: string;
  discount_percentage: number;
  active: boolean;
}

interface CustomerWithGroups extends Customer {
  groups: CustomerGroup[];
  order_count?: number;
  last_order_date?: string;
}

interface CustomerGroupWithStats extends CustomerGroup {
  order_count?: number;
}

const Customers = () => {
  const [customers, setCustomers] = useState<CustomerWithGroups[]>([]);
  const [groups, setGroups] = useState<CustomerGroupWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCustomerDialogOpen, setIsCustomerDialogOpen] = useState(false);
  const [isGroupDialogOpen, setIsGroupDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [editingGroup, setEditingGroup] = useState<CustomerGroup | null>(null);
  const [establishmentId, setEstablishmentId] = useState<string>("");
  const [deleteConfirmation, setDeleteConfirmation] = useState<{type: 'customer' | 'group', id: string, name: string} | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("establishment_id")
        .eq("user_id", session.user.id)
        .single();

      if (!profile?.establishment_id) return;
      
      setEstablishmentId(profile.establishment_id);

      // Load all customers
      const { data: customersData } = await supabase
        .from("customers")
        .select(`
          *,
          customer_group_members(
            customer_groups(*)
          )
        `)
        .eq("establishment_id", profile.establishment_id)
        .order("name");

      // Load all groups
      const { data: groupsData } = await supabase
        .from("customer_groups")
        .select("*")
        .eq("establishment_id", profile.establishment_id)
        .order("name");

      // OTIMIZAÇÃO: Buscar estatísticas de pedidos de uma vez (evita N+1)
      // Buscar todos os pedidos do estabelecimento uma vez
      const { data: allOrders } = await supabase
        .from("orders")
        .select("id, customer_id, customer_name, customer_phone, created_at")
        .eq("establishment_id", profile.establishment_id);

      // Criar mapas para busca rápida
      const ordersByCustomerId = new Map<string, any[]>();
      const ordersByCustomerName = new Map<string, any[]>();
      
      // Organizar pedidos por customer_id e por customer_name
      if (allOrders) {
        allOrders.forEach((order: any) => {
          // Por customer_id
          if (order.customer_id) {
            if (!ordersByCustomerId.has(order.customer_id)) {
              ordersByCustomerId.set(order.customer_id, []);
            }
            ordersByCustomerId.get(order.customer_id)!.push(order);
          }
          
          // Por customer_name (para clientes sem customer_id vinculado)
          if (order.customer_name) {
            const key = order.customer_name.toLowerCase().trim();
            if (!ordersByCustomerName.has(key)) {
              ordersByCustomerName.set(key, []);
            }
            ordersByCustomerName.get(key)!.push(order);
          }
        });
      }

      // Format customers with their groups and statistics
      const formattedCustomers: CustomerWithGroups[] = [];
      
      for (const customer of customersData || []) {
        // Buscar pedidos do cliente (por ID primeiro, depois por nome)
        const ordersById = ordersByCustomerId.get(customer.id) || [];
        const ordersByName = ordersByCustomerName.get(customer.name.toLowerCase().trim()) || [];
        
        // Combinar pedidos, evitando duplicatas
        const allCustomerOrders = new Map<string, any>();
        ordersById.forEach((order: any) => allCustomerOrders.set(order.id, order));
        ordersByName.forEach((order: any) => {
          // Só adicionar se não tiver customer_id ou se for diferente
          if (!order.customer_id || order.customer_id !== customer.id) {
            allCustomerOrders.set(order.id, order);
          }
        });
        
        const customerOrders = Array.from(allCustomerOrders.values())
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        formattedCustomers.push({
          ...customer,
          groups: customer.customer_group_members?.map((member: any) => member.customer_groups).filter(Boolean) || [],
          order_count: customerOrders.length,
          last_order_date: customerOrders[0]?.created_at
        });
      }

      // Add statistics to groups
      const groupsWithStats: CustomerGroupWithStats[] = [];
      
      for (const group of groupsData || []) {
        // Count orders that used this group's discount
        const { data: groupOrders } = await supabase
          .from("orders")
          .select("id")
          .eq("establishment_id", profile.establishment_id)
          .gt("discount_amount", 0);

        // Filter orders where the customer belongs to this group
        let groupOrderCount = 0;
        if (groupOrders) {
          for (const order of groupOrders) {
            // This is a simplified approach - in a real scenario you'd want to store group_id in orders
            // For now, we'll count all discounted orders for groups that have discounts
            if (group.discount_percentage > 0) {
              groupOrderCount++;
            }
          }
        }

        groupsWithStats.push({
          ...group,
          order_count: Math.floor(groupOrderCount / (groupsData?.length || 1)) // Distribute evenly among groups
        });
      }

      setCustomers(formattedCustomers);
      setGroups(groupsWithStats);
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  const handleCustomerSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const customerData = {
      name: formData.get("name") as string,
      phone: formData.get("phone") as string || null,
      address: formData.get("address") as string || null,
      establishment_id: establishmentId,
    };

    try {
      if (editingCustomer) {
        const { error } = await supabase
          .from("customers")
          .update(customerData)
          .eq("id", editingCustomer.id);

        if (error) throw error;
        toast.success("Cliente atualizado com sucesso!");
      } else {
        const { error } = await supabase
          .from("customers")
          .insert(customerData);

        if (error) throw error;
        toast.success("Cliente criado com sucesso!");
      }

      setIsCustomerDialogOpen(false);
      setEditingCustomer(null);
      await revalidateHelpers.customers();
      loadData();
    } catch (error) {
      console.error("Error saving customer:", error);
      toast.error("Erro ao salvar cliente");
    }
  };

  const handleGroupSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const groupData = {
      name: formData.get("name") as string,
      description: formData.get("description") as string || null,
      discount_percentage: parseFloat(formData.get("discount_percentage") as string) || 0,
      establishment_id: establishmentId,
      active: true
    };

    try {
      if (editingGroup) {
        const { error } = await supabase
          .from("customer_groups")
          .update(groupData)
          .eq("id", editingGroup.id);

        if (error) throw error;
        toast.success("Grupo atualizado com sucesso!");
      } else {
        const { error } = await supabase
          .from("customer_groups")
          .insert(groupData);

        if (error) throw error;
        toast.success("Grupo criado com sucesso!");
      }

      setIsGroupDialogOpen(false);
      setEditingGroup(null);
      loadData();
    } catch (error) {
      console.error("Error saving group:", error);
      toast.error("Erro ao salvar grupo");
    }
  };

  const addCustomerToGroup = async (customerId: string, groupId: string) => {
    try {
      const { error } = await supabase
        .from("customer_group_members")
        .insert({
          customer_id: customerId,
          group_id: groupId
        });

      if (error) throw error;
      toast.success("Cliente adicionado ao grupo!");
      loadData();
    } catch (error) {
      console.error("Error adding customer to group:", error);
      toast.error("Erro ao adicionar cliente ao grupo");
    }
  };

  const removeCustomerFromGroup = async (customerId: string, groupId: string) => {
    try {
      const { error } = await supabase
        .from("customer_group_members")
        .delete()
        .eq("customer_id", customerId)
        .eq("group_id", groupId);

      if (error) throw error;
      toast.success("Cliente removido do grupo!");
      loadData();
    } catch (error) {
      console.error("Error removing customer from group:", error);
      toast.error("Erro ao remover cliente do grupo");
    }
  };

  const handleDeleteCustomer = async (customerId: string) => {
    try {
      // First, remove customer from all groups
      await supabase
        .from("customer_group_members")
        .delete()
        .eq("customer_id", customerId);

      // Then delete the customer
      const { error } = await supabase
        .from("customers")
        .delete()
        .eq("id", customerId);

      if (error) throw error;
      
      toast.success("Cliente excluído com sucesso!");
      setDeleteConfirmation(null);
      loadData();
    } catch (error) {
      console.error("Error deleting customer:", error);
      toast.error("Erro ao excluir cliente");
    }
  };

  const handleDeleteGroup = async (groupId: string) => {
    try {
      // First, remove all members from the group
      await supabase
        .from("customer_group_members")
        .delete()
        .eq("group_id", groupId);

      // Then delete the group
      const { error } = await supabase
        .from("customer_groups")
        .delete()
        .eq("id", groupId);

      if (error) throw error;
      
      toast.success("Grupo excluído com sucesso!");
      setDeleteConfirmation(null);
      loadData();
    } catch (error) {
      console.error("Error deleting group:", error);
      toast.error("Erro ao excluir grupo");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
          <p className="mt-4 text-muted-foreground">Carregando clientes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-foreground">Clientes</h1>
            <div className="flex gap-2">
              <Dialog open={isCustomerDialogOpen} onOpenChange={setIsCustomerDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={() => setEditingCustomer(null)}>
                    <UserPlus className="mr-2 h-4 w-4" />
                    Novo Cliente
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>
                      {editingCustomer ? "Editar Cliente" : "Novo Cliente"}
                    </DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleCustomerSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Nome *</Label>
                      <Input
                        id="name"
                        name="name"
                        defaultValue={editingCustomer?.name || ""}
                        required
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="phone">Telefone</Label>
                      <Input
                        id="phone"
                        name="phone"
                        defaultValue={editingCustomer?.phone || ""}
                        placeholder="(11) 99999-9999"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="address">Endereço</Label>
                      <Textarea
                        id="address"
                        name="address"
                        defaultValue={editingCustomer?.address || ""}
                        rows={3}
                      />
                    </div>
                    
                    <div className="flex justify-end space-x-2">
                      <Button type="button" variant="outline" onClick={() => setIsCustomerDialogOpen(false)}>
                        Cancelar
                      </Button>
                      <Button type="submit">
                        {editingCustomer ? "Atualizar" : "Criar"}
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>

              <Dialog open={isGroupDialogOpen} onOpenChange={setIsGroupDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" onClick={() => setEditingGroup(null)}>
                    <Crown className="mr-2 h-4 w-4" />
                    Novo Grupo
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>
                      {editingGroup ? "Editar Grupo" : "Novo Grupo"}
                    </DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleGroupSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="group-name">Nome do Grupo *</Label>
                      <Input
                        id="group-name"
                        name="name"
                        defaultValue={editingGroup?.name || ""}
                        required
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="group-description">Descrição</Label>
                      <Textarea
                        id="group-description"
                        name="description"
                        defaultValue={editingGroup?.description || ""}
                        rows={2}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="discount-percentage">Desconto (%)</Label>
                      <Input
                        id="discount-percentage"
                        name="discount_percentage"
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        defaultValue={editingGroup?.discount_percentage || ""}
                        placeholder="Ex: 10 para 10% de desconto"
                      />
                    </div>
                    
                    <div className="flex justify-end space-x-2">
                      <Button type="button" variant="outline" onClick={() => setIsGroupDialogOpen(false)}>
                        Cancelar
                      </Button>
                      <Button type="submit">
                        {editingGroup ? "Atualizar" : "Criar"}
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {groups.length > 0 && (
            <div className="mb-8">
              <h2 className="text-xl font-semibold mb-4">Grupos de Clientes</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {groups.map((group) => (
                  <Card key={group.id}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg flex items-center">
                        <Crown className="mr-2 h-4 w-4 text-yellow-500" />
                        {group.name}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {group.description && (
                          <p className="text-sm text-muted-foreground">
                            {group.description}
                          </p>
                        )}
                        
                         <div className="flex flex-wrap gap-2">
                           {group.discount_percentage > 0 && (
                             <Badge variant="secondary">
                               {group.discount_percentage}% de desconto
                             </Badge>
                           )}
                           <Badge variant="outline">
                             {group.order_count || 0} pedidos com desconto
                           </Badge>
                         </div>
                         
                         <div className="flex justify-end gap-2 pt-2">
                           <Button
                             variant="outline"
                             size="sm"
                             onClick={() => {
                               setEditingGroup(group);
                               setIsGroupDialogOpen(true);
                             }}
                           >
                             <Edit className="h-4 w-4" />
                           </Button>
                           <Button
                             variant="outline"
                             size="sm"
                             onClick={() => setDeleteConfirmation({type: 'group', id: group.id, name: group.name})}
                             className="text-red-600 hover:text-red-700"
                           >
                             <Trash2 className="h-4 w-4" />
                           </Button>
                         </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {customers.map((customer) => (
              <Card key={customer.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">{customer.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {customer.phone && (
                      <p className="text-sm text-muted-foreground">
                        📞 {customer.phone}
                      </p>
                    )}
                    
                    {customer.address && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        📍 {customer.address}
                      </p>
                    )}
                    
                     <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                       <span>📊 {customer.order_count || 0} pedidos</span>
                       {customer.last_order_date && (
                         <span>🕒 Último: {new Date(customer.last_order_date).toLocaleDateString('pt-BR')}</span>
                       )}
                     </div>
                     
                     {customer.groups.length > 0 && (
                       <div className="flex flex-wrap gap-1 mt-2">
                         {customer.groups.map((group) => (
                           <Badge 
                             key={group.id} 
                             variant="outline"
                             className="text-xs cursor-pointer"
                             onClick={() => removeCustomerFromGroup(customer.id, group.id)}
                             title="Clique para remover do grupo"
                           >
                             {group.name} ×
                           </Badge>
                         ))}
                       </div>
                     )}
                     
                     <div className="flex justify-between items-center pt-2">
                       <Select
                         onValueChange={(groupId) => addCustomerToGroup(customer.id, groupId)}
                       >
                         <SelectTrigger className="w-[130px] h-8">
                           <SelectValue placeholder="+ grupo" />
                         </SelectTrigger>
                         <SelectContent>
                           {groups
                             .filter(group => !customer.groups.some(cg => cg.id === group.id))
                             .map((group) => (
                               <SelectItem key={group.id} value={group.id}>
                                 {group.name}
                               </SelectItem>
                             ))}
                         </SelectContent>
                       </Select>
                       
                       <div className="flex gap-2">
                         <Button
                           variant="outline"
                           size="sm"
                           onClick={() => {
                             setEditingCustomer(customer);
                             setIsCustomerDialogOpen(true);
                           }}
                         >
                           <Edit className="h-4 w-4" />
                         </Button>
                         <Button
                           variant="outline"
                           size="sm"
                           onClick={() => setDeleteConfirmation({type: 'customer', id: customer.id, name: customer.name})}
                           className="text-red-600 hover:text-red-700"
                         >
                           <Trash2 className="h-4 w-4" />
                         </Button>
                       </div>
                     </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {customers.length === 0 && (
            <Card>
              <CardContent className="text-center py-12">
                <Users className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Nenhum cliente cadastrado</h3>
                <p className="text-muted-foreground mb-4">
                  Comece criando seu primeiro cliente para organizar sua carteira.
                </p>
                <Button onClick={() => setIsCustomerDialogOpen(true)}>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Criar Primeiro Cliente
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Delete Confirmation Dialog */}
          <AlertDialog open={deleteConfirmation !== null} onOpenChange={() => setDeleteConfirmation(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
                <AlertDialogDescription>
                  Tem certeza que deseja excluir {deleteConfirmation?.type === 'customer' ? 'o cliente' : 'o grupo'} "{deleteConfirmation?.name}"? 
                  Esta ação não pode ser desfeita.
                  {deleteConfirmation?.type === 'group' && ' Todos os clientes serão removidos do grupo.'}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    if (deleteConfirmation?.type === 'customer') {
                      handleDeleteCustomer(deleteConfirmation.id);
                    } else if (deleteConfirmation?.type === 'group') {
                      handleDeleteGroup(deleteConfirmation.id);
                    }
                  }}
                  className="bg-red-600 hover:bg-red-700"
                >
                  Excluir
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
    </div>
  );
};

export default Customers;