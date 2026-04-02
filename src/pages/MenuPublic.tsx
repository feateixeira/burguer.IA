import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { normalizePhoneBRToE164, phoneMask } from "@/utils/phoneNormalizer";
import { useBusinessHours } from "@/hooks/useBusinessHours";
import { formatDateTime, formatTime, getDayName } from "@/utils/businessHours";
import { Card, CardContent } from "@/components/ui/card";
import { normalizeImageUrl } from "@/utils/imageUrl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, Plus, Minus, X, MapPin, Phone, Clock, CheckCircle2, CreditCard, Wallet, Settings, Circle, UtensilsCrossed, Sparkles, Package, Info } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AddonsModal } from "@/components/AddonsModal";
import { checkFreeDeliveryPromotion, registerFreeDeliveryUsage } from "@/utils/freeDeliveryPromotion";

interface Product {
  id: string;
  name: string;
  description?: string;
  price: number;
  image_url?: string;
  category_id?: string;
  ingredients?: any;
  tags?: any;
}

interface Category {
  id: string;
  name: string;
  description?: string;
  sort_order: number;
}

interface Addon {
  id: string;
  name: string;
  description?: string;
  price: number;
  quantity: number;
}

interface CartItem extends Product {
  /** Identifica cada linha do carrinho (mesmo produto pode aparecer várias vezes com observações diferentes) */
  lineId: string;
  quantity: number;
  notes?: string;
  addons?: Addon[]; // adicionais selecionados
  /** Linha adicionada a partir da lista de combos (id = combos.id, não products.id) */
  isCombo?: boolean;
}

function createCartLineId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

type PublicMenuOrderItemRow = {
  order_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  notes: string | null;
  customizations: Record<string, unknown> | null;
};

/**
 * order_items.product_id referencia products. Combos no carrinho usam combos.id — expande em uma linha por combo_item.
 */
function buildOrderItemRowsForPublicMenu(
  cart: CartItem[],
  combos: any[],
  products: Product[],
  orderId: string
): PublicMenuOrderItemRow[] {
  const rows: PublicMenuOrderItemRow[] = [];

  for (const item of cart) {
    const addonsPrice =
      item.addons?.reduce((sum, addon) => sum + addon.price * addon.quantity, 0) || 0;
    const lineTotal = (item.price + addonsPrice) * item.quantity;

    const comboDef = combos.find((c: any) => c?.id === item.id);
    const cis = comboDef?.combo_items as { product_id: string; quantity: number }[] | undefined;

    if (item.isCombo && !comboDef) {
      throw new Error("COMBO_SEM_ITENS");
    }

    if (comboDef) {
      if (!cis?.length) {
        throw new Error("COMBO_SEM_ITENS");
      }
      const weights = cis.map((ci) => {
        const p = products.find((x) => x.id === ci.product_id);
        const base = p ? Number(p.price) * Number(ci.quantity) : 0;
        return base > 0 ? base : 1;
      });
      const sumW = weights.reduce((a, b) => a + b, 0) || cis.length;

      cis.forEach((ci, idx) => {
        const frac = (weights[idx] ?? 1) / sumW;
        const subtotal = lineTotal * frac;
        const qty = item.quantity * Number(ci.quantity);
        const unitPrice = qty > 0 ? subtotal / qty : 0;
        const noteBase = item.notes?.trim() || "";
        const comboNote = `Combo: ${item.name}`;
        const notesJoined = noteBase ? `${noteBase} · ${comboNote}` : comboNote;

        rows.push({
          order_id: orderId,
          product_id: ci.product_id,
          quantity: qty,
          unit_price: unitPrice,
          total_price: subtotal,
          notes: notesJoined,
          customizations:
            idx === 0 && item.addons && item.addons.length > 0
              ? { comboName: item.name, addons: item.addons }
              : null,
        });
      });
      continue;
    }

    rows.push({
      order_id: orderId,
      product_id: item.id,
      quantity: item.quantity,
      unit_price: item.price,
      total_price: lineTotal,
      notes: item.notes?.trim() || null,
      customizations:
        item.addons && item.addons.length > 0 ? { addons: item.addons } : null,
    });
  }

  return rows;
}

/** Aviso único permitido no fluxo quando o cliente envia pedido fora do horário (pré-pedido). */
const OUTSIDE_BUSINESS_HOURS_ORDER_NOTICE =
  "O estabelecimento vai receber seu pedido, mas não está em horário de funcionamento no momento. A preparação e a entrega provavelmente só ocorrerão após a abertura.";

function mapPublicMenuCheckoutError(raw: string): string {
  const lower = raw.toLowerCase();
  if (
    lower.includes("foreign key") ||
    lower.includes("order_items_product_id_fkey") ||
    lower.includes("violates foreign key constraint")
  ) {
    return "Um item do pedido não está mais disponível no cardápio. Atualize a página e monte o carrinho de novo.";
  }
  if (raw.includes("COMBO_SEM_ITENS")) {
    return "Este combo está incompleto no sistema. Escolha outro item ou avise o estabelecimento.";
  }
  if (lower.includes("permission denied") || raw.includes("42501")) {
    return "Não foi possível concluir o pedido. Atualize a página e tente novamente.";
  }
  if (lower.includes("row-level security") || lower.includes("rls")) {
    return "Não foi possível registrar o pedido. Atualize a página e tente de novo. Se continuar, avise o estabelecimento.";
  }
  const trimmed = raw.length > 160 ? `${raw.slice(0, 157)}…` : raw;
  return `Erro ao realizar pedido: ${trimmed}`;
}

interface Establishment {
  id: string;
  name: string;
  phone?: string;
  address?: string;
  slug: string;
  pix_key?: string | null;
  timezone?: string;
  allow_orders_when_closed?: boolean;
  show_schedule_on_menu?: boolean;
  menu_online_enabled?: boolean;
  settings?: {
    menuCustomization?: {
      primaryColor?: string;
      secondaryColor?: string;
      backgroundColor?: string;
      backgroundColorTransparent?: boolean;
      backgroundImage?: string;
      backgroundBlur?: number;
      cardOpacity?: number;
      headerStyle?: "default" | "gradient" | "solid";
      /** always | when_available (sem placeholder) | never */
      menuProductImagesMode?: "always" | "when_available" | "never";
    };
    delivery_fee?: number;
  };
}

