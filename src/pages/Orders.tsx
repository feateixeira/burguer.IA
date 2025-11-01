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
  import { useSidebarWidth } from "@/hooks/useSidebarWidth";
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
    const sidebarWidth = useSidebarWidth();
    const [isDesktop, setIsDesktop] = useState(false);

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
             console.log('🆕 Novo pedido detectado via Realtime:', payload.new);
             loadOrders({ background: true });
           })
           .on('postgres_changes', { 
             event: '*', 
             schema: 'public', 
             table: 'orders', 
             filter: `establishment_id=eq.${establishment.id}` 
           }, () => {
             // Para updates/deletes, também atualizar
             loadOrders({ background: true });
           })
           .on('postgres_changes', { 
             event: '*', 
             schema: 'public', 
             table: 'order_items' 
           }, () => {
             // Quando itens são alterados, atualizar também
             loadOrders({ background: true });
           })
           .subscribe();

         // Escuta eventos customizados para atualização quando notificação chegar
         const handleNewOrderNotification = () => {
           console.log('📢 Notificação de novo pedido recebida, recarregando lista...');
           loadOrders({ background: true });
         };
         
         window.addEventListener('new-order-notification', handleNewOrderNotification);

         return () => {
           supabase.removeChannel(channel);
           window.removeEventListener('new-order-notification', handleNewOrderNotification);
         };
       }
     }, [establishment]);

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
        
        while ((match = bracketRegex.exec(text)) !== null) {
          const itemText = match[1].trim(); // Texto dentro dos colchetes
          
          if (!itemText) continue;
          
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
          
          if (firstNotesIndex !== -1) {
            // Separa nome (antes da primeira observação) e observações (resto)
            name = remainingText.substring(0, firstNotesIndex).trim();
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
            // Remove hífens extras e espaços
            name = remainingText.replace(/\s*-\s*$/, '').trim();
          }
          
          // Valida o nome
          if (!name || name.length < 2) continue;
          
          // Limpa e valida as notas - remove informações duplicadas
          if (notes) {
            notes = notes.replace(/^\*\s*/, '').replace(/\s*\*$/, '').trim();
            
            // Remove "Obs:" duplicado ou no início se já estiver presente
            // Ex: "Obs: Obs: Sem cebola" -> "Obs: Sem cebola"
            notes = notes.replace(/^(Obs:\s*)+/i, 'Obs: ');
            // Remove múltiplas ocorrências consecutivas de "Obs:"
            notes = notes.replace(/(Obs:\s*){2,}/gi, 'Obs: ');
            
            // CRÍTICO: Se começa com "Obs:" seguido imediatamente por outro marcador, remove o "Obs:"
            if (notes.match(/^Obs:\s+(Molhos?|Observação|Obs):\s*/i)) {
              notes = notes.replace(/^Obs:\s+/i, '').trim();
            }
            
            // Remove "Obs:" solto sem conteúdo após ou só com marcadores
            if (notes.match(/^Obs:\s*$/i) || notes.match(/^Obs:\s+(Molhos?|Observação|Obs):\s*$/i)) {
              notes = undefined;
            } else if (notes) {
              notes = removeDuplicateReceiptInfo(notes) || undefined;
              
              // Se após limpeza ficou apenas "Obs:" sem conteúdo, remove
              if (notes && notes.match(/^Obs:\s*$/i)) {
                notes = undefined;
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
        }
        
        if (parsed.length > 0) {
          items = parsed;
        } else {
          // Se não encontrou itens entre colchetes, tenta método antigo como fallback
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
        items = (order.order_items || []).map(item => ({
          name: item.products?.name || 'Item',
          quantity: item.quantity,
          unitPrice: item.unit_price,
          totalPrice: item.total_price,
          notes: item.notes ? removeDuplicateReceiptInfo(item.notes) || undefined : undefined
        }));
      }

      // PRIORIDADE 3: Se ainda não tem itens, buscar diretamente no banco
      if (items.length === 0) {
        try {
          const { data, error } = await supabase
            .from('order_items')
            .select('quantity, unit_price, total_price, notes, products(name)')
            .eq('order_id', order.id);
          if (!error && data && data.length > 0) {
            items = data.map((it: any) => {
              let notes = it.notes;
              if (notes) {
                notes = notes.trim();
                // Remove "Obs:" duplicado
                notes = notes.replace(/^(Obs:\s*)+/i, 'Obs: ');
                notes = notes.replace(/(Obs:\s*){2,}/gi, 'Obs: ');
                // Remove se estiver vazio após limpeza
                if (notes.match(/^Obs:\s*$/i)) {
                  notes = undefined;
                } else {
                  notes = removeDuplicateReceiptInfo(notes) || undefined;
                }
              }
              return {
                name: it.products?.name || 'Item',
                quantity: it.quantity,
                unitPrice: it.unit_price,
                totalPrice: it.total_price,
                notes
              };
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
        
        // Extrair instruções gerais do pedido (remove informações duplicadas)
        // Tenta encontrar "Instruções do Pedido:" seguido do texto
        const instructionsMatch = text.match(/Instruções\s+do\s+Pedido:\s*([\s\S]*?)(?:\n\n|$)/i);
        if (instructionsMatch && instructionsMatch[1]) {
          const rawInstructions = instructionsMatch[1].trim();
          generalInstructions = removeDuplicateReceiptInfo(rawInstructions) || undefined;
        } else {
          // Remove tudo que está entre colchetes [ ] (itens do pedido) antes de processar
          // Também remove linhas que começam com "Pedido Na Brasa:" ou similar
          let cleanedText = text
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
            .trim();
          
          // Limpa espaços e quebras de linha extras
          cleanedText = cleanedText.replace(/\n\s*\n+/g, '\n').replace(/\s+/g, ' ').trim();
          
          // Só usa se tiver conteúdo relevante (mais de 5 caracteres após limpeza)
          if (cleanedText && cleanedText.length > 5) {
            generalInstructions = removeDuplicateReceiptInfo(cleanedText) || undefined;
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

                            {/* Reimprimir button for ALL orders - site, totem, PDV */}
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => handlePrintOrder(order)}
                              title="Reimprimir pedido"
                            >
                              <Printer className="h-4 w-4 mr-2" />
                            </Button>

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