  import { useState, useEffect, useRef } from "react";
  import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
  import { Button } from "@/components/ui/button";
  import { Badge } from "@/components/ui/badge";
  import { Input } from "@/components/ui/input";
  import { Label } from "@/components/ui/label";
  import { Textarea } from "@/components/ui/textarea";
  import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
  import { supabase } from "@/integrations/supabase/client";
  import { useNavigate } from "react-router-dom";
  import { toast } from "sonner";
  import { 
    Search, 
    Edit, 
    Trash2, 
    Eye, 
    Package,
    Clock,
    DollarSign,
    Phone,
    MapPin,
    Printer,
    XCircle,
    CheckCircle
  } from "lucide-react";
  import Sidebar from "@/components/Sidebar";
  import { printReceipt } from "@/utils/receiptPrinter";
  import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
  } from "@/components/ui/dialog";
  import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
  } from "@/components/ui/alert-dialog";

  interface Order {
    id: string;
    order_number: string;
    customer_name?: string;
    customer_phone?: string;
    status: string;
    payment_status: string;
    order_type: string;
    total_amount: number;
    subtotal: number;
    discount_amount?: number;
    tax_amount?: number;
    delivery_fee?: number;
    notes?: string;
    table_number?: string;
    payment_method?: string;
    created_at: string;
    channel?: string;
    origin?: string;
    source_domain?: string;
    order_items?: {
      id: string;
      quantity: number;
      unit_price: number;
      total_price: number;
      notes?: string;
      products: {
        name: string;
      };
    }[];
  }

  const Orders = () => {
    const [orders, setOrders] = useState<Order[]>([]);
    const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const firstLoadRef = useRef(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [establishment, setEstablishment] = useState<any>(null);
    const [activeTab, setActiveTab] = useState<string>("pending");
    const navigate = useNavigate();

    useEffect(() => {
      checkAuth();
    }, []);

    useEffect(() => {
      if (establishment) {
        loadOrders();

        // Realtime: orders and order_items
        const channel = supabase
          .channel('orders-realtime')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `establishment_id=eq.${establishment.id}` }, () => loadOrders({ background: true }))
          .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, () => loadOrders({ background: true }))
          .subscribe();

        // Polling como redundância para garantir baixa latência
        const interval = setInterval(() => {
          if (activeTab === 'pending') loadOrders({ background: true });
        }, 3000);

        return () => {
          clearInterval(interval);
          supabase.removeChannel(channel);
        };
      }
    }, [establishment, activeTab]);

    useEffect(() => {
      filterOrdersByTab();
    }, [searchTerm, orders, activeTab]);

    const filterOrdersByTab = () => {
      let filtered = orders;

      // Filter by tab
      if (activeTab === "pending") {
        // Online orders (from website) with status pending/preparing
        filtered = filtered.filter(order => 
          (order.channel === "online" || order.origin === "site" || order.source_domain) &&
          (order.status === "pending" || order.status === "preparing")
        );
      } else if (activeTab === "completed") {
        // PDV orders or completed online orders
        filtered = filtered.filter(order => 
          (order.channel === "pdv" || order.origin === "balcao" || !order.source_domain) ||
          (order.status === "completed" || order.status === "cancelled")
        );
      }

      // Filter by search term
      if (searchTerm) {
        filtered = filtered.filter(order =>
          order.order_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
          order.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          order.customer_phone?.includes(searchTerm)
        );
      }

      setFilteredOrders(filtered);
    };


    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          navigate("/auth");
          return;
        }

        // Get establishment
        const { data: profile } = await supabase
          .from("profiles")
          .select("establishment_id")
          .eq("user_id", session.user.id)
          .single();

        if (profile?.establishment_id) {
          const { data: est } = await supabase
            .from("establishments")
            .select("*")
            .eq("id", profile.establishment_id)
            .single();
          
          if (est) {
            setEstablishment(est);
          }
        }
      } catch (error) {
        console.error("Auth error:", error);
        navigate("/auth");
      }
    };

    const loadOrders = async (opts?: { background?: boolean }) => {
      try {
        const background = !!opts?.background;
        if (!background && firstLoadRef.current) setLoading(true);
        
        const { data, error } = await supabase
          .from("orders")
          .select(`
            *,
            order_items (
              *,
              products (name)
            )
          `)
          .eq("establishment_id", establishment.id)
          .order("created_at", { ascending: false });

        if (error) throw error;
        
        setOrders(data || []);
        setFilteredOrders(data || []);
        
        // Notificações de novos pedidos são tratadas pelo sistema global (OrderNotificationProvider)
      } catch (error) {
        console.error("Error loading orders:", error);
        toast.error("Erro ao carregar pedidos");
      } finally {
        if (firstLoadRef.current) {
          setLoading(false);
          firstLoadRef.current = false;
        }
      }
    };

    const handleDeleteOrder = async (orderId: string) => {
      try {
        // Deletar usando client-side (funciona perfeitamente e é mais simples)
        // Deletar order_items primeiro
        const { error: itemsError } = await supabase
          .from("order_items")
          .delete()
          .eq("order_id", orderId);
        if (itemsError) throw itemsError;

        // Deletar PIX payments se existir
        await supabase
          .from("pix_payments")
          .delete()
          .eq("order_id", orderId);

        // Deletar o pedido
        const { error } = await supabase
          .from("orders")
          .delete()
          .eq("id", orderId);
        if (error) throw error;

        toast.success("Pedido excluído com sucesso");
        loadOrders();
      } catch (error) {
        console.error("Error deleting order:", error);
        toast.error("Erro ao excluir pedido");
      }
    };

    const handleUpdateOrder = async (e: React.FormEvent) => {
      e.preventDefault();
      
      if (!selectedOrder) return;

      try {
        const formData = new FormData(e.target as HTMLFormElement);
        
        const updateData = {
          customer_name: formData.get("customer_name") as string,
          customer_phone: formData.get("customer_phone") as string,
          status: formData.get("status") as string,
          payment_status: formData.get("payment_status") as string,
          payment_method: formData.get("payment_method") as string,
          notes: formData.get("notes") as string,
          table_number: formData.get("table_number") as string,
        };

        const { error } = await supabase
          .from("orders")
          .update(updateData)
          .eq("id", selectedOrder.id);

        if (error) throw error;

        toast.success("Pedido atualizado com sucesso");
        setIsEditDialogOpen(false);
        setSelectedOrder(null);
        loadOrders();
      } catch (error) {
        console.error("Error updating order:", error);
        toast.error("Erro ao atualizar pedido");
      }
    };

    const handlePrintOrder = async (order: Order) => {
      let items: Array<{ name: string; quantity: number; unitPrice: number; totalPrice: number; notes?: string }> = (order.order_items || []).map(item => ({
        name: item.products?.name || 'Item',
        quantity: item.quantity,
        unitPrice: item.unit_price,
        totalPrice: item.total_price,
        notes: item.notes || undefined // Garantir que notes seja passado mesmo se null
      }));

      // Fallback: se não veio com itens, buscar diretamente no banco antes de desistir
      if (items.length === 0) {
        try {
          const { data, error } = await supabase
            .from('order_items')
            .select('quantity, unit_price, total_price, notes, products(name)')
            .eq('order_id', order.id);
          if (!error && data && data.length > 0) {
            items = data.map((it: any) => ({
              name: it.products?.name || 'Item',
              quantity: it.quantity,
              unitPrice: it.unit_price,
              totalPrice: it.total_price,
              notes: it.notes || undefined, // Garantir que notes seja preservado
            }));
          }
        } catch {}
      }

      // Último fallback: tentar extrair itens do texto em notes (WhatsApp preview)
      if (items.length === 0 && order.notes) {
        const lines = order.notes.split('\n').map(l => l.trim()).filter(Boolean);
        const parsed: Array<{ name: string; quantity: number; unitPrice: number; totalPrice: number; notes?: string }> = [];
        const parsePrice = (raw: string) => {
          const s = raw.trim();
          if (s.includes(',')) {
            return parseFloat(s.replace(/\./g, '').replace(',', '.')) || 0;
          }
          return parseFloat(s) || 0;
        };
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          // Formatos possíveis: "*2x Nome* - R$ 23,00" ou "2x Nome - R$ 23,00" ou "*1x Na Brasa Clássico* - Simples - R$ 15.00 Sem molho"
          // Limpa asteriscos mas preserva o texto
          const clean = line.replace(/^\*/g,'').replace(/\*$/g,'');
          
          // Tenta vários padrões de matching
          // Padrão 1: "1x Nome - Variante - R$ 15.00 Sem molho" ou "1x Nome - R$ 15.00 Sem molho"
          let m = clean.match(/(\d+)x\s+(.+?)\s*-\s*(?:[^-]+\s*-\s*)?R\$\s*([\d,.]+)\s*(.+)?$/i);
          
          // Padrão 2: "1x Nome - R$ 15.00" (sem variante)
          if (!m) {
            m = clean.match(/(\d+)x\s+(.+?)\s*-\s*R\$\s*([\d,.]+)\s*(.+)?$/i);
          }
          
          if (m) {
            const qty = parseInt(m[1], 10) || 1;
            let name = m[2].replace(/\*/g,'').trim();
            // Remove possíveis informações de molho do nome se vieram misturadas
            name = name.replace(/\s*(Sem molho|Molhos?:.*)$/i, '').trim();
            const total = parsePrice(m[3]);
            const unit = total / qty;
            
            // Capturar informações de molho
            let notes = '';
            
            // 1. Tenta capturar na mesma linha após o preço (m[4])
            if (m[4]) {
              notes = m[4].trim();
              // Se capturou algo que não parece molho, descarta
              if (notes && !notes.match(/^(Sem molho|Molhos?:|Molho:|Obs:)/i)) {
                // Verifica se tem molho em outro lugar da linha
                const molhoNaLinha = clean.match(/(Sem molho|Molhos?:[^$]+)/i);
                notes = molhoNaLinha ? molhoNaLinha[1].trim() : '';
              }
            }
            
            // 2. Se não encontrou, verifica a próxima linha
            if (!notes && i + 1 < lines.length) {
              const nextLine = lines[i + 1].trim();
              // Padrões: "Sem molho", "Molhos: X", "Molhos: X, Y", "Obs: ..."
              if (nextLine.match(/^(Sem molho|Molhos?:|Molho:|Obs:)/i)) {
                notes = nextLine;
                i++; // Consome a próxima linha
              }
            }
            
            // 3. Última tentativa: busca na linha original após o preço
            if (!notes) {
              const afterPrice = clean.split(/R\$\s*[\d,.]+/i);
              if (afterPrice.length > 1) {
                const rest = afterPrice[1].trim();
                const molhoMatch = rest.match(/(Sem molho|Molhos?:[^]*)/i);
                if (molhoMatch) {
                  notes = molhoMatch[1].trim();
                }
              }
            }
            
            parsed.push({ name, quantity: qty, unitPrice: unit, totalPrice: total, notes: notes || undefined });
          }
        }
        if (parsed.length > 0) items = parsed;
        // Se ainda vazio, imprime ao menos um item genérico com o total
        if (parsed.length === 0) {
          items = [{ name: 'Pedido Online', quantity: 1, unitPrice: order.total_amount, totalPrice: order.total_amount, notes: order.notes }];
        }
      }

      // Garantir que as notas dos order_items sejam preservadas
      // Se temos order_items com notes mas não foram passadas, tentar buscar novamente com mais detalhes
      if (items.length > 0 && items.some(item => !item.notes) && order.order_items) {
        // Mapear items pelos nomes para adicionar notes faltantes
        const itemsMap = new Map(items.map(item => [item.name.toLowerCase(), item]));
        order.order_items.forEach(orderItem => {
          const itemName = orderItem.products?.name?.toLowerCase() || '';
          const existingItem = itemsMap.get(itemName);
          if (existingItem && !existingItem.notes && orderItem.notes) {
            existingItem.notes = orderItem.notes;
          }
        });
      }

      if (items.length === 0) {
        toast.error("Pedido sem itens para imprimir");
        return;
      }

      // Nome + endereço ao lado do nome
      let customerDisplay = order.customer_name || '';
      if (order.notes) {
        const text = order.notes.replace(/\*/g, '');
        const mAddr = text.match(/Endereç[oa]:\s*([^*\n]+)/i);
        if (mAddr && mAddr[1]) {
          const addr = mAddr[1].trim();
          if (addr) customerDisplay = `${customerDisplay} - ${addr}`.trim();
        }
      }

      const receiptData = {
        orderNumber: order.order_number,
        customerName: customerDisplay,
        customerPhone: order.customer_phone,
        items,
        subtotal: order.subtotal,
        discountAmount: order.discount_amount || 0,
        deliveryFee: order.delivery_fee || 0,
        totalAmount: order.total_amount,
        establishmentName: establishment?.name || "",
        establishmentAddress: (establishment as any)?.address,
        establishmentPhone: (establishment as any)?.phone,
        paymentMethod: order.payment_method,
        orderType: order.order_type || "delivery"
      };

      await printReceipt(receiptData);
      toast.success("Pedido enviado para impressão");
    };

    const handleRejectOrder = async (orderId: string) => {
      try {
        const { error } = await supabase
          .from("orders")
          .update({ status: "cancelled" })
          .eq("id", orderId);

        if (error) throw error;

        toast.success("Pedido recusado com sucesso");
        loadOrders();
      } catch (error) {
        console.error("Error rejecting order:", error);
        toast.error("Erro ao recusar pedido");
      }
    };

    const handleAcceptAndPrintOrder = async (order: Order) => {
      try {
        // Primeiro, imprimir o pedido (como PDV)
        await handlePrintOrder(order);
        
        // Then update status to preparing
        const { error } = await supabase
          .from("orders")
          .update({ status: "preparing" })
          .eq("id", order.id);

        if (error) throw error;

        toast.success("Pedido aceito e enviado para impressão");
        loadOrders();
      } catch (error) {
        console.error("Error accepting order:", error);
        toast.error("Erro ao aceitar pedido");
      }
    };

    const handleAcceptOrder = async (orderId: string) => {
      try {
        const { error } = await supabase
          .from("orders")
          .update({ status: "preparing" })
          .eq("id", orderId);

        if (error) throw error;

        toast.success("Pedido aceito com sucesso");
        loadOrders();
      } catch (error) {
        console.error("Error accepting order:", error);
        toast.error("Erro ao aceitar pedido");
      }
    };

    const getStatusColor = (status: string) => {
      switch (status) {
        case "pending": return "bg-yellow-500";
        case "preparing": return "bg-blue-500";
        case "ready": return "bg-green-500";
        case "completed": return "bg-green-600";
        case "cancelled": return "bg-red-500";
        default: return "bg-gray-500";
      }
    };

    const getStatusText = (status: string) => {
      switch (status) {
        case "pending": return "Pendente";
        case "preparing": return "Preparando";
        case "ready": return "Pronto";
        case "completed": return "Concluído";
        case "cancelled": return "Cancelado";
        default: return status;
      }
    };

    if (loading) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
            <p className="mt-4 text-muted-foreground">Carregando pedidos...</p>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-background flex">
        <Sidebar />
        
        <main className="flex-1 p-6">
          <div className="max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-6">
              <h1 className="text-3xl font-bold text-foreground">Gerenciar Pedidos</h1>
              <div className="flex items-center space-x-4">
                <div className="relative">
                  <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Buscar pedidos..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 w-64"
                  />
                </div>
              </div>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="pending" className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Pendentes (Site)
                </TabsTrigger>
                <TabsTrigger value="completed" className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  PDV / Concluídos
                </TabsTrigger>
              </TabsList>

              <TabsContent value={activeTab} className="space-y-6">
                {filteredOrders.length === 0 ? (
                  <Card className="p-12 text-center">
                    <Package className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                    <h3 className="text-lg font-semibold mb-2">Nenhum pedido encontrado</h3>
                    <p className="text-muted-foreground">
                      {activeTab === "pending" 
                        ? "Não há pedidos pendentes do site no momento"
                        : "Não há pedidos do PDV ou concluídos"
                      }
                    </p>
                  </Card>
                ) : (
                  filteredOrders.map((order) => {
                    const isOnlineOrder = order.channel === "online" || order.origin === "site" || order.source_domain;
                    const isPendingOnline = isOnlineOrder && (order.status === "pending" || order.status === "preparing");

                    return (
                      <Card key={order.id} className="p-6">
                        <div className="flex justify-between items-start">
                          <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                              <h3 className="font-semibold text-lg mb-2 flex items-center gap-2">
                                Pedido #{order.order_number}
                                {isOnlineOrder && (
                                  <Badge variant="outline" className="text-xs">
                                    SITE
                                  </Badge>
                                )}
                              </h3>
                              <div className="space-y-1 text-sm text-muted-foreground">
                                {order.customer_name && (
                                  <p className="flex items-center">
                                    <Package className="h-4 w-4 mr-1" />
                                    {order.customer_name}
                                  </p>
                                )}
                                {order.customer_phone && (
                                  <p className="flex items-center">
                                    <Phone className="h-4 w-4 mr-1" />
                                    {order.customer_phone}
                                  </p>
                                )}
                                {order.table_number && (
                                  <p className="flex items-center">
                                    <MapPin className="h-4 w-4 mr-1" />
                                    Mesa {order.table_number}
                                  </p>
                                )}
                              </div>
                            </div>

                            <div>
                              <div className="space-y-2">
                                <Badge className={getStatusColor(order.status)}>
                                  {getStatusText(order.status)}
                                </Badge>
                                <Badge variant="outline">
                                  {order.payment_status === "paid" ? "Pago" : "Pendente"}
                                </Badge>
                                <p className="text-sm text-muted-foreground flex items-center">
                                  <Clock className="h-4 w-4 mr-1" />
                                  {new Date(order.created_at).toLocaleString("pt-BR")}
                                </p>
                              </div>
                            </div>

                            <div className="text-right">
                              <p className="text-2xl font-bold text-primary flex items-center justify-end">
                                <DollarSign className="h-5 w-5" />
                                {order.total_amount.toLocaleString("pt-BR", {
                                  minimumFractionDigits: 2
                                })}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {order.order_items?.length || 0} item(s)
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center space-x-2 ml-4">
                            {/* Show Print and Reject buttons only for pending online orders */}
                            {isPendingOnline && order.status === "pending" && (
                              <>
                                <Button 
                                  variant="default" 
                                  size="sm"
                                  onClick={() => handleAcceptAndPrintOrder(order)}
                                  className="bg-green-600 hover:bg-green-700"
                                >
                                  <Printer className="h-4 w-4 mr-2" />
                                  Aceitar e Imprimir
                                </Button>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button variant="destructive" size="sm">
                                      <XCircle className="h-4 w-4" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Recusar Pedido</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Tem certeza que deseja recusar o pedido #{order.order_number}? Esta ação não pode ser desfeita.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                      <AlertDialogAction onClick={() => handleRejectOrder(order.id)}>
                                        Recusar Pedido
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </>
                            )}

                            {/* Show Print button for preparing online orders */}
                            {isPendingOnline && order.status === "preparing" && (
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => handlePrintOrder(order)}
                              >
                                <Printer className="h-4 w-4" />
                              </Button>
                            )}

                            {/* Standard view button for all orders */}
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button variant="outline" size="sm">
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-2xl">
                                <DialogHeader>
                                  <DialogTitle>Detalhes do Pedido #{order.order_number}</DialogTitle>
                                </DialogHeader>
                                <div className="space-y-4">
                                  <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                      <strong>Cliente:</strong> {order.customer_name || "N/A"}
                                    </div>
                                    <div>
                                      <strong>Telefone:</strong> {order.customer_phone || "N/A"}
                                    </div>
                                    <div>
                                      <strong>Status:</strong> {getStatusText(order.status)}
                                    </div>
                                    <div>
                                      <strong>Pagamento:</strong> {order.payment_status === "paid" ? "Pago" : "Pendente"}
                                    </div>
                                    {order.source_domain && (
                                      <div className="col-span-2">
                                        <strong>Origem:</strong> {order.source_domain}
                                      </div>
                                    )}
                                  </div>
                                  
                                  <div>
                                    <strong>Itens:</strong>
                                    <div className="mt-2 space-y-2">
                                      {order.order_items?.map((item, index) => (
                                        <div key={index} className="flex justify-between items-center p-2 border rounded">
                                          <span>{item.quantity}x {item.products.name}</span>
                                          <span>R$ {item.total_price.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>

                                  {order.notes && (
                                    <div>
                                      <strong>Observações:</strong>
                                      <p className="text-sm text-muted-foreground mt-1">{order.notes}</p>
                                    </div>
                                  )}
                                </div>
                              </DialogContent>
                            </Dialog>

                            {/* Edit button for all orders */}
                            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                              <DialogTrigger asChild>
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => setSelectedOrder(order)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                              </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Editar Pedido #{order.order_number}</DialogTitle>
                          </DialogHeader>
                          <form onSubmit={handleUpdateOrder} className="space-y-4">
                            <div>
                              <Label htmlFor="customer_name">Nome do Cliente</Label>
                              <Input
                                id="customer_name"
                                name="customer_name"
                                defaultValue={selectedOrder?.customer_name || ""}
                              />
                            </div>
                            <div>
                              <Label htmlFor="customer_phone">Telefone</Label>
                              <Input
                                id="customer_phone"
                                name="customer_phone"
                                defaultValue={selectedOrder?.customer_phone || ""}
                              />
                            </div>
                            <div>
                              <Label htmlFor="status">Status</Label>
                              <select
                                id="status"
                                name="status"
                                defaultValue={selectedOrder?.status || ""}
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                <option value="pending">Pendente</option>
                                <option value="preparing">Preparando</option>
                                <option value="ready">Pronto</option>
                                <option value="completed">Concluído</option>
                                <option value="cancelled">Cancelado</option>
                              </select>
                            </div>
                            <div>
                              <Label htmlFor="payment_status">Status do Pagamento</Label>
                              <select
                                id="payment_status"
                                name="payment_status"
                                defaultValue={selectedOrder?.payment_status || ""}
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                <option value="pending">Pendente</option>
                                <option value="paid">Pago</option>
                              </select>
                            </div>
                            <div>
                              <Label htmlFor="payment_method">Método de Pagamento</Label>
                              <Input
                                id="payment_method"
                                name="payment_method"
                                defaultValue={selectedOrder?.payment_method || ""}
                              />
                            </div>
                            <div>
                              <Label htmlFor="table_number">Mesa</Label>
                              <Input
                                id="table_number"
                                name="table_number"
                                defaultValue={selectedOrder?.table_number || ""}
                              />
                            </div>
                            <div>
                              <Label htmlFor="notes">Observações</Label>
                              <Textarea
                                id="notes"
                                name="notes"
                                defaultValue={selectedOrder?.notes || ""}
                              />
                            </div>
                            <div className="flex justify-end space-x-2">
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                  setIsEditDialogOpen(false);
                                  setSelectedOrder(null);
                                }}
                              >
                                Cancelar
                              </Button>
                              <Button type="submit">
                                Atualizar
                              </Button>
                            </div>
                          </form>
                        </DialogContent>
                      </Dialog>

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
                            <AlertDialogDescription>
                              Tem certeza que deseja excluir o pedido #{order.order_number}? 
                              Esta ação não pode ser desfeita.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDeleteOrder(order.id)}
                              className="bg-red-600 hover:bg-red-700"
                            >
                              Excluir
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>

                  {order.notes && (
                    <div className="mt-4 p-3 bg-muted rounded-md">
                      <p className="text-sm"><strong>Observações:</strong> {order.notes}</p>
                    </div>
                  )}
                </Card>
              );
            })
          )}
        </TabsContent>
      </Tabs>
          </div>
        </main>
      </div>
    );
  };

  export default Orders;