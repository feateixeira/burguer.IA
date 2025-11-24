  import { useState, useEffect, useRef, useMemo, useCallback } from "react";
  import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
  import { Button } from "@/components/ui/button";
  import { Badge } from "@/components/ui/badge";
  import { Input } from "@/components/ui/input";
  import { Label } from "@/components/ui/label";
  import { Textarea } from "@/components/ui/textarea";
  import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
  import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
  } from "@/components/ui/select";
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
    CheckCircle,
    CheckCircle2,
    ArrowRight,
    Truck,
    MessageCircle,
    SquarePen,
    Monitor
  } from "lucide-react";
  import Sidebar from "@/components/Sidebar";
  import { printReceipt, printNonFiscalReceipt, type NonFiscalReceiptData } from "@/utils/receiptPrinter";
  import { useSidebarWidth } from "@/hooks/useSidebarWidth";
import { useCashSession } from "@/hooks/useCashSession";
import { phoneMask } from "@/utils/phoneNormalizer";
import { buildWhatsLink, shouldShowWhatsButton } from "@/utils/whatsappLink";
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
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
  } from "@/components/ui/tooltip";

// Função para formatar valores monetários no padrão brasileiro
const formatCurrencyBR = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

interface Order {
    id: string;
    order_number: string;
    customer_name?: string;
    customer_phone?: string;
    status: string;
    payment_status: string;
    order_type: string;
    delivery_type?: string;
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
    rejection_reason?: string;
    accepted_and_printed_at?: string;
    order_items?: {
      id: string;
      quantity: number;
      unit_price: number;
      total_price: number;
      notes?: string;
      customizations?: any;
      products: {
        name: string;
      };
    }[];
  }

  const Orders = () => {
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const firstLoadRef = useRef(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [establishment, setEstablishment] = useState<any>(null);
    const [activeTab, setActiveTab] = useState<string>("pending");
    const [isNaBrasa, setIsNaBrasa] = useState(false);
    const [rejectionReason, setRejectionReason] = useState("");
    const [orderToReject, setOrderToReject] = useState<string | null>(null);
  const [showAllDates, setShowAllDates] = useState(false);
  const [showPDV, setShowPDV] = useState(false);
  const [showSite, setShowSite] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>("");
  const [showNonFiscalModal, setShowNonFiscalModal] = useState(false);
  const [orderForNonFiscal, setOrderForNonFiscal] = useState<Order | null>(null);
  const [customerCpf, setCustomerCpf] = useState("");
  const [customerPhoneNonFiscal, setCustomerPhoneNonFiscal] = useState("");
  const [editPaymentMethod, setEditPaymentMethod] = useState<string>("");
  const [showDeliveryBoyDialog, setShowDeliveryBoyDialog] = useState(false);
  const [pendingOrderForAccept, setPendingOrderForAccept] = useState<Order | null>(null);
  const [deliveryBoys, setDeliveryBoys] = useState<any[]>([]);
  const [selectedDeliveryBoyId, setSelectedDeliveryBoyId] = useState<string>("");
  const navigate = useNavigate();
    const sidebarWidth = useSidebarWidth();
    const [isDesktop, setIsDesktop] = useState(false);
    
    // Verificar se o caixa está aberto
    const { hasOpenSession, loading: cashLoading } = useCashSession(establishment?.id || null);

    useEffect(() => {
      const checkDesktop = () => setIsDesktop(window.innerWidth >= 1024);
      checkDesktop();
      window.addEventListener('resize', checkDesktop);
      return () => window.removeEventListener('resize', checkDesktop);
    }, []);

    useEffect(() => {
      checkAuth();
    }, []);

     useEffect(() => {
       if (establishment) {
         loadOrders();

         // OTIMIZAÇÃO: Throttle recarregamento para evitar muitas requisições
         let reloadTimeout: NodeJS.Timeout | null = null;
         const reloadWithThrottle = (immediate = false) => {
           if (reloadTimeout) clearTimeout(reloadTimeout);
           if (immediate) {
             loadOrders({ background: true });
           } else {
             // Aguardar 500ms antes de recarregar (throttle)
             reloadTimeout = setTimeout(() => {
               loadOrders({ background: true });
             }, 500);
           }
         };

         // Realtime: escuta INSERT de novos pedidos para atualização imediata
         const channel = supabase
           .channel('orders-realtime')
           .on('postgres_changes', { 
             event: 'INSERT', 
             schema: 'public', 
             table: 'orders', 
             filter: `establishment_id=eq.${establishment.id}` 
           }, (payload) => {
             // Quando um novo pedido é inserido, recarregar imediatamente
             reloadWithThrottle(true);
           })
           .on('postgres_changes', { 
             event: '*', 
             schema: 'public', 
             table: 'orders', 
             filter: `establishment_id=eq.${establishment.id}` 
           }, () => {
             // Para updates/deletes, atualizar com throttle
             reloadWithThrottle();
           })
           .on('postgres_changes', { 
             event: '*', 
             schema: 'public', 
             table: 'order_items' 
           }, () => {
             // Quando itens são alterados, atualizar com throttle
             reloadWithThrottle();
           })
           .subscribe();

         // Escuta eventos customizados para atualização quando notificação chegar
         const handleNewOrderNotification = () => {
           reloadWithThrottle(true);
         };
         
         window.addEventListener('new-order-notification', handleNewOrderNotification);

         return () => {
           if (reloadTimeout) clearTimeout(reloadTimeout);
           supabase.removeChannel(channel);
           window.removeEventListener('new-order-notification', handleNewOrderNotification);
         };
       }
     }, [establishment]);

    // Memoizar função helper para evitar recriação
    const isFromNaBrasaSite = useCallback((order: Order) => {
      return order.source_domain?.toLowerCase().includes('hamburguerianabrasa') || false;
    }, []);

    const isFromOnlineMenu = useCallback((order: Order) => {
      if (isFromNaBrasaSite(order)) {
        return false;
      }
      if (order.channel === "online" || order.origin === "site") {
        return true;
      }
      if (order.source_domain && String(order.source_domain).trim() !== '') {
        return true;
      }
      return false;
    }, [isFromNaBrasaSite]);

    const isPDVOrder = useCallback((order: Order) => {
      if (order.source_domain && String(order.source_domain).trim() !== '') {
        return false;
      }
      if (isFromNaBrasaSite(order)) {
        return false;
      }
      if (order.channel === "online" || order.origin === "site") {
        return false;
      }
      if (order.channel === "totem" || order.origin === "totem") {
        return false;
      }
      return true;
    }, [isFromNaBrasaSite]);

    // Usar useMemo ao invés de useEffect para evitar loops infinitos
    const filteredOrders = useMemo(() => {
      let filtered = orders;

      // Filter by tab
      if (activeTab === "pending") {
        // Aba "Pendentes": pedidos do site/cardápio online que estão PENDENTES (pagamento OU entrega)
        // Inclui pedidos que foram aceitos e impressos mas ainda não têm ambos os status confirmados
        // Para Na Brasa: apenas pedidos do site hamburguerianabrasa.com.br
        // Para outros: apenas pedidos do cardápio online
        if (isNaBrasa) {
          filtered = filtered.filter(order => {
            // Verificar se é do site Na Brasa
            if (!isFromNaBrasaSite(order)) {
              return false;
            }
            // EXCLUIR pedidos recusados (vão para aba "Recusados")
            if (order.status === "cancelled" && order.rejection_reason) {
              return false;
            }
            // EXCLUIR imediatamente se ambos já foram confirmados (vai para "Todos os Pedidos")
            // Status final pode ser "completed" ou "ready" (Pronto)
            const statusNormalized = String(order.status).trim().toLowerCase();
            const statusConfirmed = statusNormalized === "completed" || statusNormalized === "ready";
            const paymentConfirmed = String(order.payment_status).trim().toLowerCase() === "paid";
            if (statusConfirmed && paymentConfirmed) {
              return false;
            }
            // Incluir todos os outros (pendentes em pagamento OU entrega)
            return true;
          });
        } else {
          filtered = filtered.filter(order => {
            // Verificar se é do cardápio online
            if (!isFromOnlineMenu(order)) {
              return false;
            }
            // EXCLUIR pedidos recusados (vão para aba "Recusados")
            if (order.status === "cancelled" && order.rejection_reason) {
              return false;
            }
            // EXCLUIR imediatamente se ambos já foram confirmados (vai para "Todos os Pedidos")
            // Status final pode ser "completed" ou "ready" (Pronto)
            const statusNormalized = String(order.status).trim().toLowerCase();
            const statusConfirmed = statusNormalized === "completed" || statusNormalized === "ready";
            const paymentConfirmed = String(order.payment_status).trim().toLowerCase() === "paid";
            if (statusConfirmed && paymentConfirmed) {
              return false;
            }
            // Incluir todos os outros (pendentes em pagamento OU entrega)
            return true;
          });
        }
      } else if (activeTab === "totem") {
        // Aba "Totem": pedidos do totem (channel="totem" ou origin="totem")
        filtered = filtered.filter(order => {
          return order.channel === "totem" || order.origin === "totem";
        });
      } else if (activeTab === "completed") {
        // Aba "PDV/Concluídos": 
        // Para Na Brasa: APENAS pedidos do PDV pendentes (NÃO incluir pedidos do site)
        // Para outros: APENAS pedidos do PDV que estão PENDENTES
        if (isNaBrasa) {
          // Para Na Brasa: APENAS pedidos do PDV pendentes
          // Pedidos do site Na Brasa vão para "Pendentes (Cardápio Online)" quando pendentes
          // E para "Todos os Pedidos" quando concluídos
          filtered = filtered.filter(order => {
            // Não incluir pedidos recusados aqui (eles vão para aba rejected)
            if (order.status === "cancelled" && order.rejection_reason) {
              return false;
            }
            
            // EXCLUIR pedidos do site Na Brasa (eles têm sua própria aba "Pendentes")
            if (isFromNaBrasaSite(order)) {
              return false;
            }
            
            // Verificar se é pedido do PDV pendente (pagamento OU entrega)
            // EXCLUIR pedidos do totem
            if (order.channel === "totem" || order.origin === "totem") {
              return false;
            }
            const hasNoSourceDomain = !order.source_domain || String(order.source_domain).trim() === '';
            const isNotOnline = order.channel !== "online" && order.origin !== "site";
            const isPDV = hasNoSourceDomain && isNotOnline;
            const isPDVPending = isPDV && (order.status === "pending" || order.payment_status === "pending");
            
            return isPDVPending;
          });
        } else {
          // Para outros usuários: APENAS pedidos do PDV que estão PENDENTES (pagamento OU entrega)
          // Pedido do PDV pendente = status="pending" OU payment_status="pending"
          filtered = filtered.filter(order => {
            // EXCLUIR pedidos do totem
            if (order.channel === "totem" || order.origin === "totem") {
              return false;
            }
            // Verificação direta e explícita para pedidos do PDV
            const hasNoSourceDomain = !order.source_domain || String(order.source_domain).trim() === '';
            const isNotNaBrasa = !order.source_domain?.toLowerCase().includes('hamburguerianabrasa');
            const isNotOnline = order.channel !== "online" && order.origin !== "site";
            const isPDV = hasNoSourceDomain && isNotNaBrasa && isNotOnline;
            
            // Apenas pedidos do PDV que estão pendentes (status="pending" OU payment_status="pending")
            // Pedidos confirmados (status="completed" E payment_status="paid") vão para "Todos os Pedidos"
            const isPending = order.status === "pending" || order.payment_status === "pending";
            return isPDV && isPending;
          });
        }
      } else if (activeTab === "rejected") {
        // Rejected orders (only for Na Brasa)
        filtered = filtered.filter(order => 
          order.status === "cancelled" && order.rejection_reason
        );
      } else if (activeTab === "all") {
        // Aba "Todos os Pedidos": apenas pedidos TOTALMENTE CONFIRMADOS
        // Incluir apenas pedidos que foram confirmados TANTO no pagamento QUANTO na entrega
        // Excluir:
        // 1. Pedidos recusados
        // 2. Pedidos do PDV que estão pendentes (pagamento OU entrega) - vão para "PDV/Concluídos"
        // 3. Pedidos do site/cardápio online pendentes (vão para "Pendentes")
        filtered = filtered.filter(order => {
          // Excluir pedidos recusados
          if (order.status === "cancelled" && order.rejection_reason) {
            return false;
          }
          
          // Verificar se pedido está totalmente confirmado
          // Status final pode ser "completed" ou "ready" (Pronto) E payment_status="paid"
          const statusNormalized = String(order.status).trim().toLowerCase();
          const isStatusFinal = statusNormalized === "completed" || statusNormalized === "ready";
          const isPaymentPaid = String(order.payment_status).trim().toLowerCase() === "paid";
          const isFullyConfirmed = isStatusFinal && isPaymentPaid;
          
          // Excluir pedidos do PDV que estão pendentes (pagamento OU entrega)
          if (isPDVOrder(order) && !isFullyConfirmed) {
            return false;
          }
          
          // Excluir pedidos do site/cardápio online que estão pendentes
          if ((isFromNaBrasaSite(order) || isFromOnlineMenu(order)) && !isFullyConfirmed) {
            return false;
          }
          
          // Incluir apenas pedidos TOTALMENTE confirmados 
          return isFullyConfirmed;
        });

        // Filtrar por data
        if (selectedDate) {
          // Se uma data específica foi selecionada, filtrar por ela (independente de showAllDates)
          // Extrair dia, mês e ano da data selecionada (formato YYYY-MM-DD)
          const [year, month, day] = selectedDate.split('-').map(Number);
          
          filtered = filtered.filter(order => {
            const orderDate = new Date(order.created_at);
            
            // Obter a data do pedido no fuso horário local
            const orderYear = orderDate.getFullYear();
            const orderMonth = orderDate.getMonth() + 1; // getMonth retorna 0-11
            const orderDay = orderDate.getDate();
            
            // Comparar com a data selecionada
            return orderYear === year && orderMonth === month && orderDay === day;
          });
        } else if (!showAllDates) {
          // Se nenhuma data foi selecionada E "mostrar todos" não está marcado, mostrar apenas hoje (comportamento padrão)
          const today = new Date();
          const todayYear = today.getFullYear();
          const todayMonth = today.getMonth() + 1; // getMonth retorna 0-11
          const todayDay = today.getDate();
          
          filtered = filtered.filter(order => {
            const orderDate = new Date(order.created_at);
            
            // Obter a data do pedido no fuso horário local
            const orderYear = orderDate.getFullYear();
            const orderMonth = orderDate.getMonth() + 1; // getMonth retorna 0-11
            const orderDay = orderDate.getDate();
            
            // Comparar com hoje
            return orderYear === todayYear && orderMonth === todayMonth && orderDay === todayDay;
          });
        }
        // Se showAllDates está marcado E não há data selecionada, não filtrar por data (mostrar todos)

        // Filtrar por método de pagamento
        if (selectedPaymentMethod) {
          filtered = filtered.filter(order => {
            return order.payment_method === selectedPaymentMethod;
          });
        }

        // Filtrar por origem usando checkboxes (PDV e/ou Site)
        // Se nenhum estiver selecionado, não mostrar nada
        if (!showPDV && !showSite) {
          filtered = [];
        } else {
          // Se ambos estiverem selecionados, mostrar todos (não filtrar)
          // Se apenas um estiver selecionado, filtrar por ele
          if (showPDV && !showSite) {
            // Apenas PDV
            filtered = filtered.filter(order => isPDVOrder(order));
          } else if (!showPDV && showSite) {
            // Apenas Site/Cardápio Online
            filtered = filtered.filter(order => isFromNaBrasaSite(order) || isFromOnlineMenu(order));
          }
          // Se ambos (showPDV && showSite), não filtrar (mostrar todos)
        }
      }

      // Filter by search term
      if (searchTerm) {
        filtered = filtered.filter(order =>
          order.order_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
          order.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          order.customer_phone?.includes(searchTerm)
        );
      }

      return filtered;
    }, [orders, activeTab, isNaBrasa, showAllDates, showPDV, showSite, selectedDate, selectedPaymentMethod, searchTerm, isFromNaBrasaSite, isFromOnlineMenu, isPDVOrder]);


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
            
            // Verifica se é Na Brasa (não é admin do sistema)
            const userIsSystemAdmin = session.user.email === 'fellipe_1693@outlook.com';
            if (!userIsSystemAdmin) {
              const establishmentName = est.name?.toLowerCase() || '';
              const isNaBrasaUser = establishmentName.includes('na brasa') || 
                                    establishmentName.includes('nabrasa') ||
                                    establishmentName === 'hamburgueria na brasa';
              setIsNaBrasa(isNaBrasaUser);
            } else {
              setIsNaBrasa(false);
            }
          }
        }
      } catch (error) {
        navigate("/auth");
      }
    };

    const loadOrders = async (opts?: { background?: boolean }) => {
      try {
        // Verificar se establishment está disponível
        if (!establishment?.id) {
          return;
        }

        const background = !!opts?.background;
        if (!background && firstLoadRef.current) setLoading(true);
        
        // Calculate cutoff date: 3 months ago (for performance - only load recent orders)
        const cutoffDate = new Date();
        cutoffDate.setMonth(cutoffDate.getMonth() - 3);
        
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
          .gte("created_at", cutoffDate.toISOString())
          .order("created_at", { ascending: false });

        if (error) throw error;
        
        setOrders(data || []);
        // filteredOrders é calculado automaticamente pelo useMemo baseado em orders
        
        // Notificações de novos pedidos são tratadas pelo sistema global (OrderNotificationProvider)
      } catch (error: any) {
        // Só exibir erro se não for um erro de cancelamento ou se for um erro crítico
        if (error?.code !== 'PGRST301' && error?.message !== 'The user aborted a request') {
          toast.error("Erro ao carregar pedidos");
        }
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
          payment_method: editPaymentMethod || formData.get("payment_method") as string || selectedOrder.payment_method,
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
        setEditPaymentMethod("");
        loadOrders();
      } catch (error) {
        toast.error("Erro ao atualizar pedido");
      }
    };

    // Função auxiliar para remover informações duplicadas que já aparecem no cupom
    const removeDuplicateReceiptInfo = (text: string): string | null => {
      if (!text) return null;
      
      // Primeiro, normaliza quebras de linha e espaços para facilitar matching
      let cleaned = text
        // Normaliza múltiplos espaços em um só
        .replace(/\s+/g, ' ')
        // Normaliza quebras de linha para facilitar matching de padrões multilinha
        .replace(/\n/g, ' ')
        .replace(/\r/g, ' ')
        .trim();
      
      // Remove informações que já aparecem no cupom (agora tratando como texto contínuo)
      // Primeiro, tenta padrões mais específicos para capturar variações
      cleaned = cleaned
        // Remove subtotal (com ou sem asteriscos, variáveis de formatação)
        .replace(/\*?Subtotal[:\s]*R\$\s*[\d.,\s]+/gi, '')
        // Remove taxa de entrega/entrega (várias variações, incluindo sem ":" e quebrado)
        .replace(/\*?Taxa\s+de\s+entrega[:\s]*R\$\s*[\d.,\s]+/gi, '')
        .replace(/\*?Entrega[:\s]*R\$\s*[\d.,\s]+/gi, '')
        .replace(/\*?Taxa\s+de\s+entrega\s*R\$\s*[\d.,\s]+/gi, '')
        // Remove total (case insensitive)
        .replace(/\*?Total[:\s]*R\$\s*[\d.,\s]+/gi, '')
        .replace(/\*?TOTAL[:\s]*R\$\s*[\d.,\s]+/gi, '')
        // Remove forma de entrega (pode estar quebrado: "Forma de entrega:" ou "Forma de entrega: Entrega")
        // Usa padrão mais flexível para capturar mesmo que esteja em múltiplas palavras
        .replace(/\*?Forma\s+de\s+entrega[:\s]*[^\*]*Entrega[^\*]*/gi, '')
        .replace(/\*?Forma\s+entrega[:\s]*[^\*]*Entrega[^\*]*/gi, '')
        .replace(/\*?Entrega[:\s]*[^\*]*Entrega[^\*]*/gi, '')
        .replace(/\*?Forma\s+de\s+entrega[:\s]*[^\*]+/gi, '')
        // Remove cliente (nome já aparece no cupom)
        .replace(/\*?Cliente[:\s]*[^\*]+/gi, '')
        // Remove endereço (já extraído e aparece no cupom - pode estar quebrado)
        .replace(/\*?Endereço[:\s]*[^\*]+/gi, '')
        .replace(/\*?Endereco[:\s]*[^\*]+/gi, '')
        // Remove forma de pagamento/pagamento (pode estar quebrado: "Forma de pagamento:" ou "Forma de pagamento: cartao")
        .replace(/\*?Forma\s+de\s+pagamento[:\s]*[^\*]+/gi, '')
        .replace(/\*?Forma\s+pagamento[:\s]*[^\*]+/gi, '')
        .replace(/\*?Pagamento[:\s]*[^\*]+/gi, '')
        // Remove padrões comuns que podem sobrar após quebras de linha (apenas se estiverem isolados)
        // Ex: "Forma de" sem o resto, "passado" sozinho após endereço removido
        .replace(/\bForma\s+de\s*$/gi, '')
        .replace(/^\s*passado\s*$/gi, '')
        // Remove asteriscos soltos
        .replace(/\*+/g, '')
        // Remove múltiplos espaços novamente após remoções
        .replace(/\s+/g, ' ')
        .trim();
      
      // Verifica se o texto contém APENAS informações duplicadas (não deve ser impresso)
      const duplicateKeywords = [
        'subtotal', 'total', 'entrega', 'taxa', 'cliente', 'endereço', 'endereco',
        'pagamento', 'forma', 'cartao', 'cartão', 'dinheiro', 'pix'
      ];
      
      const words = cleaned.toLowerCase().split(/\s+/).filter(w => w.length > 2);
      const duplicateWordCount = words.filter(w => 
        duplicateKeywords.some(kw => w.includes(kw))
      ).length;
      
      // Se mais de 50% das palavras são de informações duplicadas, considera como apenas duplicatas
      if (words.length > 0 && (duplicateWordCount / words.length) > 0.5) {
        return null;
      }
      
      // Se sobrou apenas espaços ou ficou vazio, retorna null
      if (!cleaned || cleaned.length < 2) return null;
      
      return cleaned;
    };

    const handlePrintOrder = async (order: Order) => {
      let items: Array<{ name: string; quantity: number; unitPrice: number; totalPrice: number; notes?: string }> = [];
      
      // Função para extrair informações do trio do campo notes (retorna o primeiro encontrado)
      const extractTrioInfo = (notesText: string): string | null => {
        if (!notesText) return null;
        
        // Procura por padrões como "Trio:", "Trio :", etc.
        // Pode estar em linha separada ou no meio do texto
        // Usa regex mais flexível que captura até o final da linha ou até encontrar outro marcador
        const trioRegex = /Trio\s*:\s*([^\n\[\]]+?)(?:\n|$|\[|Subtotal|Total|Forma|Cliente|Endereço)/i;
        let match = notesText.match(trioRegex);
        
        // Se não encontrou, tenta procurar em múltiplas linhas
        if (!match) {
          // Remove colchetes temporariamente para buscar
          const textWithoutBrackets = notesText.replace(/\[([^\]]+)\]/g, '');
          match = textWithoutBrackets.match(/Trio\s*:\s*([^\n]+)/i);
        }
        
        // Se ainda não encontrou, tenta procurar em qualquer lugar do texto
        if (!match) {
          const lines = notesText.split('\n');
          for (const line of lines) {
            const lineMatch = line.match(/Trio\s*:\s*(.+)/i);
            if (lineMatch && lineMatch[1]) {
              match = lineMatch;
              break;
            }
          }
        }
        
        if (match && match[1]) {
          let trioText = match[1].trim();
          // Remove espaços extras
          trioText = trioText.replace(/\s+/g, ' ').trim();
          // Remove apenas caracteres que não são letras, números, espaços, +, : ou -
          // Preserva o conteúdo útil como "Batata pequena + Coca-Cola lata"
          trioText = trioText.replace(/[^\w\s+\-:áàâãéêíóôõúçÁÀÂÃÉÊÍÓÔÕÚÇ]/g, '').trim();
          if (trioText.length > 0) {
            return trioText;
          }
        }
        return null;
      };
      
      // Função para extrair TODAS as informações de trio do campo notes
      const extractAllTrioInfo = (notesText: string): string[] => {
        if (!notesText) return [];
        
        const trios: string[] = [];
        
        // Procura por todos os padrões "Trio: ..." no texto
        // Remove colchetes temporariamente para buscar
        const textWithoutBrackets = notesText.replace(/\[([^\]]+)\]/g, '');
        
        // Procura por todas as linhas que começam com "Trio:"
        const lines = textWithoutBrackets.split('\n');
        for (const line of lines) {
          const lineMatch = line.trim().match(/^Trio\s*:\s*(.+)$/i);
          if (lineMatch && lineMatch[1]) {
            let trioText = lineMatch[1].trim();
            // Remove espaços extras
            trioText = trioText.replace(/\s+/g, ' ').trim();
            // Limpa caracteres especiais mas preserva conteúdo útil
            trioText = trioText.replace(/[^\w\s+\-:áàâãéêíóôõúçÁÀÂÃÉÊÍÓÔÕÚÇ]/g, '').trim();
            if (trioText.length > 0) {
              trios.push(trioText);
            }
          }
        }
        
        return trios;
      };
      
      // PRIORIDADE 1: Tentar extrair itens do texto em notes usando colchetes [ ]
      // Este é o novo formato padrão vindo do site hamburguerianabrasa.com.br
      if (order.notes) {
        const parsed: Array<{ name: string; quantity: number; unitPrice: number; totalPrice: number; notes?: string }> = [];
        
        const parsePrice = (raw: string) => {
          const s = raw.trim();
          if (s.includes(',')) {
            return parseFloat(s.replace(/\./g, '').replace(',', '.')) || 0;
          }
          return parseFloat(s) || 0;
        };
        
        // Encontra todos os blocos entre colchetes [ ]
        // Usa regex global para encontrar todas as ocorrências, mesmo que estejam em múltiplas linhas
        const bracketRegex = /\[([^\]]+)\]/g;
        const text = order.notes;
        let match;
        // Guarda o texto original de cada item para verificar "+ Trio"
        const originalItemTexts: Map<number, string> = new Map();
        let itemIndex = 0;
        
        // Extrai trios de cada item individualmente (antes de processar os itens)
        // PRIORIDADE: Extrai do nome do item quando tem "+ Trio (conteúdo)"
        // Ignora linhas "Trio: ..." separadas para evitar duplicação
        const itemTrios: Map<number, string> = new Map();
        let tempMatch;
        let tempIndex = 0;
        const tempRegex = /\[([^\]]+)\]/g;
        while ((tempMatch = tempRegex.exec(text)) !== null) {
          const itemText = tempMatch[1].trim();
          if (itemText) {
            // PRIMEIRO: Procura por "+ Trio (conteúdo)" no nome do item
            const trioInNameMatch = itemText.match(/\+\s*Trio\s*\(([^)]+)\)/i);
            if (trioInNameMatch && trioInNameMatch[1]) {
              // Extrai o conteúdo dos parênteses após "+ Trio"
              let trioText = trioInNameMatch[1].trim();
              trioText = trioText.replace(/\s+/g, ' ').trim();
              if (trioText.length > 0) {
                itemTrios.set(tempIndex, trioText);
              }
            } else {
              // FALLBACK: Se não encontrou no nome, procura por "Trio: ..." como linha separada
              // Mas só se não houver "+ Trio" no texto (para evitar duplicação)
              if (!itemText.toLowerCase().includes('+ trio')) {
                const trioMatch = itemText.match(/Trio\s*:\s*([^\n\[\]]+)/i);
                if (trioMatch && trioMatch[1]) {
                  let trioText = trioMatch[1].trim();
                  trioText = trioText.replace(/\s+/g, ' ').trim();
                  if (trioText.length > 0) {
                    itemTrios.set(tempIndex, trioText);
                  }
                }
              }
            }
          }
          tempIndex++;
        }
        
        while ((match = bracketRegex.exec(text)) !== null) {
          const itemText = match[1].trim(); // Texto dentro dos colchetes
          
          if (!itemText) continue;
          
          // GUARDA o texto original ANTES de processar
          originalItemTexts.set(itemIndex, itemText);
          
          // Extrai quantidade: "1x", "2x", etc.
          const qtyMatch = itemText.match(/^(\d+)x\s+/i);
          if (!qtyMatch) continue; // Se não tem quantidade, não é um item válido
          
          const qty = parseInt(qtyMatch[1], 10) || 1;
          if (qty <= 0 || qty > 1000) continue;
          
          // Remove a quantidade do texto para processar o resto
          let remainingText = itemText.replace(/^\d+x\s+/i, '').trim();
          
          // Extrai o preço: "R$ 15.00" ou "R$15,00"
          const priceMatch = remainingText.match(/R\$\s*([\d.,]+)/i);
          if (!priceMatch) continue; // Se não tem preço, não é um item válido
          
          const total = parsePrice(priceMatch[1]);
          if (total <= 0) continue;
          
          const unit = total / qty;
          
          // Remove o preço do texto para obter o nome e observações
          remainingText = remainingText.replace(/R\$\s*[\d.,]+\s*/i, '').trim();
          
          // Separa nome e observações
          // Observações geralmente começam com "Obs:", "Observação:", "Molhos:", etc.
          // Pode ter múltiplas observações no mesmo item
          // Procura por qualquer padrão de observação no texto
          const notesKeywords = ['Obs:', 'Observação:', 'Molhos:', 'Molho:'];
          let firstNotesIndex = -1;
          
          for (const keyword of notesKeywords) {
            const index = remainingText.toLowerCase().indexOf(keyword.toLowerCase());
            if (index !== -1 && (firstNotesIndex === -1 || index < firstNotesIndex)) {
              firstNotesIndex = index;
            }
          }
          
          let name = remainingText;
          let notes: string | undefined = undefined;
          
          // Verifica ANTES de separar nome/notes se contém "+ Trio"
          // Isso é importante para detectar corretamente - GUARDA ANTES DE LIMPAR
          const originalRemainingText = remainingText;
          const hasTrioInName = originalRemainingText.toLowerCase().includes('+ trio') || originalRemainingText.toLowerCase().includes('+trio');
          
          if (firstNotesIndex !== -1) {
            // Separa nome (antes da primeira observação) e observações (resto)
            name = remainingText.substring(0, firstNotesIndex).trim();
            
            // Remove "+ Trio (conteúdo)" do nome - remove todo o padrão incluindo parênteses
            name = name.replace(/\s*\+\s*Trio\s*\([^)]+\)\s*/gi, '').trim();
            
            // Remove "+ Trio" simples (sem parênteses) do nome
            name = name.replace(/\s*\+\s*Trio\s*/gi, '').trim();
            
            // Remove informações de trio entre parênteses do nome (ex: "Simples(Batata pequena + Coca-Cola Zero lata)")
            // Remove qualquer conteúdo entre parênteses que contenha palavras relacionadas a trio
            name = name.replace(/\s*\([^)]*(trio|batata|coca|guaraná|pequena|grande|refrigerante|bebida)[^)]*\)/gi, '').trim();
            
            // Remove TODOS os padrões de "Trio:" do nome (com ou sem hífen antes)
            // Isso remove: " - Trio: ...", " Trio: ...", "-Trio: ...", etc.
            name = name.replace(/\s*[-]?\s*Trio\s*:\s*[^\n]*/gi, '').trim();
            
            const notesText = remainingText.substring(firstNotesIndex).trim();
            
            // Limpa o nome de qualquer hífen ou espaço extra no final
            name = name.replace(/-\s*$/, '').trim();
            
            // As observações podem ter múltiplas partes (ex: "Obs: Sem cebola Molhos: Ervas")
            // Limpa espaços extras
            notes = notesText.replace(/\s+/g, ' ').trim();
            
            // Remove "Obs:" duplicado no início
            notes = notes.replace(/^(Obs:\s*)+/i, 'Obs: ');
            notes = notes.replace(/(Obs:\s*){2,}/gi, 'Obs: ');
            
            // CRÍTICO: Se começa com "Obs:" seguido imediatamente por outro marcador (Molhos:, Observação:, etc.)
            // Remove o "Obs:" completamente, pois não há conteúdo real após ele
            // Ex: "Obs: Molhos: Bacon" -> "Molhos: Bacon"
            if (notes.match(/^Obs:\s+(Molhos?|Observação|Obs):\s*/i)) {
              notes = notes.replace(/^Obs:\s+/i, '').trim();
              // Verifica se após remover "Obs:" ficou apenas o marcador sem conteúdo
              // Ex: "Molhos: " (sem valor) -> undefined
              const afterMarker = notes.replace(/^(Molhos?|Observação|Obs):\s*/i, '').trim();
              if (!afterMarker || afterMarker.length < 1) {
                notes = undefined;
              }
            }
            
            // Se começa com "Obs:" mas não tem conteúdo após (só espaços, vazio)
            if (notes && notes.match(/^Obs:\s*$/i)) {
              notes = undefined;
            }
            
            // Se está vazio ou só tem espaços, não adiciona
            if (!notes || notes.length < 2) {
              notes = undefined;
            }
          } else {
            // Se não tem observações explícitas, o texto todo é o nome
            // Remove "+ Trio (conteúdo)" do nome - remove todo o padrão incluindo parênteses
            name = remainingText.replace(/\s*\+\s*Trio\s*\([^)]+\)\s*/gi, '').trim();
            
            // Remove "+ Trio" simples (sem parênteses) do nome
            name = name.replace(/\s*\+\s*Trio\s*/gi, '').trim();
            
            // Remove informações de trio entre parênteses do nome (ex: "Simples(Batata pequena + Coca-Cola Zero lata)")
            name = name.replace(/\s*\([^)]*trio[^)]*\)/gi, '').trim();
            name = name.replace(/\s*\([^)]*batata[^)]*\)/gi, '').trim(); // Remove também se mencionar batata
            
            // Remove TODOS os padrões de "Trio:" do nome (com ou sem hífen antes)
            // Isso remove: " - Trio: ...", " Trio: ...", "-Trio: ...", etc.
            name = name.replace(/\s*[-]?\s*Trio\s*:\s*[^\n]*/gi, '').trim();
            
            // Remove hífen ou espaço extra no final
            name = name.replace(/-\s*$/, '').trim();
          }
          
          // Valida o nome
          if (!name || name.length < 2) continue;
          
          // Limpa e valida as notas - remove informações duplicadas
          if (notes) {
            notes = notes.replace(/^\*\s*/, '').replace(/\s*\*$/, '').trim();
            
            // Verifica se é acompanhamento pelo nome (heurística quando categoria não está disponível)
            const itemNameLower = name.toLowerCase();
            const isAccompaniment = itemNameLower.includes('batata') || 
                                   itemNameLower.includes('frango no pote') ||
                                   itemNameLower.includes('frango pote') ||
                                   itemNameLower.includes('acompanhamento');
            
            // Se for acompanhamento, remove "Molho:" das notas e "Obs:" antes de "Opção:"
            if (isAccompaniment) {
              notes = notes.replace(/Molhos?\s*:\s*/gi, '').trim();
              // Remove "Obs: Molho:" se restou
              notes = notes.replace(/^Obs:\s*Molhos?\s*:\s*/i, 'Obs: ').trim();
              // Remove "Obs:" antes de "Opção:" nos acompanhamentos
              notes = notes.replace(/^Obs:\s*Opção:\s*/i, 'Opção: ').trim();
              // Remove "Obs:" que possa estar em linhas separadas antes de "Opção:"
              notes = notes.split('\n').map(line => {
                const trimmed = line.trim();
                if (trimmed.toLowerCase().startsWith('obs:') && trimmed.toLowerCase().includes('opção:')) {
                  return trimmed.replace(/^Obs:\s*/i, '').trim();
                }
                return trimmed;
              }).join('\n').trim();
            }
            
            // Remove "Obs:" duplicado ou no início se já estiver presente
            // Ex: "Obs: Obs: Sem cebola" -> "Obs: Sem cebola"
            notes = notes.replace(/^(Obs:\s*)+/i, 'Obs: ');
            // Remove múltiplas ocorrências consecutivas de "Obs:"
            notes = notes.replace(/(Obs:\s*){2,}/gi, 'Obs: ');
            
            // CRÍTICO: Se começa com "Obs:" seguido imediatamente por outro marcador, remove o "Obs:"
            if (notes.match(/^Obs:\s+(Molhos?|Observação|Obs|Opção):\s*/i)) {
              notes = notes.replace(/^Obs:\s+/i, '').trim();
            }
            
            // Remove "Obs:" solto sem conteúdo após ou só com marcadores
            if (notes.match(/^Obs:\s*$/i) || notes.match(/^Obs:\s+(Molhos?|Observação|Obs|Opção):\s*$/i)) {
              notes = undefined;
            } else if (notes) {
              notes = removeDuplicateReceiptInfo(notes) || undefined;
              
              // Se após limpeza ficou apenas "Obs:" sem conteúdo, remove
              if (notes && notes.match(/^Obs:\s*$/i)) {
                notes = undefined;
              }
            }
          }
          
          // IMPORTANTE: Remove QUALQUER informação de trio que já esteja nas notes antes de adicionar
          // Isso evita duplicação se o trio já veio misturado nas notes do item original
          // Remove TODAS as linhas que começam com "Trio:" (pode ter múltiplas ocorrências)
          if (notes) {
            const notesLines = notes.split('\n');
            const cleanedLines = notesLines
              .filter(line => {
                const trimmed = line.trim();
                // Remove linhas que começam com "Trio:" (case insensitive)
                return !trimmed.toLowerCase().startsWith('trio:');
              });
            
            notes = cleanedLines.join('\n').trim();
            
            // Remove espaços extras e linhas vazias
            notes = notes.replace(/\n\s*\n+/g, '\n').trim();
            
            // Se ficou vazio após remover trio, deixa undefined
            if (!notes || notes.length < 2) {
              notes = undefined;
            }
          }
          
          // Se o item tinha "+ Trio" no nome, busca o trio específico deste item
          // PRIORIDADE: Extrai do nome quando tem "+ Trio (conteúdo)" - ignora linhas "Trio: ..." separadas
          if (hasTrioInName) {
            let itemTrio: string | null = null;
            
            // PRIMEIRO: Tenta buscar do map (já foi extraído do nome antes)
            if (itemTrios.has(itemIndex)) {
              itemTrio = itemTrios.get(itemIndex) || null;
            } else {
              // FALLBACK: Tenta extrair diretamente do nome do item "+ Trio (conteúdo)"
              const trioInNameMatch = originalRemainingText.match(/\+\s*Trio\s*\(([^)]+)\)/i);
              if (trioInNameMatch && trioInNameMatch[1]) {
                itemTrio = trioInNameMatch[1].trim();
                itemTrio = itemTrio.replace(/\s+/g, ' ').trim();
              }
            }
            
            // Só adiciona se encontrou o trio E ele ainda não está nas notes
            if (itemTrio) {
              // Verifica se o trio já está nas notes (após a limpeza acima)
              const notesLower = (notes || '').toLowerCase();
              const itemTrioLower = itemTrio.toLowerCase();
              
              // Verifica se já existe exatamente este trio nas notes
              const hasTrioAlready = notesLower.includes(`trio: ${itemTrioLower}`) || 
                                     notesLower.includes(`trio:${itemTrioLower}`);
              
              if (!hasTrioAlready) {
                const trioNote = `Trio: ${itemTrio}`;
                if (notes) {
                  // Adiciona o trio ANTES das outras notes, separado por uma linha em branco
                  notes = `${trioNote}\n\n${notes}`;
                } else {
                  notes = trioNote;
                }
              }
            }
          }
          
          parsed.push({ 
            name, 
            quantity: qty, 
            unitPrice: unit, 
            totalPrice: total, 
            notes: notes || undefined 
          });
          
          itemIndex++;
        }
        
        // Os trios já foram adicionados durante o processamento acima
        // Não precisa de um segundo loop para evitar duplicação
        items = parsed;
        
        // Se não encontrou itens entre colchetes, tenta método antigo como fallback
        if (items.length === 0) {
          const lines = order.notes.split('\n').map(l => l.trim()).filter(Boolean);
          
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const clean = line.replace(/^\*/g,'').replace(/\*$/g,'');
            
            // Tenta padrão antigo: "1x Nome - R$ 15.00"
            let m = clean.match(/^(\d+)x\s+(.+?)\s*-\s*R\$\s*([\d,.]+)\s*(.*)$/i);
            if (!m) {
              m = clean.match(/^(\d+)x\s+(.+?)\s+R\$\s*([\d,.]+)\s*(.*)$/i);
            }
            
            if (m) {
              const qty = parseInt(m[1], 10) || 1;
              if (qty <= 0 || qty > 1000) continue;
              
              let name = m[2].replace(/\*/g,'').trim();
              name = name.replace(/\s*(Sem molho|Molhos?:.*|Obs:.*)$/i, '').trim();
              
              if (!name || name.length < 2) continue;
              
              const total = parsePrice(m[3]);
              if (total <= 0) continue;
              
              const unit = total / qty;
              let notes = (m[4] || '').trim();
              
              if (notes) {
                // Remove "Obs:" duplicado
                notes = notes.replace(/^(Obs:\s*)+/i, 'Obs: ');
                notes = notes.replace(/(Obs:\s*){2,}/gi, 'Obs: ');
                // Remove se estiver vazio
                if (notes.match(/^Obs:\s*$/i)) {
                  notes = undefined;
                } else {
                  notes = removeDuplicateReceiptInfo(notes) || undefined;
                }
              }
              
              parsed.push({ 
                name, 
                quantity: qty, 
                unitPrice: unit, 
                totalPrice: total, 
                notes: notes || undefined 
              });
            }
          }
          
          if (parsed.length > 0) {
            items = parsed;
          }
        }
      }
      
      // PRIORIDADE 2: Se não encontrou itens em colchetes, usa order_items do banco
      if (items.length === 0 && order.order_items && order.order_items.length > 0) {
        const trioInfo = extractTrioInfo(order.notes || '');
        
        items = (order.order_items || []).flatMap(item => {
          const itemName = item.products?.name || 'Item';
          const itemNameLower = itemName.toLowerCase();
          // Heurística para identificar acompanhamentos pelo nome (quando categoria não está disponível)
          const isAccompaniment = itemNameLower.includes('batata') || 
                                 itemNameLower.includes('frango no pote') ||
                                 itemNameLower.includes('frango pote') ||
                                 itemNameLower.includes('acompanhamento') ||
                                 itemNameLower.includes('cebolas empanadas') ||
                                 itemNameLower.includes('mini chickens') ||
                                 itemNameLower.includes('fritas');
          const hasTrioInName = itemNameLower.includes('+ trio') || itemNameLower.includes('+trio');
          
          const cleanName = hasTrioInName 
            ? itemName.replace(/\s*\+\s*Trio\s*/gi, '').trim()
            : itemName;
          
          // Se o item tinha "+ Trio" no nome E temos informação do trio, adiciona nas notes
          let finalNotes = item.notes ? removeDuplicateReceiptInfo(item.notes) || undefined : undefined;
          
          // Processar adicionais do campo customizations se existir
          try {
            const customizations = item.customizations as any;
            if (customizations && customizations.addons && Array.isArray(customizations.addons)) {
              const addons = customizations.addons;
              // Formatar cada adicional em uma linha separada com valor individual
              const addonsLines = addons.map((a: any) => {
                const qty = a.quantity || 1;
                const price = a.price || 0;
                const totalAddonPrice = price * qty;
                return `${qty}x ${a.name} - R$${totalAddonPrice.toFixed(2).replace('.', ',')}`;
              });
              
              if (addonsLines.length > 0) {
                const addonsText = `Adicionais:\n${addonsLines.join('\n')}`;
                if (finalNotes) {
                  if (!finalNotes.includes('Adicionais:')) {
                    finalNotes = `${finalNotes}\n\n${addonsText}`;
                  }
                } else {
                  finalNotes = addonsText;
                }
              }
            }
          } catch (e) {
            // Erro ao processar customizations - continuar silenciosamente
          }
          
          // Se for acompanhamento, remove "Molho:" das notas e "Obs:" antes de "Opção:"
          if (isAccompaniment && finalNotes) {
            finalNotes = finalNotes.replace(/Molhos?\s*:\s*/gi, '').trim();
            // Remove "Obs: Molho:" se restou
            finalNotes = finalNotes.replace(/^Obs:\s*Molhos?\s*:\s*/i, 'Obs: ').trim();
            // Remove "Obs:" antes de "Opção:" nos acompanhamentos
            finalNotes = finalNotes.replace(/^Obs:\s*Opção:\s*/i, 'Opção: ').trim();
            // Remove "Obs:" que possa estar em linhas separadas antes de "Opção:"
            finalNotes = finalNotes.split('\n').map(line => {
              const trimmed = line.trim();
              if (trimmed.toLowerCase().startsWith('obs:') && trimmed.toLowerCase().includes('opção:')) {
                return trimmed.replace(/^Obs:\s*/i, '').trim();
              }
              return trimmed;
            }).join('\n').trim();
            // Remove se ficou apenas "Obs:" sem conteúdo
            if (finalNotes.match(/^Obs:\s*$/i)) {
              finalNotes = undefined;
            }
          }
          
          if (hasTrioInName && trioInfo) {
            const trioNote = `Trio: ${trioInfo}`;
            if (finalNotes) {
              // Adiciona uma linha em branco antes do trio para melhor separação visual
              finalNotes = `${finalNotes}\n\n${trioNote}`;
            } else {
              finalNotes = trioNote;
            }
          }
          
          return [{
            name: cleanName,
            quantity: item.quantity,
            unitPrice: item.unit_price,
            totalPrice: item.total_price,
            notes: finalNotes || undefined
          }];
        });
      }

      // PRIORIDADE 3: Se ainda não tem itens, buscar diretamente no banco
      if (items.length === 0) {
        try {
          const trioInfo = extractTrioInfo(order.notes || '');
          
          const { data, error } = await supabase
            .from('order_items')
            .select('quantity, unit_price, total_price, notes, customizations, products(name, categories(name))')
            .eq('order_id', order.id);
          if (!error && data && data.length > 0) {
            items = data.flatMap((it: any) => {
              const itemName = it.products?.name || 'Item';
              const categoryName = it.products?.categories?.name || '';
              const isAccompaniment = categoryName.toLowerCase().includes('acompanhamento');
              const hasTrioInName = itemName.toLowerCase().includes('+ trio') || itemName.toLowerCase().includes('+trio');
              
              const cleanName = hasTrioInName 
                ? itemName.replace(/\s*\+\s*Trio\s*/gi, '').trim()
                : itemName;
              
              let notes = it.notes;
              if (notes) {
                notes = notes.trim();
              }
              
              // Processar adicionais do campo customizations se existir
              try {
                let customizationsData: any = it.customizations;
                if (typeof customizationsData === 'string') {
                  customizationsData = JSON.parse(customizationsData);
                }
                if (customizationsData && customizationsData.addons && Array.isArray(customizationsData.addons)) {
                  const addons = customizationsData.addons;
                  // Formatar cada adicional em uma linha separada com valor individual
                  const addonsLines = addons.map((a: any) => {
                    const qty = a.quantity || 1;
                    const price = a.price || 0;
                    const totalAddonPrice = price * qty;
                    return `${qty}x ${a.name} - R$${totalAddonPrice.toFixed(2).replace('.', ',')}`;
                  });
                  
                  if (addonsLines.length > 0) {
                    const addonsText = `Adicionais:\n${addonsLines.join('\n')}`;
                    if (notes) {
                      if (!notes.includes('Adicionais:')) {
                        notes = `${notes}\n\n${addonsText}`;
                      }
                    } else {
                      notes = addonsText;
                    }
                  }
                }
              } catch (e) {
                // Erro ao processar customizations - continuar silenciosamente
              }
              
              // Se for acompanhamento, remove "Molho:" das notas e "Obs:" antes de "Opção:"
              if (isAccompaniment && notes) {
                notes = notes.replace(/Molhos?\s*:\s*/gi, '').trim();
                // Remove "Obs: Molho:" se restou
                notes = notes.replace(/^Obs:\s*Molhos?\s*:\s*/i, 'Obs: ').trim();
                // Remove "Obs:" antes de "Opção:" nos acompanhamentos
                notes = notes.replace(/^Obs:\s*Opção:\s*/i, 'Opção: ').trim();
                // Remove "Obs:" que possa estar em linhas separadas antes de "Opção:"
                notes = notes.split('\n').map(line => {
                  const trimmed = line.trim();
                  if (trimmed.toLowerCase().startsWith('obs:') && trimmed.toLowerCase().includes('opção:')) {
                    return trimmed.replace(/^Obs:\s*/i, '').trim();
                  }
                  return trimmed;
                }).join('\n').trim();
                // Remove se ficou apenas "Obs:" sem conteúdo
                if (notes.match(/^Obs:\s*$/i)) {
                  notes = undefined;
                }
              }
              
              // Remove "Obs:" duplicado
              if (notes) {
                notes = notes.replace(/^(Obs:\s*)+/i, 'Obs: ');
                notes = notes.replace(/(Obs:\s*){2,}/gi, 'Obs: ');
                // Remove se estiver vazio após limpeza
                if (notes.match(/^Obs:\s*$/i)) {
                  notes = undefined;
                } else {
                  notes = removeDuplicateReceiptInfo(notes) || undefined;
                }
              }
              
              // Se o item tinha "+ Trio" no nome E temos informação do trio, adiciona nas notes
              if (hasTrioInName && trioInfo) {
                const trioNote = `Trio: ${trioInfo}`;
                if (notes) {
                  // Adiciona uma linha em branco antes do trio para melhor separação visual
                  notes = `${notes}\n\n${trioNote}`;
                } else {
                  notes = trioNote;
                }
              }
              
              return [{
                name: cleanName,
                quantity: it.quantity,
                unitPrice: it.unit_price,
                totalPrice: it.total_price,
                notes: notes || undefined
              }];
            });
          }
        } catch {}
      }
      
      // PRIORIDADE 4: Último fallback - item genérico
      if (items.length === 0) {
        items = [{ name: 'Pedido Online', quantity: 1, unitPrice: order.total_amount, totalPrice: order.total_amount, notes: order.notes }];
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
            let cleanedNotes = orderItem.notes.trim();
            // Remove "Obs:" duplicado
            cleanedNotes = cleanedNotes.replace(/^(Obs:\s*)+/i, 'Obs: ');
            cleanedNotes = cleanedNotes.replace(/(Obs:\s*){2,}/gi, 'Obs: ');
            // Remove se estiver vazio
            if (!cleanedNotes.match(/^Obs:\s*$/i)) {
              cleanedNotes = removeDuplicateReceiptInfo(cleanedNotes) || '';
              if (cleanedNotes) {
                existingItem.notes = cleanedNotes;
              }
            }
          }
        });
      }
      
      // Remove informações duplicadas das notes dos itens que já aparecem no cupom
      // Também limpa "Obs:" duplicado e remove se estiver vazio
      items = items.map(item => {
        if (item.notes) {
          let cleanedNotes = item.notes.trim();
          
          // Verifica se é acompanhamento pelo nome (heurística quando categoria não está disponível)
          const itemNameLower = item.name.toLowerCase();
          const isAccompaniment = itemNameLower.includes('batata') || 
                                 itemNameLower.includes('frango no pote') ||
                                 itemNameLower.includes('frango pote') ||
                                 itemNameLower.includes('acompanhamento') ||
                                 itemNameLower.includes('cebolas empanadas') ||
                                 itemNameLower.includes('mini chickens') ||
                                 itemNameLower.includes('fritas');
          
          // Se for acompanhamento, remove "Molho:" das notas e "Obs:" antes de "Opção:"
          if (isAccompaniment) {
            cleanedNotes = cleanedNotes.replace(/Molhos?\s*:\s*/gi, '').trim();
            // Remove "Obs: Molho:" se restou
            cleanedNotes = cleanedNotes.replace(/^Obs:\s*Molhos?\s*:\s*/i, 'Obs: ').trim();
            // Remove "Obs:" antes de "Opção:" nos acompanhamentos
            cleanedNotes = cleanedNotes.replace(/^Obs:\s*Opção:\s*/i, 'Opção: ').trim();
            // Remove "Obs:" que possa estar em linhas separadas antes de "Opção:"
            cleanedNotes = cleanedNotes.split('\n').map(line => {
              const trimmed = line.trim();
              if (trimmed.toLowerCase().startsWith('obs:') && trimmed.toLowerCase().includes('opção:')) {
                return trimmed.replace(/^Obs:\s*/i, '').trim();
              }
              return trimmed;
            }).join('\n').trim();
          }
          
          // Remove "Obs:" duplicado ou no início se já estiver presente
          cleanedNotes = cleanedNotes.replace(/^(Obs:\s*)+/i, 'Obs: ');
          cleanedNotes = cleanedNotes.replace(/(Obs:\s*){2,}/gi, 'Obs: ');
          
          // Se começa com "Obs:" mas só tem outro marcador, remove o "Obs:"
          if (cleanedNotes.match(/^Obs:\s+(Molhos?|Observação):/i)) {
            cleanedNotes = cleanedNotes.replace(/^Obs:\s+/i, '').trim();
          }
          
          // Remove "Obs:" solto sem conteúdo
          if (cleanedNotes.match(/^Obs:\s*$/i)) {
            cleanedNotes = '';
          } else {
            // Aplica remoção de informações duplicadas
            cleanedNotes = removeDuplicateReceiptInfo(cleanedNotes) || '';
          }
          
          return { ...item, notes: cleanedNotes || undefined };
        }
        return item;
      });

      if (items.length === 0) {
        toast.error("Pedido sem itens para imprimir");
        return;
      }

      // Nome + endereço ao lado do nome
      let customerDisplay = order.customer_name || '';
      let generalInstructions: string | undefined = undefined;
      
      if (order.notes) {
        const text = order.notes.replace(/\*/g, '');
        
        // Extrair endereço (mas não vamos incluí-lo duplicado nas observações)
        const mAddr = text.match(/Endereç[oa]:\s*([^*\n]+)/i);
        if (mAddr && mAddr[1]) {
          const addr = mAddr[1].trim();
          if (addr) customerDisplay = `${customerDisplay} - ${addr}`.trim();
        }
        
        // REMOVER informações de trio do texto antes de processar instruções gerais
        // O trio deve aparecer nas notes do item, não nas instruções gerais
        let textWithoutTrio = text;
        // Remove linhas que começam com "Trio:"
        textWithoutTrio = textWithoutTrio.replace(/^Trio\s*:\s*[^\n]+/gmi, '');
        // Remove "Trio:" que pode estar no meio do texto também
        textWithoutTrio = textWithoutTrio.replace(/\nTrio\s*:\s*[^\n]+/gmi, '');
        
        // Extrair instruções gerais do pedido (remove informações duplicadas)
        // Remove também informações de "comer no local" ou "embalar pra levar" que já estão no nome do cliente
        // E também "Forma de consumo/embalagem:"
        let textWithoutServiceType = textWithoutTrio;
        textWithoutServiceType = textWithoutServiceType
          .replace(/comer\s+no\s+local/gi, '')
          .replace(/comer\s+no\s+estabelecimento/gi, '')
          .replace(/embalar\s+(para|pra)\s+levar/gi, '')
          .replace(/\bembalar\b/gi, '')
          .replace(/\bpara\s+levar\b/gi, '')
          .replace(/\bpra\s+levar\b/gi, '')
          // Remove "Forma de consumo/embalagem:" e variações
          .replace(/Forma\s+de\s+consumo[\/:]?\s*embalagem[:\s]*/gi, '')
          .replace(/Forma\s+de\s+embalagem[:\s]*/gi, '')
          .replace(/Forma\s+de\s+consumo[:\s]*/gi, '')
          .replace(/consumo[\/:]?\s*embalagem[:\s]*/gi, '')
          .trim();
        
        // Tenta encontrar "Instruções do Pedido:" seguido do texto
        const instructionsMatch = textWithoutServiceType.match(/Instruções\s+do\s+Pedido:\s*([\s\S]*?)(?:\n\n|$)/i);
        if (instructionsMatch && instructionsMatch[1]) {
          let rawInstructions = instructionsMatch[1].trim();
          
          // Remove telefone das instruções (padrões brasileiros com ou sem formatação)
          rawInstructions = rawInstructions
            // Remove telefones formatados: (11) 99999-9999, (11)99999-9999, 11 99999-9999
            .replace(/\(?\d{2}\)?\s*\d{4,5}[-\s]?\d{4}/g, '')
            // Remove telefones sem formatação: 11999999999, 1199999999
            .replace(/\b\d{10,11}\b/g, '')
            // Remove padrões com "Tel:", "Telefone:", "Fone:", etc. (com ou sem número)
            .replace(/(Tel|Telefone|Fone|Phone)[:\s]*\(?\d{2}\)?\s*\d{4,5}[-\s]?\d{4}/gi, '')
            .replace(/(Tel|Telefone|Fone|Phone)[:\s]*\d{10,11}/gi, '')
            // Remove "Telefone:" isolado (sem número após)
            .replace(/^(Telefone|Tel|Fone|Phone)[:\s]*$/gmi, '')
            .replace(/\n(Telefone|Tel|Fone|Phone)[:\s]*$/gmi, '')
            .replace(/\n(Telefone|Tel|Fone|Phone)[:\s]*\n/gmi, '\n')
            .trim();
          
          // Remove qualquer menção de trio das instruções
          rawInstructions = rawInstructions.replace(/Trio\s*:\s*[^\n]+/gi, '').trim();
          // Remove resumo de quantidades (ex: "Resumo: 4x hamburgueres, 6x acompanhamentos, 1x bebidas")
          rawInstructions = rawInstructions.replace(/Resumo[:\s]*[\d\s]*x\s*(hamburgueres?|acompanhamentos?|bebidas?)[\s,]*[\d\s]*x\s*(hamburgueres?|acompanhamentos?|bebidas?)?[\s,]*[\d\s]*x\s*(hamburgueres?|acompanhamentos?|bebidas?)?/gi, '').trim();
          rawInstructions = rawInstructions.replace(/^\s*Resumo[:\s]*.*$/gmi, '').trim();
          // Remove informações de serviceType das instruções (todos os padrões possíveis)
          rawInstructions = rawInstructions
            .replace(/comer\s+no\s+local/gi, '')
            .replace(/comer\s+no\s+estabelecimento/gi, '')
            .replace(/embalar\s+(para|pra)\s+levar/gi, '')
            .replace(/\bembalar\b/gi, '')
            .replace(/\bpara\s+levar\b/gi, '')
            .replace(/\bpra\s+levar\b/gi, '')
            // Remove "Forma de consumo/embalagem:" e variações
            .replace(/Forma\s+de\s+consumo[\/:]?\s*embalagem[:\s]*/gi, '')
            .replace(/Forma\s+de\s+embalagem[:\s]*/gi, '')
            .replace(/Forma\s+de\s+consumo[:\s]*/gi, '')
            .replace(/consumo[\/:]?\s*embalagem[:\s]*/gi, '')
            // Remove também quando aparece isolado em linha própria
            .replace(/^\s*comer\s+no\s+local\s*$/gmi, '')
            .replace(/^\s*embalar\s+(para|pra)\s+levar\s*$/gmi, '')
            .replace(/^\s*Forma\s+de\s+consumo[\/:]?\s*embalagem[:\s]*\s*$/gmi, '')
            .replace(/^\s*Forma\s+de\s+embalagem[:\s]*\s*$/gmi, '')
            // Limpa linhas vazias e espaços extras
            .replace(/\n\s*\n+/g, '\n')
            .replace(/^\s+|\s+$/gm, '')
            .trim();
          
          // Verifica se há conteúdo real (não apenas espaços, quebras de linha ou marcadores vazios)
          const hasRealContent = rawInstructions && 
                                rawInstructions.length > 3 && 
                                !rawInstructions.match(/^(Telefone|Tel|Fone|Phone)[:\s]*$/i) &&
                                rawInstructions.replace(/\s/g, '').length > 0;
          
          // Só adiciona se sobrar conteúdo relevante
          if (hasRealContent) {
            generalInstructions = removeDuplicateReceiptInfo(rawInstructions) || undefined;
          } else {
            // Se sobrou apenas espaços/vazio após remoção, não adiciona instruções
            generalInstructions = undefined;
          }
        } else {
          // Remove tudo que está entre colchetes [ ] (itens do pedido) antes de processar
          // Também remove linhas que começam com "Pedido Na Brasa:" ou similar
          let cleanedText = textWithoutServiceType
            // Remove telefone das instruções (padrões brasileiros com ou sem formatação)
            // Remove telefones formatados: (11) 99999-9999, (11)99999-9999, 11 99999-9999
            .replace(/\(?\d{2}\)?\s*\d{4,5}[-\s]?\d{4}/g, '')
            // Remove telefones sem formatação: 11999999999, 1199999999
            .replace(/\b\d{10,11}\b/g, '')
            // Remove padrões com "Tel:", "Telefone:", "Fone:", etc. (com ou sem número)
            .replace(/(Tel|Telefone|Fone|Phone)[:\s]*\(?\d{2}\)?\s*\d{4,5}[-\s]?\d{4}/gi, '')
            .replace(/(Tel|Telefone|Fone|Phone)[:\s]*\d{10,11}/gi, '')
            // Remove "Telefone:" isolado (sem número após)
            .replace(/^(Telefone|Tel|Fone|Phone)[:\s]*$/gmi, '')
            .replace(/\n(Telefone|Tel|Fone|Phone)[:\s]*$/gmi, '')
            .replace(/\n(Telefone|Tel|Fone|Phone)[:\s]*\n/gmi, '\n')
            // Remove itens entre colchetes (ex: [1x Na Brasa...])
            .replace(/\[[^\]]+\]/g, '')
            // Remove linhas que começam com "Pedido Na Brasa:" ou variações
            .replace(/^Pedido\s+Na\s+Brasa[:\s]*/gmi, '')
            // Remove informações de resumo (Subtotal, Total, etc.)
            .replace(/Subtotal[:\s]*R\$\s*[\d.,\s]+/gi, '')
            .replace(/Taxa\s+de\s+entrega[:\s]*R\$\s*[\d.,\s]+/gi, '')
            .replace(/Total[:\s]*R\$\s*[\d.,\s]+/gi, '')
            .replace(/Forma\s+de\s+entrega[:\s]*[^\n]+/gi, '')
            .replace(/Cliente[:\s]*[^\n]+/gi, '')
            .replace(/Endereç[oa][:\s]*[^\n]+/gi, '')
            .replace(/Forma\s+de\s+pagamento[:\s]*[^\n]+/gi, '')
            // Remove resumo de quantidades (ex: "Resumo: 4x hamburgueres, 6x acompanhamentos, 1x bebidas")
            .replace(/Resumo[:\s]*[\d\s]*x\s*(hamburgueres?|acompanhamentos?|bebidas?)[\s,]*[\d\s]*x\s*(hamburgueres?|acompanhamentos?|bebidas?)?[\s,]*[\d\s]*x\s*(hamburgueres?|acompanhamentos?|bebidas?)?/gi, '')
            .replace(/^\s*Resumo[:\s]*.*$/gmi, '')
            // Remove informações de serviceType (todos os padrões possíveis)
            .replace(/comer\s+no\s+local/gi, '')
            .replace(/comer\s+no\s+estabelecimento/gi, '')
            .replace(/embalar\s+(para|pra)\s+levar/gi, '')
            .replace(/\bembalar\b/gi, '')
            .replace(/\bpara\s+levar\b/gi, '')
            .replace(/\bpra\s+levar\b/gi, '')
            // Remove "Forma de consumo/embalagem:" e variações
            .replace(/Forma\s+de\s+consumo[\/:]?\s*embalagem[:\s]*/gi, '')
            .replace(/Forma\s+de\s+embalagem[:\s]*/gi, '')
            .replace(/Forma\s+de\s+consumo[:\s]*/gi, '')
            .replace(/consumo[\/:]?\s*embalagem[:\s]*/gi, '')
            // Remove também quando aparece isolado em linha própria
            .replace(/^\s*comer\s+no\s+local\s*$/gmi, '')
            .replace(/^\s*embalar\s+(para|pra)\s+levar\s*$/gmi, '')
            .replace(/^\s*Forma\s+de\s+consumo[\/:]?\s*embalagem[:\s]*\s*$/gmi, '')
            .replace(/^\s*Forma\s+de\s+embalagem[:\s]*\s*$/gmi, '')
            .trim();
          
          // Limpa espaços e quebras de linha extras
          cleanedText = cleanedText.replace(/\n\s*\n+/g, '\n').replace(/\s+/g, ' ').trim();
          
          // Verifica se há conteúdo real (não apenas espaços, quebras de linha ou marcadores vazios)
          const hasRealContent = cleanedText && 
                                cleanedText.length > 5 && 
                                !cleanedText.match(/^Trio\s*:/i) && 
                                !cleanedText.match(/^(comer|embalar|para\s+levar|pra\s+levar)/i) &&
                                !cleanedText.match(/^(Telefone|Tel|Fone|Phone)[:\s]*$/i) &&
                                cleanedText.replace(/\s/g, '').length > 0;
          
          // Só usa se tiver conteúdo relevante
          if (hasRealContent) {
            generalInstructions = removeDuplicateReceiptInfo(cleanedText) || undefined;
          } else {
            // Se sobrou apenas serviceType, telefone ou vazio, não adiciona instruções
            generalInstructions = undefined;
          }
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
        orderType: order.order_type || "delivery",
        generalInstructions: generalInstructions
      };

      await printReceipt(receiptData);
      toast.success("Pedido enviado para impressão");
    };

    // Função para formatar CPF
    const formatCPF = (value: string): string => {
      const digits = value.replace(/\D/g, '');
      if (digits.length <= 3) return digits;
      if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
      if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
      return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
    };

    const handlePrintNonFiscalReceipt = async (order: Order) => {
      // Sempre abrir modal para coletar/confirmar dados do cliente
      setOrderForNonFiscal(order);
      // Pré-preencher telefone se já existir
      setCustomerPhoneNonFiscal(order.customer_phone ? phoneMask(order.customer_phone) : "");
      setCustomerCpf("");
      setShowNonFiscalModal(true);
    };

    const printNonFiscalReceiptWithData = async (order: Order, cpf?: string, phone?: string) => {
      if (!establishment) {
        toast.error("Erro ao carregar informações do estabelecimento");
        return;
      }

      // Preparar itens do pedido
      const items = order.order_items?.map(item => ({
        name: item.products.name,
        quantity: item.quantity,
        unitPrice: item.unit_price,
        totalPrice: item.total_price,
        notes: item.notes || undefined
      })) || [];

      const nonFiscalData: NonFiscalReceiptData = {
        orderNumber: order.order_number,
        orderId: order.id,
        items,
        subtotal: order.subtotal,
        discountAmount: order.discount_amount || 0,
        deliveryFee: order.delivery_fee || 0,
        taxAmount: order.tax_amount || 0,
        totalAmount: order.total_amount,
        establishmentName: establishment.name || "",
        establishmentAddress: (establishment as any)?.address,
        establishmentCnpj: (establishment as any)?.cnpj,
        establishmentPhone: (establishment as any)?.phone,
        customerName: order.customer_name || "Cliente",
        customerPhone: phone || order.customer_phone,
        customerCpf: cpf,
        paymentMethod: order.payment_method,
        createdAt: order.created_at
      };

      try {
        await printNonFiscalReceipt(nonFiscalData);
        toast.success("Cupom não fiscal enviado para impressão");
        setShowNonFiscalModal(false);
        setOrderForNonFiscal(null);
        setCustomerCpf("");
        setCustomerPhoneNonFiscal("");
      } catch (error) {
        toast.error("Erro ao imprimir cupom não fiscal");
      }
    };

    const handleConfirmNonFiscalPrint = () => {
      if (!orderForNonFiscal) return;

      // Validar telefone (obrigatório)
      if (!customerPhoneNonFiscal || !customerPhoneNonFiscal.trim()) {
        toast.error("Por favor, informe o telefone do cliente");
        return;
      }

      // Remover formatação do CPF e telefone
      const cpfClean = customerCpf.replace(/\D/g, '');
      const phoneClean = customerPhoneNonFiscal.replace(/\D/g, '');

      printNonFiscalReceiptWithData(orderForNonFiscal, cpfClean || undefined, phoneClean);
    };

    const handleRejectOrder = async () => {
      if (!orderToReject) return;
      
      if (!rejectionReason.trim()) {
        toast.error("Por favor, informe a justificativa para recusar o pedido");
        return;
      }

      try {
        const { error } = await supabase
          .from("orders")
          .update({ 
            status: "cancelled",
            rejection_reason: rejectionReason.trim()
          })
          .eq("id", orderToReject);

        if (error) throw error;

        toast.success("Pedido recusado com sucesso");
        setOrderToReject(null);
        setRejectionReason("");
        loadOrders();
      } catch (error) {
        toast.error("Erro ao recusar pedido");
      }
    };

    const handleAcceptAndPrintOrder = async (order: Order, deliveryBoyId?: string) => {
      try {
        // Verificar se é pedido do site externo (Na Brasa)
        const isFromNaBrasaSite = order.source_domain?.toLowerCase().includes('hamburguerianabrasa') || false;
        
        // Para pedidos do site externo, verificar se o caixa está aberto
        if (isFromNaBrasaSite) {
          if (!hasOpenSession) {
            toast.error("Não é possível aceitar pedidos sem o caixa estar aberto. Por favor, abra o caixa primeiro.");
            return;
          }
        }
        
        // Preparar dados para atualização
        const updateData: any = {
          accepted_and_printed_at: new Date().toISOString()
        };
        
        // Se for pedido do site externo, gerar novo número sequencial
        if (isFromNaBrasaSite && establishment) {
          try {
            const { data: newOrderNumber, error: orderNumberError } = await supabase.rpc(
              'get_next_order_number',
              { p_establishment_id: establishment.id }
            );
            
            if (!orderNumberError && newOrderNumber) {
              updateData.order_number = newOrderNumber;
            }
          } catch (error) {
            // Se falhar ao gerar número sequencial, continuar com o número original
          }
        }
        
        // Atribuir motoboy se fornecido ou se for pedido do site do Na Brasa
        const isDelivery = order.order_type === 'delivery';
        const hasAddress = order.notes?.toLowerCase().includes('endereço:') || false;
        const hasDeliveryBoy = order.delivery_boy_id !== null && order.delivery_boy_id !== undefined;
        
        if (deliveryBoyId) {
          // Usar o motoboy selecionado
          updateData.delivery_boy_id = deliveryBoyId;
        } else if (isFromNaBrasaSite && isDelivery && hasAddress && !hasDeliveryBoy && establishment) {
          // Buscar o primeiro motoboy ativo do estabelecimento (comportamento antigo para Na Brasa)
          const { data: deliveryBoys, error: deliveryBoysError } = await supabase
            .from("delivery_boys")
            .select("id")
            .eq("establishment_id", establishment.id)
            .eq("active", true)
            .order("name")
            .limit(1);
          
          if (!deliveryBoysError && deliveryBoys && deliveryBoys.length > 0) {
            updateData.delivery_boy_id = deliveryBoys[0].id;
          }
        }
        
        // Atualizar o pedido com os novos dados
        const { data: updatedOrder, error } = await supabase
          .from("orders")
          .update(updateData)
          .eq("id", order.id)
          .select()
          .single();

        if (error) throw error;

        // Se o número do pedido foi atualizado, usar o pedido atualizado para impressão
        const orderToPrint = updatedOrder || order;
        
        // Abater estoque de ingredientes automaticamente
        if (establishment) {
          try {
            const { data: stockResult, error: stockError } = await supabase.rpc(
              'apply_stock_deduction_for_order',
              {
                p_establishment_id: establishment.id,
                p_order_id: order.id
              }
            );

            if (stockError) {
              // Erro ao abater estoque mas não interrompe a aceitação do pedido
            } else if (stockResult && !stockResult.success) {
              // Avisos no abatimento de estoque mas não bloqueia a aceitação
            }
          } catch (stockErr) {
            // Não bloquear a aceitação se houver erro no estoque
          }
        }
        
        // Imprimir o pedido com o número atualizado
        await handlePrintOrder(orderToPrint);

        toast.success("Pedido aceito e enviado para impressão");
        loadOrders();
      } catch (error: any) {
        toast.error(error?.message || "Erro ao aceitar pedido");
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
        toast.error("Erro ao aceitar pedido");
      }
    };

    const handleMarkPaymentAsPaid = async (orderId: string) => {
      try {
        // Ao confirmar pagamento, atualizar apenas payment_status para "paid"
        // O pedido só vai para "Todos os Pedidos" quando AMBOS estiverem confirmados
        const { error } = await supabase
          .from("orders")
          .update({ 
            payment_status: "paid"
          })
          .eq("id", orderId);

        if (error) throw error;

        toast.success("Pagamento confirmado com sucesso");
        loadOrders();
      } catch (error) {
        toast.error("Erro ao confirmar pagamento");
      }
    };

    const handleMarkDeliveryAsCompleted = async (orderId: string) => {
      try {
        // Ao confirmar entrega, atualizar status para "completed"
        // O pedido só vai para "Todos os Pedidos" quando AMBOS estiverem confirmados
        const { error } = await supabase
          .from("orders")
          .update({ 
            status: "completed"
          })
          .eq("id", orderId);

        if (error) throw error;

        toast.success("Entrega confirmada com sucesso");
        loadOrders();
      } catch (error) {
        toast.error("Erro ao confirmar entrega");
      }
    };

    const handleMarkAsReady = async (orderId: string) => {
      try {
        const { error } = await supabase
          .from("orders")
          .update({ status: "ready" })
          .eq("id", orderId);

        if (error) throw error;

        toast.success("Pedido marcado como pronto para retirada");
        loadOrders();
      } catch (error) {
        toast.error("Erro ao marcar pedido como pronto");
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
          <div className="w-full">
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
              <TabsList className={`grid w-full ${isNaBrasa ? 'grid-cols-5' : 'grid-cols-4'}`}>
                <TabsTrigger value="pending" className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Pendentes (Cardápio Online)
                </TabsTrigger>
                <TabsTrigger value="totem" className="flex items-center gap-2">
                  <Monitor className="h-4 w-4" />
                  Totem
                </TabsTrigger>
                <TabsTrigger value="completed" className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  PDV / Concluídos
                </TabsTrigger>
                {isNaBrasa && (
                  <TabsTrigger value="rejected" className="flex items-center gap-2">
                    <XCircle className="h-4 w-4" />
                    Recusados
                  </TabsTrigger>
                )}
                <TabsTrigger value="all" className="flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Todos os Pedidos
                </TabsTrigger>
              </TabsList>

              <TabsContent value={activeTab} className="space-y-6">
                {activeTab === "all" && (
                  <Card className="p-4">
                    <div className="flex flex-col gap-4">
                      <div className="flex flex-wrap items-center gap-4">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="showAllDates"
                            checked={showAllDates}
                            onCheckedChange={(checked) => {
                              setShowAllDates(checked === true);
                              if (checked === true) {
                                setSelectedDate(""); // Limpar data selecionada quando mostrar todos
                              }
                            }}
                          />
                          <Label htmlFor="showAllDates" className="text-sm font-normal cursor-pointer">
                            Mostrar todos os pedidos
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="showPDV"
                            checked={showPDV}
                            onCheckedChange={(checked) => setShowPDV(checked === true)}
                          />
                          <Label htmlFor="showPDV" className="text-sm font-normal cursor-pointer">
                            PDV
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="showSite"
                            checked={showSite}
                            onCheckedChange={(checked) => setShowSite(checked === true)}
                          />
                          <Label htmlFor="showSite" className="text-sm font-normal cursor-pointer">
                            Site
                          </Label>
                        </div>
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-4">
                        {/* Filtro por Data */}
                        <div className="flex flex-col gap-2">
                          <Label htmlFor="filterDate" className="text-sm font-medium">
                            Filtrar por Data
                          </Label>
                          <Input
                            id="filterDate"
                            type="date"
                            value={selectedDate}
                            onChange={(e) => {
                              setSelectedDate(e.target.value);
                              // Não desmarcar "mostrar todos" - permitir filtrar por data mesmo com "todos" marcado
                            }}
                            className="w-full lg:w-auto"
                          />
                        </div>

                        {/* Filtro por Método de Pagamento */}
                        <div className="flex flex-col gap-2">
                          <Label htmlFor="filterPaymentMethod" className="text-sm font-medium">
                            Filtrar por Pagamento
                          </Label>
                          <Select
                            value={selectedPaymentMethod || "all"}
                            onValueChange={(value) => {
                              setSelectedPaymentMethod(value === "all" ? "" : value);
                            }}
                          >
                            <SelectTrigger className="w-full lg:w-[200px]">
                              <SelectValue placeholder="Todos os métodos" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">Todos os métodos</SelectItem>
                              <SelectItem value="dinheiro">Dinheiro</SelectItem>
                              <SelectItem value="pix">PIX</SelectItem>
                              <SelectItem value="cartao_debito">Cartão de Débito</SelectItem>
                              <SelectItem value="cartao_credito">Cartão de Crédito</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Botão para limpar filtros */}
                        {(selectedDate || selectedPaymentMethod) && (
                          <div className="flex flex-col gap-2">
                            <Label className="text-sm font-medium opacity-0 pointer-events-none">
                              &nbsp;
                            </Label>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedDate("");
                                setSelectedPaymentMethod("");
                              }}
                              className="h-10"
                            >
                              Limpar Filtros
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                )}
                {filteredOrders.length === 0 ? (
                  <Card className="p-12 text-center">
                    <Package className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                    <h3 className="text-lg font-semibold mb-2">Nenhum pedido encontrado</h3>
                    <p className="text-muted-foreground">
                      {activeTab === "pending" 
                        ? isNaBrasa
                          ? "Não há pedidos pendentes do site no momento"
                          : "Não há pedidos pendentes do cardápio online no momento"
                        : activeTab === "totem"
                        ? "Não há pedidos do totem no momento"
                        : activeTab === "rejected"
                        ? "Não há pedidos recusados"
                        : activeTab === "all"
                        ? "Não há pedidos no momento"
                        : "Não há pedidos do PDV ou concluídos"
                      }
                    </p>
                  </Card>
                ) : (
                  filteredOrders.map((order) => {
                    // Helper function to check if order is from hamburguerianabrasa.com.br
                    const isFromNaBrasaSite = order.source_domain?.toLowerCase().includes('hamburguerianabrasa') || false;
                    
                    // Helper function to check if order is from online menu (cardápio online)
                    const isFromOnlineMenu = (order.channel === "online" || order.origin === "site" || order.source_domain) &&
                                           !isFromNaBrasaSite;
                    
                    // Helper function to check if order is from Totem
                    const isFromTotem = order.channel === "totem" || order.origin === "totem";
                    
                    // Helper function to check if order is from PDV
                    const isPDVOrderCheck = (() => {
                      const hasNoSourceDomain = !order.source_domain || String(order.source_domain).trim() === '';
                      const isNotNaBrasa = !order.source_domain?.toLowerCase().includes('hamburguerianabrasa');
                      const isNotOnline = order.channel !== "online" && order.origin !== "site";
                      const isNotTotem = order.channel !== "totem" && order.origin !== "totem";
                      return hasNoSourceDomain && isNotNaBrasa && isNotOnline && isNotTotem;
                    })();
                    
                    const isOnlineOrder = isFromNaBrasaSite || isFromOnlineMenu;
                    // Para Na Brasa: isPendingOnline apenas para pedidos do site hamburguerianabrasa.com.br
                    // Para outros: isPendingOnline apenas para pedidos do cardápio online
                    const isPendingOnline = isNaBrasa 
                      ? (isFromNaBrasaSite && (order.status === "pending" || order.status === "preparing"))
                      : (isFromOnlineMenu && (order.status === "pending" || order.status === "preparing"));

                    return (
                      <Card key={order.id} className="p-6">
                        <div className="flex justify-between items-start">
                          <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4">
                            <div>
                              <h3 className="font-semibold text-lg mb-2 flex items-center gap-2">
                                Pedido #{order.order_number}
                                {isFromNaBrasaSite && (
                                  <Badge variant="outline" className="text-xs bg-blue-50 dark:bg-blue-950/20">
                                    SITE
                                  </Badge>
                                )}
                                {isFromOnlineMenu && (
                                  <Badge variant="outline" className="text-xs bg-purple-50 dark:bg-purple-950/20">
                                    ONLINE
                                  </Badge>
                                )}
                                {isFromTotem && (
                                  <Badge variant="outline" className="text-xs bg-orange-50 dark:bg-orange-950/20">
                                    TOTEM
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
                                {order.queued_until_next_open && (
                                  <Badge 
                                    variant="outline"
                                    className="border-purple-500 text-purple-700 bg-purple-50 dark:bg-purple-950/20"
                                    title={order.release_at ? `Será liberado em: ${new Date(order.release_at).toLocaleString("pt-BR")}` : "Pré-pedido aguardando abertura"}
                                  >
                                    Pré-pedido
                                    {order.release_at && (
                                      <span className="ml-2 text-xs">
                                        ({new Date(order.release_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })})
                                      </span>
                                    )}
                                  </Badge>
                                )}
                                <Badge 
                                  variant="outline"
                                  className={order.payment_status === "paid" 
                                    ? "border-green-500 text-green-700 bg-green-50 dark:bg-green-950/20" 
                                    : "border-orange-500 text-orange-700 bg-orange-50 dark:bg-orange-950/20"
                                  }
                                >
                                  {order.payment_status === "paid" ? "Pago" : "Pendente"}
                                </Badge>
                                {order.rejection_reason && (
                                  <div className="mt-2 p-2 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded text-xs">
                                    <strong className="text-red-900 dark:text-red-100 block mb-1">Motivo da Recusa:</strong>
                                    <p className="text-red-800 dark:text-red-200">{order.rejection_reason}</p>
                                  </div>
                                )}
                                <p className="text-sm text-muted-foreground flex items-center">
                                  <Clock className="h-4 w-4 mr-1" />
                                  {new Date(order.created_at).toLocaleString("pt-BR")}
                                </p>
                              </div>
                            </div>

                            <div className="text-right">
                              <p className="text-2xl font-bold text-primary flex items-center justify-end">
                                {formatCurrencyBR(order.total_amount)}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {order.order_items?.length || 0} item(s)
                              </p>
                            </div>
                          </div>

                          <div className="flex flex-col items-end gap-2 ml-4">
                            <div className="flex items-center gap-1 flex-wrap">
                            <TooltipProvider>
                              {/* Botão Editar no PDV - disponível para todos os pedidos */}
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button 
                                    variant="outline" 
                                    size="icon"
                                    onClick={() => navigate(`/pdv?editOrder=${order.id}`)}
                                    className="h-8 w-8 border-purple-500 text-purple-700 hover:bg-purple-50 dark:hover:bg-purple-950/20"
                                  >
                                    <SquarePen className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Editar no PDV</p>
                                </TooltipContent>
                              </Tooltip>

                              {/* Botões para pedidos do PDV */}
                              {isPDVOrderCheck && (
                                <>

                                  {/* Botão de Confirmação de Pagamento */}
                                  {order.payment_status === "pending" && (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button 
                                          variant="outline" 
                                          size="icon"
                                          onClick={() => handleMarkPaymentAsPaid(order.id)}
                                          className="h-8 w-8 border-green-500 text-green-700 hover:bg-green-50 dark:hover:bg-green-950/20"
                                        >
                                          <DollarSign className="h-4 w-4" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>Confirmar Pagamento</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  )}

                                  {/* Botão de Pronto para Retirada */}
                                  {(order.status === "pending" || order.status === "preparing") && (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button 
                                          variant="outline" 
                                          size="icon"
                                          onClick={() => handleMarkDeliveryAsCompleted(order.id)}
                                          className="h-8 w-8 border-blue-500 text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/20"
                                        >
                                          <Truck className="h-4 w-4" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>Pronto Retirada/Entrega</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  )}
                                </>
                              )}

                              {/* Botões para pedidos online que já foram aceitos/impressos */}
                              {!isPDVOrderCheck && order.accepted_and_printed_at && (
                                <>
                                  {/* Botão de Confirmação de Pagamento */}
                                  {order.payment_status === "pending" && (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button 
                                          variant="outline" 
                                          size="icon"
                                          onClick={() => handleMarkPaymentAsPaid(order.id)}
                                          className="h-8 w-8 border-green-500 text-green-700 hover:bg-green-50 dark:hover:bg-green-950/20"
                                        >
                                          <DollarSign className="h-4 w-4" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>Confirmar Pagamento</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  )}

                                  {/* Botão de Pronto para Retirada */}
                                  {order.status === "pending" && (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button 
                                          variant="outline" 
                                          size="icon"
                                          onClick={() => handleMarkDeliveryAsCompleted(order.id)}
                                          className="h-8 w-8 border-blue-500 text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/20"
                                        >
                                          <Truck className="h-4 w-4" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>Pronto Retirada/Entrega</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  )}
                                </>
                              )}

                              {/* Botões para pedidos online pendentes que ainda não foram aceitos */}
                              {isPendingOnline && order.status === "pending" && !order.accepted_and_printed_at && (
                                <>
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button 
                                        variant="destructive" 
                                        size="icon"
                                        onClick={() => {
                                          setOrderToReject(order.id);
                                          setRejectionReason("");
                                        }}
                                        className="h-8 w-8"
                                        title="Recusar Pedido"
                                      >
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
                                      <div className="py-4">
                                        <Label htmlFor="rejection-reason" className="text-sm font-medium">
                                          Justificativa * (obrigatório)
                                        </Label>
                                        <Textarea
                                          id="rejection-reason"
                                          value={rejectionReason}
                                          onChange={(e) => setRejectionReason(e.target.value)}
                                          placeholder="Informe o motivo da recusa do pedido..."
                                          className="mt-2"
                                          rows={4}
                                        />
                                      </div>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel onClick={() => {
                                          setOrderToReject(null);
                                          setRejectionReason("");
                                        }}>
                                          Cancelar
                                        </AlertDialogCancel>
                                        <AlertDialogAction 
                                          onClick={handleRejectOrder}
                                          disabled={!rejectionReason.trim()}
                                        >
                                          Recusar Pedido
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                </>
                              )}

                              {/* Botão de "Pronto para Retirada" - aparece quando status é "preparing" ou na aba Totem com status "pending" */}
                              {(order.status === "preparing" || (activeTab === "totem" && order.status === "pending" && isFromTotem)) && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button 
                                      variant="outline" 
                                      size="icon"
                                      onClick={() => handleMarkAsReady(order.id)}
                                      className="h-8 w-8 border-blue-500 text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/20"
                                    >
                                      <Truck className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Pronto Retirada/Entrega</p>
                                  </TooltipContent>
                                </Tooltip>
                              )}

                              {/* Botão de Imprimir/Reimprimir */}
                              {(activeTab === "all" || activeTab === "totem" || isFromTotem) && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button 
                                      variant="outline" 
                                      size="icon"
                                      onClick={() => handlePrintOrder(order)}
                                      className="h-8 w-8"
                                    >
                                      <Printer className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>{activeTab === "all" ? "Reimprimir Pedido" : "Imprimir Pedido"}</p>
                                  </TooltipContent>
                                </Tooltip>
                              )}

                              {/* Botão Enviar PIX por WhatsApp */}
                              {shouldShowWhatsButton(order) && establishment && (
                                (establishment.pix_key_value || establishment.pix_key) ? (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <a
                                        href={buildWhatsLink(order, establishment)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                      >
                                        <Button 
                                          variant="outline" 
                                          size="icon"
                                          className="h-8 w-8 bg-green-500 hover:bg-green-600 text-white border-green-600"
                                        >
                                          <MessageCircle className="h-4 w-4" />
                                        </Button>
                                      </a>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>Enviar PIX por WhatsApp</p>
                                    </TooltipContent>
                                  </Tooltip>
                                ) : (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="outline"
                                        size="icon"
                                        disabled
                                        className="h-8 w-8 bg-gray-400 cursor-not-allowed border-gray-400"
                                      >
                                        <MessageCircle className="h-4 w-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>Configure sua chave PIX em Configurações</p>
                                    </TooltipContent>
                                  </Tooltip>
                                )
                              )}

                              {/* Botão Ver Detalhes */}
                              <Dialog>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <DialogTrigger asChild>
                                      <Button variant="outline" size="icon" className="h-8 w-8">
                                        <Eye className="h-4 w-4" />
                                      </Button>
                                    </DialogTrigger>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Ver Detalhes</p>
                                  </TooltipContent>
                                </Tooltip>
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
                                      <strong>Pagamento:</strong>{" "}
                                      <Badge 
                                        variant="outline"
                                        className={order.payment_status === "paid" 
                                          ? "border-green-500 text-green-700 bg-green-50 dark:bg-green-950/20 ml-2" 
                                          : "border-orange-500 text-orange-700 bg-orange-50 dark:bg-orange-950/20 ml-2"
                                        }
                                      >
                                        {order.payment_status === "paid" ? "Pago" : "Pendente"}
                                      </Badge>
                                    </div>
                                    <div>
                                      <strong>Método:</strong>{" "}
                                      <Badge variant="outline" className="ml-2">
                                        {order.payment_method === 'dinheiro' ? 'Dinheiro' :
                                         order.payment_method === 'pix' ? 'PIX' :
                                         order.payment_method === 'cartao_debito' ? 'Débito' :
                                         order.payment_method === 'cartao_credito' ? 'Crédito' :
                                         order.payment_method || 'N/A'}
                                      </Badge>
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
                                      {order.order_items?.map((item, index) => {
                                        // Extrair adicionais do campo customizations
                                        let addonsInfo = null;
                                        try {
                                          const customizations = item.customizations as any;
                                          if (customizations && customizations.addons && Array.isArray(customizations.addons) && customizations.addons.length > 0) {
                                            const addons = customizations.addons;
                                            addonsInfo = addons.map((a: any) => {
                                              const qty = a.quantity || 1;
                                              const price = a.price || 0;
                                              return `${qty}x ${a.name} (R$ ${(price * qty).toFixed(2)})`;
                                            }).join(', ');
                                          }
                                        } catch (e) {
                                          // Erro ao processar customizations - continuar silenciosamente
                                        }
                                        
                                        return (
                                          <div key={index} className="p-2 border rounded">
                                            <div className="flex justify-between items-center">
                                              <span className="font-medium">{item.quantity}x {item.products.name}</span>
                                              <span className="font-semibold">{formatCurrencyBR(item.total_price)}</span>
                                            </div>
                                            {addonsInfo && (
                                              <div className="mt-1.5 text-sm text-muted-foreground pl-2 border-l-2 border-primary/30">
                                                <span className="font-medium">Adicionais: </span>
                                                <span>{addonsInfo}</span>
                                              </div>
                                            )}
                                            {item.notes && (
                                              <div className="mt-1.5 text-sm text-muted-foreground pl-2 border-l-2 border-border">
                                                <span className="font-medium">Obs: </span>
                                                <span>{item.notes}</span>
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>

                                  {order.notes && (
                                    <div>
                                      <strong>Observações:</strong>
                                      <p className="text-sm text-muted-foreground mt-1">{order.notes}</p>
                                    </div>
                                  )}

                                  {order.rejection_reason && (
                                    <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg">
                                      <strong className="text-red-900 dark:text-red-100">Motivo da Recusa:</strong>
                                      <p className="text-sm text-red-800 dark:text-red-200 mt-1">{order.rejection_reason}</p>
                                    </div>
                                  )}

                                  {/* Botões de Ação */}
                                  <div className="pt-4 border-t space-y-3">
                                    {/* Botão Imprimir Cupom Não Fiscal */}
                                    <Button
                                      variant="outline"
                                      className="w-full"
                                      onClick={() => handlePrintNonFiscalReceipt(order)}
                                    >
                                      <Printer className="h-4 w-4 mr-2" />
                                      Imprimir Cupom Não Fiscal
                                    </Button>

                                    {/* Botão Enviar PIX por WhatsApp */}
                                    {shouldShowWhatsButton(order) && establishment && (
                                      <div>
                                        {establishment.pix_key ? (
                                          <a
                                            href={buildWhatsLink(order, establishment)}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-md transition-colors w-full justify-center"
                                          >
                                            <MessageCircle className="h-4 w-4" />
                                            Enviar PIX por WhatsApp
                                          </a>
                                        ) : (
                                          <div className="space-y-2">
                                            <Button
                                              disabled
                                              className="inline-flex items-center gap-2 px-4 py-2 bg-gray-400 cursor-not-allowed w-full"
                                              title="Configure sua chave PIX em Configurações"
                                            >
                                              <MessageCircle className="h-4 w-4" />
                                              Enviar PIX por WhatsApp
                                            </Button>
                                            <p className="text-xs text-muted-foreground">
                                              Configure sua chave PIX em Configurações para habilitar esta função
                                            </p>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </DialogContent>
                            </Dialog>

                            {/* Edit button for all orders */}
                            <Dialog 
                              open={isEditDialogOpen} 
                              onOpenChange={(open) => {
                                setIsEditDialogOpen(open);
                                if (!open) {
                                  setSelectedOrder(null);
                                  setEditPaymentMethod("");
                                }
                              }}
                            >
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <DialogTrigger asChild>
                                    <Button 
                                      variant="outline" 
                                      size="icon"
                                      onClick={() => {
                                        setSelectedOrder(order);
                                        setEditPaymentMethod(order.payment_method || "");
                                      }}
                                      className="h-8 w-8"
                                    >
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                  </DialogTrigger>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Editar Pedido</p>
                                </TooltipContent>
                              </Tooltip>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Editar Pedido #{selectedOrder?.order_number || order.order_number}</DialogTitle>
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
                              <Select
                                value={editPaymentMethod || selectedOrder?.payment_method || ""}
                                onValueChange={setEditPaymentMethod}
                              >
                                <SelectTrigger id="payment_method">
                                  <SelectValue placeholder="Selecione o método de pagamento" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="dinheiro">Dinheiro</SelectItem>
                                  <SelectItem value="pix">PIX</SelectItem>
                                  <SelectItem value="cartao_debito">Cartão de Débito</SelectItem>
                                  <SelectItem value="cartao_credito">Cartão de Crédito</SelectItem>
                                </SelectContent>
                              </Select>
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
                                    setEditPaymentMethod("");
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
                          <Button 
                            variant="outline" 
                            size="icon" 
                            className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20"
                            title="Excluir Pedido"
                          >
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
                            </TooltipProvider>
                          </div>
                          
                          {/* Botão destacado para aceitar e imprimir - posicionado abaixo dos outros botões */}
                          {isPendingOnline && order.status === "pending" && !order.accepted_and_printed_at && (
                            <Button 
                              variant="default" 
                              size="sm"
                              onClick={async () => {
                                // Verificar se é pedido de entrega
                                const isDelivery = order.order_type === 'delivery';
                                
                                if (isDelivery && establishment) {
                                  // Buscar motoboys ativos
                                  const { data: boys, error } = await supabase
                                    .from("delivery_boys")
                                    .select("id, name")
                                    .eq("establishment_id", establishment.id)
                                    .eq("active", true)
                                    .order("name");
                                  
                                  if (!error && boys && boys.length > 1) {
                                    // Se houver mais de um motoboy, mostrar diálogo de seleção
                                    setDeliveryBoys(boys);
                                    setPendingOrderForAccept(order);
                                    setSelectedDeliveryBoyId("");
                                    setShowDeliveryBoyDialog(true);
                                    return;
                                  } else if (!error && boys && boys.length === 1) {
                                    // Se houver apenas um, usar automaticamente
                                    await handleAcceptAndPrintOrder(order, boys[0].id);
                                    return;
                                  }
                                }
                                
                                // Se não for entrega ou não houver motoboys, aceitar normalmente
                                await handleAcceptAndPrintOrder(order);
                              }}
                              className="h-8 px-3 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white text-xs font-medium shadow-sm hover:shadow transition-all border border-green-400"
                            >
                              <Printer className="h-3.5 w-3.5 mr-1.5" />
                              Aceitar e Imprimir
                            </Button>
                          )}
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

        {/* Modal para coletar dados do cliente para cupom não fiscal */}
        <Dialog open={showNonFiscalModal} onOpenChange={setShowNonFiscalModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Dados do Cliente - Cupom Não Fiscal</DialogTitle>
              <DialogDescription>
                Preencha os dados do cliente para gerar o cupom não fiscal do pedido #{orderForNonFiscal?.order_number}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="customerPhoneNonFiscal">Telefone *</Label>
                <Input
                  id="customerPhoneNonFiscal"
                  value={customerPhoneNonFiscal}
                  onChange={(e) => setCustomerPhoneNonFiscal(phoneMask(e.target.value))}
                  placeholder="(00) 00000-0000"
                  maxLength={15}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="customerCpf">CPF (opcional)</Label>
                <Input
                  id="customerCpf"
                  value={customerCpf}
                  onChange={(e) => {
                    const formatted = formatCPF(e.target.value);
                    if (formatted.replace(/\D/g, '').length <= 11) {
                      setCustomerCpf(formatted);
                    }
                  }}
                  placeholder="000.000.000-00"
                  maxLength={14}
                />
              </div>
            </div>
            <div className="flex justify-end space-x-2 mt-6">
              <Button
                variant="outline"
                onClick={() => {
                  setShowNonFiscalModal(false);
                  setOrderForNonFiscal(null);
                  setCustomerCpf("");
                  setCustomerPhoneNonFiscal("");
                }}
              >
                Cancelar
              </Button>
              <Button onClick={handleConfirmNonFiscalPrint}>
                <Printer className="h-4 w-4 mr-2" />
                Imprimir Cupom
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        
        {/* Dialog para seleção de motoboy - fora do map */}
        <Dialog open={showDeliveryBoyDialog} onOpenChange={setShowDeliveryBoyDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Selecionar Motoboy para Entrega</DialogTitle>
              <DialogDescription>
                Selecione qual motoboy fará esta entrega. O pedido #{pendingOrderForAccept?.order_number} será aceito e impresso após a seleção.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {deliveryBoys.map((boy) => (
                <Button
                  key={boy.id}
                  variant={selectedDeliveryBoyId === boy.id ? "default" : "outline"}
                  className="w-full justify-start h-auto py-3"
                  onClick={() => setSelectedDeliveryBoyId(boy.id)}
                >
                  <Truck className="h-4 w-4 mr-2" />
                  <span className="font-medium">{boy.name}</span>
                  {selectedDeliveryBoyId === boy.id && (
                    <CheckCircle2 className="h-4 w-4 ml-auto" />
                  )}
                </Button>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowDeliveryBoyDialog(false);
                  setPendingOrderForAccept(null);
                  setSelectedDeliveryBoyId("");
                  setDeliveryBoys([]);
                }}
              >
                Cancelar
              </Button>
              <Button
                onClick={async () => {
                  if (!selectedDeliveryBoyId || !pendingOrderForAccept) {
                    toast.error("Por favor, selecione um motoboy");
                    return;
                  }
                  
                  await handleAcceptAndPrintOrder(pendingOrderForAccept, selectedDeliveryBoyId);
                  
                  setShowDeliveryBoyDialog(false);
                  setPendingOrderForAccept(null);
                  setSelectedDeliveryBoyId("");
                  setDeliveryBoys([]);
                }}
                disabled={!selectedDeliveryBoyId}
              >
                <Printer className="h-4 w-4 mr-2" />
                Aceitar e Imprimir
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  };

  export default Orders;