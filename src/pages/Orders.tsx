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
  Monitor,
  Calendar,
  CreditCard,
  AlertCircle,
  MoreVertical,
  CheckCircle2 as CheckCircleIcon
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
  delivery_boy_id?: string;
  queued_until_next_open?: boolean;
  release_at?: string;
  meta?: any;
  is_credit_sale?: boolean;
  credit_due_date?: string;
  credit_received_at?: string;
  credit_interest_amount?: number;
  credit_total_with_interest?: number;
  order_items?: {
    id: string;
    quantity: number;
    unit_price: number;
    total_price: number;
    notes?: string;
    customizations?: any;
    products: {
      name: string;
      categories?: {
        name: string;
      }
    };
  }[];
}

const Orders = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const firstLoadRef = useRef(true);
  const isLoadingRef = useRef(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isViewDetailsDialogOpen, setIsViewDetailsDialogOpen] = useState(false);
  const [establishment, setEstablishment] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<string>("pending");
  const [isNaBrasa, setIsNaBrasa] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [orderToReject, setOrderToReject] = useState<string | null>(null);
  const [showAllDates, setShowAllDates] = useState(false);
  const [showPDV, setShowPDV] = useState(false);
  const [showSite, setShowSite] = useState(false);
  const [showDeliveries, setShowDeliveries] = useState(false);
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
    if (!establishment?.id) return;

    // Resetar firstLoadRef quando o establishment mudar
    firstLoadRef.current = true;
    setLoading(true);
    loadOrders();

    // OTIMIZAÇÃO: Throttle recarregamento para evitar muitas requisições
    let reloadTimeout: NodeJS.Timeout | null = null;
    let lastReloadTime = 0;
    const THROTTLE_DELAY = 500;
    const MIN_RELOAD_INTERVAL = 1000; // Mínimo de 1 segundo entre reloads

    const reloadWithThrottle = (immediate = false) => {
      const now = Date.now();
      
      // Se já está carregando, ignorar nova chamada
      if (isLoadingRef.current && !immediate) {
        return;
      }

      // Limpar timeout anterior se existir
      if (reloadTimeout) {
        clearTimeout(reloadTimeout);
        reloadTimeout = null;
      }

      if (immediate) {
        // Para eventos imediatos, verificar se passou o intervalo mínimo
        if (now - lastReloadTime < MIN_RELOAD_INTERVAL) {
          // Se não passou, agendar para depois
          reloadTimeout = setTimeout(() => {
            lastReloadTime = Date.now();
            loadOrders({ background: true });
          }, MIN_RELOAD_INTERVAL - (now - lastReloadTime));
        } else {
          lastReloadTime = now;
          loadOrders({ background: true });
        }
      } else {
        // Para eventos não imediatos, usar throttle normal
        reloadTimeout = setTimeout(() => {
          const currentTime = Date.now();
          if (currentTime - lastReloadTime >= MIN_RELOAD_INTERVAL) {
            lastReloadTime = currentTime;
            loadOrders({ background: true });
          }
        }, THROTTLE_DELAY);
      }
    };

    // Realtime: escuta mudanças em orders (INSERT, UPDATE, DELETE)
    const channel = supabase
      .channel(`orders-realtime-${establishment.id}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'orders', 
        filter: `establishment_id=eq.${establishment.id}` 
      }, (payload) => {
        const isInsert = payload.new && !payload.old;
        reloadWithThrottle(isInsert);
      })
      .subscribe();

    const handleNewOrderNotification = () => {
      reloadWithThrottle(true);
    };
    
    window.addEventListener('new-order-notification', handleNewOrderNotification);

    return () => {
      if (reloadTimeout) {
        clearTimeout(reloadTimeout);
        reloadTimeout = null;
      }
      supabase.removeChannel(channel);
      window.removeEventListener('new-order-notification', handleNewOrderNotification);
    };
  }, [establishment?.id]);

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

  const filteredOrders = useMemo(() => {
    let filtered = orders;

    if (activeTab === "pending") {
      if (isNaBrasa) {
        filtered = filtered.filter(order => {
          if (!isFromNaBrasaSite(order)) return false;
          if (order.status === "cancelled" && order.rejection_reason) return false;
          
          const statusNormalized = String(order.status).trim().toLowerCase();
          const statusConfirmed = statusNormalized === "completed" || statusNormalized === "ready";
          const paymentConfirmed = String(order.payment_status).trim().toLowerCase() === "paid";
          if (statusConfirmed && paymentConfirmed) return false;
          
          return true;
        });
      } else {
        filtered = filtered.filter(order => {
          if (!isFromOnlineMenu(order)) return false;
          if (order.status === "cancelled" && order.rejection_reason) return false;

          const statusNormalized = String(order.status).trim().toLowerCase();
          const statusConfirmed = statusNormalized === "completed" || statusNormalized === "ready";
          const paymentConfirmed = String(order.payment_status).trim().toLowerCase() === "paid";
          if (statusConfirmed && paymentConfirmed) return false;

          return true;
        });
      }
    } else if (activeTab === "totem") {
      filtered = filtered.filter(order => {
        return order.channel === "totem" || order.origin === "totem";
      });
    } else if (activeTab === "completed") {
      if (isNaBrasa) {
        filtered = filtered.filter(order => {
          if (order.status === "cancelled" && order.rejection_reason) return false;
          if (isFromNaBrasaSite(order)) return false;
          if (order.channel === "totem" || order.origin === "totem") return false;
          
          const hasNoSourceDomain = !order.source_domain || String(order.source_domain).trim() === '';
          const isNotOnline = order.channel !== "online" && order.origin !== "site";
          const isPDV = hasNoSourceDomain && isNotOnline;
          const isPDVPending = isPDV && (order.status === "pending" || order.payment_status === "pending");
          
          return isPDVPending;
        });
      } else {
        filtered = filtered.filter(order => {
          if (order.channel === "totem" || order.origin === "totem") return false;
          
          const hasNoSourceDomain = !order.source_domain || String(order.source_domain).trim() === '';
          const isNotNaBrasa = !order.source_domain?.toLowerCase().includes('hamburguerianabrasa');
          const isNotOnline = order.channel !== "online" && order.origin !== "site";
          const isPDV = hasNoSourceDomain && isNotNaBrasa && isNotOnline;
          
          const isPending = order.status === "pending" || order.payment_status === "pending";
          return isPDV && isPending;
        });
      }
    } else if (activeTab === "rejected") {
      filtered = filtered.filter(order => 
        order.status === "cancelled" && order.rejection_reason
      );
    } else if (activeTab === "to_receive") {
      // Aba "A RECEBER" - apenas pedidos fiado não recebidos
      filtered = filtered.filter(order => 
        order.is_credit_sale === true && 
        !order.credit_received_at &&
        order.payment_status !== 'cancelled'
      );
    } else if (activeTab === "all") {
      filtered = filtered.filter(order => {
        if (order.status === "cancelled" && order.rejection_reason) return false;
        
        // Excluir pedidos fiado não recebidos da aba "Todos" (eles vão para "A RECEBER")
        if (order.is_credit_sale === true && !order.credit_received_at) {
          return false;
        }
        
        const statusNormalized = String(order.status).trim().toLowerCase();
        const isStatusFinal = statusNormalized === "completed" || statusNormalized === "ready";
        const isPaymentPaid = String(order.payment_status).trim().toLowerCase() === "paid";
        const isFullyConfirmed = isStatusFinal && isPaymentPaid;
        
        if (isPDVOrder(order) && !isFullyConfirmed) return false;
        if ((isFromNaBrasaSite(order) || isFromOnlineMenu(order)) && !isFullyConfirmed) return false;
        
        return isFullyConfirmed;
      });

      if (selectedDate) {
        const [year, month, day] = selectedDate.split('-').map(Number);
        filtered = filtered.filter(order => {
          const orderDate = new Date(order.created_at);
          const orderYear = orderDate.getFullYear();
          const orderMonth = orderDate.getMonth() + 1;
          const orderDay = orderDate.getDate();
          return orderYear === year && orderMonth === month && orderDay === day;
        });
      } else if (!showAllDates) {
        const today = new Date();
        const todayYear = today.getFullYear();
        const todayMonth = today.getMonth() + 1;
        const todayDay = today.getDate();
        filtered = filtered.filter(order => {
          const orderDate = new Date(order.created_at);
          const orderYear = orderDate.getFullYear();
          const orderMonth = orderDate.getMonth() + 1;
          const orderDay = orderDate.getDate();
          return orderYear === todayYear && orderMonth === todayMonth && orderDay === todayDay;
        });
      }

      if (selectedPaymentMethod) {
        filtered = filtered.filter(order => order.payment_method === selectedPaymentMethod);
      }

      if (showDeliveries) {
        filtered = filtered.filter(order => order.order_type === 'delivery');
      }

      if (!showPDV && !showSite) {
        filtered = [];
      } else {
        if (showPDV && !showSite) {
          filtered = filtered.filter(order => isPDVOrder(order));
        } else if (!showPDV && showSite) {
          filtered = filtered.filter(order => isFromNaBrasaSite(order) || isFromOnlineMenu(order));
        }
      }
    }

    if (searchTerm) {
      filtered = filtered.filter(order =>
        order.order_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.customer_phone?.includes(searchTerm)
      );
    }

    return filtered;
  }, [orders, activeTab, isNaBrasa, showAllDates, showPDV, showSite, showDeliveries, selectedDate, selectedPaymentMethod, searchTerm, isFromNaBrasaSite, isFromOnlineMenu, isPDVOrder]);

  const filteredOrdersTotal = useMemo(() => {
    if (!filteredOrders.length) return 0;
    return filteredOrders.reduce((sum, order) => {
      const value = typeof order.total_amount === "number" ? order.total_amount : 0;
      return sum + value;
    }, 0);
  }, [filteredOrders]);

  const checkAuth = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate("/auth");
        return;
      }

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
    if (isLoadingRef.current) return;

    try {
      if (!establishment?.id) return;

      isLoadingRef.current = true;
      const background = !!opts?.background;
      
      if (!background && firstLoadRef.current) {
        setLoading(true);
      }
      
      const cutoffDate = new Date();
      cutoffDate.setMonth(cutoffDate.getMonth() - 3);
      
      const { data, error } = await supabase
        .from("orders")
        .select(`
          *,
          order_items (
            *,
            products (name, categories(name))
          )
        `)
        .eq("establishment_id", establishment.id)
        .gte("created_at", cutoffDate.toISOString())
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      setOrders(data || []);
    } catch (error: any) {
      if (error?.code !== 'PGRST301' && error?.message !== 'The user aborted a request') {
        toast.error("Erro ao carregar pedidos");
      }
    } finally {
      isLoadingRef.current = false;
      if (firstLoadRef.current) {
        setLoading(false);
        firstLoadRef.current = false;
      }
    }
  };

  const handleDeleteOrder = async (orderId: string) => {
    try {
      const { error: itemsError } = await supabase
        .from("order_items")
        .delete()
        .eq("order_id", orderId);
      if (itemsError) throw itemsError;

      await supabase
        .from("pix_payments")
        .delete()
        .eq("order_id", orderId);

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
      
      const newPaymentMethod = editPaymentMethod || formData.get("payment_method") as string || selectedOrder.payment_method;
      const paymentMethodChanged = newPaymentMethod !== selectedOrder.payment_method;
      
      const updateData = {
        customer_name: formData.get("customer_name") as string,
        customer_phone: formData.get("customer_phone") as string,
        status: formData.get("status") as string,
        payment_status: formData.get("payment_status") as string,
        payment_method: newPaymentMethod,
        notes: formData.get("notes") as string,
        table_number: formData.get("table_number") as string,
      };

      const { error } = await supabase
        .from("orders")
        .update(updateData)
        .eq("id", selectedOrder.id);

      if (error) throw error;

      // Se o método de pagamento foi alterado, imprimir recibo
      if (paymentMethodChanged) {
        // Buscar o pedido atualizado com todos os dados necessários
        const { data: updatedOrder, error: fetchError } = await supabase
          .from("orders")
          .select(`
            *,
            order_items (
              *,
              products (
                id,
                name,
                price,
                categories (
                  name
                )
              )
            )
          `)
          .eq("id", selectedOrder.id)
          .single();

        if (!fetchError && updatedOrder) {
          // Criar um objeto Order completo para passar para handlePrintOrder
          // Garantir que todos os campos necessários estejam presentes
          const orderToPrint: Order = {
            ...selectedOrder, // Manter dados originais como fallback
            ...updatedOrder, // Sobrescrever com dados atualizados
            payment_method: newPaymentMethod, // Garantir que o método de pagamento atualizado está presente
            order_items: updatedOrder.order_items || selectedOrder.order_items || []
          } as Order;

          // Usar a função handlePrintOrder que já tem toda a lógica de impressão
          try {
            await handlePrintOrder(orderToPrint);
            toast.success("Pedido atualizado e recibo impresso com sucesso");
          } catch (printError: any) {
            console.error('Erro ao imprimir recibo:', printError);
            toast.warning("Pedido atualizado com sucesso, mas houve um erro ao imprimir o recibo");
          }
        } else {
          console.error('Erro ao buscar pedido atualizado:', fetchError);
          // Tentar imprimir mesmo assim com os dados do selectedOrder atualizado
          try {
            const orderToPrint: Order = {
              ...selectedOrder,
              payment_method: newPaymentMethod
            } as Order;
            await handlePrintOrder(orderToPrint);
            toast.success("Pedido atualizado e recibo impresso com sucesso");
          } catch (printError: any) {
            console.error('Erro ao imprimir recibo:', printError);
            toast.warning("Pedido atualizado com sucesso, mas não foi possível imprimir o recibo");
          }
        }
      } else {
        toast.success("Pedido atualizado com sucesso");
      }

      setIsEditDialogOpen(false);
      setSelectedOrder(null);
      setEditPaymentMethod("");
      loadOrders();
    } catch (error: any) {
      console.error('Erro ao atualizar pedido:', error);
      toast.error(`Erro ao atualizar pedido: ${error.message || 'Erro desconhecido'}`);
    }
  };

  const removeDuplicateReceiptInfo = (text: string): string | null => {
    if (!text) return null;
    
    let cleaned = text
      .replace(/\s+/g, ' ')
      .replace(/\n/g, ' ')
      .replace(/\r/g, ' ')
      .trim();
    
    cleaned = cleaned
      .replace(/\*?Subtotal[:\s]*R\$\s*[\d.,\s]+/gi, '')
      .replace(/\*?Taxa\s+de\s+entrega[:\s]*R\$\s*[\d.,\s]+/gi, '')
      .replace(/\*?Entrega[:\s]*R\$\s*[\d.,\s]+/gi, '')
      .replace(/\*?Taxa\s+de\s+entrega\s*R\$\s*[\d.,\s]+/gi, '')
      .replace(/\*?Total[:\s]*R\$\s*[\d.,\s]+/gi, '')
      .replace(/\*?TOTAL[:\s]*R\$\s*[\d.,\s]+/gi, '')
      .replace(/\*?Forma\s+de\s+entrega[:\s]*[^\*]*Entrega[^\*]*/gi, '')
      .replace(/\*?Forma\s+entrega[:\s]*[^\*]*Entrega[^\*]*/gi, '')
      .replace(/\*?Entrega[:\s]*[^\*]*Entrega[^\*]*/gi, '')
      .replace(/\*?Forma\s+de\s+entrega[:\s]*[^\*]+/gi, '')
      .replace(/\*?Cliente[:\s]*[^\*]+/gi, '')
      .replace(/\*?Endereço[:\s]*[^\*]+/gi, '')
      .replace(/\*?Endereco[:\s]*[^\*]+/gi, '')
      .replace(/\*?Forma\s+de\s+pagamento[:\s]*[^\*]+/gi, '')
      .replace(/\*?Forma\s+pagamento[:\s]*[^\*]+/gi, '')
      .replace(/\*?Pagamento[:\s]*[^\*]+/gi, '')
      .replace(/\bForma\s+de\s*$/gi, '')
      .replace(/^\s*passado\s*$/gi, '')
      .replace(/\*+/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    
    const duplicateKeywords = [
      'subtotal', 'total', 'entrega', 'taxa', 'cliente', 'endereço', 'endereco',
      'pagamento', 'forma', 'cartao', 'cartão', 'dinheiro', 'pix'
    ];
    
    const words = cleaned.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    const duplicateWordCount = words.filter(w => 
      duplicateKeywords.some(kw => w.includes(kw))
    ).length;
    
    if (words.length > 0 && (duplicateWordCount / words.length) > 0.5) {
      return null;
    }
    
    if (!cleaned || cleaned.length < 2) return null;
    
    return cleaned;
  };

  const handlePrintOrder = async (order: Order) => {
    let items: Array<{ name: string; quantity: number; unitPrice: number; totalPrice: number; notes?: string }> = [];
    
    const extractTrioInfo = (notesText: string): string | null => {
      if (!notesText) return null;
      const trioRegex = /Trio\s*:\s*([^\n\[\]]+?)(?:\n|$|\[|Subtotal|Total|Forma|Cliente|Endereço)/i;
      let match = notesText.match(trioRegex);
      
      if (!match) {
        const textWithoutBrackets = notesText.replace(/\[([^\]]+)\]/g, '');
        match = textWithoutBrackets.match(/Trio\s*:\s*([^\n]+)/i);
      }
      
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
        trioText = trioText.replace(/\s+/g, ' ').trim();
        trioText = trioText.replace(/[^\w\s+\-:áàâãéêíóôõúçÁÀÂÃÉÊÍÓÔÕÚÇ]/g, '').trim();
        if (trioText.length > 0) {
          return trioText;
        }
      }
      return null;
    };
    
    // PRIORIDADE 1: Itens do notes usando colchetes [ ]
    if (order.notes) {
      const parsed: Array<{ name: string; quantity: number; unitPrice: number; totalPrice: number; notes?: string }> = [];
      const parsePrice = (raw: string) => {
        const s = raw.trim();
        if (s.includes(',')) {
          return parseFloat(s.replace(/\./g, '').replace(',', '.')) || 0;
        }
        return parseFloat(s) || 0;
      };
      
      const bracketRegex = /\[([^\]]+)\]/g;
      const text = order.notes;
      let match;
      const originalItemTexts: Map<number, string> = new Map();
      let itemIndex = 0;
      
      const itemTrios: Map<number, string> = new Map();
      let tempMatch;
      let tempIndex = 0;
      const tempRegex = /\[([^\]]+)\]/g;
      
      while ((tempMatch = tempRegex.exec(text)) !== null) {
        const itemText = tempMatch[1].trim();
        if (itemText) {
          const trioInNameMatch = itemText.match(/\+\s*Trio\s*\(([^)]+)\)/i);
          if (trioInNameMatch && trioInNameMatch[1]) {
            let trioText = trioInNameMatch[1].trim();
            trioText = trioText.replace(/\s+/g, ' ').trim();
            if (trioText.length > 0) {
              itemTrios.set(tempIndex, trioText);
            }
          } else {
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
        const itemText = match[1].trim();
        
        if (!itemText) continue;
        originalItemTexts.set(itemIndex, itemText);
        
        const qtyMatch = itemText.match(/^(\d+)x\s+/i);
        if (!qtyMatch) continue;
        
        const qty = parseInt(qtyMatch[1], 10) || 1;
        if (qty <= 0 || qty > 1000) continue;
        
        let remainingText = itemText.replace(/^\d+x\s+/i, '').trim();
        
        const priceMatch = remainingText.match(/R\$\s*([\d.,]+)/i);
        if (!priceMatch) continue;
        
        const total = parsePrice(priceMatch[1]);
        if (total <= 0) continue;
        
        const unit = total / qty;
        
        remainingText = remainingText.replace(/R\$\s*[\d.,]+\s*/i, '').trim();
        
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
        
        const originalRemainingText = remainingText;
        const hasTrioInName = originalRemainingText.toLowerCase().includes('+ trio') || originalRemainingText.toLowerCase().includes('+trio');
        
        if (firstNotesIndex !== -1) {
          name = remainingText.substring(0, firstNotesIndex).trim();
          name = name.replace(/\s*\+\s*Trio\s*\([^)]+\)\s*/gi, '').trim();
          name = name.replace(/\s*\+\s*Trio\s*/gi, '').trim();
          name = name.replace(/\s*\([^)]*(trio|batata|coca|guaraná|pequena|grande|refrigerante|bebida)[^)]*\)/gi, '').trim();
          name = name.replace(/\s*[-]?\s*Trio\s*:\s*[^\n]*/gi, '').trim();
          
          const notesText = remainingText.substring(firstNotesIndex).trim();
          name = name.replace(/-\s*$/, '').trim();
          notes = notesText.replace(/\s+/g, ' ').trim();
          
          notes = notes.replace(/^(Obs:\s*)+/i, 'Obs: ');
          notes = notes.replace(/(Obs:\s*){2,}/gi, 'Obs: ');
          
          if (notes.match(/^Obs:\s+(Molhos?|Observação|Obs):\s*/i)) {
            notes = notes.replace(/^Obs:\s+/i, '').trim();
            const afterMarker = notes.replace(/^(Molhos?|Observação|Obs):\s*/i, '').trim();
            if (!afterMarker || afterMarker.length < 1) {
              notes = undefined;
            }
          }
          
          if (notes && notes.match(/^Obs:\s*$/i)) {
            notes = undefined;
          }
          
          if (!notes || notes.length < 2) {
            notes = undefined;
          }
        } else {
          name = remainingText.replace(/\s*\+\s*Trio\s*\([^)]+\)\s*/gi, '').trim();
          name = name.replace(/\s*\+\s*Trio\s*/gi, '').trim();
          name = name.replace(/\s*\([^)]*trio[^)]*\)/gi, '').trim();
          name = name.replace(/\s*\([^)]*batata[^)]*\)/gi, '').trim();
          name = name.replace(/\s*[-]?\s*Trio\s*:\s*[^\n]*/gi, '').trim();
          name = name.replace(/-\s*$/, '').trim();
        }
        
        if (!name || name.length < 2) continue;
        
        if (notes) {
          notes = notes.replace(/^\*\s*/, '').replace(/\s*\*$/, '').trim();
          
          const itemNameLower = name.toLowerCase();
          const isAccompaniment = itemNameLower.includes('batata') || 
                                  itemNameLower.includes('frango no pote') ||
                                  itemNameLower.includes('frango pote') ||
                                  itemNameLower.includes('acompanhamento');
          
          if (isAccompaniment) {
            notes = notes.replace(/Molhos?\s*:\s*/gi, '').trim();
            notes = notes.replace(/^Obs:\s*Molhos?\s*:\s*/i, 'Obs: ').trim();
            notes = notes.replace(/^Obs:\s*Opção:\s*/i, 'Opção: ').trim();
            notes = notes.split('\n').map(line => {
              const trimmed = line.trim();
              if (trimmed.toLowerCase().startsWith('obs:') && trimmed.toLowerCase().includes('opção:')) {
                return trimmed.replace(/^Obs:\s*/i, '').trim();
              }
              return trimmed;
            }).join('\n').trim();
          }
          
          notes = notes.replace(/^(Obs:\s*)+/i, 'Obs: ');
          notes = notes.replace(/(Obs:\s*){2,}/gi, 'Obs: ');
          
          if (notes.match(/^Obs:\s+(Molhos?|Observação|Obs|Opção):\s*/i)) {
            notes = notes.replace(/^Obs:\s+/i, '').trim();
          }
          
          if (notes.match(/^Obs:\s*$/i) || notes.match(/^Obs:\s+(Molhos?|Observação|Obs|Opção):\s*$/i)) {
            notes = undefined;
          } else if (notes) {
            notes = removeDuplicateReceiptInfo(notes) || undefined;
            if (notes && notes.match(/^Obs:\s*$/i)) {
              notes = undefined;
            }
          }
        }
        
        if (notes) {
          const notesLines = notes.split('\n');
          const cleanedLines = notesLines.filter(line => !line.trim().toLowerCase().startsWith('trio:'));
          notes = cleanedLines.join('\n').trim();
          notes = notes.replace(/\n\s*\n+/g, '\n').trim();
          if (!notes || notes.length < 2) {
            notes = undefined;
          }
        }
        
        if (hasTrioInName) {
          let itemTrio: string | null = null;
          if (itemTrios.has(itemIndex)) {
            itemTrio = itemTrios.get(itemIndex) || null;
          } else {
            const trioInNameMatch = originalRemainingText.match(/\+\s*Trio\s*\(([^)]+)\)/i);
            if (trioInNameMatch && trioInNameMatch[1]) {
              itemTrio = trioInNameMatch[1].trim();
              itemTrio = itemTrio.replace(/\s+/g, ' ').trim();
            }
          }
          
          if (itemTrio) {
            const notesLower = (notes || '').toLowerCase();
            const itemTrioLower = itemTrio.toLowerCase();
            const hasTrioAlready = notesLower.includes(`trio: ${itemTrioLower}`) || 
                                   notesLower.includes(`trio:${itemTrioLower}`);
            
            if (!hasTrioAlready) {
              const trioNote = `Trio: ${itemTrio}`;
              if (notes) {
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
      
      items = parsed;
      
      if (items.length === 0) {
        const lines = order.notes.split('\n').map(l => l.trim()).filter(Boolean);
        
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const clean = line.replace(/^\*/g,'').replace(/\*$/g,'');
          
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
              notes = notes.replace(/^(Obs:\s*)+/i, 'Obs: ');
              notes = notes.replace(/(Obs:\s*){2,}/gi, 'Obs: ');
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
    
    // PRIORIDADE 2: Itens do banco de dados (order_items)
    if (items.length === 0 && order.order_items && order.order_items.length > 0) {
      const trioInfo = extractTrioInfo(order.notes || '');
      
      items = (order.order_items || []).flatMap(item => {
        const itemName = item.products?.name || 'Item';
        const itemNameLower = itemName.toLowerCase();
        
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
        
        let finalNotes = item.notes ? removeDuplicateReceiptInfo(item.notes) || undefined : undefined;
        
        try {
          const customizations = item.customizations as any;
          if (customizations && customizations.addons && Array.isArray(customizations.addons)) {
            const addons = customizations.addons;
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
          // Erro silencioso
        }
        
        if (isAccompaniment && finalNotes) {
          finalNotes = finalNotes.replace(/Molhos?\s*:\s*/gi, '').trim();
          finalNotes = finalNotes.replace(/^Obs:\s*Molhos?\s*:\s*/i, 'Obs: ').trim();
          finalNotes = finalNotes.replace(/^Obs:\s*Opção:\s*/i, 'Opção: ').trim();
          finalNotes = finalNotes.split('\n').map(line => {
            const trimmed = line.trim();
            if (trimmed.toLowerCase().startsWith('obs:') && trimmed.toLowerCase().includes('opção:')) {
              return trimmed.replace(/^Obs:\s*/i, '').trim();
            }
            return trimmed;
          }).join('\n').trim();
          if (finalNotes.match(/^Obs:\s*$/i)) {
            finalNotes = undefined;
          }
        }
        
        if (hasTrioInName && trioInfo) {
          const trioNote = `Trio: ${trioInfo}`;
          if (finalNotes) {
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

    if (items.length === 0) {
      items = [{ name: 'Pedido Online', quantity: 1, unitPrice: order.total_amount, totalPrice: order.total_amount, notes: order.notes }];
    }

    if (items.length > 0 && items.some(item => !item.notes) && order.order_items) {
      const itemsMap = new Map(items.map(item => [item.name.toLowerCase(), item]));
      order.order_items.forEach(orderItem => {
        const itemName = orderItem.products?.name?.toLowerCase() || '';
        const existingItem = itemsMap.get(itemName);
        if (existingItem && !existingItem.notes && orderItem.notes) {
          let cleanedNotes = orderItem.notes.trim();
          cleanedNotes = cleanedNotes.replace(/^(Obs:\s*)+/i, 'Obs: ');
          cleanedNotes = cleanedNotes.replace(/(Obs:\s*){2,}/gi, 'Obs: ');
          if (!cleanedNotes.match(/^Obs:\s*$/i)) {
            cleanedNotes = removeDuplicateReceiptInfo(cleanedNotes) || '';
            if (cleanedNotes) {
              existingItem.notes = cleanedNotes;
            }
          }
        }
      });
    }
    
    items = items.map(item => {
      if (item.notes) {
        let cleanedNotes = item.notes.trim();
        const itemNameLower = item.name.toLowerCase();
        const isAccompaniment = itemNameLower.includes('batata') || 
                                itemNameLower.includes('frango no pote') ||
                                itemNameLower.includes('frango pote') ||
                                itemNameLower.includes('acompanhamento') ||
                                itemNameLower.includes('cebolas empanadas') ||
                                itemNameLower.includes('mini chickens') ||
                                itemNameLower.includes('fritas');
        
        if (isAccompaniment) {
          cleanedNotes = cleanedNotes.replace(/Molhos?\s*:\s*/gi, '').trim();
          cleanedNotes = cleanedNotes.replace(/^Obs:\s*Molhos?\s*:\s*/i, 'Obs: ').trim();
          cleanedNotes = cleanedNotes.replace(/^Obs:\s*Opção:\s*/i, 'Opção: ').trim();
          cleanedNotes = cleanedNotes.split('\n').map(line => {
            const trimmed = line.trim();
            if (trimmed.toLowerCase().startsWith('obs:') && trimmed.toLowerCase().includes('opção:')) {
              return trimmed.replace(/^Obs:\s*/i, '').trim();
            }
            return trimmed;
          }).join('\n').trim();
        }
        
        cleanedNotes = cleanedNotes.replace(/^(Obs:\s*)+/i, 'Obs: ');
        cleanedNotes = cleanedNotes.replace(/(Obs:\s*){2,}/gi, 'Obs: ');
        
        if (cleanedNotes.match(/^Obs:\s+(Molhos?|Observação):/i)) {
          cleanedNotes = cleanedNotes.replace(/^Obs:\s+/i, '').trim();
        }
        
        if (cleanedNotes.match(/^Obs:\s*$/i)) {
          cleanedNotes = '';
        } else {
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

    // ------------------ INÍCIO DA ALTERAÇÃO ------------------
    // Nome + endereço ou tipo de serviço ao lado do nome
    let customerDisplay = order.customer_name || '';
    let generalInstructions: string | undefined = undefined;

    // Verifica o tipo do pedido para adicionar ao lado do nome
    if (order.order_type === 'takeout') {
      customerDisplay = `${customerDisplay} - Embalar pra levar`;
    } else if (order.order_type === 'dine_in') {
      customerDisplay = `${customerDisplay} - Comer aqui`;
    }

    // Se for delivery, tenta extrair o endereço das notas
    if (order.order_type === 'delivery' && order.notes) {
      const text = order.notes.replace(/\*/g, '');
      const mAddr = text.match(/Endereç[oa]:\s*([^*\n]+)/i);
      if (mAddr && mAddr[1]) {
        const addr = mAddr[1].trim();
        if (addr) customerDisplay = `${customerDisplay} - ${addr}`.trim();
      }
    }
    // ------------------ FIM DA ALTERAÇÃO ------------------
    
    // Tratamento das instruções gerais (Mantendo a limpeza de texto original)
    if (order.notes) {
      const text = order.notes.replace(/\*/g, '');
      
      let textWithoutTrio = text;
      textWithoutTrio = textWithoutTrio.replace(/^Trio\s*:\s*[^\n]+/gmi, '');
      textWithoutTrio = textWithoutTrio.replace(/\nTrio\s*:\s*[^\n]+/gmi, '');
      
      let textWithoutServiceType = textWithoutTrio;
      // Remove termos de serviço do corpo do texto para não duplicar, já que agora está no título
      textWithoutServiceType = textWithoutServiceType
        .replace(/comer\s+no\s+local/gi, '')
        .replace(/comer\s+no\s+estabelecimento/gi, '')
        .replace(/embalar\s+(para|pra)\s+levar/gi, '')
        .replace(/\bembalar\b/gi, '')
        .replace(/\bpara\s+levar\b/gi, '')
        .replace(/\bpra\s+levar\b/gi, '')
        .replace(/Forma\s+de\s+consumo[\/:]?\s*embalagem[:\s]*/gi, '')
        .replace(/Forma\s+de\s+embalagem[:\s]*/gi, '')
        .replace(/Forma\s+de\s+consumo[:\s]*/gi, '')
        .replace(/consumo[\/:]?\s*embalagem[:\s]*/gi, '')
        .trim();
      
      const instructionsMatch = textWithoutServiceType.match(/Instruções\s+do\s+Pedido:\s*([\s\S]*?)(?:\n\n|$)/i);
      if (instructionsMatch && instructionsMatch[1]) {
        let rawInstructions = instructionsMatch[1].trim();
        
        rawInstructions = rawInstructions
          .replace(/\(?\d{2}\)?\s*\d{4,5}[-\s]?\d{4}/g, '')
          .replace(/\b\d{10,11}\b/g, '')
          .replace(/(Tel|Telefone|Fone|Phone)[:\s]*\(?\d{2}\)?\s*\d{4,5}[-\s]?\d{4}/gi, '')
          .replace(/(Tel|Telefone|Fone|Phone)[:\s]*\d{10,11}/gi, '')
          .replace(/^(Telefone|Tel|Fone|Phone)[:\s]*$/gmi, '')
          .replace(/\n(Telefone|Tel|Fone|Phone)[:\s]*$/gmi, '')
          .replace(/\n(Telefone|Tel|Fone|Phone)[:\s]*\n/gmi, '\n')
          .trim();
        
        rawInstructions = rawInstructions.replace(/Trio\s*:\s*[^\n]+/gi, '').trim();
        rawInstructions = rawInstructions.replace(/Resumo[:\s]*[\d\s]*x\s*(hamburgueres?|acompanhamentos?|bebidas?)[\s,]*[\d\s]*x\s*(hamburgueres?|acompanhamentos?|bebidas?)?[\s,]*[\d\s]*x\s*(hamburgueres?|acompanhamentos?|bebidas?)?/gi, '').trim();
        rawInstructions = rawInstructions.replace(/^\s*Resumo[:\s]*.*$/gmi, '').trim();
        
        rawInstructions = rawInstructions
          .replace(/comer\s+no\s+local/gi, '')
          .replace(/comer\s+no\s+estabelecimento/gi, '')
          .replace(/embalar\s+(para|pra)\s+levar/gi, '')
          .replace(/\bembalar\b/gi, '')
          .replace(/\bpara\s+levar\b/gi, '')
          .replace(/\bpra\s+levar\b/gi, '')
          .replace(/Forma\s+de\s+consumo[\/:]?\s*embalagem[:\s]*/gi, '')
          .replace(/Forma\s+de\s+embalagem[:\s]*/gi, '')
          .replace(/Forma\s+de\s+consumo[:\s]*/gi, '')
          .replace(/consumo[\/:]?\s*embalagem[:\s]*/gi, '')
          .replace(/^\s*comer\s+no\s+local\s*$/gmi, '')
          .replace(/^\s*embalar\s+(para|pra)\s+levar\s*$/gmi, '')
          .replace(/^\s*Forma\s+de\s+consumo[\/:]?\s*embalagem[:\s]*\s*$/gmi, '')
          .replace(/^\s*Forma\s+de\s+embalagem[:\s]*\s*$/gmi, '')
          .replace(/\n\s*\n+/g, '\n')
          .replace(/^\s+|\s+$/gm, '')
          .trim();
        
        const hasRealContent = rawInstructions && 
                              rawInstructions.length > 3 && 
                              !rawInstructions.match(/^(Telefone|Tel|Fone|Phone)[:\s]*$/i) &&
                              rawInstructions.replace(/\s/g, '').length > 0;
        
        if (hasRealContent) {
          generalInstructions = removeDuplicateReceiptInfo(rawInstructions) || undefined;
        } else {
          generalInstructions = undefined;
        }
      } else {
        let cleanedText = textWithoutServiceType
          .replace(/\(?\d{2}\)?\s*\d{4,5}[-\s]?\d{4}/g, '')
          .replace(/\b\d{10,11}\b/g, '')
          .replace(/(Tel|Telefone|Fone|Phone)[:\s]*\(?\d{2}\)?\s*\d{4,5}[-\s]?\d{4}/gi, '')
          .replace(/(Tel|Telefone|Fone|Phone)[:\s]*\d{10,11}/gi, '')
          .replace(/^(Telefone|Tel|Fone|Phone)[:\s]*$/gmi, '')
          .replace(/\n(Telefone|Tel|Fone|Phone)[:\s]*$/gmi, '')
          .replace(/\n(Telefone|Tel|Fone|Phone)[:\s]*\n/gmi, '\n')
          .replace(/\[[^\]]+\]/g, '')
          .replace(/^Pedido\s+Na\s+Brasa[:\s]*/gmi, '')
          .replace(/Subtotal[:\s]*R\$\s*[\d.,\s]+/gi, '')
          .replace(/Taxa\s+de\s+entrega[:\s]*R\$\s*[\d.,\s]+/gi, '')
          .replace(/Total[:\s]*R\$\s*[\d.,\s]+/gi, '')
          .replace(/Forma\s+de\s+entrega[:\s]*[^\n]+/gi, '')
          .replace(/Cliente[:\s]*[^\n]+/gi, '')
          .replace(/Endereç[oa][:\s]*[^\n]+/gi, '')
          .replace(/Forma\s+de\s+pagamento[:\s]*[^\n]+/gi, '')
          .replace(/Resumo[:\s]*[\d\s]*x\s*(hamburgueres?|acompanhamentos?|bebidas?)[\s,]*[\d\s]*x\s*(hamburgueres?|acompanhamentos?|bebidas?)?[\s,]*[\d\s]*x\s*(hamburgueres?|acompanhamentos?|bebidas?)?/gi, '')
          .replace(/^\s*Resumo[:\s]*.*$/gmi, '')
          .replace(/comer\s+no\s+local/gi, '')
          .replace(/comer\s+no\s+estabelecimento/gi, '')
          .replace(/embalar\s+(para|pra)\s+levar/gi, '')
          .replace(/\bembalar\b/gi, '')
          .replace(/\bpara\s+levar\b/gi, '')
          .replace(/\bpra\s+levar\b/gi, '')
          .replace(/Forma\s+de\s+consumo[\/:]?\s*embalagem[:\s]*/gi, '')
          .replace(/Forma\s+de\s+embalagem[:\s]*/gi, '')
          .replace(/Forma\s+de\s+consumo[:\s]*/gi, '')
          .replace(/consumo[\/:]?\s*embalagem[:\s]*/gi, '')
          .replace(/^\s*comer\s+no\s+local\s*$/gmi, '')
          .replace(/^\s*embalar\s+(para|pra)\s+levar\s*$/gmi, '')
          .replace(/^\s*Forma\s+de\s+consumo[\/:]?\s*embalagem[:\s]*\s*$/gmi, '')
          .replace(/^\s*Forma\s+de\s+embalagem[:\s]*\s*$/gmi, '')
          .trim();
        
        cleanedText = cleanedText.replace(/\n\s*\n+/g, '\n').replace(/\s+/g, ' ').trim();
        
        const hasRealContent = cleanedText && 
                              cleanedText.length > 5 && 
                              !cleanedText.match(/^Trio\s*:/i) && 
                              !cleanedText.match(/^(comer|embalar|para\s+levar|pra\s+levar)/i) &&
                              !cleanedText.match(/^(Telefone|Tel|Fone|Phone)[:\s]*$/i) &&
                              cleanedText.replace(/\s/g, '').length > 0;
        
        if (hasRealContent) {
          generalInstructions = removeDuplicateReceiptInfo(cleanedText) || undefined;
        } else {
          generalInstructions = undefined;
        }
      }
    }

    // Mapear order_type para o tipo que aparece no cupom
    // TAKEOUT e DINE_IN devem aparecer como "pickup" (Retirar) no cupom
    let receiptOrderType = order.order_type || "delivery";
    if (receiptOrderType === 'takeout' || receiptOrderType === 'dine_in') {
      receiptOrderType = 'RETIRADA';
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
      orderType: receiptOrderType,
      generalInstructions: generalInstructions
    };

    await printReceipt(receiptData);
    toast.success("Pedido enviado para impressão");
  };

  const formatCPF = (value: string): string => {
    const digits = value.replace(/\D/g, '');
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
    if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
  };

  const handlePrintNonFiscalReceipt = async (order: Order) => {
    setOrderForNonFiscal(order);
    setCustomerPhoneNonFiscal(order.customer_phone ? phoneMask(order.customer_phone) : "");
    setCustomerCpf("");
    setShowNonFiscalModal(true);
  };

  const printNonFiscalReceiptWithData = async (order: Order, cpf?: string, phone?: string) => {
    if (!establishment) {
      toast.error("Erro ao carregar informações do estabelecimento");
      return;
    }

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

    if (!customerPhoneNonFiscal || !customerPhoneNonFiscal.trim()) {
      toast.error("Por favor, informe o telefone do cliente");
      return;
    }

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
      const isFromNaBrasaSite = order.source_domain?.toLowerCase().includes('hamburguerianabrasa') || false;
      
      if (isFromNaBrasaSite) {
        if (!hasOpenSession) {
          toast.error("Não é possível aceitar pedidos sem o caixa estar aberto. Por favor, abra o caixa primeiro.");
          return;
        }
      }
      
      const updateData: any = {
        accepted_and_printed_at: new Date().toISOString()
      };
      
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
      
      const isDelivery = order.order_type === 'delivery';
      const hasAddress = order.notes?.toLowerCase().includes('endereço:') || false;
      const hasDeliveryBoy = order.delivery_boy_id !== null && order.delivery_boy_id !== undefined;
      
      if (deliveryBoyId) {
        updateData.delivery_boy_id = deliveryBoyId;
      } else if (isFromNaBrasaSite && isDelivery && hasAddress && !hasDeliveryBoy && establishment) {
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
      
      const { data: updatedOrder, error } = await supabase
        .from("orders")
        .update(updateData)
        .eq("id", order.id)
        .select()
        .single();

      if (error) throw error;

      const orderToPrint = updatedOrder || order;
      
      if (establishment) {
        try {
          const { data: stockResult, error: stockError } = await supabase.rpc(
            'apply_stock_deduction_for_order',
            {
              p_establishment_id: establishment.id,
              p_order_id: order.id
            }
          );
        } catch (stockErr) {
          // Não bloquear a aceitação se houver erro no estoque
        }
      }
      
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
            <TabsList className={`grid w-full ${isNaBrasa ? 'grid-cols-6' : 'grid-cols-5'}`}>
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
              <TabsTrigger value="to_receive" className="flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                A RECEBER
                {orders.filter(o => o.is_credit_sale === true && !o.credit_received_at && o.payment_status !== 'cancelled').length > 0 && (
                  <Badge variant="destructive" className="ml-1">
                    {orders.filter(o => o.is_credit_sale === true && !o.credit_received_at && o.payment_status !== 'cancelled').length}
                  </Badge>
                )}
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
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="showDeliveries"
                          checked={showDeliveries}
                          onCheckedChange={(checked) => setShowDeliveries(checked === true)}
                        />
                        <Label htmlFor="showDeliveries" className="text-sm font-normal cursor-pointer">
                          Entregas
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
              
              {/* Contador de pedidos filtrados */}
              {filteredOrders.length > 0 && (
                <Card className="p-4">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <Package className="h-5 w-5 text-muted-foreground" />
                      <span className="text-sm font-semibold">
                        {filteredOrders.length} {filteredOrders.length === 1 ? 'item' : 'itens'}
                      </span>
                    </div>
                    {activeTab === "all" && (
                      <div className="flex flex-col items-end text-right text-sm">
                        <span className="font-medium text-muted-foreground">
                          Total dos pedidos filtrados
                        </span>
                        <span className="font-semibold">
                          {formatCurrencyBR(filteredOrdersTotal)}
                        </span>
                      </div>
                    )}
                    {(showPDV || showSite || showDeliveries || selectedDate || selectedPaymentMethod || searchTerm) && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                        <span className="font-medium">Filtros:</span>
                        {showPDV && <Badge variant="outline" className="text-xs">PDV</Badge>}
                        {showSite && <Badge variant="outline" className="text-xs">Site</Badge>}
                        {showDeliveries && <Badge variant="outline" className="text-xs">Entregas</Badge>}
                        {selectedDate && <Badge variant="outline" className="text-xs">Data</Badge>}
                        {selectedPaymentMethod && <Badge variant="outline" className="text-xs">Pagamento</Badge>}
                        {searchTerm && <Badge variant="outline" className="text-xs">Busca</Badge>}
                      </div>
                    )}
                  </div>
                </Card>
              )}
              
              {activeTab === "to_receive" && (
                <Card className="p-4">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold">Pedidos Fiado a Receber</h3>
                      <Badge variant="outline" className="text-sm">
                        {filteredOrders.length} {filteredOrders.length === 1 ? 'pedido' : 'pedidos'}
                      </Badge>
                    </div>
                    {filteredOrders.length === 0 ? (
                      <p className="text-muted-foreground text-center py-8">
                        Não há pedidos fiado pendentes de recebimento
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {filteredOrders.map((order) => {
                          const dueDate = order.credit_due_date ? new Date(order.credit_due_date) : null;
                          const today = new Date();
                          today.setHours(0, 0, 0, 0);
                          const dueDateOnly = dueDate ? new Date(dueDate) : null;
                          if (dueDateOnly) dueDateOnly.setHours(0, 0, 0, 0);
                          const daysOverdue = dueDateOnly ? Math.max(0, Math.floor((today.getTime() - dueDateOnly.getTime()) / (1000 * 60 * 60 * 24))) : 0;
                          const isOverdue = daysOverdue > 0;
                          
                          return (
                            <Card key={order.id} className={`p-4 ${isOverdue ? 'border-red-500 bg-red-50 dark:bg-red-950/20' : ''}`}>
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-2">
                                    <span className="font-semibold">Pedido {order.order_number}</span>
                                    {isOverdue && (
                                      <Badge variant="destructive">
                                        <AlertCircle className="h-3 w-3 mr-1" />
                                        {daysOverdue} {daysOverdue === 1 ? 'dia' : 'dias'} em atraso
                                      </Badge>
                                    )}
                                    {!isOverdue && dueDateOnly && dueDateOnly.getTime() === today.getTime() && (
                                      <Badge variant="outline" className="bg-yellow-100 dark:bg-yellow-900">
                                        <Calendar className="h-3 w-3 mr-1" />
                                        Vence hoje
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                    <div>
                                      <Label className="text-muted-foreground">Cliente</Label>
                                      <p className="font-medium">{order.customer_name || 'N/A'}</p>
                                    </div>
                                    <div>
                                      <Label className="text-muted-foreground">Vencimento</Label>
                                      <p className="font-medium flex items-center gap-1">
                                        <Calendar className="h-4 w-4" />
                                        {dueDate ? dueDate.toLocaleDateString('pt-BR') : 'N/A'}
                                      </p>
                                    </div>
                                    <div>
                                      <Label className="text-muted-foreground">Valor</Label>
                                      <p className="font-medium">{formatCurrencyBR(order.total_amount)}</p>
                                    </div>
                                    <div>
                                      <Label className="text-muted-foreground">Status</Label>
                                      <p className="font-medium text-yellow-600 dark:text-yellow-400">
                                        Aguardando Recebimento
                                      </p>
                                    </div>
                                  </div>
                                </div>
                                <div className="ml-4">
                                  <Button
                                    variant="outline"
                                    onClick={() => navigate(`/credit-sales`)}
                                    className="flex items-center gap-2"
                                  >
                                    <DollarSign className="h-4 w-4" />
                                    Receber
                                  </Button>
                                </div>
                              </div>
                            </Card>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </Card>
              )}

              {filteredOrders.length === 0 && activeTab !== "to_receive" ? (
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
                      : activeTab === "to_receive"
                      ? "Não há pedidos fiado a receber"
                      : "Não há pedidos do PDV ou concluídos"
                    }
                  </p>
                </Card>
              ) : activeTab !== "to_receive" ? (
                <>
                {filteredOrders.map((order) => {
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
                              {order.is_credit_sale && (
                                <Badge variant="outline" className="text-xs bg-yellow-50 dark:bg-yellow-950/20 border-yellow-500 text-yellow-700 dark:text-yellow-300">
                                  <CreditCard className="h-3 w-3 mr-1" />
                                  FIADO
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
                          <div className="flex items-center gap-2">
                            <TooltipProvider>
                              {/* Botões principais - ações mais importantes visíveis */}
                              
                              {/* Para pedidos do site Na Brasa: Botão principal "Alterar Pagamento" */}
                              {isFromNaBrasaSite && (
                                <Button 
                                  variant="default" 
                                  size="sm"
                                  onClick={() => {
                                    setSelectedOrder(order);
                                    setEditPaymentMethod(order.payment_method || "");
                                    setIsEditDialogOpen(true);
                                  }}
                                  className="h-9 px-4 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white shadow-md hover:shadow-lg transition-all"
                                >
                                  <CreditCard className="h-4 w-4 mr-2" />
                                  Alterar Pagamento
                                </Button>
                              )}

                              {/* Botão "Confirmar Pagamento" - aparece para TODOS os pedidos com pagamento pendente */}
                              {order.payment_status === "pending" && (
                                <Button 
                                  variant="default"
                                  size="sm"
                                  onClick={() => handleMarkPaymentAsPaid(order.id)}
                                  className="h-9 px-4 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white shadow-md hover:shadow-lg transition-all"
                                >
                                  <CheckCircleIcon className="h-4 w-4 mr-2" />
                                  Confirmar Pagamento
                                </Button>
                              )}

                              {/* Botão "Pronto Retirada/Entrega" - aparece quando aplicável */}
                              {((order.status === "pending" || order.status === "preparing") && 
                                (isPDVOrderCheck || order.accepted_and_printed_at || 
                                 (activeTab === "totem" && order.status === "pending" && isFromTotem))) && (
                                <Button 
                                  variant="default"
                                  size="sm"
                                  onClick={() => {
                                    if (order.status === "preparing" || (activeTab === "totem" && order.status === "pending")) {
                                      handleMarkAsReady(order.id);
                                    } else {
                                      handleMarkDeliveryAsCompleted(order.id);
                                    }
                                  }}
                                  className="h-9 px-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-md hover:shadow-lg transition-all"
                                >
                                  <Truck className="h-4 w-4 mr-2" />
                                  Pronto
                                </Button>
                              )}

                              {/* Botão "Recusar" para pedidos online pendentes */}
                              {isPendingOnline && order.status === "pending" && !order.accepted_and_printed_at && (
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button 
                                      variant="destructive" 
                                      size="sm"
                                      onClick={() => {
                                        setOrderToReject(order.id);
                                        setRejectionReason("");
                                      }}
                                      className="h-9 px-4 shadow-md hover:shadow-lg transition-all"
                                    >
                                      <XCircle className="h-4 w-4 mr-2" />
                                      Recusar
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
                              )}

                              {/* Menu dropdown "Mais ações" */}
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button 
                                    variant="outline" 
                                    size="icon"
                                    className="h-9 w-9 border-2 hover:bg-accent"
                                  >
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-56">
                                  <DropdownMenuLabel>Ações do Pedido</DropdownMenuLabel>
                                  <DropdownMenuSeparator />
                                  
                                  {/* Editar no PDV - apenas para pedidos que não são do site Na Brasa */}
                                  {!isFromNaBrasaSite && (
                                    <DropdownMenuItem onClick={() => navigate(`/pdv?editOrder=${order.id}`)}>
                                      <SquarePen className="h-4 w-4 mr-2" />
                                      Editar no PDV
                                    </DropdownMenuItem>
                                  )}

                                  {/* Editar Pedido */}
                                  <DropdownMenuItem onSelect={(e) => {
                                    e.preventDefault();
                                    setSelectedOrder(order);
                                    setEditPaymentMethod(order.payment_method || "");
                                    setIsEditDialogOpen(true);
                                  }}>
                                    <Edit className="h-4 w-4 mr-2" />
                                    Editar Pedido
                                  </DropdownMenuItem>

                                  {/* Confirmar Pagamento - no dropdown também para garantir acesso */}
                                  {order.payment_status === "pending" && (
                                    <DropdownMenuItem onClick={() => handleMarkPaymentAsPaid(order.id)}>
                                      <CheckCircleIcon className="h-4 w-4 mr-2" />
                                      Confirmar Pagamento
                                    </DropdownMenuItem>
                                  )}

                                  {/* Ver Detalhes */}
                                  <Dialog 
                                    open={isViewDetailsDialogOpen && selectedOrder?.id === order.id}
                                    onOpenChange={(open) => {
                                      setIsViewDetailsDialogOpen(open);
                                      if (open) {
                                        setSelectedOrder(order);
                                      } else {
                                        setSelectedOrder(null);
                                        // Prevenir scroll ao fechar o dialog
                                        setTimeout(() => {
                                          window.scrollTo({ top: 0, behavior: 'instant' });
                                        }, 0);
                                      }
                                    }}
                                  >
                                    <DialogTrigger asChild>
                                      <DropdownMenuItem onSelect={(e) => {
                                        e.preventDefault();
                                        setSelectedOrder(order);
                                        setIsViewDetailsDialogOpen(true);
                                      }}>
                                        <Eye className="h-4 w-4 mr-2" />
                                        Ver Detalhes
                                      </DropdownMenuItem>
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

                                  <DropdownMenuSeparator />

                                  {/* Imprimir/Reimprimir */}
                                  {(activeTab === "all" || activeTab === "totem" || isFromTotem) && (
                                    <DropdownMenuItem onClick={() => handlePrintOrder(order)}>
                                      <Printer className="h-4 w-4 mr-2" />
                                      {activeTab === "all" ? "Reimprimir Pedido" : "Imprimir Pedido"}
                                    </DropdownMenuItem>
                                  )}

                                  {/* Enviar PIX por WhatsApp */}
                                  {shouldShowWhatsButton(order) && establishment && (establishment.pix_key_value || establishment.pix_key) && (
                                    <DropdownMenuItem asChild>
                                      <a
                                        href={buildWhatsLink(order, establishment)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center"
                                      >
                                        <MessageCircle className="h-4 w-4 mr-2" />
                                        Enviar PIX por WhatsApp
                                      </a>
                                    </DropdownMenuItem>
                                  )}

                                  <DropdownMenuSeparator />

                                  {/* Excluir Pedido */}
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <DropdownMenuItem 
                                        onSelect={(e) => e.preventDefault()}
                                        className="text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950/20"
                                      >
                                        <Trash2 className="h-4 w-4 mr-2" />
                                        Excluir Pedido
                                      </DropdownMenuItem>
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
                                </DropdownMenuContent>
                              </DropdownMenu>
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
                  })}
                </>
              ) : null}

              {/* Diálogo de Edição - Compartilhado para todos os pedidos */}
              <Dialog 
                open={isEditDialogOpen && !!selectedOrder} 
                onOpenChange={(open) => {
                  setIsEditDialogOpen(open);
                  if (!open) {
                    setSelectedOrder(null);
                    setEditPaymentMethod("");
                    // Prevenir scroll ao fechar o dialog
                    setTimeout(() => {
                      window.scrollTo({ top: 0, behavior: 'instant' });
                    }, 0);
                  }
                }}
              >
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Editar Pedido #{selectedOrder?.order_number}</DialogTitle>
                    {selectedOrder?.source_domain?.toLowerCase().includes('hamburguerianabrasa') && (
                      <p className="text-sm text-muted-foreground mt-2">
                        Ao alterar o método de pagamento, o recibo será impresso automaticamente.
                      </p>
                    )}
                  </DialogHeader>
                  {selectedOrder && (
                    <form onSubmit={handleUpdateOrder} className="space-y-4">
                      <div>
                        <Label htmlFor="edit_customer_name">Nome do Cliente</Label>
                        <Input
                          id="edit_customer_name"
                          name="customer_name"
                          defaultValue={selectedOrder.customer_name || ""}
                        />
                      </div>
                      <div>
                        <Label htmlFor="edit_customer_phone">Telefone</Label>
                        <Input
                          id="edit_customer_phone"
                          name="customer_phone"
                          defaultValue={selectedOrder.customer_phone || ""}
                        />
                      </div>
                      <div>
                        <Label htmlFor="edit_status">Status</Label>
                        <select
                          id="edit_status"
                          name="status"
                          defaultValue={selectedOrder.status || ""}
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
                        <Label htmlFor="edit_payment_status">Status do Pagamento</Label>
                        <select
                          id="edit_payment_status"
                          name="payment_status"
                          defaultValue={selectedOrder.payment_status || ""}
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <option value="pending">Pendente</option>
                          <option value="paid">Pago</option>
                        </select>
                      </div>
                      <div>
                        <Label htmlFor="edit_payment_method">Método de Pagamento</Label>
                        <Select
                          value={editPaymentMethod || selectedOrder.payment_method || ""}
                          onValueChange={setEditPaymentMethod}
                        >
                          <SelectTrigger id="edit_payment_method">
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
                        <Label htmlFor="edit_table_number">Mesa</Label>
                        <Input
                          id="edit_table_number"
                          name="table_number"
                          defaultValue={selectedOrder.table_number || ""}
                        />
                      </div>
                      <div>
                        <Label htmlFor="edit_notes">Observações</Label>
                        <Textarea
                          id="edit_notes"
                          name="notes"
                          defaultValue={selectedOrder.notes || ""}
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
                  )}
                </DialogContent>
              </Dialog>
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