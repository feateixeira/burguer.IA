import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { normalizePhoneBRToE164, phoneMask } from "@/utils/phoneNormalizer";
import { useBusinessHours } from "@/hooks/useBusinessHours";
import { formatDateTime, formatTime, getDayName } from "@/utils/businessHours";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, Plus, Minus, X, MapPin, Phone, Clock, CheckCircle2, CreditCard, Wallet, AlertTriangle, Settings, Circle, UtensilsCrossed } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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

interface CartItem extends Product {
  quantity: number;
  notes?: string;
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
}

const MenuPublic = () => {
  const { slug } = useParams<{ slug: string }>();
  const [loading, setLoading] = useState(true);
  const [establishment, setEstablishment] = useState<Establishment | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [combos, setCombos] = useState<any[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showCombosOnly, setShowCombosOnly] = useState(false);
  const [showCart, setShowCart] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [orderNumber, setOrderNumber] = useState<string>("");
  
  // Form fields
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [orderNotes, setOrderNotes] = useState("");
  const [orderType, setOrderType] = useState<"delivery" | "pickup">("delivery");
  const [paymentMethod, setPaymentMethod] = useState<"dinheiro" | "pix" | "cartao_credito" | "cartao_debito" | "">("");

  // Hook para verificar horário de funcionamento
  const { isOpen, nextOpenAt, nextCloseAt, loading: hoursLoading } = useBusinessHours(establishment?.id || null);
  const [hasBusinessHoursConfig, setHasBusinessHoursConfig] = useState(false);

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

    const reloadProducts = async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("establishment_id", establishment.id)
        .eq("active", true)
        .order("sort_order");
      if (!error && data) {
        setProducts(data);
      }
    };

    const reloadCategories = async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .eq("establishment_id", establishment.id)
        .eq("active", true)
        .order("sort_order");
      if (!error && data) {
        setCategories(data);
      }
    };

    const reloadCombos = async () => {
      const { data, error } = await supabase
        .from("combos")
        .select("*, combo_items(product_id, quantity)")
        .eq("establishment_id", establishment.id)
        .eq("active", true)
        .order("sort_order");
      if (!error && data) {
        setCombos(data);
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
          reloadProducts();
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
          reloadCategories();
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
          reloadCombos();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(productsChannel);
      supabase.removeChannel(categoriesChannel);
      supabase.removeChannel(combosChannel);
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

      // Load establishment by slug (tentar com campos novos, se falhar tenta sem eles)
      let { data: estabData, error: estabError } = await supabase
        .from("establishments")
        .select("id, name, phone, address, slug, pix_key, timezone, allow_orders_when_closed, show_schedule_on_menu, menu_online_enabled")
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
      
      const [productsResult, categoriesResult, combosResult] = await Promise.all([
        supabase
          .from("products")
          .select("*")
          .eq("establishment_id", estabId)
          .eq("active", true)
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
          .order("sort_order")
      ]);

      if (productsResult.error) throw productsResult.error;
      if (categoriesResult.error) throw categoriesResult.error;
      if (combosResult.error) throw combosResult.error;

      setProducts(productsResult.data || []);
      setCategories(categoriesResult.data || []);
      setCombos(combosResult.data || []);

      // Começar mostrando todos os produtos (null = todos)
      setSelectedCategory(null);
      setShowCombosOnly(false);
    } catch (error) {
      toast.error("Erro ao carregar cardápio");
    } finally {
      setLoading(false);
    }
  };

  const addToCart = (product: Product) => {
    const existingItem = cart.find(item => item.id === product.id && !item.notes);
    
    if (existingItem) {
      setCart(cart.map(item =>
        item.id === product.id && !item.notes
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      setCart([...cart, { ...product, quantity: 1 }]);
    }
    toast.success(`${product.name} adicionado ao carrinho`);
  };

  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }
    setCart(cart.map(item =>
      item.id === productId && !item.notes
        ? { ...item, quantity }
        : item
    ));
  };

  const removeFromCart = (productId: string) => {
    setCart(cart.filter(item => !(item.id === productId && !item.notes)));
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

    // Filtrar produtos válidos também
    const validProducts = products
      .filter((p: any) => p && p.id && p.name)
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

  const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const cartItemsCount = cart.reduce((sum, item) => sum + item.quantity, 0);

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
      // Gerar número de pedido sequencial (#00001, #00002, etc)
      // Se não houver caixa aberto, retorna número com timestamp
      const { data: orderNumber, error: orderNumberError } = await supabase.rpc(
        "get_next_order_number",
        { p_establishment_id: establishment.id }
      );

      if (orderNumberError || !orderNumber) {
        console.error("Error generating order number:", orderNumberError);
        // Fallback para número com timestamp se houver erro
        const fallbackNumber = `ONLINE-${Date.now()}`;
        console.warn("Using fallback order number:", fallbackNumber);
      }

      const finalOrderNumber = orderNumber || `ONLINE-${Date.now()}`;

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
          delivery_fee: orderType === "delivery" ? 0 : 0, // Can be configured later
          total_amount: cartTotal,
          status: "pending",
          payment_status: "paid", // Pagamento já é considerado efetuado ao finalizar venda
          payment_method: paymentMethod,
          notes: finalNotes || null,
          channel: "online",
          origin: "cardapio_online",
          source_domain: window.location.hostname,
          queued_until_next_open: isQueued,
          release_at: releaseAt,
        })
        .select()
        .single();

      if (orderError) {
        throw orderError;
      }

      // Create order items
      const orderItems = cart.map(item => ({
        order_id: newOrder.id,
        product_id: item.id,
        quantity: item.quantity,
        unit_price: item.price,
        total_price: item.price * item.quantity,
        notes: item.notes || null,
      }));

      const { error: itemsError } = await supabase
        .from("order_items")
        .insert(orderItems);

      if (itemsError) {
        throw itemsError;
      }

      // Success
      setOrderNumber(orderNumber);
      setOrderSuccess(true);
      setCart([]);
      setShowCheckout(false);
      setShowCart(false);
      setCustomerName("");
      setCustomerPhone("");
      setCustomerAddress("");
      setOrderNotes("");

      toast.success("Pedido realizado com sucesso!");
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
      
      // Mensagem de erro amigável
      if (errorMessage.includes("row-level security") || errorMessage.includes("RLS")) {
        toast.error("Erro de segurança: Verifique se o estabelecimento está configurado corretamente para receber pedidos online.");
      } else {
        toast.error(`Erro ao realizar pedido: ${errorMessage}`);
      }
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

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">{establishment.name}</h1>
              {establishment.phone && (
                <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                  <Phone className="h-3 w-3" />
                  {establishment.phone}
                </p>
              )}
            </div>
            <Button
              onClick={() => setShowCart(true)}
              className="relative"
              size="lg"
            >
              <ShoppingCart className="h-5 w-5 mr-2" />
              Carrinho
              {cartItemsCount > 0 && (
                <Badge className="ml-2 bg-primary">
                  {cartItemsCount}
                </Badge>
              )}
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
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
                    <p className="text-sm text-red-700 dark:text-red-300 mt-1 italic">
                      Você pode fazer um pré-pedido que será preparado quando abrirmos
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
                >
                  🍔 Combos
                </Button>
              )}
              {categories.map(category => (
                <Button
                  key={category.id}
                  variant={selectedCategory === category.id ? "default" : "outline"}
                  onClick={() => {
                    setSelectedCategory(category.id);
                    setShowCombosOnly(false);
                  }}
                  className="whitespace-nowrap"
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {items.map((product: any, index: number) => {
            if (!product || !product.id || !product.name) {
              return null;
            }
            
            // Garantir que price é um número válido
            if (!product.price || isNaN(Number(product.price))) {
              return null;
            }
            
            return (
            <Card key={product.id} className="overflow-hidden hover:shadow-lg transition-shadow">
              {product.image_url && (
                <div className="aspect-video w-full overflow-hidden bg-muted">
                  <img
                    src={product.image_url}
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="font-semibold text-lg">{product.name}</h3>
                  {product.isCombo && (
                    <Badge variant="secondary" className="text-xs">
                      Combo
                    </Badge>
                  )}
                </div>
                {product.description && (
                  <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                    {product.description}
                  </p>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-xl font-bold text-primary">
                    R$ {Number(product.price).toFixed(2)}
                  </span>
                  <Button
                    size="sm"
                    onClick={() => addToCart(product)}
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
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Carrinho de Compras</DialogTitle>
            <DialogDescription>
              {cartItemsCount} item(s) no carrinho
            </DialogDescription>
          </DialogHeader>

          {cart.length === 0 ? (
            <div className="text-center py-8">
              <ShoppingCart className="h-16 w-16 text-muted-foreground mx-auto mb-4 opacity-50" />
              <p className="text-muted-foreground">Seu carrinho está vazio</p>
            </div>
          ) : (
            <div className="space-y-4">
              {cart.map(item => (
                <div key={`${item.id}-${item.notes || ''}`} className="flex items-center gap-3 p-3 border rounded-lg">
                  <div className="flex-1">
                    <p className="font-medium">{item.name}</p>
                    <p className="text-sm text-muted-foreground">
                      R$ {Number(item.price).toFixed(2)} cada
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => updateQuantity(item.id, item.quantity - 1)}
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <span className="w-8 text-center font-medium">{item.quantity}</span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => updateQuantity(item.id, item.quantity + 1)}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => removeFromCart(item.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}

              <div className="border-t pt-4 space-y-4">
                <div className="flex justify-between text-lg font-bold">
                  <span>Total:</span>
                  <span>R$ {cartTotal.toFixed(2)}</span>
                </div>
                <Button
                  onClick={() => {
                    setShowCart(false);
                    setShowCheckout(true);
                  }}
                  className="w-full"
                  size="lg"
                >
                  Finalizar Pedido
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Checkout Dialog */}
      <Dialog open={showCheckout} onOpenChange={setShowCheckout}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Finalizar Pedido</DialogTitle>
            <DialogDescription>
              Preencha os dados para finalizar seu pedido
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
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
              <Label>Tipo de Pedido *</Label>
              <div className="flex gap-2 mt-2">
                <Button
                  type="button"
                  variant={orderType === "delivery" ? "default" : "outline"}
                  onClick={() => setOrderType("delivery")}
                  className="flex-1"
                >
                  <MapPin className="h-4 w-4 mr-2" />
                  Entrega
                </Button>
                <Button
                  type="button"
                  variant={orderType === "pickup" ? "default" : "outline"}
                  onClick={() => setOrderType("pickup")}
                  className="flex-1"
                >
                  <Clock className="h-4 w-4 mr-2" />
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
              <Label>Forma de Pagamento *</Label>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <Button
                  type="button"
                  variant={paymentMethod === "dinheiro" ? "default" : "outline"}
                  onClick={() => setPaymentMethod("dinheiro")}
                  className="flex items-center justify-center gap-2"
                >
                  <Wallet className="h-4 w-4" />
                  Dinheiro
                </Button>
                <Button
                  type="button"
                  variant={paymentMethod === "pix" ? "default" : "outline"}
                  onClick={() => setPaymentMethod("pix")}
                  className="flex items-center justify-center gap-2"
                >
                  <CreditCard className="h-4 w-4" />
                  PIX
                </Button>
                <Button
                  type="button"
                  variant={paymentMethod === "cartao_debito" ? "default" : "outline"}
                  onClick={() => setPaymentMethod("cartao_debito")}
                  className="flex items-center justify-center gap-2"
                >
                  <CreditCard className="h-4 w-4" />
                  Débito
                </Button>
                <Button
                  type="button"
                  variant={paymentMethod === "cartao_credito" ? "default" : "outline"}
                  onClick={() => setPaymentMethod("cartao_credito")}
                  className="flex items-center justify-center gap-2"
                >
                  <CreditCard className="h-4 w-4" />
                  Crédito
                </Button>
              </div>
            </div>

            <div>
              <Label htmlFor="orderNotes">Observações (opcional)</Label>
              <Textarea
                id="orderNotes"
                value={orderNotes}
                onChange={(e) => setOrderNotes(e.target.value)}
                placeholder="Alguma observação sobre o pedido?"
                rows={3}
              />
            </div>

            <div className="border-t pt-4">
              <div className="flex justify-between mb-4">
                <span className="font-semibold">Total:</span>
                <span className="text-xl font-bold text-primary">
                  R$ {cartTotal.toFixed(2)}
                </span>
              </div>
              <Button
                onClick={handleCheckout}
                className="w-full"
                size="lg"
                disabled={
                  !customerName.trim() || 
                  !customerPhone.trim() || 
                  !paymentMethod ||
                  (!isOpen && !establishment?.allow_orders_when_closed)
                }
                title={
                  !isOpen && !establishment?.allow_orders_when_closed
                    ? "Estamos fechados agora. Tente novamente quando estivermos abertos."
                    : undefined
                }
              >
                {!isOpen && establishment?.allow_orders_when_closed
                  ? "Confirmar Pré-Pedido"
                  : "Confirmar Pedido"}
              </Button>
              {!isOpen && !establishment?.allow_orders_when_closed && (
                <p className="text-sm text-muted-foreground text-center mt-2">
                  Estamos fechados agora. Tente novamente quando estivermos abertos.
                </p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MenuPublic;