const MenuPublic = () => {
  const { slug } = useParams<{ slug: string }>();
  const [loading, setLoading] = useState(true);
  const [establishment, setEstablishment] = useState<Establishment | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [addonsCategoryId, setAddonsCategoryId] = useState<string | null>(null);
  const [combos, setCombos] = useState<any[]>([]);
  const [promotions, setPromotions] = useState<any[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showCombosOnly, setShowCombosOnly] = useState(false);
  const [showCart, setShowCart] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [orderNumber, setOrderNumber] = useState<string>("");
  /** Pré-pedido enviado fora do horário — exibe aviso na tela de confirmação */
  const [orderSuccessOutsideHours, setOrderSuccessOutsideHours] = useState(false);
  const [showAddonsModal, setShowAddonsModal] = useState(false);
  const [pendingProduct, setPendingProduct] = useState<Product | null>(null);
  
  // Form fields
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [orderNotes, setOrderNotes] = useState("");
  const [orderType, setOrderType] = useState<"delivery" | "pickup">("delivery");
  const [paymentMethod, setPaymentMethod] = useState<"dinheiro" | "pix" | "cartao_credito" | "cartao_debito" | "">("");
  const [freeDeliveryPromotionId, setFreeDeliveryPromotionId] = useState<string | null>(null);
  /** Taxa base de entrega (config + motoboys via RPC) — usada só no checkout / total final */
  const [menuDeliveryBaseFee, setMenuDeliveryBaseFee] = useState(0);

  // Hook para verificar horário de funcionamento
  const { isOpen, nextOpenAt, nextCloseAt, loading: hoursLoading } = useBusinessHours(establishment?.id || null);
  const [hasBusinessHoursConfig, setHasBusinessHoursConfig] = useState(false);
  
  // Menu customization
  const menuCustomization = {
    primaryColor: "#3b82f6",
    secondaryColor: "#8b5cf6",
    backgroundColor: "#ffffff",
    backgroundColorTransparent: false,
    backgroundImage: "",
    backgroundBlur: 10,
    cardOpacity: 0.95,
    headerStyle: "default" as const,
    menuProductImagesMode: "always" as const,
    ...(establishment?.settings?.menuCustomization || {}),
  };

  const menuProductImagesMode =
    menuCustomization.menuProductImagesMode ?? "always";

  const productHasImage = (p: { image_url?: string | null }) =>
    !!(p.image_url && String(p.image_url).trim());

  const showProductImageStrip = (p: { image_url?: string | null }) => {
    if (menuProductImagesMode === "never") return false;
    if (menuProductImagesMode === "when_available") return productHasImage(p);
    return true;
  };

  // Atualizar título da página quando o estabelecimento mudar
  useEffect(() => {
    if (establishment?.name) {
      document.title = `Cardápio Online - ${establishment.name}`;
    } else {
      document.title = 'Cardápio Online';
    }
    
    // Cleanup: restaurar título padrão ao sair da página
    return () => {
      document.title = 'burguer.IA - Sistema de Gestão Completo Hamburguerias & Restaurantes';
    };
  }, [establishment?.name]);

  useEffect(() => {
    if (slug) {
      loadEstablishmentData();
    }
    
    // Carregar preferência de pagamento do localStorage
    const savedPayment = localStorage.getItem('preferred_payment_method');
    if (savedPayment && ['dinheiro', 'pix', 'cartao_credito', 'cartao_debito'].includes(savedPayment)) {
      setPaymentMethod(savedPayment as any);
    }
  }, [slug]);

  // Real-time subscriptions para atualizar produtos, categorias e combos automaticamente
  useEffect(() => {
    if (!establishment?.id) return;

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
        .eq("establishment_id", establishment.id)
        .eq("active", true)
          .or("is_combo.is.null,is_combo.eq.false")
        .order("sort_order");
        if (!error && data && isMounted) {
          setProducts(prev => {
            if (JSON.stringify(prev) === JSON.stringify(data)) {
              return prev;
            }
            return data;
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
        .eq("establishment_id", establishment.id)
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
        .eq("establishment_id", establishment.id)
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
        .eq("establishment_id", establishment.id)
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
      .channel(`menu-products-updates-${establishment.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'products',
          filter: `establishment_id=eq.${establishment.id}`
        },
        () => {
          throttleReload('products', reloadProducts, 1000);
        }
      )
      .subscribe();

    // Channel para categorias
    const categoriesChannel = supabase
      .channel(`menu-categories-updates-${establishment.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'categories',
          filter: `establishment_id=eq.${establishment.id}`
        },
        () => {
          throttleReload('categories', reloadCategories, 1000);
        }
      )
      .subscribe();

    // Channel para combos
    const combosChannel = supabase
      .channel(`menu-combos-updates-${establishment.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'combos',
          filter: `establishment_id=eq.${establishment.id}`
        },
        () => {
          throttleReload('combos', reloadCombos, 1000);
        }
      )
      .subscribe();

    // Channel para promoções
    const promotionsChannel = supabase
      .channel(`menu-promotions-updates-${establishment.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'promotions',
          filter: `establishment_id=eq.${establishment.id}`
        },
        () => {
          throttleReload('promotions', reloadPromotions, 1000);
        }
      )
      .subscribe();

    // Channel para promotion_products
    const promotionProductsChannel = supabase
      .channel(`menu-promotion-products-updates-${establishment.id}`)
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
  }, [establishment?.id]);
  
  // Salvar preferência de pagamento no localStorage
  useEffect(() => {
    if (paymentMethod) {
      localStorage.setItem('preferred_payment_method', paymentMethod);
    }
  }, [paymentMethod]);

  const loadEstablishmentData = async () => {
    try {
      setLoading(true);
      setMenuDeliveryBaseFee(0);

      // Load establishment by slug (tentar com campos novos, se falhar tenta sem eles)
      let { data: estabData, error: estabError } = await supabase
        .from("establishments")
        .select("id, name, phone, address, slug, pix_key, timezone, allow_orders_when_closed, show_schedule_on_menu, menu_online_enabled, settings")
        .eq("slug", slug)
        .single();

      // Se falhar por causa de colunas inexistentes, tentar sem elas
      if (estabError && estabError.message?.includes("does not exist")) {
        const { data: fallbackData, error: fallbackError } = await supabase
          .from("establishments")
          .select("id, name, phone, address, slug")
          .eq("slug", slug)
          .single();
        
        if (!fallbackError && fallbackData) {
          estabData = { 
            ...fallbackData, 
            pix_key: null, 
            timezone: null, 
            allow_orders_when_closed: false, 
            show_schedule_on_menu: false,
            menu_online_enabled: true
          } as any;
          estabError = null;
        } else {
          estabError = fallbackError;
        }
      }

      if (estabError || !estabData) {
        toast.error("Estabelecimento não encontrado");
        return;
      }

      // Verificar se o cardápio online está desativado
      if (estabData.menu_online_enabled === false) {
        setEstablishment(null);
        setLoading(false);
        return;
      }

      setEstablishment(estabData as any);

      const estabIdForFee = (estabData as any)?.id as string;
      let resolvedDeliveryFee = Number((estabData as any)?.settings?.delivery_fee) || 0;
      try {
        const { data: rpcFee, error: rpcFeeError } = await supabase.rpc(
          "get_online_menu_delivery_fee",
          { p_establishment_id: estabIdForFee }
        );
        if (!rpcFeeError && rpcFee != null && rpcFee !== "") {
          const n = Number(rpcFee);
          if (!Number.isNaN(n)) {
            resolvedDeliveryFee = n;
          }
        }
      } catch {
        // Migração ainda não aplicada ou RPC indisponível
      }
      setMenuDeliveryBaseFee(resolvedDeliveryFee);

      // Verificar se há horários de funcionamento configurados
      const { data: hoursData } = await supabase
        .from("establishment_hours")
        .select("id")
        .eq("estab_id", (estabData as any)?.id)
        .limit(1);
      
      setHasBusinessHoursConfig((hoursData && hoursData.length > 0) || false);

      // Load products, categories and combos
      const estabId = (estabData as any)?.id;
      if (!estabId) {
        toast.error("Erro ao identificar estabelecimento");
        return;
      }
      
      const [productsResult, categoriesResult, combosResult, promotionsResult] = await Promise.all([
        supabase
          .from("products")
          .select("*")
          .eq("establishment_id", estabId)
          .eq("active", true)
          .or("is_combo.is.null,is_combo.eq.false") // Excluir produtos que são combos
          .order("sort_order"),
        supabase
          .from("categories")
          .select("*")
          .eq("establishment_id", estabId)
          .eq("active", true)
          .order("sort_order"),
        supabase
          .from("combos")
          .select("*, combo_items(product_id, quantity)")
          .eq("establishment_id", estabId)
          .eq("active", true)
          .order("sort_order"),
        supabase
          .from("promotions")
          .select("*, promotion_products(product_id, fixed_price)")
          .eq("establishment_id", estabId)
          .eq("active", true)
      ]);

      if (productsResult.error) throw productsResult.error;
      if (categoriesResult.error) throw categoriesResult.error;
      if (combosResult.error) throw combosResult.error;
      if (promotionsResult.error) throw promotionsResult.error;

      setProducts(productsResult.data || []);
      setCategories(categoriesResult.data || []);
      setCombos(combosResult.data || []);
      setPromotions(promotionsResult.data || []);

      // Começar mostrando todos os produtos (null = todos)
      setSelectedCategory(null);
      setShowCombosOnly(false);
    } catch (error) {
      toast.error("Erro ao carregar cardápio");
    } finally {
      setLoading(false);
    }
  };

  // Verificar se produto tem adicionais
  const checkProductHasAddons = async (product: Product): Promise<boolean> => {
    if (!establishment?.id || !product.id) return false;
    
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

  // Funções para aplicar promoções
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

  const addToCart = async (product: Product, selectedAddons?: Addon[]) => {
    try {
      // Aplicar promoção se houver
      const productWithPromotion = applyPromotionIfAny(product);
      
      // Se adicionais foram passados, adicionar com eles
      if (selectedAddons !== undefined) {
        const cartItem: CartItem = {
          ...productWithPromotion,
          lineId: createCartLineId(),
          quantity: 1,
          addons: selectedAddons.length > 0 ? selectedAddons : undefined,
        };
        
        setCart([...cart, cartItem]);
        toast.success(`${productWithPromotion.name} adicionado ao carrinho`);
        return;
      }

      // Verificar se produto tem adicionais antes de adicionar
      const hasAddons = await checkProductHasAddons(product);
      
      if (hasAddons) {
        // Abrir modal de adicionais
        setPendingProduct(productWithPromotion);
        setShowAddonsModal(true);
      } else {
        // Adicionar diretamente ao carrinho
        const existingItem = cart.find(item => 
          item.id === productWithPromotion.id && 
          !item.notes && 
          (!item.addons || item.addons.length === 0)
        );
        
        if (existingItem) {
          setCart(cart.map(item =>
            item.id === productWithPromotion.id && !item.notes && (!item.addons || item.addons.length === 0)
              ? { ...item, quantity: item.quantity + 1 }
              : item
          ));
        } else {
          setCart([
            ...cart,
            { ...productWithPromotion, lineId: createCartLineId(), quantity: 1 },
          ]);
        }
        toast.success(`${productWithPromotion.name} adicionado ao carrinho`);
      }
    } catch (error) {
      toast.error('Erro ao adicionar produto. Por favor, tente novamente.');
    }
  };

  const handleAddonsConfirm = (selectedAddons: Addon[]) => {
    if (!pendingProduct) return;
    
    const cartItem: CartItem = {
      ...pendingProduct,
      lineId: createCartLineId(),
      quantity: 1,
      addons: selectedAddons.length > 0 ? selectedAddons : undefined,
    };
    
    setCart([...cart, cartItem]);
    toast.success(`${pendingProduct.name} adicionado ao carrinho`);
    setPendingProduct(null);
    setShowAddonsModal(false);
  };

  const updateQuantity = (lineId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(lineId);
      return;
    }
    setCart(cart.map((item) =>
      item.lineId === lineId ? { ...item, quantity } : item
    ));
  };

  const removeFromCart = (lineId: string) => {
    setCart(cart.filter((item) => item.lineId !== lineId));
  };

  const updateItemNotes = (lineId: string, notes: string) => {
    setCart(cart.map((item) =>
      item.lineId === lineId
        ? { ...item, notes: notes.length > 0 ? notes : undefined }
        : item
    ));
  };

  const getProductsByCategory = () => {
    // Combinar produtos e combos
    const combosMapped = combos
      .filter((combo: any) => combo && combo.id && combo.name) // Filtrar combos inválidos
      .map((combo: any) => ({
        id: combo.id,
        name: combo.name || 'Combo sem nome',
        description: combo.description || '',
        price: Number(combo.price) || 0,
        image_url: combo.image_url || null,
        category_id: combo.category_id || null,
        ingredients: combo.ingredients || null,
        tags: combo.tags || null,
        isCombo: true, // Flag para identificar combos
      }));

    // Filtrar produtos válidos também (excluindo produtos que são combos e adicionais)
    const validProducts = products
      .filter((p: any) => p && p.id && p.name && !p.is_combo && !(addonsCategoryId && p.category_id === addonsCategoryId)) // Excluir produtos marcados como combos e adicionais
      .map((p: any) => ({
        ...p,
        price: Number(p.price) || 0,
        isCombo: false,
      }));

    const allItems = [
      ...validProducts,
      ...combosMapped
    ];
    
    // Se está mostrando apenas combos
    if (showCombosOnly) {
      return allItems.filter((p: any) => p && p.isCombo === true);
    }
    
    if (!selectedCategory) {
      return allItems; // Se não há categoria selecionada, mostra todos
    }
    
    return allItems.filter((p: any) => p && (p.category_id === selectedCategory || (!p.category_id && selectedCategory === 'all')));
  };

  // Função para obter ícone da categoria
  const getCategoryIcon = (categoryName: string): string => {
    const name = categoryName.toLowerCase();
    if (name.includes('hamburguer') || name.includes('hambúrguer') || name.includes('burger') || name.includes('lanche')) {
      return '🍔';
    }
    if (name.includes('bebida') || name.includes('refri') || name.includes('drink') || name.includes('suco') || name.includes('refrigerante')) {
      return '🥤';
    }
    if (name.includes('batata') || name.includes('frita') || name.includes('acompanhamento') || name.includes('side')) {
      return '🍟';
    }
    if (name.includes('pizza')) {
      return '🍕';
    }
    if (name.includes('sobremesa') || name.includes('doce') || name.includes('doces')) {
      return '🍰';
    }
    if (name.includes('salada')) {
      return '🥗';
    }
    if (name.includes('petisco') || name.includes('aperitivo')) {
      return '🍴';
    }
    // Ícone padrão
    return '🍽️';
  };

  const cartTotal = cart.reduce((sum, item) => {
    const itemPrice = item.price * item.quantity;
    const addonsPrice = item.addons?.reduce((addonSum, addon) => 
      addonSum + (addon.price * addon.quantity), 0) || 0;
    return sum + itemPrice + (addonsPrice * item.quantity);
  }, 0);
  const cartItemsCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  
  // Taxa de entrega só entra no total na etapa "Finalizar pedido" (entrega vs retirada)
  const baseDeliveryFee =
    orderType === "delivery" ? (Number(menuDeliveryBaseFee) || 0) : 0;
  const deliveryFee =
    orderType === "delivery" && freeDeliveryPromotionId ? 0 : baseDeliveryFee;
  const finalTotal = cartTotal + deliveryFee;

  const handleCheckout = async () => {
    if (!establishment || cart.length === 0) return;

    if (!customerName.trim()) {
      toast.error("Por favor, informe seu nome");
      return;
    }

    if (!customerPhone.trim()) {
      toast.error("Por favor, informe seu telefone");
      return;
    }

    if (orderType === "delivery" && !customerAddress.trim()) {
      toast.error("Por favor, informe o endereço de entrega");
      return;
    }

    if (!paymentMethod) {
      toast.error("Por favor, selecione a forma de pagamento");
      return;
    }

    // Verificar se está aberto ou se permite pré-pedidos
    if (!isOpen && !establishment?.allow_orders_when_closed) {
      toast.error("Estamos fechados agora. Tente novamente quando estivermos abertos.");
      return;
    }

    // Se está fechado mas permite pré-pedidos, será marcado como queued
    const isQueued = !isOpen && establishment?.allow_orders_when_closed;
    const releaseAt = isQueued && nextOpenAt ? nextOpenAt.toISOString() : null;

    try {
      // Número provisório: o # sequencial do caixa é atribuído na loja ao aceitar o pedido (com caixa aberto).
      const finalOrderNumber = `ONLINE-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

      // Prepare notes with address if delivery
      let finalNotes = orderNotes.trim() || "";
      if (orderType === "delivery" && customerAddress.trim()) {
        if (finalNotes) {
          finalNotes = `Endereço: ${customerAddress.trim()}\n${finalNotes}`;
        } else {
          finalNotes = `Endereço: ${customerAddress.trim()}`;
        }
      }

      // Normalizar telefone para E.164
      const normalizedPhone = normalizePhoneBRToE164(customerPhone);

      // Create order
      const { data: newOrder, error: orderError } = await supabase
        .from("orders")
        .insert({
          establishment_id: establishment.id,
          order_number: finalOrderNumber,
          customer_name: customerName.trim(),
          customer_phone: normalizedPhone,
          order_type: orderType,
          delivery_type: orderType, // Salvar também em delivery_type
          subtotal: cartTotal,
          delivery_fee: deliveryFee,
          total_amount: finalTotal,
          status: "pending",
          payment_status: "paid", // Pagamento já é considerado efetuado ao finalizar venda
          payment_method: paymentMethod,
          notes: finalNotes || null,
          channel: "online",
          origin: "cardapio_online",
          source_domain: window.location.hostname,
          queued_until_next_open: isQueued,
          release_at: releaseAt,
          free_delivery_promotion_id:
            orderType === "delivery" ? freeDeliveryPromotionId || null : null,
        })
        .select()
        .single();

      if (orderError) {
        throw orderError;
      }

      // Registrar uso da promoção de frete grátis se aplicável
      if (freeDeliveryPromotionId && newOrder?.id) {
        await registerFreeDeliveryUsage(newOrder.id, freeDeliveryPromotionId);
      }

      const orderItems = buildOrderItemRowsForPublicMenu(
        cart,
        combos,
        products,
        newOrder.id
      );

      const { error: itemsError } = await supabase.from("order_items").insert(orderItems);

      if (itemsError) {
        throw itemsError;
      }

      // Abater estoque de ingredientes automaticamente
      try {
        const { data: stockResult, error: stockError } = await supabase.rpc(
          'apply_stock_deduction_for_order',
          {
            p_establishment_id: establishment.id,
            p_order_id: newOrder.id
          }
        );

        if (stockError) {
          // Erro ao abater estoque mas não interrompe o pedido
        } else if (stockResult && !stockResult.success) {
          // Avisos no abatimento de estoque mas não bloqueia o pedido
        }
      } catch (stockErr) {
        // Não bloquear o pedido se houver erro no estoque
      }

      // Success
      setOrderNumber(finalOrderNumber);
      setOrderSuccessOutsideHours(isQueued);
      setOrderSuccess(true);
      setCart([]);
      setShowCheckout(false);
      setShowCart(false);
      setCustomerName("");
      setCustomerPhone("");
      setCustomerAddress("");
      setOrderNotes("");

      if (isQueued) {
        toast.success("Pré-pedido enviado com sucesso!", {
          description: OUTSIDE_BUSINESS_HOURS_ORDER_NOTICE,
          duration: 10000,
        });
      } else {
        toast.success("Pedido realizado com sucesso!");
      }
    } catch (error: any) {
      // Extrair mensagem de erro mais detalhada
      let errorMessage = "Erro desconhecido ao realizar pedido";
      
      if (error?.message) {
        errorMessage = error.message;
      } else if (error?.error?.message) {
        errorMessage = error.error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }
      
      toast.error(mapPublicMenuCheckoutError(errorMessage));
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Carregando cardápio...</p>
        </div>
      </div>
    );
  }

  if (!establishment) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-bold mb-4">Cardápio Indisponível</h1>
          <p className="text-muted-foreground">
            O cardápio online deste estabelecimento está temporariamente indisponível.
          </p>
        </div>
      </div>
    );
  }

  if (orderSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mb-4">
                <CheckCircle2 className="h-10 w-10 text-green-600 dark:text-green-400" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Pedido Realizado!</h2>
              <p className="text-muted-foreground mb-4">
                Seu pedido foi recebido com sucesso.
              </p>
              {orderSuccessOutsideHours && (
                <p
                  className="text-sm text-left rounded-lg border border-sky-500/40 bg-sky-500/10 dark:bg-sky-950/35 text-sky-950 dark:text-sky-100 p-3 mb-4 leading-snug"
                  role="status"
                >
                  {OUTSIDE_BUSINESS_HOURS_ORDER_NOTICE}
                </p>
              )}
              <div className="bg-muted p-4 rounded-lg mb-4">
                <p className="text-sm text-muted-foreground mb-1">Número do pedido</p>
                <p className="text-xl font-bold">{orderNumber}</p>
              </div>
              <p className="text-sm text-muted-foreground mb-6">
                Você receberá uma confirmação em breve.
              </p>
              <Button
                onClick={() => {
                  setOrderSuccess(false);
                  setOrderNumber("");
                  setOrderSuccessOutsideHours(false);
                }}
                className="w-full"
              >
                Fazer Novo Pedido
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Get header style class
  const getHeaderStyle = () => {
    if (menuCustomization.headerStyle === "gradient") {
      return {
        background: `linear-gradient(135deg, ${menuCustomization.primaryColor} 0%, ${menuCustomization.secondaryColor} 100%)`,
        color: "#ffffff",
      };
    } else if (menuCustomization.headerStyle === "solid") {
      return {
        background: menuCustomization.primaryColor,
        color: "#ffffff",
      };
    }
    return {};
  };

  return (
    <div 
      className="min-h-screen relative"
      style={{
        backgroundColor: menuCustomization.backgroundImage && menuCustomization.backgroundColorTransparent
          ? "transparent"
          : menuCustomization.backgroundColor,
        backgroundImage: menuCustomization.backgroundImage 
          ? `url(${menuCustomization.backgroundImage})` 
          : undefined,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "fixed",
      }}
    >
      {/* Background overlay with blur */}
      {menuCustomization.backgroundImage && (
        <div 
          className="fixed inset-0 z-0"
          style={{
            backdropFilter: `blur(${menuCustomization.backgroundBlur}px)`,
            WebkitBackdropFilter: `blur(${menuCustomization.backgroundBlur}px)`,
            backgroundColor: menuCustomization.backgroundColorTransparent
              ? "transparent"
              : `${menuCustomization.backgroundColor}80`,
          }}
        />
      )}
      
      <div className="relative z-10">
      {/* Header */}
      <header 
        className="sticky top-0 z-50 w-full border-b backdrop-blur supports-[backdrop-filter]:bg-background/60 pt-[max(0.75rem,env(safe-area-inset-top))]"
        style={getHeaderStyle()}
      >
        <div className="container max-w-screen-lg mx-auto px-3 sm:px-4 py-3 sm:py-4">
          <div className="flex flex-wrap items-start sm:items-center justify-between gap-3">
            <div className="min-w-0 flex-1 pr-2">
              <h1 className="text-xl sm:text-2xl font-bold leading-tight break-words">{establishment.name}</h1>
              {establishment.phone && (
                <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                  <Phone className="h-3 w-3" />
                  {establishment.phone}
                </p>
              )}
            </div>
            <Button
              onClick={() => setShowCart(true)}
              className="relative shrink-0 min-h-[44px] touch-manipulation"
              size="lg"
              style={{
                backgroundColor: menuCustomization.headerStyle === "default" 
                  ? menuCustomization.primaryColor 
                  : menuCustomization.headerStyle === "gradient" 
                    ? "rgba(255,255,255,0.2)" 
                    : "rgba(255,255,255,0.2)",
                color: menuCustomization.headerStyle === "default" ? "#ffffff" : "#ffffff",
              }}
            >
              <ShoppingCart className="h-5 w-5 mr-2" />
              Carrinho
              {cartItemsCount > 0 && (
                <Badge className="ml-2" style={{ backgroundColor: menuCustomization.secondaryColor }}>
                  {cartItemsCount}
                </Badge>
              )}
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container max-w-screen-lg mx-auto px-3 sm:px-4 py-4 sm:py-8 pb-24 relative z-10">
        {/* Banner de Status do Estabelecimento - só mostrar se houver horário configurado */}
        {!hoursLoading && establishment && hasBusinessHoursConfig && (
          <div className={`mb-6 p-4 rounded-lg border flex items-center gap-3 ${
            isOpen 
              ? "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800" 
              : "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800"
          }`}>
            <Circle className={`h-5 w-5 flex-shrink-0 ${
              isOpen ? "text-green-600 dark:text-green-500 fill-green-600 dark:fill-green-500" : "text-red-600 dark:text-red-500 fill-red-600 dark:fill-red-500"
            }`} />
            <div className="flex-1">
              {isOpen ? (
                <>
                  <p className="font-medium text-green-900 dark:text-green-100">
                    Aberto agora
                    {nextCloseAt && `, fecha às ${formatTime(nextCloseAt, establishment.timezone || "America/Sao_Paulo")}`}
                  </p>
                </>
              ) : (
                <>
                  <p className="font-medium text-red-900 dark:text-red-100">
                    Fechado agora
                  </p>
                  {nextOpenAt && (
                    <p className="text-sm text-red-800 dark:text-red-200">
                      Próxima abertura: {formatDateTime(nextOpenAt, establishment.timezone || "America/Sao_Paulo")}
                    </p>
                  )}
                  {establishment.allow_orders_when_closed && (
                    <p className="text-sm text-red-800 dark:text-red-200 mt-1 leading-snug">
                      {OUTSIDE_BUSINESS_HOURS_ORDER_NOTICE}
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* Categories */}
        {(categories.length > 0 || combos.length > 0) && (
          <div className="mb-6 overflow-x-auto">
            <div className="flex gap-2 pb-2">
              <Button
                variant={selectedCategory === null && !showCombosOnly ? "default" : "outline"}
                onClick={() => {
                  setSelectedCategory(null);
                  setShowCombosOnly(false);
                }}
                className="whitespace-nowrap"
                style={selectedCategory === null && !showCombosOnly ? {
                  backgroundColor: menuCustomization.primaryColor,
                  color: "#ffffff",
                  borderColor: menuCustomization.primaryColor,
                } : {}}
              >
                <UtensilsCrossed className="h-4 w-4 mr-1" />
                Todos
              </Button>
              {combos.length > 0 && (
                <Button
                  variant={showCombosOnly ? "default" : "outline"}
                  onClick={() => {
                    setShowCombosOnly(true);
                    setSelectedCategory(null);
                  }}
                  className="whitespace-nowrap"
                  style={showCombosOnly ? {
                    backgroundColor: menuCustomization.primaryColor,
                    color: "#ffffff",
                    borderColor: menuCustomization.primaryColor,
                  } : {}}
                >
                  🍔 Combos
                </Button>
              )}
              {categories
                .filter(category => {
                  // Filtrar categoria "Adicionais" e "Combos" (case-insensitive)
                  const categoryName = category.name.toLowerCase().trim();
                  return !categoryName.includes('adicional') && 
                         !categoryName.includes('adicionais') &&
                         !categoryName.includes('combo') &&
                         !categoryName.includes('combos');
                })
                .map(category => (
                <Button
                  key={category.id}
                  variant={selectedCategory === category.id ? "default" : "outline"}
                  onClick={() => {
                    setSelectedCategory(category.id);
                    setShowCombosOnly(false);
                  }}
                  className="whitespace-nowrap"
                  style={selectedCategory === category.id ? {
                    backgroundColor: menuCustomization.primaryColor,
                    color: "#ffffff",
                    borderColor: menuCustomization.primaryColor,
                  } : {}}
                >
                  <span className="mr-1">{getCategoryIcon(category.name)}</span>
                  {category.name}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Products Grid */}
        {(() => {
          const items = getProductsByCategory();
          
          if (items.length === 0) {
            return (
              <div className="text-center py-12">
                <p className="text-muted-foreground">Nenhum produto encontrado nesta categoria.</p>
              </div>
            );
          }
          
          return (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
              {items.map((product: any, index: number) => {
            if (!product || !product.id || !product.name) {
              return null;
            }
            
            // Garantir que price é um número válido
            if (!product.price || isNaN(Number(product.price))) {
              return null;
            }
            
            return (
            <Card 
              key={product.id} 
              className="overflow-hidden hover:shadow-lg transition-shadow flex flex-col h-full"
              style={{
                backgroundColor: `${menuCustomization.backgroundColor}${Math.round(menuCustomization.cardOpacity * 255).toString(16).padStart(2, '0')}`,
                backdropFilter: "blur(10px)",
              }}
            >
              {showProductImageStrip(product) && (
                <div className="aspect-video w-full overflow-hidden bg-muted flex-shrink-0">
                  {productHasImage(product) ? (
                    <img
                      src={normalizeImageUrl(product.image_url!) || product.image_url!}
                      alt={product.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-muted/50">
                      <Package className="h-12 w-12 text-muted-foreground/30" />
                    </div>
                  )}
                </div>
              )}
              <CardContent className="p-4 flex flex-col flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="font-semibold text-lg">{product.name}</h3>
                  {product.isCombo && (
                    <Badge variant="secondary" className="text-xs" style={{ backgroundColor: menuCustomization.secondaryColor, color: "#ffffff" }}>
                      Combo
                    </Badge>
                  )}
                </div>
                {(() => {
                  const applied = getAppliedPromotionForProduct(product);
                  return applied ? (
                    <div className="text-xs text-green-700 dark:text-green-300 font-medium mb-2">Promoção: {applied.promotionName}</div>
                  ) : null;
                })()}
                {product.description && (
                  <p className="text-sm text-muted-foreground mb-3 line-clamp-2 flex-shrink-0">
                    {product.description}
                  </p>
                )}
                <div className="flex items-center justify-between mt-auto">
                  <span className="text-xl font-bold" style={{ color: menuCustomization.primaryColor }}>
                    {(() => {
                      const applied = getAppliedPromotionForProduct(product);
                      if (applied) {
                        return (
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-primary text-lg">R$ {applied.price.toFixed(2)}</span>
                            <span className="text-sm line-through text-muted-foreground">R$ {product.price.toFixed(2)}</span>
                          </div>
                        );
                      }
                      return (
                        <span className="font-bold text-primary text-lg">R$ {Number(product.price).toFixed(2)}</span>
                      );
                    })()}
                  </span>
                  <Button
                    size="sm"
                    onClick={() => addToCart(product)}
                    style={{ backgroundColor: menuCustomization.primaryColor, color: "#ffffff" }}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Adicionar
                  </Button>
                </div>
              </CardContent>
            </Card>
            );
          })}
            </div>
          );
        })()}
      </main>

      {/* Cart Dialog */}
      <Dialog open={showCart} onOpenChange={setShowCart}>
        <DialogContent
          className={
            "w-[calc(100vw-0.75rem)] max-w-lg sm:max-w-2xl gap-0 p-0 " +
            "max-h-[min(92dvh,calc(100vh-0.5rem))] h-auto flex flex-col overflow-hidden " +
            "rounded-2xl sm:rounded-xl left-1/2 top-[50%] -translate-x-1/2 -translate-y-1/2 " +
            "pb-[max(1rem,env(safe-area-inset-bottom))]"
          }
        >
          {/* Header — sem overflow:hidden para não cortar a descrição */}
          <DialogHeader
            className="shrink-0 px-4 sm:px-6 pt-5 sm:pt-6 pb-3 text-left space-y-2 pr-12"
            style={{
              background: `linear-gradient(135deg, ${menuCustomization.primaryColor}15 0%, ${menuCustomization.secondaryColor}15 100%)`,
            }}
          >
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 shrink-0" style={{ color: menuCustomization.primaryColor }} />
              <DialogTitle className="text-xl sm:text-2xl font-bold leading-snug tracking-tight">
                Seu Carrinho
              </DialogTitle>
            </div>
            <DialogDescription className="text-sm sm:text-base text-muted-foreground leading-snug break-words whitespace-normal !mt-0">
              {cart.length === 0
                ? "Seu carrinho está esperando por delícias! 🛒"
                : `${cartItemsCount} ${cartItemsCount === 1 ? "item delicioso" : "itens deliciosos"} no seu carrinho`}
            </DialogDescription>
          </DialogHeader>

          <div className="flex min-h-0 flex-1 flex-col px-4 sm:px-6 py-3">
            {cart.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">🛒</div>
                <p className="text-lg font-medium text-muted-foreground mb-2">
                  Seu carrinho está vazio
                </p>
                <p className="text-sm text-muted-foreground mb-6">
                  Que tal adicionar alguns itens deliciosos?
                </p>
                <Button 
                  onClick={() => setShowCart(false)} 
                  size="lg"
                  style={{ backgroundColor: menuCustomization.primaryColor, color: "#ffffff" }}
                  className="px-8"
                >
                  Continuar Comprando
                </Button>
              </div>
            ) : (
              <div className="space-y-3 overflow-y-auto overflow-x-hidden min-h-0 flex-1 overscroll-y-contain touch-pan-y pr-1 sm:pr-2">
                {cart.map((item) => {
                  const itemAddonsPrice = item.addons?.reduce((sum, addon) => sum + (addon.price * addon.quantity), 0) || 0;
                  const itemTotalPrice = (item.price + itemAddonsPrice) * item.quantity;
                  
                  return (
                    <div 
                      key={item.lineId} 
                      className="p-4 border-2 rounded-xl transition-all hover:shadow-md"
                      style={{ 
                        borderColor: `${menuCustomization.primaryColor}30`,
                        backgroundColor: `${menuCustomization.primaryColor}05`
                      }}
                    >
                      <div className="flex items-start gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div>
                              <p className="font-semibold text-base">{item.name}</p>
                              {item.addons && item.addons.length > 0 && (
                                <div className="mt-2 space-y-1">
                                  {item.addons.map((addon) => (
                                    <p 
                                      key={addon.id} 
                                      className="text-xs pl-2 border-l-2"
                                      style={{ 
                                        borderColor: `${menuCustomization.primaryColor}40`,
                                        color: menuCustomization.primaryColor
                                      }}
                                    >
                                      + {addon.quantity}x {addon.name}
                                    </p>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p 
                                className="text-lg font-bold"
                                style={{ color: menuCustomization.primaryColor }}
                              >
                                R$ {itemTotalPrice.toFixed(2)}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                R$ {(item.price + itemAddonsPrice).toFixed(2)} cada
                              </p>
                            </div>
                          </div>

                          <div className="mt-3 space-y-1.5">
                            <Label htmlFor={`item-notes-${item.lineId}`} className="text-xs font-medium text-muted-foreground">
                              Observações deste item (opcional)
                            </Label>
                            <Textarea
                              id={`item-notes-${item.lineId}`}
                              value={item.notes ?? ""}
                              onChange={(e) => updateItemNotes(item.lineId, e.target.value)}
                              placeholder="Ex.: sem alface, molho à parte, ponto bem passado…"
                              rows={2}
                              className="text-sm resize-none min-h-[60px]"
                            />
                          </div>
                          
                          <div className="flex items-center gap-2 mt-3">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateQuantity(item.lineId, item.quantity - 1)}
                              className="h-8 w-8 p-0 rounded-full"
                              style={{ borderColor: menuCustomization.primaryColor }}
                            >
                              <Minus className="h-4 w-4" style={{ color: menuCustomization.primaryColor }} />
                            </Button>
                            <span 
                              className="w-10 text-center font-bold text-base"
                              style={{ color: menuCustomization.primaryColor }}
                            >
                              {item.quantity}
                            </span>
                            <Button
                              size="sm"
                              onClick={() => updateQuantity(item.lineId, item.quantity + 1)}
                              className="h-8 w-8 p-0 rounded-full"
                              style={{ backgroundColor: menuCustomization.primaryColor, color: "#ffffff" }}
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => removeFromCart(item.lineId)}
                              className="ml-auto text-muted-foreground hover:text-destructive"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {cart.length > 0 && (
            <div
              className="shrink-0 px-4 sm:px-6 pt-3 pb-4 sm:pb-5 border-t space-y-3"
              style={{ borderColor: `${menuCustomization.primaryColor}20` }}
            >
              <div
                className="p-3 sm:p-4 rounded-xl"
                style={{ backgroundColor: `${menuCustomization.primaryColor}10` }}
              >
                <div className="flex justify-between items-baseline gap-3 mb-1">
                  <span className="font-semibold text-base sm:text-lg leading-tight">
                    Subtotal dos itens
                  </span>
                  <span
                    className="text-xl sm:text-2xl font-bold tabular-nums shrink-0"
                    style={{ color: menuCustomization.primaryColor }}
                  >
                    R$ {cartTotal.toFixed(2).replace(".", ",")}
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground leading-snug">
                  Taxa de entrega e total final aparecem na próxima etapa, ao escolher entrega ou retirada no local.
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  {cartItemsCount} {cartItemsCount === 1 ? "item" : "itens"} no carrinho
                </p>
              </div>

              <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3">
                <Button
                  variant="outline"
                  onClick={() => setShowCart(false)}
                  size="lg"
                  className="flex-1 min-h-[48px] touch-manipulation w-full sm:w-auto"
                >
                  Continuar Comprando
                </Button>
                <Button
                  onClick={() => {
                    setShowCart(false);
                    setShowCheckout(true);
                  }}
                  size="lg"
                  className="flex-1 min-h-[48px] touch-manipulation w-full sm:w-auto font-semibold shadow-lg hover:shadow-xl transition-shadow"
                  style={{
                    backgroundColor: menuCustomization.primaryColor,
                    color: "#ffffff",
                  }}
                >
                  <Package className="h-4 w-4 mr-2 shrink-0" />
                  Finalizar Pedido
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Checkout Dialog */}
      <Dialog open={showCheckout} onOpenChange={setShowCheckout}>
        <DialogContent
          className={
            "w-[calc(100vw-0.75rem)] max-w-lg sm:max-w-2xl gap-0 p-0 " +
            "max-h-[min(92dvh,calc(100vh-0.5rem))] flex flex-col overflow-hidden " +
            "rounded-2xl sm:rounded-xl pb-[max(1rem,env(safe-area-inset-bottom))]"
          }
        >
          <DialogHeader
            className="shrink-0 px-4 sm:px-6 pt-5 sm:pt-6 pb-3 text-left space-y-2 pr-12"
            style={{
              background: `linear-gradient(135deg, ${menuCustomization.primaryColor}15 0%, ${menuCustomization.secondaryColor}15 100%)`,
            }}
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 shrink-0" style={{ color: menuCustomization.primaryColor }} />
              <DialogTitle className="text-xl sm:text-2xl font-bold leading-snug tracking-tight">
                Finalizar Pedido
              </DialogTitle>
            </div>
            <DialogDescription className="text-sm sm:text-base text-muted-foreground leading-snug break-words whitespace-normal !mt-0">
              Preencha seus dados, escolha entrega ou retirada e confira o total com a taxa quando for o caso.
            </DialogDescription>
          </DialogHeader>

          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain px-4 sm:px-6 py-4">
            <div className="space-y-4">
            {!hoursLoading && !isOpen && establishment?.allow_orders_when_closed && (
              <div
                className="flex gap-3 rounded-lg border border-sky-500/45 bg-sky-500/10 dark:bg-sky-950/35 p-3 text-sm text-sky-950 dark:text-sky-100"
                role="status"
              >
                <Info className="h-5 w-5 shrink-0 text-sky-600 dark:text-sky-400" aria-hidden />
                <p className="leading-snug">{OUTSIDE_BUSINESS_HOURS_ORDER_NOTICE}</p>
              </div>
            )}
            <div>
              <Label htmlFor="customerName">Nome *</Label>
              <Input
                id="customerName"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Seu nome completo"
              />
            </div>

            <div>
              <Label htmlFor="customerPhone">Telefone *</Label>
              <Input
                id="customerPhone"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(phoneMask(e.target.value))}
                placeholder="(00) 00000-0000"
                maxLength={15}
              />
            </div>

            <div>
              <Label className="text-base font-medium">Tipo de Pedido *</Label>
              <div className="flex flex-col min-[380px]:flex-row gap-2 sm:gap-3 mt-2">
                <Button
                  type="button"
                  variant={orderType === "delivery" ? "default" : "outline"}
                  onClick={async () => {
                    setOrderType("delivery");
                    // Verificar se há promoção de frete grátis ativa
                    if (establishment?.id) {
                      const promotionId = await checkFreeDeliveryPromotion(establishment.id);
                      setFreeDeliveryPromotionId(promotionId);
                      if (promotionId) {
                        toast.success("Frete grátis aplicado!");
                      }
                    }
                  }}
                  className="flex-1 min-h-[48px] touch-manipulation justify-center"
                  style={orderType === "delivery" ? {
                    backgroundColor: menuCustomization.primaryColor,
                    color: "#ffffff"
                  } : {}}
                >
                  <MapPin className="h-4 w-4 mr-2 shrink-0" />
                  Entrega
                </Button>
                <Button
                  type="button"
                  variant={orderType === "pickup" ? "default" : "outline"}
                  onClick={() => {
                    setOrderType("pickup");
                    setFreeDeliveryPromotionId(null);
                  }}
                  className="flex-1 min-h-[48px] touch-manipulation justify-center"
                  style={orderType === "pickup" ? {
                    backgroundColor: menuCustomization.primaryColor,
                    color: "#ffffff"
                  } : {}}
                >
                  <Clock className="h-4 w-4 mr-2 shrink-0" />
                  Retirada
                </Button>
              </div>
            </div>

            {orderType === "delivery" && (
              <div>
                <Label htmlFor="customerAddress">Endereço de Entrega *</Label>
                <Textarea
                  id="customerAddress"
                  value={customerAddress}
                  onChange={(e) => setCustomerAddress(e.target.value)}
                  placeholder="Rua, número, bairro, complemento"
                  rows={3}
                />
              </div>
            )}

            <div>
              <Label className="text-base font-medium">Forma de Pagamento *</Label>
              <div className="grid grid-cols-2 gap-2 sm:gap-3 mt-2">
                <Button
                  type="button"
                  variant={paymentMethod === "dinheiro" ? "default" : "outline"}
                  onClick={() => setPaymentMethod("dinheiro")}
                  className="flex items-center justify-center gap-2 min-h-[48px] touch-manipulation text-sm sm:text-base px-2"
                  style={paymentMethod === "dinheiro" ? {
                    backgroundColor: menuCustomization.primaryColor,
                    color: "#ffffff"
                  } : {}}
                >
                  <Wallet className="h-4 w-4" />
                  Dinheiro
                </Button>
                <Button
                  type="button"
                  variant={paymentMethod === "pix" ? "default" : "outline"}
                  onClick={() => setPaymentMethod("pix")}
                  className="flex items-center justify-center gap-2 min-h-[48px] touch-manipulation text-sm sm:text-base px-2"
                  style={paymentMethod === "pix" ? {
                    backgroundColor: menuCustomization.primaryColor,
                    color: "#ffffff"
                  } : {}}
                >
                  <CreditCard className="h-4 w-4" />
                  PIX
                </Button>
                <Button
                  type="button"
                  variant={paymentMethod === "cartao_debito" ? "default" : "outline"}
                  onClick={() => setPaymentMethod("cartao_debito")}
                  className="flex items-center justify-center gap-2 min-h-[48px] touch-manipulation text-sm sm:text-base px-2"
                  style={paymentMethod === "cartao_debito" ? {
                    backgroundColor: menuCustomization.primaryColor,
                    color: "#ffffff"
                  } : {}}
                >
                  <CreditCard className="h-4 w-4" />
                  Débito
                </Button>
                <Button
                  type="button"
                  variant={paymentMethod === "cartao_credito" ? "default" : "outline"}
                  onClick={() => setPaymentMethod("cartao_credito")}
                  className="flex items-center justify-center gap-2 min-h-[48px] touch-manipulation text-sm sm:text-base px-2"
                  style={paymentMethod === "cartao_credito" ? {
                    backgroundColor: menuCustomization.primaryColor,
                    color: "#ffffff"
                  } : {}}
                >
                  <CreditCard className="h-4 w-4" />
                  Crédito
                </Button>
              </div>
            </div>

            <div>
              <Label htmlFor="orderNotes">Observações gerais do pedido (opcional)</Label>
              <Textarea
                id="orderNotes"
                value={orderNotes}
                onChange={(e) => setOrderNotes(e.target.value)}
                placeholder="Ex.: campainha quebrada, entregar na portaria…"
                rows={3}
              />
            </div>

            <div
              className="rounded-lg border p-3 space-y-2"
              style={{ borderColor: `${menuCustomization.primaryColor}25` }}
            >
              <p className="text-sm font-semibold">Itens e observações por produto</p>
              <ul className="text-sm space-y-2 max-h-44 overflow-y-auto pr-1">
                {cart.map((item) => (
                  <li
                    key={item.lineId}
                    className="border-b border-muted/50 pb-2 last:border-0 last:pb-0"
                  >
                    <span className="font-medium">
                      {item.quantity}× {item.name}
                    </span>
                    {item.notes && (
                      <p
                        className="text-xs text-muted-foreground mt-1 pl-2 border-l-2"
                        style={{ borderColor: menuCustomization.primaryColor }}
                      >
                        {item.notes}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            <div 
              className="border-t pt-4 mt-4"
              style={{ borderColor: `${menuCustomization.primaryColor}20` }}
            >
              <div 
                className="p-3 sm:p-4 rounded-xl mb-4 space-y-2"
                style={{ backgroundColor: `${menuCustomization.primaryColor}10` }}
              >
                <div className="flex justify-between items-center text-sm sm:text-base gap-2">
                  <span className="text-muted-foreground">Subtotal dos itens</span>
                  <span className="tabular-nums font-medium">R$ {cartTotal.toFixed(2).replace(".", ",")}</span>
                </div>
                {orderType === "delivery" && (
                  <div className="flex justify-between items-center text-sm sm:text-base gap-2">
                    <span className="text-muted-foreground">Taxa de entrega</span>
                    <span className="tabular-nums">
                      {freeDeliveryPromotionId ? (
                        <span className="text-green-600 font-semibold">Grátis</span>
                      ) : (
                        `R$ ${deliveryFee.toFixed(2).replace(".", ",")}`
                      )}
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-baseline gap-2 pt-1 border-t border-black/5 dark:border-white/10">
                  <span className="font-semibold text-base sm:text-lg">Total do pedido</span>
                  <span 
                    className="text-xl sm:text-2xl font-bold tabular-nums"
                    style={{ color: menuCustomization.primaryColor }}
                  >
                    R$ {finalTotal.toFixed(2).replace(".", ",")}
                  </span>
                </div>
              </div>
              <Button
                onClick={handleCheckout}
                className="w-full min-h-[52px] touch-manipulation font-semibold shadow-lg hover:shadow-xl transition-shadow text-base"
                size="lg"
                disabled={
                  !customerName.trim() ||
                  !customerPhone.trim() ||
                  !paymentMethod ||
                  (!isOpen && !establishment?.allow_orders_when_closed)
                }
                style={{
                  backgroundColor: menuCustomization.primaryColor,
                  color: "#ffffff",
                  opacity:
                    !customerName.trim() ||
                    !customerPhone.trim() ||
                    !paymentMethod ||
                    (!isOpen && !establishment?.allow_orders_when_closed)
                      ? 0.5
                      : 1,
                }}
                title={
                  !isOpen && !establishment?.allow_orders_when_closed
                    ? "Estamos fechados agora. Tente novamente quando estivermos abertos."
                    : undefined
                }
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                {!isOpen && establishment?.allow_orders_when_closed
                  ? "Confirmar Pré-Pedido"
                  : "Confirmar Pedido"}
              </Button>
              {!isOpen && !establishment?.allow_orders_when_closed && (
                <p className="text-sm text-muted-foreground text-center mt-3">
                  Estamos fechados agora. Tente novamente quando estivermos abertos.
                </p>
              )}
            </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Addons Modal */}
      {pendingProduct && establishment && (
        <AddonsModal
          open={showAddonsModal}
          onClose={() => {
            setShowAddonsModal(false);
            setPendingProduct(null);
          }}
          onConfirm={handleAddonsConfirm}
          productId={pendingProduct.id}
          categoryId={pendingProduct.category_id || null}
          establishmentId={establishment.id}
          productName={pendingProduct.name}
          primaryColor={menuCustomization.primaryColor}
          secondaryColor={menuCustomization.secondaryColor}
        />
      )}
      </div>
    </div>
  );
};

export default MenuPublic;
