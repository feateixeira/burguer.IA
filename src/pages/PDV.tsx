import { useState, useEffect, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  Plus, 
  Minus, 
  ShoppingCart, 
  Receipt,
  Search,
  X,
  Truck,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import Sidebar from "@/components/Sidebar";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSidebarWidth } from "@/hooks/useSidebarWidth";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { printReceipt, ReceiptData } from "@/utils/receiptPrinter";
import { PixPaymentModal } from "@/components/PixPaymentModal";
import { CashRequiredModal } from "@/components/CashRequiredModal";
import { generatePixQrCode } from "@/utils/pixQrCode";
import { normalizePhoneBRToE164 } from "@/utils/phoneNormalizer";
import { AddonsModal } from "@/components/AddonsModal";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useNavigate, useSearchParams } from "react-router-dom";
import { checkFreeDeliveryPromotion, registerFreeDeliveryUsage } from "@/utils/freeDeliveryPromotion";

interface Product {
  id: string;
  name: string;
  price: number;
  description?: string;
  image_url?: string;
  category_id?: string;
}

interface CustomerWithGroups {
  id: string;
  name: string;
  phone?: string;
  address?: string;
  groups: {
    id: string;
    name: string;
    discount_percentage: number;
    discount_amount: number;
  }[];
}

interface Addon {
  id: string;
  name: string;
  description?: string;
  price: number;
  quantity: number;
}

interface CartItem extends Product {
  quantity: number;
  notes?: string;
  saucePrice?: number;
  originalPrice?: number; // preço antes da promoção
  promotionId?: string;
  promotionName?: string;
  addons?: Addon[]; // adicionais selecionados
}

