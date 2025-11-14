import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Plus, Minus, ShoppingCart, Home, Check, UtensilsCrossed } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

interface Product {
  id: string;
  name: string;
  price: number;
  image_url: string | null;
  description: string | null;
  category_id: string | null;
}

interface Combo {
  id: string;
  name: string;
  price: number;
  image_url: string | null;
  description: string | null;
  active: boolean;
}

interface Category {
  id: string;
  name: string;
}

interface CartItem extends Product {
  quantity: number;
  isCombo?: boolean;
}

interface DisplayItem {
  id: string;
  name: string;
  price: number;
  image_url: string | null;
  description: string | null;
  category_id?: string | null;
  isCombo: boolean;
}

export default function Totem() {
  const [products, setProducts] = useState<Product[]>([]);
  const [combos, setCombos] = useState<Combo[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCart, setShowCart] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [orderType, setOrderType] = useState<"balcao" | "delivery">("balcao"); // true = comer aqui, false = levar
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [establishmentId, setEstablishmentId] = useState("");
  const [establishmentName, setEstablishmentName] = useState<string>("");

  useEffect(() => {
    loadData();
  }, []);

  // OTIMIZAÇÃO: Removido polling redundante - real-time subscriptions são suficientes
  // O polling estava duplicando requisições desnecessariamente
  // Real-time subscriptions abaixo já garantem atualizações imediatas

  // Real-time updates para produtos e combos - força atualização imediata
  useEffect(() => {
    if (!establishmentId) return;

    const reloadProducts = async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, price, image_url, description, category_id, active, sort_order")
        .eq("establishment_id", establishmentId)
        .eq("active", true)
        .order("sort_order");
      if (!error && data) {
        setProducts(data);
      } else if (error) {
        console.error("Error reloading products:", error);
      }
    };

    const reloadCombos = async () => {
      const { data, error } = await supabase
        .from("combos")
        .select("id, name, price, image_url, description, active, sort_order")
        .eq("establishment_id", establishmentId)
        .eq("active", true)
        .order("sort_order");
      if (!error && data) {
        setCombos(data);
      } else if (error) {
        console.error("Error reloading combos:", error);
      }
    };

    const reloadCategories = async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .eq("establishment_id", establishmentId)
        .eq("active", true)
        .order("sort_order");
      if (!error && data) {
        setCategories(data || []);
      }
    };

    // Channel para produtos
    const productsChannel = supabase
      .channel(`totem-products-updates-${establishmentId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'products',
          filter: `establishment_id=eq.${establishmentId}`
        },
        () => {
          reloadProducts();
        }
      )
      .subscribe();

    // Channel para combos
    const combosChannel = supabase
      .channel(`totem-combos-updates-${establishmentId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'combos',
          filter: `establishment_id=eq.${establishmentId}`
        },
        () => {
          reloadCombos();
        }
      )
      .subscribe();

    // Channel para categorias
    const categoriesChannel = supabase
      .channel(`totem-categories-updates-${establishmentId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'categories',
          filter: `establishment_id=eq.${establishmentId}`
        },
        () => {
          reloadCategories();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(productsChannel);
      supabase.removeChannel(combosChannel);
      supabase.removeChannel(categoriesChannel);
    };
  }, [establishmentId]);

  const loadData = async () => {
    try {
      // Primeiro, tentar pegar o estabelecimento do usuário logado (se houver sessão)
      let establishmentIdToUse: string | null = null;
      let establishmentNameToUse: string = "";

      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("establishment_id")
          .eq("user_id", session.user.id)
          .maybeSingle();
        
        if (profile?.establishment_id) {
          const { data: estab } = await supabase
            .from("establishments")
            .select("id, name")
            .eq("id", profile.establishment_id)
            .single();
          
          if (estab) {
            establishmentIdToUse = estab.id;
            establishmentNameToUse = estab.name || "";
          }
        }
      }

      // Se não encontrou pelo perfil, pegar o primeiro estabelecimento
      if (!establishmentIdToUse) {
      const { data: establishments, error: estError } = await supabase
        .from("establishments")
          .select("id, name")
        .limit(1)
        .maybeSingle();

      if (estError) {
        console.error("Error loading establishment:", estError);
        toast.error("Erro ao carregar estabelecimento");
        return;
      }

      if (!establishments) {
        toast.error("Totem não configurado. Ative o totem nas configurações primeiro.");
        return;
      }

        establishmentIdToUse = establishments.id;
        establishmentNameToUse = establishments.name || "";
      }

      setEstablishmentId(establishmentIdToUse);
      setEstablishmentName(establishmentNameToUse);

      // Load categories - SEM filtro de active para garantir que pegue todas
      const { data: categoriesData, error: categoriesError } = await supabase
        .from("categories")
        .select("*")
        .eq("establishment_id", establishmentIdToUse)
        .eq("active", true)
        .order("sort_order");

      if (categoriesError) {
        console.error("Error loading categories:", categoriesError);
        throw categoriesError;
      }
      
      const loadedCategories = categoriesData || [];
      setCategories(loadedCategories);
      
      // Garantir que iniciamos mostrando todos os produtos
      setSelectedCategory("all");

      // Load products and combos - explicitamente selecionando todos os campos necessários incluindo image_url
      const [productsResult, combosResult] = await Promise.all([
        supabase
          .from("products")
          .select("id, name, price, image_url, description, category_id, active, sort_order")
          .eq("establishment_id", establishmentIdToUse)
          .eq("active", true)
          .order("sort_order"),
        supabase
          .from("combos")
          .select("id, name, price, image_url, description, active, sort_order")
          .eq("establishment_id", establishmentIdToUse)
          .eq("active", true)
          .order("sort_order")
      ]);

      if (productsResult.error) throw productsResult.error;
      if (combosResult.error) throw combosResult.error;
      
      setProducts(productsResult.data || []);
      setCombos(combosResult.data || []);
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Erro ao carregar produtos");
    }
  };

  const addToCart = (item: DisplayItem) => {
    const existing = cart.find((cartItem) => cartItem.id === item.id);
    if (existing) {
      setCart(
        cart.map((cartItem) =>
          cartItem.id === item.id
            ? { ...cartItem, quantity: cartItem.quantity + 1 }
            : cartItem
        )
      );
    } else {
      setCart([...cart, { 
        ...item, 
        quantity: 1,
        isCombo: item.isCombo,
        category_id: item.category_id || null,
        image_url: item.image_url || null,
        description: item.description || null
      }]);
    }
    toast.success("Adicionado ao carrinho!", {
      position: "top-left",
      duration: 2000,
      style: {
        zIndex: 9999,
      },
    });
  };

  const removeFromCart = (productId: string) => {
    const existing = cart.find((item) => item.id === productId);
    if (existing && existing.quantity > 1) {
      setCart(
        cart.map((item) =>
          item.id === productId
            ? { ...item, quantity: item.quantity - 1 }
            : item
        )
      );
    } else {
      setCart(cart.filter((item) => item.id !== productId));
    }
  };

  const getTotalPrice = () => {
    return cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  };

  const getTotalItems = () => {
    return cart.reduce((sum, item) => sum + item.quantity, 0);
  };

  const generatePassword = async () => {
    try {
      // Get next password number
      const { data: lastPassword } = await supabase
        .from("password_queue")
        .select("password_number")
        .eq("establishment_id", establishmentId)
        .order("password_number", { ascending: false })
        .limit(1)
        .single();

      const nextNumber = lastPassword ? lastPassword.password_number + 1 : 1;

      const { error } = await supabase
        .from("password_queue")
        .insert({
          establishment_id: establishmentId,
          password_number: nextNumber,
          customer_name: customerName || null,
          service_type: "normal",
          status: "waiting",
        });

      if (error) throw error;

      return nextNumber;
    } catch (error) {
      console.error("Error generating password:", error);
      throw error;
    }
  };

  const handleFinishOrder = async () => {
    if (cart.length === 0) {
      toast.error("Adicione itens ao carrinho");
      return;
    }

    if (!customerName || customerName.trim() === "") {
      toast.error("Por favor, informe seu nome");
      return;
    }

    try {
      // Gerar número de pedido sequencial (#00001, #00002, etc)
      // Se não houver caixa aberto, retorna número com timestamp
      const { data: orderNumber, error: orderNumberError } = await supabase.rpc(
        "get_next_order_number",
        { p_establishment_id: establishmentId }
      );

      if (orderNumberError || !orderNumber) {
        console.error("Error generating order number:", orderNumberError);
        // Fallback para número com timestamp se houver erro
        const fallbackNumber = `TT-${Date.now()}`;
        console.warn("Using fallback order number:", fallbackNumber);
      }

      const finalOrderNumber = orderNumber || `TT-${Date.now()}`;

      // Calculate totals
      const subtotal = getTotalPrice();
      
      // Create order
      const { data: newOrder, error: orderError } = await supabase
        .from("orders")
        .insert({
          establishment_id: establishmentId,
          order_number: finalOrderNumber,
          customer_name: customerName.trim(),
          order_type: orderType,
          subtotal,
          total_amount: subtotal,
          status: "pending",
          payment_status: "paid", // Pagamento já é considerado efetuado ao finalizar venda
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Create order items (for combos, create virtual products like PDV does)
      const itemsToInsert = await Promise.all(
        cart.map(async (item) => {
          let productId = item.id;

          if (item.isCombo) {
            // Try to find an existing product that represents this combo
            const { data: existingComboProduct } = await supabase
              .from("products")
              .select("id")
              .eq("establishment_id", establishmentId)
              .eq("is_combo", true)
              .eq("name", item.name)
              .limit(1)
              .single();

            if (existingComboProduct) {
              productId = existingComboProduct.id;
            } else {
              // Create a combo product on the fly for referential integrity
              const { data: newProduct, error: newProductError } = await supabase
                .from("products")
                .insert({
                  establishment_id: establishmentId,
                  name: item.name,
                  description: "Combo",
                  is_combo: true,
                  active: true,
                  price: item.price,
                } as any)
                .select()
                .single();

              if (newProductError) {
                console.error("Error creating combo product:", newProductError);
                throw newProductError;
              }
              productId = (newProduct as any).id;
            }
          }

          return {
            order_id: newOrder.id,
            product_id: productId,
            quantity: item.quantity,
            unit_price: item.price,
            total_price: item.price * item.quantity,
            notes: item.isCombo ? `Combo do totem` : null,
          };
        })
      );

      const { error: itemsError } = await supabase
        .from("order_items")
        .insert(itemsToInsert);

      if (itemsError) {
        console.error("Error creating order items:", itemsError);
        // Continue anyway, order is created
      }

      // Abater estoque de ingredientes automaticamente
      try {
        const { data: stockResult, error: stockError } = await supabase.rpc(
          'apply_stock_deduction_for_order',
          {
            p_establishment_id: establishmentId,
            p_order_id: newOrder.id
          }
        );

        if (stockError) {
          // Log do erro mas não interrompe o pedido
          console.error('Erro ao abater estoque:', stockError);
        } else if (stockResult && !stockResult.success) {
          // Avisar sobre problemas no estoque mas não bloquear o pedido
          console.warn('Avisos no abatimento de estoque:', stockResult.errors);
        }
      } catch (stockErr) {
        // Não bloquear o pedido se houver erro no estoque
        console.error('Erro ao processar estoque:', stockErr);
      }

      // Generate password
      const passwordNumber = await generatePassword();

      setOrderSuccess(true);
      
      // Show success message with password
      setTimeout(() => {
        toast.success(
          `Pedido realizado! Sua senha: S${String(passwordNumber).padStart(3, "0")}`,
          { duration: 8000 }
        );
      }, 500);

      // Reset after 5 seconds
      setTimeout(() => {
        setCart([]);
        setCustomerName("");
        setOrderType("balcao");
        setShowCart(false);
        setOrderSuccess(false);
      }, 5000);
    } catch (error) {
      console.error("Error creating order:", error);
      toast.error("Erro ao finalizar pedido");
    }
  };

  // Combine products and combos for display (recalcula sempre que products/combos mudarem)
  const displayItems: DisplayItem[] = useMemo(() => {
    return [
      ...products.map(p => ({ ...p, isCombo: false })),
      ...combos.map(c => ({ 
        id: c.id, 
        name: c.name, 
        price: c.price, 
        image_url: c.image_url, 
        description: c.description,
        category_id: null,
        isCombo: true 
      }))
    ];
  }, [products, combos]);

  // Filtra items baseado na categoria selecionada (recalcula sempre que necessário)
  const filteredItems = useMemo(() => {
    if (selectedCategory === "all") {
      return displayItems;
    } else if (selectedCategory === "combos") {
      return displayItems.filter((item) => item.isCombo);
    } else {
      return displayItems.filter((item) => item.category_id === selectedCategory);
    }
  }, [displayItems, selectedCategory]);

  // Atualizar título da página quando o estabelecimento mudar
  useEffect(() => {
    if (establishmentName) {
      document.title = `Totem - ${establishmentName}`;
    } else {
      document.title = 'Totem';
    }
    
    // Cleanup: restaurar título padrão ao sair da página
    return () => {
      document.title = 'burguer.IA - Sistema de Gestão Completo Hamburguerias & Restaurantes';
    };
  }, [establishmentName]);

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

  if (orderSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/20 to-primary-glow/20 flex items-center justify-center p-8">
        <Card className="max-w-2xl w-full p-12">
          <div className="text-center space-y-6">
            <div className="flex justify-center">
              <div className="rounded-full bg-primary p-6">
                <Check className="h-16 w-16 text-primary-foreground" />
              </div>
            </div>
            <h2 className="text-4xl font-bold">Pedido Realizado!</h2>
            <p className="text-xl text-muted-foreground">
              Aguarde sua senha ser chamada no painel
            </p>
            <p className="text-sm text-muted-foreground">
              Redirecionando em alguns segundos...
            </p>
          </div>
        </Card>
      </div>
    );
  }

  if (showCart) {
    return (
      <div className="min-h-screen bg-background px-2 py-4">
        <div className="w-full space-y-6">
          <div className="flex items-center justify-between">
            <Button variant="outline" size="lg" onClick={() => setShowCart(false)}>
              <Home className="h-5 w-5 mr-2" />
              Voltar
            </Button>
            <h1 className="text-4xl font-bold">Seu Pedido</h1>
            <div className="w-24" /> {/* Spacer */}
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="customerName" className="text-lg">
                Seu nome *
              </Label>
              <Input
                id="customerName"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Digite seu nome"
                className="text-xl p-8 h-16 text-lg"
                required
              />
            </div>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <Label htmlFor="order-type" className="text-lg font-semibold mb-2">
                      Tipo de Pedido
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      {orderType === "balcao" ? "Comer aqui" : "Levar"}
                    </p>
                  </div>
                  <div className="flex items-center space-x-3">
                    <span className="text-sm text-muted-foreground">Comer aqui</span>
                    <Switch
                      id="order-type"
                      checked={orderType === "delivery"}
                      onCheckedChange={(checked) => setOrderType(checked ? "delivery" : "balcao")}
                    />
                    <span className="text-sm text-muted-foreground">Levar</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {cart.map((item) => (
              <Card key={item.id}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0 pr-4">
                      <h3 className="text-xl font-semibold break-words">{item.name}</h3>
                      <p className="text-lg text-muted-foreground">
                        R$ {item.price.toFixed(2)} x {item.quantity}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <Button
                        size="lg"
                        variant="outline"
                        onClick={() => removeFromCart(item.id)}
                      >
                        <Minus className="h-5 w-5" />
                      </Button>
                      <span className="text-2xl font-bold w-12 text-center">
                        {item.quantity}
                      </span>
                      <Button
                        size="lg"
                        onClick={() => {
                          const displayItem: DisplayItem = {
                            id: item.id,
                            name: item.name,
                            price: item.price,
                            image_url: item.image_url || null,
                            description: item.description || null,
                            category_id: item.category_id || null,
                            isCombo: item.isCombo || false
                          };
                          addToCart(displayItem);
                        }}
                      >
                        <Plus className="h-5 w-5" />
                      </Button>
                      <p className="text-2xl font-bold ml-4 w-32 text-right">
                        R$ {(item.price * item.quantity).toFixed(2)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="bg-primary text-primary-foreground">
            <CardContent className="p-8">
              <div className="flex items-center justify-between text-3xl font-bold">
                <span>Total:</span>
                <span>R$ {getTotalPrice().toFixed(2)}</span>
              </div>
            </CardContent>
          </Card>

          <Button
            size="lg"
            className="w-full h-20 text-2xl"
            onClick={handleFinishOrder}
          >
            Finalizar Pedido
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-2 py-4">
      <div className="w-full space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-5xl font-bold">Faça seu Pedido</h1>
          <p className="text-xl text-muted-foreground">
            Selecione os produtos que deseja
          </p>
        </div>

        {/* Categories */}
        <div className="flex gap-4 overflow-x-auto pb-4">
          <Button
            size="lg"
            variant={selectedCategory === "all" ? "default" : "outline"}
            onClick={() => setSelectedCategory("all")}
          >
            <UtensilsCrossed className="h-5 w-5 mr-2" />
            Todos
          </Button>
          {combos.length > 0 && (
            <Button
              size="lg"
              variant={selectedCategory === "combos" ? "default" : "outline"}
              onClick={() => setSelectedCategory("combos")}
            >
              🍔 Combos
            </Button>
          )}
          {categories.length > 0 ? (
            categories.map((category) => (
            <Button
              key={category.id}
              size="lg"
              variant={selectedCategory === category.id ? "default" : "outline"}
              onClick={() => setSelectedCategory(category.id)}
            >
                <span className="mr-2">{getCategoryIcon(category.name)}</span>
              {category.name}
            </Button>
            ))
          ) : (
            <div className="text-sm text-muted-foreground p-2">
              Carregando categorias...
            </div>
          )}
        </div>

        {/* Products and Combos Grid - Tamanho otimizado para tablet */}
        <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {filteredItems.map((item) => (
            <Card
              key={item.id}
              className="cursor-pointer hover:shadow-lg transition-shadow overflow-hidden"
              onClick={() => addToCart(item)}
            >
              <CardHeader className="p-2 pb-1">
                <div className="aspect-square rounded-md overflow-hidden bg-muted mb-2 min-h-[120px] w-full flex items-center justify-center">
                  {item.image_url && item.image_url.trim() ? (
                    <img
                      src={item.image_url}
                      alt={item.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        const parent = target.parentElement;
                        if (parent) {
                          const existingPlaceholder = parent.querySelector('.no-image-placeholder');
                          if (!existingPlaceholder) {
                            const placeholder = document.createElement('div');
                            placeholder.className = 'no-image-placeholder w-full h-full flex items-center justify-center text-muted-foreground text-xs';
                            placeholder.textContent = 'Erro ao carregar';
                            parent.appendChild(placeholder);
                          }
                        }
                      }}
                      onLoad={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'block';
                        const parent = target.parentElement;
                        if (parent) {
                          const placeholder = parent.querySelector('.no-image-placeholder');
                          if (placeholder) {
                            placeholder.remove();
                          }
                        }
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
                      Sem imagem
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-1">
                  <CardTitle className="text-sm font-semibold leading-tight min-h-[3rem]">
                    {item.name}
                  </CardTitle>
                  {item.isCombo && (
                    <Badge variant="secondary" className="text-xs w-fit">Combo</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-2 pt-0 pb-3">
                <p className="text-lg font-bold text-primary">
                  R$ {item.price.toFixed(2)}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Floating Cart Button */}
        {cart.length > 0 && (
          <div className="fixed bottom-8 right-8 z-[10000]">
            <Button
              size="lg"
              className="h-20 px-8 text-xl shadow-2xl relative"
              onClick={() => setShowCart(true)}
            >
              <ShoppingCart className="h-6 w-6 mr-3" />
              Ver Carrinho ({getTotalItems()})
              <Badge variant="secondary" className="ml-3 text-lg px-3">
                R$ {getTotalPrice().toFixed(2)}
              </Badge>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