const PDV = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [addonsCategoryId, setAddonsCategoryId] = useState<string | null>(null);
  const [combos, setCombos] = useState<any[]>([]);
  const [promotions, setPromotions] = useState<any[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [customers, setCustomers] = useState<CustomerWithGroups[]>([]);
  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerWithGroups | null>(null);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [establishmentSettings, setEstablishmentSettings] = useState<any>({});
  const [establishmentInfo, setEstablishmentInfo] = useState<{ name: string; address?: string; phone?: string; storeNumber?: string }>({ name: '' });
  const [establishmentId, setEstablishmentId] = useState<string | null>(null);
  const [includeDelivery, setIncludeDelivery] = useState(false);
  const [freeDeliveryPromotionId, setFreeDeliveryPromotionId] = useState<string | null>(null);
  const [deliveryBoys, setDeliveryBoys] = useState<any[]>([]);
  const [selectedDeliveryBoy, setSelectedDeliveryBoy] = useState<string>("");
  const [showSauceDialog, setShowSauceDialog] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [sauceNote, setSauceNote] = useState("");
  const [selectedSauces, setSelectedSauces] = useState<string[]>([]);
  const [pendingComboAsProduct, setPendingComboAsProduct] = useState<Product | null>(null);
  const [showDrinkDialog, setShowDrinkDialog] = useState(false);
  const [selectedDrink, setSelectedDrink] = useState<Product | null>(null);
  const [comboDrinkItem, setComboDrinkItem] = useState<any>(null); // item do combo que é bebida (combo_item com product_id)
  const [showAddonsModal, setShowAddonsModal] = useState(false);
  const [pendingProduct, setPendingProduct] = useState<Product | null>(null);
  const [pendingNotes, setPendingNotes] = useState<string | undefined>(undefined);
  const [pendingSaucePrice, setPendingSaucePrice] = useState<number | undefined>(undefined);
  const [isImporting, setIsImporting] = useState(false);
  const [whatsappDialogOpen, setWhatsappDialogOpen] = useState(false);
  const [whatsappOrderText, setWhatsappOrderText] = useState("");
  const [whatsappSelectedCustomer, setWhatsappSelectedCustomer] = useState<CustomerWithGroups | null>(null);
  const [whatsappCustomerSearch, setWhatsappCustomerSearch] = useState("");
  const [showWhatsappCustomerDropdown, setShowWhatsappCustomerDropdown] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("");
  const [combosOpen, setCombosOpen] = useState(false);
  const [showPixModal, setShowPixModal] = useState(false);
  const [pendingOrderId, setPendingOrderId] = useState<string>("");
  const [pendingOrderAmount, setPendingOrderAmount] = useState<number>(0);
  const [pendingReceiptData, setPendingReceiptData] = useState<ReceiptData | null>(null);
  const [showCashModal, setShowCashModal] = useState(false); // Modal de pagamento em dinheiro (troco)
  const [showCashRequiredModal, setShowCashRequiredModal] = useState(false); // Modal de caixa fechado
  const [cashGiven, setCashGiven] = useState<number>(0);
  const [cashChange, setCashChange] = useState<number>(0);
  const sidebarWidth = useSidebarWidth();
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const checkDesktop = () => setIsDesktop(window.innerWidth >= 1024);
    checkDesktop();
    window.addEventListener('resize', checkDesktop);
    return () => window.removeEventListener('resize', checkDesktop);
  }, []);
  const [generalInstructions, setGeneralInstructions] = useState<string>("");
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [editingOrderNumber, setEditingOrderNumber] = useState<string | null>(null);
  const [orderLoaded, setOrderLoaded] = useState(false);

  const sauceOptions = ["Mostarda e Mel", "Bacon", "Alho", "Ervas"];

  useEffect(() => {
    let isMounted = true;
    let hasLoaded = false;

    const initializeData = async () => {
      if (hasLoaded || !isMounted) return;
      hasLoaded = true;
      
      await Promise.all([
        loadProducts(),
        loadCustomers()
      ]);
    };

    initializeData();

    // F9 key listener for WhatsApp order modal
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === "F9") {
        e.preventDefault();
        setWhatsappDialogOpen(true);
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => {
      isMounted = false;
      window.removeEventListener("keydown", handleKeyPress);
    };
  }, []);

  // Detectar parâmetro editOrder na URL e carregar pedido
  useEffect(() => {
    const editOrderId = searchParams.get('editOrder');
    if (editOrderId && establishmentId && !loading && !orderLoaded && editOrderId !== editingOrderId) {
      setOrderLoaded(true);
      setEditingOrderId(editOrderId);
      loadOrderForEditing(editOrderId);
    } else if (!editOrderId && orderLoaded) {
      // Reset quando sair do modo de edição
      setOrderLoaded(false);
      setEditingOrderId(null);
      setEditingOrderNumber(null);
    }
  }, [searchParams, establishmentId, loading, orderLoaded, editingOrderId]);

  // Refs para acessar valores mais recentes sem causar re-renderizações
  const showSauceDialogRef = useRef(showSauceDialog);
  const showPixModalRef = useRef(showPixModal);
  const showCashModalRef = useRef(showCashModal);
  const selectedCustomerRef = useRef(selectedCustomer);
  const paymentMethodRef = useRef(paymentMethod);
  const searchTermRef = useRef(searchTerm);
  const productsRef = useRef(products);
  const categoriesRef = useRef(categories);

  // Atualizar refs quando valores mudam
  useEffect(() => {
    showSauceDialogRef.current = showSauceDialog;
    showPixModalRef.current = showPixModal;
    showCashModalRef.current = showCashModal;
    selectedCustomerRef.current = selectedCustomer;
    paymentMethodRef.current = paymentMethod;
    searchTermRef.current = searchTerm;
    productsRef.current = products;
    categoriesRef.current = categories;
  }, [showSauceDialog, showPixModal, showCashModal, selectedCustomer, paymentMethod, searchTerm, products, categories]);

  // Atalhos com Enter: Enter no campo de busca adiciona primeiro produto; Ctrl+Enter finaliza venda
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault();
        if (!showSauceDialogRef.current && !showPixModalRef.current && !showCashModalRef.current) {
          const total = selectedCustomerRef.current && selectedCustomerRef.current.groups.length > 0 ? 
            calculateDiscountedTotal() : calculateTotal();
          if (paymentMethodRef.current === 'dinheiro') {
            setCashGiven(Number(total));
            setCashChange(0);
            setShowCashModal(true);
          } else {
            handleCheckout();
          }
        }
        return;
      }

      const active = document.activeElement as HTMLElement | null;
      const isSearchFocused = active && active.id === 'pdv-product-search';
      if (e.key === 'Enter' && isSearchFocused) {
        e.preventDefault();
        const first = getFirstMatchingProduct();
        if (first) handleProductClick(first);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []); // Sem dependências - usa refs para valores atualizados

  // Real-time subscriptions para atualizar produtos, categorias, combos e promoções automaticamente
  useEffect(() => {
    if (!establishmentId) return;

    // Flags para evitar loops infinitos
    let isMounted = true;
    let reloadTimeouts: { [key: string]: NodeJS.Timeout | null } = {
      products: null,
      categories: null,
      combos: null,
      promotions: null,
    };

    // Função auxiliar para throttle - evita chamadas muito frequentes
    const throttleReload = (key: string, fn: () => Promise<void>, delay: number = 1000) => {
      if (reloadTimeouts[key]) {
        clearTimeout(reloadTimeouts[key]!);
      }
      reloadTimeouts[key] = setTimeout(async () => {
        if (isMounted) {
          await fn();
        }
      }, delay);
    };

    const reloadProducts = async () => {
      if (!isMounted) return;
      try {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("establishment_id", establishmentId)
        .eq("active", true)
        .order("name");
        if (!error && data && isMounted) {
          // Só atualiza se os dados realmente mudaram
          setProducts(prev => {
            const prevIds = new Set(prev.map(p => p.id));
            const newIds = new Set(data.map(p => p.id));
            if (prevIds.size !== newIds.size || 
                ![...prevIds].every(id => newIds.has(id)) ||
                ![...newIds].every(id => prevIds.has(id))) {
              return data;
            }
            // Verificar se algum produto mudou
            const hasChanges = data.some(newProd => {
              const oldProd = prev.find(p => p.id === newProd.id);
              return !oldProd || JSON.stringify(oldProd) !== JSON.stringify(newProd);
            });
            return hasChanges ? data : prev;
          });
        }
      } catch (error) {
        // Error reloading products
      }
    };

    const reloadCategories = async () => {
      if (!isMounted) return;
      try {
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .eq("establishment_id", establishmentId)
        .eq("active", true)
        .order("sort_order");
        if (!error && data && isMounted) {
          setCategories(prev => {
            if (JSON.stringify(prev) === JSON.stringify(data)) {
              return prev;
            }
            return data;
          });
          
          // Buscar ID da categoria "Adicionais" para filtrar
          const addonsCategory = data.find(cat => cat.name === "Adicionais");
          setAddonsCategoryId(addonsCategory?.id || null);
        }
      } catch (error) {
        // Error reloading categories
      }
    };

    const reloadCombos = async () => {
      if (!isMounted) return;
      try {
      const { data, error } = await supabase
        .from("combos")
        .select("*, combo_items(product_id, quantity)")
        .eq("establishment_id", establishmentId)
        .eq("active", true)
        .order("sort_order");
        if (!error && data && isMounted) {
          setCombos(prev => {
            if (JSON.stringify(prev) === JSON.stringify(data)) {
              return prev;
            }
            return data;
          });
        }
      } catch (error) {
        // Error reloading combos
      }
    };

    const reloadPromotions = async () => {
      if (!isMounted) return;
      try {
      const { data, error } = await supabase
        .from("promotions")
        .select("*, promotion_products(product_id, fixed_price)")
        .eq("establishment_id", establishmentId)
        .eq("active", true);
        if (!error && data && isMounted) {
          setPromotions(prev => {
            if (JSON.stringify(prev) === JSON.stringify(data)) {
              return prev;
            }
            return data;
          });
        }
      } catch (error) {
        // Error reloading promotions
      }
    };

    // Channel para produtos
    const productsChannel = supabase
      .channel(`pdv-products-updates-${establishmentId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'products',
          filter: `establishment_id=eq.${establishmentId}`
        },
        () => {
          throttleReload('products', reloadProducts, 1000);
        }
      )
      .subscribe();

    // Channel para categorias
    const categoriesChannel = supabase
      .channel(`pdv-categories-updates-${establishmentId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'categories',
          filter: `establishment_id=eq.${establishmentId}`
        },
        () => {
          throttleReload('categories', reloadCategories, 1000);
        }
      )
      .subscribe();

    // Channel para combos
    const combosChannel = supabase
      .channel(`pdv-combos-updates-${establishmentId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'combos',
          filter: `establishment_id=eq.${establishmentId}`
        },
        () => {
          throttleReload('combos', reloadCombos, 1000);
        }
      )
      .subscribe();

    // Channel para promoções
    const promotionsChannel = supabase
      .channel(`pdv-promotions-updates-${establishmentId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'promotions',
          filter: `establishment_id=eq.${establishmentId}`
        },
        () => {
          throttleReload('promotions', reloadPromotions, 1000);
        }
      )
      .subscribe();

    // Channel para promotion_products
    const promotionProductsChannel = supabase
      .channel(`pdv-promotion-products-updates-${establishmentId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'promotion_products'
        },
        () => {
          throttleReload('promotions', reloadPromotions, 1000);
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      // Limpar todos os timeouts
      Object.values(reloadTimeouts).forEach(timeout => {
        if (timeout) clearTimeout(timeout);
      });
      // Remover channels
      supabase.removeChannel(productsChannel);
      supabase.removeChannel(categoriesChannel);
      supabase.removeChannel(combosChannel);
      supabase.removeChannel(promotionsChannel);
      supabase.removeChannel(promotionProductsChannel);
    };
  }, [establishmentId]);

  const getFirstMatchingProduct = (): Product | null => {
    const term = (searchTerm || '').toLowerCase();
    const list = products.filter(p => p?.name?.toLowerCase().includes(term));
    return list.length > 0 ? list[0] : null;
  };

  const loadProducts = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("establishment_id")
        .eq("user_id", session.user.id)
        .single();

      if (!profile?.establishment_id) return;

      // Só atualiza establishmentId se for diferente (evita loops)
      setEstablishmentId(prev => {
        if (prev === profile.establishment_id) {
          return prev;
        }
        return profile.establishment_id;
      });

      const [productsResult, categoriesResult, establishmentResult, combosResult, promotionsResult] = await Promise.all([
        supabase
          .from("products")
          .select("*")
          .eq("establishment_id", profile.establishment_id)
          .eq("active", true)
          .order("name"),
        supabase
          .from("categories")
          .select("*")
          .eq("establishment_id", profile.establishment_id)
          .eq("active", true)
          .order("sort_order"),
        supabase
          .from("establishments")
          .select("name, address, phone, settings")
          .eq("id", profile.establishment_id)
          .single(),
        supabase
          .from("combos")
          .select("*, combo_items(product_id, quantity)")
          .eq("establishment_id", profile.establishment_id)
          .eq("active", true)
          .order("sort_order"),
        supabase
          .from("promotions")
          .select("*, promotion_products(product_id, fixed_price)")
          .eq("establishment_id", profile.establishment_id)
          .eq("active", true)
      ]);

      if (productsResult.error) throw productsResult.error;
      if (categoriesResult.error) throw categoriesResult.error;
      if (establishmentResult.error) throw establishmentResult.error;
      if (combosResult.error) throw combosResult.error;
      if (promotionsResult.error) throw promotionsResult.error;

      setProducts(productsResult.data || []);
      setCategories(categoriesResult.data || []);
      setCombos(combosResult.data || []);
      setPromotions(promotionsResult.data || []);
      setEstablishmentSettings(establishmentResult.data?.settings || {});
      const estSettings: any = establishmentResult.data?.settings || {};
      setEstablishmentInfo({
        name: establishmentResult.data?.name || '',
        address: establishmentResult.data?.address || '',
        phone: establishmentResult.data?.phone || '',
        storeNumber: (estSettings?.store_number || estSettings?.numero || '').toString() || undefined,
      });
      const settings = establishmentResult.data?.settings as any;
      setDeliveryFee(settings?.delivery_fee || 0);
    } catch (error) {
      toast.error("Erro ao carregar produtos");
    } finally {
      setLoading(false);
    }
  };

  const loadDeliveryBoys = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("establishment_id")
        .eq("user_id", session.user.id)
        .single();

      if (!profile?.establishment_id) return;

      const { data, error } = await supabase
        .from("delivery_boys")
        .select("*")
        .eq("establishment_id", profile.establishment_id)
        .eq("active", true)
        .order("name");

      if (error) throw error;
      setDeliveryBoys(data || []);
    } catch (error) {
      // Error loading delivery boys
    }
  };

  const loadCustomers = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("establishment_id")
        .eq("user_id", session.user.id)
        .single();

      if (!profile?.establishment_id) return;

      // Load customers with their groups
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

      // Format customers with their groups
      const formattedCustomers: CustomerWithGroups[] = customersData?.map(customer => ({
        ...customer,
        groups: customer.customer_group_members?.map((member: any) => member.customer_groups).filter(Boolean) || []
      })) || [];

      setCustomers(formattedCustomers);
    } catch (error) {
      // Error loading customers
    }
  };

  const loadOrderForEditing = async (orderId: string) => {
    try {
      setLoading(true);
      
      // Carregar pedido completo com itens
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .select(`
          *,
          order_items (
            *,
            products (
              id,
              name,
              price,
              description,
              image_url,
              category_id
            )
          )
        `)
        .eq("id", orderId)
        .single();

      if (orderError || !order) {
        toast.error("Erro ao carregar pedido para edição");
        return;
      }

      // Verificar se o pedido pertence ao estabelecimento correto
      if (order.establishment_id !== establishmentId) {
        toast.error("Pedido não pertence a este estabelecimento");
        return;
      }

      // Salvar ID e número do pedido
      setEditingOrderId(order.id);
      setEditingOrderNumber(order.order_number);

      // Preencher dados do cliente
      setCustomerName(order.customer_name || "");
      setCustomerPhone(order.customer_phone || "");
      setCustomerSearch(order.customer_name || "");
      
      // Buscar cliente se houver telefone
      if (order.customer_phone) {
        const matchingCustomer = customers.find(c => 
          c.phone === order.customer_phone || c.name === order.customer_name
        );
        if (matchingCustomer) {
          setSelectedCustomer(matchingCustomer);
        }
      }

      // Preencher forma de pagamento
      setPaymentMethod(order.payment_method || "");

      // Preencher entrega
      const isDelivery = order.order_type === "delivery";
      setIncludeDelivery(isDelivery);
      if (isDelivery && order.delivery_boy_id) {
        setSelectedDeliveryBoy(order.delivery_boy_id);
        loadDeliveryBoys();
      }

      // Preencher instruções gerais
      if (order.notes && order.notes.includes("Instruções do Pedido:")) {
        const instructions = order.notes.replace("Instruções do Pedido:", "").trim();
        setGeneralInstructions(instructions);
      }

      // Popular carrinho com itens do pedido
      const cartItems: CartItem[] = [];
      
      for (const item of order.order_items || []) {
        const product = item.products;
        if (!product) continue;

        // Extrair adicionais do campo customizations
        let addons: Addon[] = [];
        if (item.customizations && typeof item.customizations === 'object') {
          const customizations = item.customizations as any;
          if (customizations.addons && Array.isArray(customizations.addons)) {
            addons = customizations.addons.map((addon: any) => ({
              id: addon.id,
              name: addon.name,
              price: addon.price || 0,
              quantity: addon.quantity || 1,
              description: undefined
            }));
          }
        }

        // Extrair informações de molhos e promoção das notes
        let notes = item.notes || "";
        let saucePrice = 0;
        let originalPrice: number | undefined = undefined;
        let promotionId: string | undefined = undefined;
        let promotionName: string | undefined = undefined;

        // Tentar extrair preço original e promoção das notes
        if (notes.includes("Promoção:")) {
          const promoMatch = notes.match(/Promoção:\s*([^(]+)(?:\(de R\$\s*([\d,\.]+)\s*por R\$\s*([\d,\.]+)\))?/);
          if (promoMatch) {
            promotionName = promoMatch[1].trim();
            if (promoMatch[2] && promoMatch[3]) {
              originalPrice = parseFloat(promoMatch[2].replace(',', '.'));
              // O preço atual já está no unit_price
            }
          }
        }

        // Calcular preço unitário base (sem adicionais e molhos)
        // O unit_price já inclui tudo, então precisamos calcular o preço base
        const addonsPrice = addons.reduce((sum, addon) => sum + (addon.price * addon.quantity), 0);
        const basePrice = item.unit_price - addonsPrice;
        
        // Tentar extrair preço de molhos (se houver nas notes)
        if (notes.includes("molhos") || notes.includes("Molhos:")) {
          const sauceMatch = notes.match(/\+ R\$\s*([\d,\.]+)\s*\(molhos\)/);
          if (sauceMatch) {
            saucePrice = parseFloat(sauceMatch[1].replace(',', '.'));
          }
        }

        const finalPrice = basePrice - saucePrice;

        const cartItem: CartItem = {
          id: product.id,
          name: product.name,
          price: finalPrice,
          description: product.description,
          image_url: product.image_url,
          category_id: product.category_id,
          quantity: item.quantity,
          notes: notes,
          saucePrice: saucePrice > 0 ? saucePrice : undefined,
          originalPrice: originalPrice,
          promotionId: promotionId,
          promotionName: promotionName,
          addons: addons.length > 0 ? addons : undefined
        };

        cartItems.push(cartItem);
      }

      setCart(cartItems);
      toast.success(`Pedido #${order.order_number} carregado para edição`);
    } catch (error) {
      toast.error("Erro ao carregar pedido para edição");
    } finally {
      setLoading(false);
    }
  };

  const getFilteredCustomers = () => {
    if (!customerSearch.trim()) return [];
    return customers.filter(customer =>
      customer.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
      (customer.phone && customer.phone.includes(customerSearch))
    ).slice(0, 5);
  };

  const selectCustomer = (customer: CustomerWithGroups) => {
    setSelectedCustomer(customer);
    setCustomerName(customer.name);
    setCustomerPhone(customer.phone || "");
    setCustomerSearch(customer.name);
    setShowCustomerDropdown(false);
  };

  const getCustomerDiscount = () => {
    if (!selectedCustomer || selectedCustomer.groups.length === 0) return { percentage: 0, amount: 0 };
    
    // Apply the best discount available from customer groups
    let bestPercentage = 0;
    let bestAmount = 0;
    
    selectedCustomer.groups.forEach(group => {
      if (group.discount_percentage > bestPercentage) {
        bestPercentage = group.discount_percentage;
      }
      if (group.discount_amount > bestAmount) {
        bestAmount = group.discount_amount;
      }
    });
    
    return { percentage: bestPercentage, amount: bestAmount };
  };

  const calculateDiscountedTotal = () => {
    const subtotal = calculateSubtotal();
    // Se for entrega e houver promoção de frete grátis ativa, não cobrar frete
    const deliveryCost = (includeDelivery && !freeDeliveryPromotionId) ? deliveryFee : 0;
    const discount = getCustomerDiscount();
    
    let discountValue = 0;
    if (discount.percentage > 0) {
      discountValue = subtotal * (discount.percentage / 100);
    }
    if (discount.amount > 0) {
      discountValue = Math.max(discountValue, discount.amount);
    }
    
    return Math.max(0, subtotal - discountValue + deliveryCost);
  };

  const isHamburger = (product: Product | null) => {
    if (!product) return false;
    const hamburgerCategory = categories.find(cat => 
      cat.name?.toLowerCase().includes('hambúrguer') || 
      cat.name?.toLowerCase().includes('hamburger')
    );
    return product.category_id === hamburgerCategory?.id || 
           product.name.toLowerCase().includes('hambúrguer') ||
           product.name.toLowerCase().includes('hamburger');
  };

  const isTriplo = (product: Product | null) => {
    if (!product) return false;
    const productNameLower = product.name.toLowerCase().trim();
    
    // Verificar se contém "triplo" (lógica padrão)
    if (productNameLower.includes('triplo')) return true;
    
    // Verificar se é o estabelecimento "Na Brasa" e o produto é "Na Brasa Eno - Mostro"
    const establishmentNameLower = (establishmentInfo.name || '').toLowerCase().trim();
    const isNaBrasa = establishmentNameLower.includes('na brasa') || 
                      establishmentNameLower.includes('nabrasa') ||
                      establishmentNameLower.includes('hamburgueria na brasa') ||
                      establishmentNameLower === 'na brasa';
    
    if (isNaBrasa) {
      // Verificar variações do nome: "Na Brasa Eno - Mostro", "Na Brasa Eno - Monstro", "ENO Mostro", etc.
      // Verificar se contém "eno" e "mostro" ou "monstro" (pode estar em qualquer ordem ou formato)
      // Normalizar removendo acentos e caracteres especiais para comparação
      const normalizedName = productNameLower
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\w\s]/g, ' ')
        .replace(/\s+/g, ' ');
      
      const hasEno = normalizedName.includes('eno');
      // Aceitar tanto "mostro" quanto "monstro" (com ou sem "o" no final)
      const hasMostro = normalizedName.includes('mostro') || normalizedName.includes('monstro');
      
      if (hasEno && hasMostro) {
        return true;
      }
    }
    
    return false;
  };

  const isDrink = (product: Product | null) => {
    if (!product) return false;
    const drinkCategory = categories.find(cat => 
      cat.name?.toLowerCase().includes('bebida') || 
      cat.name?.toLowerCase().includes('refri') ||
      cat.name?.toLowerCase().includes('drink')
    );
    if (drinkCategory && product.category_id === drinkCategory.id) {
      return true;
    }
    // Verificar também por nome comum de bebidas
    const drinkNames = ['refri', 'refrigerante', 'coca', 'guarana', 'pepsi', 'bebida', 'lata', 'latinha'];
    return drinkNames.some(name => product.name.toLowerCase().includes(name));
  };

  // Filtro específico para bebidas do combo: apenas refrigerantes LATA, sucos e cremes
  const isComboDrink = (product: Product | null) => {
    if (!product || !isDrink(product)) return false;
    
    const nameLower = product.name.toLowerCase();
    
    // Excluir bebidas que não devem aparecer no combo
    const excludedKeywords = [
      'dell vale',
      '2 litros',
      '2l',
      '600ml',
      '600 ml',
      'pet'
    ];
    
    if (excludedKeywords.some(keyword => nameLower.includes(keyword))) {
      return false;
    }
    
    // Incluir apenas: refrigerantes lata, sucos e cremes
    const includedKeywords = [
      'lata',
      'latinha',
      '350ml',
      '350 ml',
      'suco',
      'creme',
      'vitamina',
      'milk shake',
      'milkshake'
    ];
    
    return includedKeywords.some(keyword => nameLower.includes(keyword));
  };

  const checkProductHasAddons = async (product: Product): Promise<boolean> => {
    if (!establishmentId || !product.id) return false;
    
    try {
      const promises: Promise<any>[] = [];

      // Verificar se há adicionais associados à categoria do produto
      if (product.category_id) {
        const categoryQuery = supabase
          .from("category_addons")
          .select("addon_id, addons!inner(id, active)")
          .eq("category_id", product.category_id)
          .eq("addons.active", true)
          .limit(1);
        promises.push(categoryQuery);
      }

      // Verificar se há adicionais associados diretamente ao produto
      const productQuery = supabase
        .from("product_addons")
        .select("addon_id, addons!inner(id, active)")
        .eq("product_id", product.id)
        .eq("addons.active", true)
        .limit(1);
      promises.push(productQuery);

      const results = await Promise.all(promises);

      // Verificar se algum resultado tem dados
      for (const result of results) {
        if (result.data && result.data.length > 0) {
          return true;
        }
      }

      return false;
    } catch (error) {
      return false;
    }
  };

  const handleProductClick = async (product: Product) => {
    const productWithPromotion = applyPromotionIfAny(product);
    
    if (isHamburger(product)) {
      // Para hambúrgueres, primeiro verificar adicionais, depois molhos
      const hasAddons = await checkProductHasAddons(product);
      if (hasAddons) {
        setPendingProduct(productWithPromotion);
        setPendingNotes(undefined);
        setPendingSaucePrice(undefined);
        setShowAddonsModal(true);
      } else {
        setSelectedProduct(product);
        setSauceNote("");
        setSelectedSauces([]);
        setShowSauceDialog(true);
      }
    } else {
      // Para outros produtos, verificar se tem adicionais
      const hasAddons = await checkProductHasAddons(product);
      if (hasAddons) {
        setPendingProduct(productWithPromotion);
        setPendingNotes(undefined);
        setPendingSaucePrice(undefined);
        setShowAddonsModal(true);
      } else {
        addToCart(productWithPromotion);
      }
    }
  };

  const handleAddonsConfirm = (selectedAddons: Addon[]) => {
    if (!pendingProduct) return;

    // Se for hambúrguer, abrir diálogo de molhos depois dos adicionais
    if (isHamburger(pendingProduct)) {
      // Salvar adicionais no produto selecionado para usar depois do molho
      setSelectedProduct({ ...pendingProduct, addons: selectedAddons } as any);
      setSauceNote("");
      setSelectedSauces([]);
      setShowSauceDialog(true);
      setPendingProduct(null);
    } else {
      // Para produtos que não são hambúrgueres, adicionar diretamente ao carrinho
      addToCart(pendingProduct, pendingNotes, pendingSaucePrice, selectedAddons);
      setPendingProduct(null);
      setPendingNotes(undefined);
      setPendingSaucePrice(undefined);
    }
    setShowAddonsModal(false);
  };

  const addToCart = (
    product: Product | (Product & { originalPrice?: number; promotionId?: string; promotionName?: string }), 
    notes?: string, 
    saucePrice?: number,
    addons?: Addon[]
  ) => {
    // Criar uma chave única para o item do carrinho baseada em id, notes e adicionais
    const addonsKey = addons && addons.length > 0 
      ? addons.map(a => `${a.id}-${a.quantity}`).sort().join(',')
      : '';
    const itemKey = `${product.id}-${notes || ''}-${addonsKey}`;

    setCart(prevCart => {
      const existingItem = prevCart.find(item => {
        const itemAddonsKey = item.addons && item.addons.length > 0
          ? item.addons.map(a => `${a.id}-${a.quantity}`).sort().join(',')
          : '';
        const existingKey = `${item.id}-${item.notes || ''}-${itemAddonsKey}`;
        return existingKey === itemKey;
      });

      if (existingItem) {
        return prevCart.map(item => {
          const itemAddonsKey = item.addons && item.addons.length > 0
            ? item.addons.map(a => `${a.id}-${a.quantity}`).sort().join(',')
            : '';
          const existingKey = `${item.id}-${item.notes || ''}-${itemAddonsKey}`;
          return existingKey === itemKey
            ? { ...item, quantity: item.quantity + 1 }
            : item;
        });
      }
      return [...prevCart, { ...product, quantity: 1, notes, saucePrice, addons } as CartItem];
    });
  };

  const addComboToCart = (combo: any) => {
    if (!combo?.combo_items) return;
    
    // Add combo as a single product with combo price
    const comboAsProduct: Product = {
      id: combo.id,
      name: combo.name,
      price: combo.price,
      description: combo.description || `Combo: ${combo.combo_items.map((ci: any) => {
        const prod = products.find(p => p.id === ci.product_id);
        return prod ? `${ci.quantity}x ${prod.name}` : '';
      }).filter(Boolean).join(', ')}`,
      image_url: combo.image_url,
    };

    // Verifica se o combo possui um hambúrguer entre seus itens
    const burgerInCombo: Product | undefined = combo.combo_items
      .map((ci: any) => products.find(p => p.id === ci.product_id))
      .find((p: Product | undefined) => !!p && isHamburger(p));

    // Verifica se o combo possui uma bebida entre seus itens
    const drinkComboItem = combo.combo_items
      .find((ci: any) => {
        const prod = products.find(p => p.id === ci.product_id);
        return prod && isDrink(prod);
      });

    if (burgerInCombo && drinkComboItem) {
      // Se tem hambúrguer E bebida: primeiro escolher bebida, depois molho
      setComboDrinkItem(drinkComboItem);
      setPendingComboAsProduct(comboAsProduct);
      setShowDrinkDialog(true);
    } else if (burgerInCombo) {
      // Se tem apenas hambúrguer: abrir diálogo de molhos
      setSelectedProduct(burgerInCombo);
      setSauceNote("");
      setSelectedSauces([]);
      setPendingComboAsProduct(comboAsProduct);
      setShowSauceDialog(true);
    } else if (drinkComboItem) {
      // Se tem apenas bebida: abrir diálogo de seleção de bebida
      setComboDrinkItem(drinkComboItem);
      setPendingComboAsProduct(comboAsProduct);
      setShowDrinkDialog(true);
    } else {
      // Se não tem nem hambúrguer nem bebida: adicionar direto
      addToCart(applyPromotionIfAny(comboAsProduct), `Combo`);
      toast.success(`Combo "${combo.name}" adicionado ao carrinho`);
    }
  };

  const calculateSaucePrice = (product: Product, selectedSauces: string[]) => {
    const isTriploProduct = isTriplo(product);
    const freeSauces = isTriploProduct ? 2 : 1;
    const extraSauces = Math.max(0, selectedSauces.length - freeSauces);
    return extraSauces * 2;
  };

  const handleSauceToggle = (sauce: string, checked: boolean) => {
    if (checked) {
      setSelectedSauces(prev => [...prev, sauce]);
    } else {
      setSelectedSauces(prev => prev.filter(s => s !== sauce));
    }
  };

  const handleDrinkConfirm = () => {
    if (!selectedDrink || !pendingComboAsProduct) return;
    
    const drinkNote = `Bebida: ${selectedDrink.name}`;
    
    // Verifica se o combo também tem hambúrguer (depois de escolher bebida, vai para molhos)
    const comboWithDrink = combos.find(c => c.id === pendingComboAsProduct.id);
    if (comboWithDrink) {
      const burgerInCombo: Product | undefined = comboWithDrink.combo_items
        .map((ci: any) => products.find(p => p.id === ci.product_id))
        .find((p: Product | undefined) => !!p && isHamburger(p));
      
      if (burgerInCombo) {
        // Tem hambúrguer: guardar a bebida e abrir diálogo de molhos
        setSelectedProduct(burgerInCombo);
        setSauceNote("");
        setSelectedSauces([]);
        // Atualizar notes do combo pendente com a bebida escolhida
        setPendingComboAsProduct({
          ...pendingComboAsProduct,
          description: drinkNote
        });
        setShowDrinkDialog(false);
        setShowSauceDialog(true);
        return;
      }
    }
    
    // Se não tem hambúrguer: adicionar combo com bebida escolhida
    addToCart(applyPromotionIfAny(pendingComboAsProduct), `Combo - ${drinkNote}`);
    toast.success(`Combo "${pendingComboAsProduct.name}" adicionado ao carrinho`);
    
    setShowDrinkDialog(false);
    setSelectedDrink(null);
    setComboDrinkItem(null);
    setPendingComboAsProduct(null);
  };

  const handleSauceConfirm = () => {
    if (!selectedProduct) return;
    const saucePrice = calculateSaucePrice(selectedProduct, selectedSauces);
    const sauceNames = selectedSauces.length > 0 ? selectedSauces.join(", ") : "Sem molho";
    
    // Verifica se tem bebida escolhida no combo pendente
    let notes = sauceNote ? `Molhos: ${sauceNames}. Obs: ${sauceNote}` : `Molhos: ${sauceNames}`;
    if (pendingComboAsProduct?.description?.includes('Bebida:')) {
      notes = `${pendingComboAsProduct.description} - ${notes}`;
    }

    // Verificar se há adicionais salvos no selectedProduct ou pendingProduct
    const addons = (selectedProduct as any).addons || (pendingProduct as any)?.addons;

    if (pendingComboAsProduct) {
      // Aplicar molhos sobre o combo (cobrando extras no combo)
      addToCart(applyPromotionIfAny(pendingComboAsProduct), `Combo - ${notes}`, saucePrice, addons);
      setPendingComboAsProduct(null);
    } else {
      // Fluxo original para hambúrguer avulso
      addToCart(applyPromotionIfAny(selectedProduct), notes, saucePrice, addons);
    }
    
    // Limpar adicionais dos produtos pendentes
    if ((selectedProduct as any).addons) {
      delete (selectedProduct as any).addons;
    }
    if ((pendingProduct as any)?.addons) {
      setPendingProduct(null);
    }
    
    setShowSauceDialog(false);
    setSelectedProduct(null);
    setSauceNote("");
    setSelectedSauces([]);
  };

  const updateQuantity = (productId: string, notes: string | undefined, quantity: number, addons?: Addon[]) => {
    if (quantity <= 0) {
      removeFromCart(productId, notes, addons);
      return;
    }
    
    // Criar chave única baseada em id, notes e adicionais
    const addonsKey = addons && addons.length > 0 
      ? addons.map(a => `${a.id}-${a.quantity}`).sort().join(',')
      : '';
    const itemKey = `${productId}-${notes || ''}-${addonsKey}`;
    
    setCart(prevCart =>
      prevCart.map(item => {
        const itemAddonsKey = item.addons && item.addons.length > 0
          ? item.addons.map(a => `${a.id}-${a.quantity}`).sort().join(',')
          : '';
        const existingKey = `${item.id}-${item.notes || ''}-${itemAddonsKey}`;
        return existingKey === itemKey ? { ...item, quantity } : item;
      })
    );
  };

  const removeFromCart = (productId: string, notes?: string, addons?: Addon[]) => {
    const addonsKey = addons && addons.length > 0
      ? addons.map(a => `${a.id}-${a.quantity}`).sort().join(',')
      : '';
    const itemKey = `${productId}-${notes || ''}-${addonsKey}`;
    
    setCart(prevCart => {
      return prevCart.filter(item => {
        const itemAddonsKey = item.addons && item.addons.length > 0
          ? item.addons.map(a => `${a.id}-${a.quantity}`).sort().join(',')
          : '';
        const existingKey = `${item.id}-${item.notes || ''}-${itemAddonsKey}`;
        return existingKey !== itemKey;
      });
    });
  };

  const calculateSubtotal = () => {
    return cart.reduce((total, item) => {
      const itemPrice = item.price + (item.saucePrice || 0);
      // Adicionar preço dos adicionais
      const addonsPrice = item.addons?.reduce((addonTotal, addon) => {
        return addonTotal + (addon.price * addon.quantity);
      }, 0) || 0;
      return total + ((itemPrice + addonsPrice) * item.quantity);
    }, 0);
  };

  const calculateTotal = () => {
    const subtotal = calculateSubtotal();
    // Se for entrega e houver promoção de frete grátis ativa, não cobrar frete
    const finalDeliveryFee = (includeDelivery && !freeDeliveryPromotionId) ? deliveryFee : 0;
    return subtotal + finalDeliveryFee;
  };

  const handleCheckout = async () => {
    if (cart.length === 0) {
      toast.error("Carrinho vazio");
      return;
    }

    if (!paymentMethod) {
      toast.error("Selecione uma forma de pagamento");
      return;
    }

    try {
      // Get current user session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Usuário não autenticado");
        return;
      }

      // Get user profile to get establishment_id
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("establishment_id")
        .eq("user_id", session.user.id)
        .single();

      if (profileError || !profile?.establishment_id) {
        toast.error("Estabelecimento não encontrado");
        return;
      }

      // Verificar se há caixa aberto (exigir caixa aberto para vender)
      const { data: hasSession, error: cashSessionError } = await supabase.rpc(
        "has_open_cash_session",
        { p_establishment_id: profile.establishment_id }
      );

      if (cashSessionError || !hasSession) {
        setShowCashRequiredModal(true);
        return;
      }

      const subtotal = calculateSubtotal();
      // Calcular frete: se houver promoção de frete grátis, frete é 0
      const finalDeliveryFee = (includeDelivery && !freeDeliveryPromotionId) ? deliveryFee : 0;
      const finalTotal = selectedCustomer && selectedCustomer.groups.length > 0 ? 
        calculateDiscountedTotal() : calculateTotal();
      const discountAmount = selectedCustomer && selectedCustomer.groups.length > 0 ? 
        (subtotal + finalDeliveryFee - finalTotal) : 0;

      // Verificar se é PIX para abrir modal informativo (mas pagamento já é considerado efetuado)
      const isPix = paymentMethod === "pix";
      
      // Preparar notes com instruções gerais se houver
      const orderNotes = generalInstructions.trim() 
        ? `Instruções do Pedido: ${generalInstructions.trim()}`
        : null;

      let order: any;
      let orderNumber: string;

      // Se estiver editando um pedido existente
      if (editingOrderId && editingOrderNumber) {
        orderNumber = editingOrderNumber;
        
        // Atualizar pedido existente
        const { data: updatedOrder, error: orderError } = await supabase
          .from("orders")
          .update({
            customer_name: customerName || "Cliente Balcão",
            customer_phone: customerPhone,
            order_type: includeDelivery ? "delivery" : "balcao",
            delivery_boy_id: includeDelivery && selectedDeliveryBoy ? selectedDeliveryBoy : null,
            payment_method: paymentMethod,
            subtotal: subtotal,
            discount_amount: discountAmount,
            delivery_fee: finalDeliveryFee,
            total_amount: finalTotal,
            notes: orderNotes,
            free_delivery_promotion_id: freeDeliveryPromotionId || null
          })
          .eq("id", editingOrderId)
          .select()
          .single();

        if (orderError) throw orderError;
        order = updatedOrder;

        // Deletar itens antigos do pedido
        const { error: deleteItemsError } = await supabase
          .from("order_items")
          .delete()
          .eq("order_id", editingOrderId);

        if (deleteItemsError) throw deleteItemsError;
      } else {
        // Gerar número de pedido sequencial (#00001, #00002, etc) para novo pedido
        const { data: newOrderNumber, error: orderNumberError } = await supabase.rpc(
          "get_next_order_number",
          { p_establishment_id: profile.establishment_id }
        );

        if (orderNumberError || !newOrderNumber) {
          toast.error("Erro ao gerar número do pedido");
          return;
        }
        orderNumber = newOrderNumber;
        
        // Criar novo pedido
        const { data: newOrder, error: orderError } = await supabase
          .from("orders")
          .insert({
            establishment_id: profile.establishment_id,
            order_number: orderNumber,
            customer_name: customerName || "Cliente Balcão",
            customer_phone: customerPhone,
            order_type: includeDelivery ? "delivery" : "balcao",
            delivery_boy_id: includeDelivery && selectedDeliveryBoy ? selectedDeliveryBoy : null,
            status: "pending",
            payment_status: "paid", // Pagamento já é considerado efetuado ao finalizar venda
            payment_method: paymentMethod,
            subtotal: subtotal,
            discount_amount: discountAmount,
            delivery_fee: finalDeliveryFee,
            total_amount: finalTotal,
            notes: orderNotes,
            free_delivery_promotion_id: freeDeliveryPromotionId || null
          })
          .select()
          .single();

        if (orderError) throw orderError;
        order = newOrder;
      }

      // Create order items (resolve product_id for combos)
      const itemsToInsert = await Promise.all(
        cart.map(async (item) => {
          let productId = item.id;

          // If this cart item is a combo, ensure there's a product (is_combo=true) to reference
          const isComboItem = combos.some((c) => c.id === item.id);

          if (isComboItem) {
            // Try to find an existing product that represents this combo (by name and is_combo=true)
            const existingComboProduct = (products as any[]).find(
              (p: any) => p?.is_combo && p?.name === item.name
            );

            if (existingComboProduct) {
              productId = existingComboProduct.id;
            } else {
              // Create a combo product on the fly for referential integrity
              const { data: newProduct, error: newProductError } = await supabase
                .from("products")
                .insert({
                  establishment_id: profile.establishment_id,
                  name: item.name,
                  description: "Combo",
                  is_combo: true,
                  active: true,
                  price: item.price,
                } as any)
                .select()
                .single();

              if (newProductError) throw newProductError;
              productId = (newProduct as any).id;
            }
          }

          // Calcular preço dos adicionais
          const addonsPrice = item.addons?.reduce((sum, addon) => sum + (addon.price * addon.quantity), 0) || 0;
          const unitPrice = item.price + (item.saucePrice || 0) + addonsPrice;
          
          // Preparar customizations com adicionais
          const customizations: any = {};
          if (item.addons && item.addons.length > 0) {
            customizations.addons = item.addons.map(addon => ({
              id: addon.id,
              name: addon.name,
              quantity: addon.quantity,
              price: addon.price
            }));
          }
          
          // Preparar notes incluindo adicionais
          let notes = item.notes || '';
          if (item.addons && item.addons.length > 0) {
            const addonsText = item.addons.map(a => `${a.quantity}x ${a.name}`).join(', ');
            notes = notes ? `${notes} | Adicionais: ${addonsText}` : `Adicionais: ${addonsText}`;
          }
          if (item.promotionName) {
            notes = `${notes ? notes + ' | ' : ''}Promoção: ${item.promotionName}${item.originalPrice ? ` (de R$ ${Number(item.originalPrice).toFixed(2)} por R$ ${Number(item.price).toFixed(2)})` : ''}`;
          }
          
          return {
            order_id: order.id,
            product_id: productId,
            quantity: item.quantity,
            unit_price: unitPrice,
            total_price: unitPrice * item.quantity,
            notes: notes || null,
            customizations: Object.keys(customizations).length > 0 ? customizations : null,
            promotion_id: item.promotionId || null,
            original_price: item.originalPrice || null,
          };
        })
      );

      const { error: itemsError } = await supabase
        .from("order_items")
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;

      // Abater estoque de ingredientes automaticamente
      try {
        const { data: stockResult, error: stockError } = await supabase.rpc(
          'apply_stock_deduction_for_order',
          {
            p_establishment_id: profile.establishment_id,
            p_order_id: order.id
          }
        );

        if (stockError) {
          // Erro ao abater estoque mas não interrompe a venda
        } else if (stockResult && !stockResult.success) {
          // Avisos no abatimento de estoque mas não bloqueia a venda
        }
      } catch (stockErr) {
        // Não bloquear a venda se houver erro no estoque
      }

      // Se for PIX, buscar dados do PIX e gerar QR code
      let pixQrCode: string | undefined;
      let pixKey: string | undefined;
      let pixKeyType: string | undefined;
      
      if (isPix) {
        try {
          const { data: establishment } = await supabase
            .from('establishments')
            .select('pix_key_value, pix_key_type, pix_holder_name')
            .eq('id', profile.establishment_id)
            .single();

          if (establishment?.pix_key_value) {
            // Normalizar chave PIX se for telefone
            let normalizedPixKey = establishment.pix_key_value;
            if (establishment.pix_key_type === 'phone') {
              // Se não começa com +, normalizar para E.164
              if (!normalizedPixKey.startsWith('+')) {
                const normalized = normalizePhoneBRToE164(normalizedPixKey);
                normalizedPixKey = `+${normalized}`;
              }
            }
            pixKey = normalizedPixKey;
            pixKeyType = establishment.pix_key_type;
            const holderName = establishment.pix_holder_name || establishmentInfo.name || 'Estabelecimento';
            pixQrCode = await generatePixQrCode(normalizedPixKey, holderName, finalTotal);
          } else {
            toast.error('Chave PIX não configurada. Configure em Configurações > PIX');
          }
        } catch (error: any) {
          toast.error('Erro ao gerar QR code PIX');
        }
      }

      // Prepare receipt data
      const receiptData: ReceiptData = {
        orderNumber: orderNumber,
        customerName: customerName || "Cliente Balcão",
        customerPhone: customerPhone,
        customerAddress: selectedCustomer?.address,
        items: cart.map(item => {
          // Incluir adicionais nas notes
          let notes = item.notes || '';
          if (item.addons && item.addons.length > 0) {
            const addonsText = item.addons.map(a => `${a.quantity}x ${a.name} (R$ ${(a.price * a.quantity).toFixed(2)})`).join(', ');
            notes = notes ? `${notes} | Adicionais: ${addonsText}` : `Adicionais: ${addonsText}`;
          }
          if (item.promotionName) {
            notes = `${notes ? notes + ' | ' : ''}Promoção: ${item.promotionName}${item.originalPrice ? ` (de R$ ${Number(item.originalPrice).toFixed(2)} por R$ ${Number(item.price).toFixed(2)})` : ''}`;
          }
          
          // Calcular preço total incluindo adicionais
          const addonsPrice = item.addons?.reduce((sum, addon) => sum + (addon.price * addon.quantity), 0) || 0;
          const unitPrice = item.price + (item.saucePrice || 0) + addonsPrice;
          
          return {
            name: item.name,
            quantity: item.quantity,
            unitPrice: unitPrice,
            totalPrice: unitPrice * item.quantity,
            notes: notes || undefined
          };
        }),
        subtotal: subtotal,
        discountAmount: discountAmount,
        deliveryFee: finalDeliveryFee,
        totalAmount: finalTotal,
        establishmentName: `${establishmentInfo.name || ''}${establishmentInfo.storeNumber ? ' - ' + establishmentInfo.storeNumber : ''}`,
        establishmentAddress: establishmentInfo.address,
        establishmentPhone: establishmentInfo.phone,
        paymentMethod: paymentMethod,
        orderType: includeDelivery ? "delivery" : "balcao",
        cashGiven: paymentMethod === 'dinheiro' ? cashGiven : undefined,
        cashChange: paymentMethod === 'dinheiro' ? Math.max(0, Number(cashGiven) - Number(finalTotal)) : undefined,
        generalInstructions: generalInstructions.trim() || undefined,
        pixQrCode: pixQrCode,
        pixKey: pixKey,
        pixKeyType: pixKeyType
      };

      // Registrar uso da promoção de frete grátis se aplicável
      if (freeDeliveryPromotionId && order?.id) {
        await registerFreeDeliveryUsage(order.id, freeDeliveryPromotionId);
      }

      // Print receipt (incluindo PIX com QR code)
      await printReceipt(receiptData);

      // Clear cart and customer info
      setCart([]);
      setCustomerName("");
      setCustomerPhone("");
      setCustomerSearch("");
      setSelectedCustomer(null);
      setDeliveryFee((establishmentSettings as any)?.delivery_fee || 0);
      setIncludeDelivery(false);
      setFreeDeliveryPromotionId(null);
      setSelectedDeliveryBoy("");
      setPaymentMethod("");
      setGeneralInstructions("");
      
      // Limpar estados de edição
      if (editingOrderId) {
        setEditingOrderId(null);
        setEditingOrderNumber(null);
        setOrderLoaded(false);
        // Remover parâmetro da URL
        navigate('/pdv', { replace: true });
        toast.success(`Pedido #${orderNumber} editado com sucesso!`);
      } else {
        toast.success(`Venda finalizada! Pedido: ${orderNumber}`);
      }
    } catch (error) {
      toast.error("Erro ao finalizar venda");
    }
  };

  const handlePixPaymentConfirmed = async () => {
    // Imprimir comanda após confirmação do PIX
    if (pendingReceiptData) {
      await printReceipt(pendingReceiptData);
    }

    const wasEditing = !!editingOrderId;
    const orderNum = editingOrderNumber;

    // Limpar carrinho e dados do cliente
    setCart([]);
    setCustomerName("");
    setCustomerPhone("");
    setCustomerSearch("");
    setSelectedCustomer(null);
    setDeliveryFee((establishmentSettings as any)?.delivery_fee || 0);
    setIncludeDelivery(false);
    setFreeDeliveryPromotionId(null);
    setSelectedDeliveryBoy("");
    setPaymentMethod("");
    setGeneralInstructions("");
    setPendingOrderId("");
    setPendingOrderAmount(0);
    setPendingReceiptData(null);
    setShowPixModal(false);
    
    // Limpar estados de edição
    if (wasEditing) {
      setEditingOrderId(null);
      setEditingOrderNumber(null);
      setOrderLoaded(false);
      // Remover parâmetro da URL
      navigate('/pdv', { replace: true });
      toast.success(`Pedido #${orderNum} editado com sucesso!`);
    }
  };

  const getProductsByCategory = () => {
    // Filtrar produtos que são combos (is_combo: true) e adicionais - eles aparecem em seções separadas
    const filteredProducts = products.filter(product =>
      product?.name?.toLowerCase().includes(searchTerm.toLowerCase()) &&
      !(product as any)?.is_combo && // Excluir produtos que são combos
      !(addonsCategoryId && product.category_id === addonsCategoryId) // Excluir produtos da categoria "Adicionais"
    );

    const normalize = (s: string) =>
      (s || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "");

    // Desired order normalized
    const categoryOrderKeys = ['hamburgueres', 'acompanhamentos', 'bebidas'];
    const organizedProducts: { [key: string]: Product[] } = {};
    const categoryDisplayNames: { [key: string]: string } = {};

    // Initialize categories in order
    categoryOrderKeys.forEach(key => {
      organizedProducts[key] = [];
    });

    // Group products by category (case-insensitive and accent-insensitive)
    filteredProducts.forEach(product => {
      const category = categories.find(cat => cat.id === product.category_id);
      const categoryName = category?.name || 'OUTROS';
      const categoryKey = normalize(categoryName);

      // Find matching key from desired order
      const matchedKey = categoryOrderKeys.find(key =>
        categoryKey.includes(key) || key.includes(categoryKey)
      );

      const finalKey = matchedKey || categoryKey;

      if (!organizedProducts[finalKey]) {
        organizedProducts[finalKey] = [];
      }
      organizedProducts[finalKey].push(product);

      // Store display name for this key (first occurrence wins)
      if (!categoryDisplayNames[finalKey]) {
        categoryDisplayNames[finalKey] = categoryName;
      }
    });

    // Return categories in the correct order, only if they have products
    const finalOrganized: { [key: string]: Product[] } = {};

    categoryOrderKeys.forEach(key => {
      if (organizedProducts[key] && organizedProducts[key].length > 0) {
        const displayName = categoryDisplayNames[key] || key.toUpperCase();
        finalOrganized[displayName] = organizedProducts[key];
      }
    });

    // Add any other categories that might exist (preserving insertion order)
    Object.keys(organizedProducts).forEach(key => {
      if (!categoryOrderKeys.includes(key) && organizedProducts[key].length > 0) {
        const displayName = categoryDisplayNames[key] || key.toUpperCase();
        finalOrganized[displayName] = organizedProducts[key];
      }
    });

    return finalOrganized;
  };

  const parseWhatsAppOrder = (text: string) => {
    const lines = text.split('\n').filter(line => line.trim());
    const items: Array<{ name: string; quantity: number; price: number; notes?: string }> = [];
    let total = 0;
    let deliveryFee = 0;
    let paymentMethod = "";
    let orderType = "balcao";

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Parse items (format: 1x Item Name - R$ 23.00)
      const itemMatch = line.match(/^(\d+)x\s+(.+?)\s+-.*?R\$\s*([\d,\.]+)$/);
      if (itemMatch) {
        const quantity = parseInt(itemMatch[1]);
        const name = itemMatch[2].trim();
        const price = parseFloat(itemMatch[3].replace(',', '.'));
        
        // Check next line for notes (Molhos, Observações, etc)
        let notes = "";
        if (i + 1 < lines.length && lines[i + 1].trim().includes(':')) {
          notes = lines[i + 1].trim();
          i++; // Skip next line as we've processed it
        }
        
        items.push({ name, quantity, price, notes });
      }
      
      // Parse total
      const totalMatch = line.match(/^Total:\s*R\$\s*([\d,\.]+)$/);
      if (totalMatch) {
        total = parseFloat(totalMatch[1].replace(',', '.'));
      }
      
      // Parse delivery type
      if (line.includes('Forma de entrega:')) {
        if (line.toLowerCase().includes('entrega') || line.toLowerCase().includes('delivery')) {
          orderType = "delivery";
        } else {
          orderType = "balcao";
        }
      }
      
      // Parse payment method
      if (line.includes('Forma de pagamento:')) {
        paymentMethod = line.split(':')[1]?.trim() || "";
      }
    }

    return { items, total, deliveryFee, paymentMethod, orderType };
  };

  const isPromotionActiveNow = (promotion: any) => {
    if (!promotion?.active) return false;
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const startOk = todayStr >= promotion.start_date;
    const endOk = todayStr <= promotion.end_date;
    if (!(startOk && endOk)) return false;

    // Time window optional
    if (promotion.start_time) {
      const [sh, sm, ss] = promotion.start_time.split(":").map((v: string) => parseInt(v, 10) || 0);
      const startMinutes = sh * 60 + sm;
      const nowMinutes = now.getHours() * 60 + now.getMinutes();
      if (nowMinutes < startMinutes) return false;
    }
    if (promotion.end_time) {
      const [eh, em, es] = promotion.end_time.split(":").map((v: string) => parseInt(v, 10) || 0);
      const endMinutes = eh * 60 + em;
      const nowMinutes = now.getHours() * 60 + now.getMinutes();
      if (nowMinutes > endMinutes) return false;
    }
    return true;
  };

  const computeDiscountedPrice = (basePrice: number, promotion: any) => {
    if (!promotion) return basePrice;
    if (promotion.discount_type === 'percentage') {
      return Math.max(0, Number(basePrice) * (1 - Number(promotion.discount_value) / 100));
    }
    if (promotion.discount_type === 'fixed') {
      return Math.max(0, Number(basePrice) - Number(promotion.discount_value));
    }
    return basePrice;
  };

  const getAppliedPromotionForProduct = (product: Product) => {
    if (!promotions || promotions.length === 0) return null;
    const applicable = promotions.filter(isPromotionActiveNow).find((p: any) => {
      if (p.type === 'product') {
        // Verificar se o produto está na lista de promotion_products
        if (p.promotion_products && Array.isArray(p.promotion_products)) {
          return p.promotion_products.some((pp: any) => pp.product_id === product.id);
        }
        // Fallback para compatibilidade com promoções antigas (target_id)
        return p.target_id === product.id;
      }
      if (p.type === 'category') return p.target_id && product.category_id === p.target_id;
      if (p.type === 'global') return true;
      return false;
    });
    if (!applicable) return null;
    
    // Se for promoção do tipo produto com promotion_products, usar o valor fixo
    if (applicable.type === 'product' && applicable.promotion_products && Array.isArray(applicable.promotion_products)) {
      const productPromotion = applicable.promotion_products.find((pp: any) => pp.product_id === product.id);
      if (productPromotion && productPromotion.fixed_price !== null && productPromotion.fixed_price !== undefined) {
        return { 
          price: Number(productPromotion.fixed_price), 
          originalPrice: product.price, 
          promotionId: applicable.id, 
          promotionName: applicable.name 
        };
      }
    }
    
    // Para outros tipos de promoção, calcular desconto normalmente
    const discounted = computeDiscountedPrice(product.price, applicable);
    return { price: discounted, originalPrice: product.price, promotionId: applicable.id, promotionName: applicable.name };
  };

  const applyPromotionIfAny = (product: Product) => {
    const applied = getAppliedPromotionForProduct(product);
    if (!applied) return product;
    return { ...product, price: applied.price, originalPrice: applied.originalPrice, promotionId: applied.promotionId, promotionName: applied.promotionName } as Product & { originalPrice: number; promotionId: string; promotionName: string };
  };

  const getWhatsappFilteredCustomers = () => {
    if (!whatsappCustomerSearch.trim()) return [];
    return customers.filter(customer =>
      customer.name.toLowerCase().includes(whatsappCustomerSearch.toLowerCase()) ||
      (customer.phone && customer.phone.includes(whatsappCustomerSearch))
    ).slice(0, 5);
  };

  const selectWhatsappCustomer = (customer: CustomerWithGroups) => {
    setWhatsappSelectedCustomer(customer);
    setWhatsappCustomerSearch(customer.name);
    setShowWhatsappCustomerDropdown(false);
  };

  const handleWhatsAppOrderSubmit = async () => {
    if (!whatsappOrderText.trim()) {
      toast.error("Cole o pedido do WhatsApp");
      return;
    }

    try {
      const parsed = parseWhatsAppOrder(whatsappOrderText);
      
      if (parsed.items.length === 0) {
        toast.error("Não foi possível identificar os itens do pedido");
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Usuário não autenticado");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("establishment_id, establishments(*)")
        .eq("user_id", session.user.id)
        .single();

      if (!profile?.establishment_id) {
        toast.error("Estabelecimento não encontrado");
        return;
      }

      // Calculate discount if customer is selected
      let discountAmount = 0;
      let finalTotal = parsed.total;
      const subtotal = parsed.items.reduce((sum, item) => sum + item.price, 0);
      
      if (whatsappSelectedCustomer && whatsappSelectedCustomer.groups.length > 0) {
        const discount = getCustomerDiscount();
        if (discount.percentage > 0) {
          discountAmount = subtotal * (discount.percentage / 100);
        }
        if (discount.amount > 0) {
          discountAmount = Math.max(discountAmount, discount.amount);
        }
        finalTotal = subtotal - discountAmount;
      }

      const orderNumber = `PDV-${Date.now()}`;

      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          establishment_id: profile.establishment_id,
          order_number: orderNumber,
          customer_name: whatsappSelectedCustomer?.name || whatsappCustomerSearch || "Cliente",
          customer_phone: whatsappSelectedCustomer?.phone,
          order_type: parsed.orderType,
          subtotal,
          discount_amount: discountAmount,
          total_amount: finalTotal || subtotal,
          payment_method: parsed.paymentMethod,
          payment_status: "paid",
          status: "completed",
        })
        .select()
        .single();

      if (orderError) throw orderError;

      for (const item of parsed.items) {
        const { data: matchedProducts } = await supabase
          .from("products")
          .select("id")
          .eq("establishment_id", profile.establishment_id)
          .ilike("name", `%${item.name.split('-')[0].trim()}%`)
          .limit(1);

        const productId = matchedProducts?.[0]?.id || null;

        await supabase.from("order_items").insert({
          order_id: order.id,
          product_id: productId,
          quantity: item.quantity,
          unit_price: item.price / item.quantity,
          total_price: item.price,
          notes: item.notes,
        });
      }

      const receiptData: ReceiptData = {
        orderNumber,
        customerName: whatsappSelectedCustomer?.name || whatsappCustomerSearch || "Cliente",
        customerPhone: whatsappSelectedCustomer?.phone,
        customerAddress: whatsappSelectedCustomer?.address,
        items: parsed.items.map(item => ({
          name: item.name,
          quantity: item.quantity,
          unitPrice: item.price / item.quantity,
          totalPrice: item.price,
          notes: item.notes,
        })),
        subtotal,
        discountAmount,
        deliveryFee: parsed.deliveryFee,
        totalAmount: finalTotal || subtotal,
        establishmentName: `${establishmentInfo.name || ''}${establishmentInfo.storeNumber ? ' - ' + establishmentInfo.storeNumber : ''}`,
        establishmentAddress: establishmentInfo.address,
        establishmentPhone: establishmentInfo.phone,
        paymentMethod: parsed.paymentMethod,
        orderType: parsed.orderType === "delivery" ? "ENTREGA" : "BALCÃO",
      };

      printReceipt(receiptData);

      toast.success(`Pedido ${orderNumber} processado e impresso com sucesso!`);
      setWhatsappDialogOpen(false);
      setWhatsappOrderText("");
      setWhatsappSelectedCustomer(null);
      setWhatsappCustomerSearch("");
    } catch (error) {
      toast.error("Erro ao processar pedido. Verifique o formato e tente novamente");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
          <p className="mt-4 text-muted-foreground">Carregando produtos...</p>
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
            <div className="flex items-center gap-4">
              <h1 className="text-3xl font-bold text-foreground">PDV - Ponto de Venda</h1>
              {editingOrderId && editingOrderNumber && (
                <Badge variant="outline" className="bg-purple-50 dark:bg-purple-950/20 border-purple-500 text-purple-700 dark:text-purple-300 text-sm px-3 py-1">
                  Editando Pedido #{editingOrderNumber}
                </Badge>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Products Section */}
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <CardTitle>Produtos</CardTitle>
                    <div className="relative w-64">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="pdv-product-search"
                        placeholder="Buscar produtos..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {(() => {
                    const productsByCategory = getProductsByCategory();
                    const hasProducts = Object.values(productsByCategory).some(products => products.length > 0);

                    if (!hasProducts) {
                      return (
                        <div className="text-center py-8">
                          <p className="text-muted-foreground">Nenhum produto encontrado</p>
                        </div>
                      );
                    }

                    return (
                      <div className="space-y-6">
                        {Object.entries(productsByCategory).map(([categoryName, categoryProducts]) => {
                          if (categoryProducts.length === 0) return null;

                          return (
                            <div key={categoryName}>
                              <h3 className="text-base font-semibold mb-2 text-primary border-b border-border pb-1">
                                {categoryName}
                              </h3>
                              <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-2">
                                {categoryProducts.map((product) => (
                                  <Card key={product.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => handleProductClick(product)}>
                                    <CardContent className="p-2">
                                      <div className="space-y-1">
                                        <h4 className="font-medium text-xs leading-tight line-clamp-2">{product.name}</h4>
                                        <p className="text-xs text-muted-foreground line-clamp-1">
                                          {product.description}
                                        </p>
                                        <div className="flex justify-between items-center">
                                          {(() => {
                                            const applied = getAppliedPromotionForProduct(product);
                                            if (applied) {
                                              return (
                                                <div className="flex items-center gap-2">
                                                  <span className="font-bold text-primary text-sm">R$ {applied.price.toFixed(2)}</span>
                                                  <span className="text-xs line-through text-muted-foreground">R$ {product.price.toFixed(2)}</span>
                                                </div>
                                              );
                                            }
                                            return (
                                              <span className="font-bold text-primary text-sm">R$ {product.price.toFixed(2)}</span>
                                            );
                                          })()}
                                           <Button 
                                             size="sm" 
                                             onClick={(e) => { e.stopPropagation(); handleProductClick(product); }}
                                             className="h-6 w-6 p-0"
                                           >
                                            <Plus className="h-3 w-3" />
                                          </Button>
                                        </div>
                                        {(() => {
                                          const applied = getAppliedPromotionForProduct(product);
                                          return applied ? (
                                            <div className="text-[10px] text-green-700 dark:text-green-300">Promoção: {applied.promotionName}</div>
                                          ) : null;
                                        })()}
                                      </div>
                                    </CardContent>
                                  </Card>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}

                  {/* Combos - exibidos por último */}
                  {combos && combos.length > 0 && (
                    <div className="mt-6">
                      <Collapsible open={combosOpen} onOpenChange={setCombosOpen}>
                        <CollapsibleTrigger className="w-full">
                          <div className="flex items-center justify-between text-base font-semibold mb-2 text-primary border-b border-border pb-1 hover:opacity-80 transition-opacity cursor-pointer">
                            <span>Combos</span>
                            {combosOpen ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </div>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-2 mt-2">
                            {combos
                              .filter((c: any) => !searchTerm || c.name.toLowerCase().includes(searchTerm.toLowerCase()))
                              .map((combo: any) => (
                                <Card key={combo.id} className="cursor-pointer hover:shadow-md transition-shadow">
                                  <CardContent className="p-2">
                                    <div className="space-y-1">
                                      <h4 className="font-medium text-xs leading-tight line-clamp-2">{combo.name}</h4>
                                      <div className="text-[11px] text-muted-foreground line-clamp-2">
                                        {(combo.combo_items?.length || 0)} item(s)
                                      </div>
                                      <div className="flex justify-between items-center">
                                        <span className="font-bold text-primary text-sm">
                                          R$ {Number(combo.price || 0).toFixed(2)}
                                        </span>
                                        <Button 
                                          size="sm" 
                                          onClick={() => addComboToCart(combo)}
                                          className="h-6 w-6 p-0">
                                          <Plus className="h-3 w-3" />
                                        </Button>
                                      </div>
                                    </div>
                                  </CardContent>
                                </Card>
                              ))}
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Cart Section */}
            <div>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <ShoppingCart className="mr-2 h-5 w-5" />
                    Carrinho ({cart.reduce((sum, item) => sum + item.quantity, 0)})
                  </CardTitle>
                 </CardHeader>
                <CardContent className="space-y-4">
                   {/* Customer Search - Unified */}
                   <div className="space-y-2">
                      <Label className="text-sm font-medium">Cliente</Label>
                      <div className="relative">
                        <Input
                          placeholder="Nome do cliente ou buscar cadastrado..."
                          value={customerSearch}
                          onChange={(e) => {
                            setCustomerSearch(e.target.value);
                            setCustomerName(e.target.value);
                            setShowCustomerDropdown(e.target.value.length > 0);
                            if (e.target.value === "") {
                              setSelectedCustomer(null);
                            }
                          }}
                          onFocus={() => setShowCustomerDropdown(customerSearch.length > 0)}
                        />
                        
                        {showCustomerDropdown && getFilteredCustomers().length > 0 && (
                          <div className="absolute z-50 w-full mt-1 bg-background border rounded-md shadow-lg max-h-48 overflow-y-auto">
                            {getFilteredCustomers().map((customer) => (
                              <div
                                key={customer.id}
                                className="p-2 hover:bg-accent cursor-pointer"
                                onClick={() => selectCustomer(customer)}
                              >
                                <div className="flex justify-between items-center">
                                  <div>
                                    <p className="text-sm font-medium">{customer.name}</p>
                                    {customer.phone && (
                                      <p className="text-xs text-muted-foreground">{customer.phone}</p>
                                    )}
                                  </div>
                                  {customer.groups.length > 0 && (
                                    <div className="flex flex-wrap gap-1">
                                      {customer.groups.map((group) => (
                                        <Badge key={group.id} variant="secondary" className="text-xs">
                                          {group.discount_percentage > 0 && `${group.discount_percentage}%`}
                                          {group.discount_amount > 0 && `R$ ${group.discount_amount}`}
                                        </Badge>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      
                      {selectedCustomer && (
                        <div className="p-2 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded">
                          <div className="flex justify-between items-center">
                            <div>
                              <p className="text-sm font-medium text-green-800 dark:text-green-200">
                                {selectedCustomer.name}
                              </p>
                              {selectedCustomer.phone && (
                                <p className="text-xs text-green-600 dark:text-green-400">{selectedCustomer.phone}</p>
                              )}
                            </div>
                            {selectedCustomer.groups.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {selectedCustomer.groups.map((group) => (
                                  <Badge key={group.id} variant="secondary" className="text-xs">
                                    {group.discount_percentage > 0 && `${group.discount_percentage}%`}
                                    {group.discount_amount > 0 && `R$ ${group.discount_amount}`}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                      
                      {!selectedCustomer && customerPhone && (
                        <Input
                          placeholder="Telefone (opcional)"
                          value={customerPhone}
                          onChange={(e) => setCustomerPhone(e.target.value)}
                        />
                      )}
                    </div>

                  {/* Delivery Toggle */}
                  <div className="flex items-center justify-between p-3 border rounded">
                    <div className="flex items-center space-x-2">
                      <Truck className="h-4 w-4" />
                      <Label htmlFor="delivery-toggle">Incluir entrega</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      {/* Reserva de espaço para não empurrar o switch ao mostrar o valor */}
                      <span className={cn("text-sm text-muted-foreground w-16 text-right transition-opacity", includeDelivery ? "opacity-100" : "opacity-0")}>
                        R$ {deliveryFee.toFixed(2)}
                      </span>
                      <Switch
                        id="delivery-toggle"
                        checked={includeDelivery}
                        onCheckedChange={async (checked) => {
                          setIncludeDelivery(checked);
                          if (checked) {
                            loadDeliveryBoys();
                            // Verificar se há promoção de frete grátis ativa
                            if (establishmentId) {
                              const promotionId = await checkFreeDeliveryPromotion(establishmentId);
                              setFreeDeliveryPromotionId(promotionId);
                              if (promotionId) {
                                toast.success("Frete grátis aplicado!");
                              }
                            }
                          } else {
                            setSelectedDeliveryBoy("");
                            setFreeDeliveryPromotionId(null);
                          }
                        }}
                      />
                    </div>
                  </div>

                  {/* Delivery Boy Selection */}
                  {includeDelivery && (
                    <div className="space-y-2">
                      <Label htmlFor="delivery-boy" className="text-sm font-medium">Motoboy</Label>
                      {deliveryBoys.length === 0 ? (
                        <div className="p-3 border rounded-lg bg-muted/50">
                          <p className="text-sm text-muted-foreground">
                            Nenhum motoboy cadastrado. Cadastre em Configurações → Delivery
                          </p>
                        </div>
                      ) : (
                        <Select
                          value={selectedDeliveryBoy || undefined}
                          onValueChange={setSelectedDeliveryBoy}
                        >
                          <SelectTrigger id="delivery-boy">
                            <SelectValue placeholder="Selecione o motoboy" />
                          </SelectTrigger>
                          <SelectContent>
                            {deliveryBoys.map((boy) => (
                              <SelectItem key={boy.id} value={boy.id}>
                                {boy.name}
                                {boy.daily_rate > 0 && ` (Diária: R$ ${boy.daily_rate.toFixed(2)})`}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  )}

                  {/* Payment Method */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Forma de Pagamento</Label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <option value="">Selecione...</option>
                      <option value="dinheiro">Dinheiro</option>
                      <option value="cartao_debito">Cartão de Débito</option>
                      <option value="cartao_credito">Cartão de Crédito</option>
                      <option value="pix">PIX</option>
                    </select>
                  </div>

                  {/* General Instructions */}
                  <div className="space-y-2">
                    <Label htmlFor="general-instructions" className="text-sm font-medium">Instruções do Pedido</Label>
                    <Textarea
                      id="general-instructions"
                      placeholder="Ex: Enviar em sacos separados, não colocar talheres, etc..."
                      value={generalInstructions}
                      onChange={(e) => setGeneralInstructions(e.target.value)}
                      rows={3}
                      className="resize-none"
                    />
                  </div>

                  {/* Cart Items */}
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {cart.map((item, idx) => {
                      const itemAddonsKey = item.addons && item.addons.length > 0
                        ? item.addons.map(a => `${a.id}-${a.quantity}`).sort().join(',')
                        : '';
                      const itemKey = `${item.id}-${item.notes || ''}-${itemAddonsKey}-${idx}`;
                      return (
                      <div key={itemKey} className="flex items-center justify-between p-2 border rounded">
                         <div className="flex-1">
                          <p className="text-sm font-medium">{item.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {item.originalPrice ? (
                              <>
                                <span className="font-semibold text-green-700 dark:text-green-300">R$ {item.price.toFixed(2)}</span>
                                <span className="ml-2 line-through">R$ {Number(item.originalPrice).toFixed(2)}</span>
                              </>
                            ) : (
                              <>R$ {item.price.toFixed(2)}</>
                            )}
                            {item.saucePrice ? ` + R$ ${item.saucePrice.toFixed(2)} (molhos)` : ''}
                            {item.addons && item.addons.length > 0 && (
                              <>
                                {' + R$ '}
                                {item.addons.reduce((sum, addon) => sum + (addon.price * addon.quantity), 0).toFixed(2)}
                                {' (adicionais)'}
                              </>
                            )}
                            {' cada'}
                          </p>
                          {item.addons && item.addons.length > 0 && (
                            <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                              Adicionais: {item.addons.map(a => `${a.quantity}x ${a.name}`).join(', ')}
                            </p>
                          )}
                          {item.promotionName && (
                            <p className="text-[10px] text-green-700 dark:text-green-300">Promoção: {item.promotionName}</p>
                          )}
                           {item.notes && (
                             <p className="text-xs text-orange-600 mt-1">
                               {item.notes}
                             </p>
                           )}
                         </div>
                        
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => updateQuantity(item.id, item.notes, item.quantity - 1, item.addons)}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          
                          <span className="text-sm w-8 text-center">{item.quantity}</span>
                          
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => updateQuantity(item.id, item.notes, item.quantity + 1, item.addons)}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                          
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => removeFromCart(item.id, item.notes, item.addons)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      );
                    })}
                  </div>

                  {cart.length === 0 && (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground">Carrinho vazio</p>
                    </div>
                  )}

                  {/* Total */}
                  {cart.length > 0 && (
                    <div className="border-t pt-4 space-y-4">
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span>Subtotal:</span>
                          <span>R$ {calculateSubtotal().toFixed(2)}</span>
                        </div>
                         {includeDelivery && (
                           <div className="flex justify-between">
                             <span>Taxa de entrega:</span>
                             <span>
                               {freeDeliveryPromotionId ? (
                                 <span className="text-green-600 font-semibold">Grátis</span>
                               ) : (
                                 `R$ ${deliveryFee.toFixed(2)}`
                               )}
                             </span>
                           </div>
                         )}
                         {selectedCustomer && selectedCustomer.groups.length > 0 && (() => {
                           const discount = getCustomerDiscount();
                           const subtotal = calculateSubtotal();
                           let discountValue = 0;
                           if (discount.percentage > 0) {
                             discountValue = subtotal * (discount.percentage / 100);
                           }
                           if (discount.amount > 0) {
                             discountValue = Math.max(discountValue, discount.amount);
                           }
                           
                           return discountValue > 0 ? (
                             <div className="flex justify-between text-green-600">
                               <span>Desconto do grupo:</span>
                               <span>- R$ {discountValue.toFixed(2)}</span>
                             </div>
                           ) : null;
                         })()}
                         <div className="flex justify-between text-lg font-bold border-t pt-2">
                           <span>Total:</span>
                           <span>R$ {selectedCustomer && selectedCustomer.groups.length > 0 ? calculateDiscountedTotal().toFixed(2) : calculateTotal().toFixed(2)}</span>
                         </div>
                      </div>
                      
                      <Button 
                        className="w-full" 
                        onClick={() => {
                          // Se pagamento em dinheiro, abrir modal antes
                          const total = selectedCustomer && selectedCustomer.groups.length > 0 ? 
                            calculateDiscountedTotal() : calculateTotal();
                          if (paymentMethod === 'dinheiro') {
                            setCashGiven(Number(total));
                            setCashChange(0);
                            setShowCashModal(true);
                          } else {
                            handleCheckout();
                          }
                        }}
                      >
                        <Receipt className="mr-2 h-4 w-4" />
                        Finalizar Venda
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>

      {/* Drink Selection Dialog */}
      <Dialog open={showDrinkDialog} onOpenChange={setShowDrinkDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Escolha da Bebida</DialogTitle>
            <DialogDescription>
              {pendingComboAsProduct?.name} - Selecione a bebida desejada
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-3 max-h-96 overflow-y-auto">
              <Label className="text-sm font-medium">Bebidas disponíveis:</Label>
              {products.filter(p => isComboDrink(p)).map((drink) => (
                <div 
                  key={drink.id} 
                  className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-colors ${
                    selectedDrink?.id === drink.id 
                      ? 'bg-primary text-primary-foreground' 
                      : 'hover:bg-accent'
                  }`}
                  onClick={() => setSelectedDrink(drink)}
                >
                  <div className="flex items-center space-x-3">
                    <div className={`w-4 h-4 rounded-full border-2 ${
                      selectedDrink?.id === drink.id 
                        ? 'bg-primary-foreground border-primary-foreground' 
                        : 'border-current'
                    }`}>
                      {selectedDrink?.id === drink.id && (
                        <div className="w-full h-full rounded-full bg-primary-foreground" />
                      )}
                    </div>
                    <div>
                      <Label className={`text-sm font-medium cursor-pointer ${
                        selectedDrink?.id === drink.id ? 'text-primary-foreground' : ''
                      }`}>
                        {drink.name}
                      </Label>
                      <p className={`text-xs ${selectedDrink?.id === drink.id ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                        R$ {drink.price.toFixed(2)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
              {products.filter(p => isComboDrink(p)).length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhuma bebida disponível para combos
                </p>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => {
                setShowDrinkDialog(false);
                setSelectedDrink(null);
                setComboDrinkItem(null);
                setPendingComboAsProduct(null);
              }}>
                Cancelar
              </Button>
              <Button onClick={handleDrinkConfirm} disabled={!selectedDrink}>
                Continuar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Sauce Selection Dialog */}
      <Dialog open={showSauceDialog} onOpenChange={setShowSauceDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Escolha dos Molhos</DialogTitle>
            <DialogDescription>
              {selectedProduct?.name} - {isTriplo(selectedProduct) ? '2 molhos grátis' : '1 molho grátis'}, R$ 2,00 por adicional
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-3">
              <Label className="text-sm font-medium">Molhos disponíveis:</Label>
              {sauceOptions.map((sauce) => (
                <div key={sauce} className="flex items-center space-x-2">
                  <Checkbox
                    id={sauce}
                    checked={selectedSauces.includes(sauce)}
                    onCheckedChange={(checked) => handleSauceToggle(sauce, !!checked)}
                  />
                  <Label htmlFor={sauce} className="text-sm cursor-pointer">
                    {sauce}
                  </Label>
                </div>
              ))}
            </div>

            {selectedSauces.length > 0 && (
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm font-medium">Molhos selecionados: {selectedSauces.length}</p>
                <p className="text-xs text-muted-foreground">
                  Grátis: {isTriplo(selectedProduct) ? '2' : '1'} | 
                  Pagos: {Math.max(0, selectedSauces.length - (isTriplo(selectedProduct) ? 2 : 1))} | 
                  Valor extra: R$ {selectedProduct ? calculateSaucePrice(selectedProduct, selectedSauces).toFixed(2) : '0.00'}
                </p>
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="custom-sauce">Observação adicional:</Label>
              <Textarea
                id="custom-sauce"
                placeholder="Ex: Pouco molho, molho à parte, etc..."
                value={sauceNote}
                onChange={(e) => setSauceNote(e.target.value)}
                rows={2}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowSauceDialog(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSauceConfirm}>
                Adicionar ao Carrinho
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* WhatsApp Order Dialog */}
      <Dialog open={whatsappDialogOpen} onOpenChange={setWhatsappDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              Importar Pedido do WhatsApp (F9)
            </DialogTitle>
            <DialogDescription>
              Cole o texto do pedido recebido pelo WhatsApp. O sistema irá processar e imprimir automaticamente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Customer Search in WhatsApp Dialog */}
            <div className="space-y-2">
              <Label htmlFor="whatsapp-customer">Cliente (opcional)</Label>
              <div className="relative">
                <Input
                  id="whatsapp-customer"
                  placeholder="Buscar cliente cadastrado ou digitar nome..."
                  value={whatsappCustomerSearch}
                  onChange={(e) => {
                    setWhatsappCustomerSearch(e.target.value);
                    setShowWhatsappCustomerDropdown(e.target.value.length > 0);
                    if (e.target.value === "") {
                      setWhatsappSelectedCustomer(null);
                    }
                  }}
                  onFocus={() => setShowWhatsappCustomerDropdown(whatsappCustomerSearch.length > 0)}
                />
                
                {showWhatsappCustomerDropdown && getWhatsappFilteredCustomers().length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-background border rounded-md shadow-lg max-h-48 overflow-y-auto">
                    {getWhatsappFilteredCustomers().map((customer) => (
                      <div
                        key={customer.id}
                        className="p-2 hover:bg-accent cursor-pointer"
                        onClick={() => selectWhatsappCustomer(customer)}
                      >
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="text-sm font-medium">{customer.name}</p>
                            {customer.phone && (
                              <p className="text-xs text-muted-foreground">{customer.phone}</p>
                            )}
                          </div>
                          {customer.groups.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {customer.groups.map((group) => (
                                <Badge key={group.id} variant="secondary" className="text-xs">
                                  {group.discount_percentage > 0 && `${group.discount_percentage}%`}
                                  {group.discount_amount > 0 && `R$ ${group.discount_amount}`}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              {whatsappSelectedCustomer && (
                <div className="p-2 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-sm font-medium text-green-800 dark:text-green-200">
                        Cliente selecionado: {whatsappSelectedCustomer.name}
                      </p>
                      {whatsappSelectedCustomer.phone && (
                        <p className="text-xs text-green-600 dark:text-green-400">{whatsappSelectedCustomer.phone}</p>
                      )}
                    </div>
                    {whatsappSelectedCustomer.groups.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {whatsappSelectedCustomer.groups.map((group) => (
                          <Badge key={group.id} variant="secondary" className="text-xs">
                            {group.name}: {group.discount_percentage > 0 && `${group.discount_percentage}%`}
                            {group.discount_amount > 0 && `R$ ${group.discount_amount}`}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="whatsapp-order">Pedido do WhatsApp</Label>
              <Textarea
                id="whatsapp-order"
                placeholder="Cole aqui o pedido completo recebido pelo WhatsApp..."
                value={whatsappOrderText}
                onChange={(e) => setWhatsappOrderText(e.target.value)}
                className="min-h-[300px] font-mono text-sm"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setWhatsappDialogOpen(false);
                  setWhatsappOrderText("");
                  setWhatsappSelectedCustomer(null);
                  setWhatsappCustomerSearch("");
                }}
              >
                Cancelar
              </Button>
              <Button className="flex-1" onClick={handleWhatsAppOrderSubmit}>
                <Receipt className="mr-2 h-4 w-4" />
                Processar e Imprimir
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Cash Payment Dialog */}
      <Dialog open={showCashModal} onOpenChange={setShowCashModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Pagamento em Dinheiro</DialogTitle>
            <DialogDescription>
              Informe o valor recebido para calcular o troco automaticamente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Total da venda</Label>
              <div className="mt-1 text-lg font-semibold">
                R$ {(selectedCustomer && selectedCustomer.groups.length > 0 ? calculateDiscountedTotal() : calculateTotal()).toFixed(2)}
              </div>
            </div>
            <div>
              <Label htmlFor="cash-given">Valor recebido</Label>
              <Input
                id="cash-given"
                type="number"
                step="0.01"
                value={Number.isNaN(cashGiven) ? '' : cashGiven}
                onChange={(e) => {
                  const val = parseFloat(e.target.value || '0');
                  setCashGiven(val);
                  const total = selectedCustomer && selectedCustomer.groups.length > 0 ? calculateDiscountedTotal() : calculateTotal();
                  setCashChange(Math.max(0, val - Number(total)));
                }}
              />
            </div>
            <div>
              <Label>Troco</Label>
              <div className="mt-1 text-lg font-semibold">
                R$ {Math.max(0, cashChange).toFixed(2)}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowCashModal(false)}>Cancelar</Button>
              <Button onClick={() => {
                // Confirma e finaliza
                setShowCashModal(false);
                handleCheckout();
              }}>Confirmar e Finalizar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AddonsModal
        open={showAddonsModal}
        onClose={() => {
          setShowAddonsModal(false);
          setPendingProduct(null);
          setPendingNotes(undefined);
          setPendingSaucePrice(undefined);
        }}
        onConfirm={handleAddonsConfirm}
        productId={pendingProduct?.id || ""}
        categoryId={pendingProduct?.category_id || null}
        establishmentId={establishmentId || ""}
        productName={pendingProduct?.name || ""}
        variant="normal"
      />

      <PixPaymentModal
        open={showPixModal}
        onClose={() => setShowPixModal(false)}
        orderId={pendingOrderId}
        amount={pendingOrderAmount}
        onPaymentConfirmed={handlePixPaymentConfirmed}
      />

      <CashRequiredModal
        open={showCashRequiredModal}
        onClose={() => setShowCashRequiredModal(false)}
        onOpenCash={() => navigate("/finance/cash")}
      />
    </div>
  );
};

export default PDV;