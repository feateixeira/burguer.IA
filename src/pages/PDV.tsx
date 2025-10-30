import { useState, useEffect } from "react";
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
  Truck
} from "lucide-react";
import Sidebar from "@/components/Sidebar";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
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

interface CartItem extends Product {
  quantity: number;
  notes?: string;
  saucePrice?: number;
  originalPrice?: number; // preço antes da promoção
  promotionId?: string;
  promotionName?: string;
}

const PDV = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
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
  const [includeDelivery, setIncludeDelivery] = useState(false);
  const [showSauceDialog, setShowSauceDialog] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [sauceNote, setSauceNote] = useState("");
  const [selectedSauces, setSelectedSauces] = useState<string[]>([]);
  const [pendingComboAsProduct, setPendingComboAsProduct] = useState<Product | null>(null);
  const [showDrinkDialog, setShowDrinkDialog] = useState(false);
  const [selectedDrink, setSelectedDrink] = useState<Product | null>(null);
  const [comboDrinkItem, setComboDrinkItem] = useState<any>(null); // item do combo que é bebida (combo_item com product_id)
  const [isImporting, setIsImporting] = useState(false);
  const [whatsappDialogOpen, setWhatsappDialogOpen] = useState(false);
  const [whatsappOrderText, setWhatsappOrderText] = useState("");
  const [whatsappSelectedCustomer, setWhatsappSelectedCustomer] = useState<CustomerWithGroups | null>(null);
  const [whatsappCustomerSearch, setWhatsappCustomerSearch] = useState("");
  const [showWhatsappCustomerDropdown, setShowWhatsappCustomerDropdown] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("");
  const [showPixModal, setShowPixModal] = useState(false);
  const [pendingOrderId, setPendingOrderId] = useState<string>("");
  const [pendingOrderAmount, setPendingOrderAmount] = useState<number>(0);
  const [pendingReceiptData, setPendingReceiptData] = useState<ReceiptData | null>(null);
  const [showCashModal, setShowCashModal] = useState(false);
  const [cashGiven, setCashGiven] = useState<number>(0);
  const [cashChange, setCashChange] = useState<number>(0);
  const [generalInstructions, setGeneralInstructions] = useState<string>("");

  const sauceOptions = ["Mostarda e Mel", "Bacon", "Alho", "Ervas"];

  useEffect(() => {
    loadProducts();
    loadCustomers();

    // F9 key listener for WhatsApp order modal
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === "F9") {
        e.preventDefault();
        setWhatsappDialogOpen(true);
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, []);

  // Atalhos com Enter: Enter no campo de busca adiciona primeiro produto; Ctrl+Enter finaliza venda
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault();
        if (!showSauceDialog && !showPixModal && !showCashModal) {
          const total = selectedCustomer && selectedCustomer.groups.length > 0 ? 
            calculateDiscountedTotal() : calculateTotal();
          if (paymentMethod === 'dinheiro') {
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
  }, [searchTerm, products, categories, selectedCustomer, paymentMethod, showSauceDialog, showPixModal, showCashModal]);

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
          .select("*")
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
      console.error("Error loading products:", error);
      toast.error("Erro ao carregar produtos");
    } finally {
      setLoading(false);
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
      console.error("Error loading customers:", error);
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
    const deliveryCost = includeDelivery ? deliveryFee : 0;
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
    return product.name.toLowerCase().includes('triplo');
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

  const handleProductClick = (product: Product) => {
    if (isHamburger(product)) {
      setSelectedProduct(product);
      setSauceNote("");
      setSelectedSauces([]);
      setShowSauceDialog(true);
    } else {
      addToCart(applyPromotionIfAny(product));
    }
  };

  const addToCart = (product: Product | (Product & { originalPrice?: number; promotionId?: string; promotionName?: string }), notes?: string, saucePrice?: number) => {
    setCart(prevCart => {
      const existingItem = prevCart.find(item => item.id === product.id && item.notes === notes);
      if (existingItem) {
        return prevCart.map(item =>
          item.id === product.id && item.notes === notes
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prevCart, { ...product, quantity: 1, notes, saucePrice } as CartItem];
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
    const freeSauces = isTriplo(product) ? 2 : 1;
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

    if (pendingComboAsProduct) {
      // Aplicar molhos sobre o combo (cobrando extras no combo)
      addToCart(applyPromotionIfAny(pendingComboAsProduct), `Combo - ${notes}`, saucePrice);
      setPendingComboAsProduct(null);
    } else {
      // Fluxo original para hambúrguer avulso
      addToCart(applyPromotionIfAny(selectedProduct), notes, saucePrice);
    }

    setShowSauceDialog(false);
    setSelectedProduct(null);
    setSauceNote("");
    setSelectedSauces([]);
  };

  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }
    
    setCart(prevCart =>
      prevCart.map(item =>
        item.id === productId ? { ...item, quantity } : item
      )
    );
  };

  const removeFromCart = (productId: string) => {
    setCart(prevCart => prevCart.filter(item => item.id !== productId));
  };

  const calculateSubtotal = () => {
    return cart.reduce((total, item) => {
      const itemPrice = item.price + (item.saucePrice || 0);
      return total + (itemPrice * item.quantity);
    }, 0);
  };

  const calculateTotal = () => {
    return calculateSubtotal() + (includeDelivery ? deliveryFee : 0);
  };

  const handleCheckout = async () => {
    if (cart.length === 0) {
      toast.error("Carrinho vazio");
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
        console.error("Profile error:", profileError);
        toast.error("Estabelecimento não encontrado");
        return;
      }

      const orderNumber = `PDV-${Date.now()}`;
      const subtotal = calculateSubtotal();
      const finalTotal = selectedCustomer && selectedCustomer.groups.length > 0 ? 
        calculateDiscountedTotal() : calculateTotal();
      const discountAmount = selectedCustomer && selectedCustomer.groups.length > 0 ? 
        (subtotal + (includeDelivery ? deliveryFee : 0) - finalTotal) : 0;

      // Create order - se for PIX, status fica como pending
      const isPix = paymentMethod === "pix";
      
      // Preparar notes com instruções gerais se houver
      const orderNotes = generalInstructions.trim() 
        ? `Instruções do Pedido: ${generalInstructions.trim()}`
        : null;
      
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          establishment_id: profile.establishment_id,
          order_number: orderNumber,
          customer_name: customerName || "Cliente Balcão",
          customer_phone: customerPhone,
          order_type: includeDelivery ? "delivery" : "balcao",
          status: isPix ? "pending" : "completed",
          payment_status: isPix ? "pending" : "paid",
          payment_method: paymentMethod,
          subtotal: subtotal,
          discount_amount: discountAmount,
          total_amount: finalTotal,
          notes: orderNotes
        })
        .select()
        .single();

      if (orderError) throw orderError;

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

          const unitPrice = item.price + (item.saucePrice || 0);
          return {
            order_id: order.id,
            product_id: productId,
            quantity: item.quantity,
            unit_price: unitPrice,
            total_price: unitPrice * item.quantity,
            notes: item.promotionName ? `${item.notes ? item.notes + ' | ' : ''}Promoção: ${item.promotionName}${item.originalPrice ? ` (de R$ ${Number(item.originalPrice).toFixed(2)} por R$ ${Number(item.price).toFixed(2)})` : ''}` : item.notes,
            promotion_id: item.promotionId || null,
            original_price: item.originalPrice || null,
          };
        })
      );

      const { error: itemsError } = await supabase
        .from("order_items")
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;

      // Prepare receipt data
      const receiptData: ReceiptData = {
        orderNumber: orderNumber,
        customerName: customerName || "Cliente Balcão",
        customerPhone: customerPhone,
        customerAddress: selectedCustomer?.address,
        items: cart.map(item => ({
          name: item.name,
          quantity: item.quantity,
          unitPrice: item.price + (item.saucePrice || 0),
          totalPrice: (item.price + (item.saucePrice || 0)) * item.quantity,
          notes: item.promotionName ? `${item.notes ? item.notes + ' | ' : ''}Promoção: ${item.promotionName}${item.originalPrice ? ` (de R$ ${Number(item.originalPrice).toFixed(2)} por R$ ${Number(item.price).toFixed(2)})` : ''}` : item.notes
        })),
        subtotal: subtotal,
        discountAmount: discountAmount,
        deliveryFee: includeDelivery ? deliveryFee : 0,
        totalAmount: finalTotal,
        establishmentName: `${establishmentInfo.name || ''}${establishmentInfo.storeNumber ? ' - ' + establishmentInfo.storeNumber : ''}`,
        establishmentAddress: establishmentInfo.address,
        establishmentPhone: establishmentInfo.phone,
        paymentMethod: paymentMethod,
        orderType: includeDelivery ? "delivery" : "balcao",
        cashGiven: paymentMethod === 'dinheiro' ? cashGiven : undefined,
        cashChange: paymentMethod === 'dinheiro' ? Math.max(0, Number(cashGiven) - Number(finalTotal)) : undefined,
        generalInstructions: generalInstructions.trim() || undefined
      };

      // Se for PIX, abrir modal de pagamento
      if (isPix) {
        setPendingOrderId(order.id);
        setPendingOrderAmount(finalTotal);
        setPendingReceiptData(receiptData);
        setShowPixModal(true);
        return; // Não limpa o carrinho ainda
      }

      // Print receipt (somente para pagamentos não-PIX)
      await printReceipt(receiptData);

      // Clear cart and customer info
      setCart([]);
      setCustomerName("");
      setCustomerPhone("");
      setCustomerSearch("");
      setSelectedCustomer(null);
      setDeliveryFee((establishmentSettings as any)?.delivery_fee || 0);
      setIncludeDelivery(false);
      setPaymentMethod("");
      setGeneralInstructions("");

      toast.success(`Venda finalizada! Pedido: ${orderNumber}`);
    } catch (error) {
      console.error("Checkout error:", error);
      toast.error("Erro ao finalizar venda");
    }
  };

  const handlePixPaymentConfirmed = async () => {
    // Imprimir comanda após confirmação do PIX
    if (pendingReceiptData) {
      await printReceipt(pendingReceiptData);
    }

    // Limpar carrinho e dados do cliente
    setCart([]);
    setCustomerName("");
    setCustomerPhone("");
    setCustomerSearch("");
    setSelectedCustomer(null);
    setDeliveryFee((establishmentSettings as any)?.delivery_fee || 0);
    setIncludeDelivery(false);
    setPaymentMethod("");
    setGeneralInstructions("");
    setPendingOrderId("");
    setPendingOrderAmount(0);
    setPendingReceiptData(null);
    setShowPixModal(false);
  };

  const getProductsByCategory = () => {
    const filteredProducts = products.filter(product =>
      product?.name?.toLowerCase().includes(searchTerm.toLowerCase())
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
      if (p.type === 'product') return p.target_id === product.id;
      if (p.type === 'category') return p.target_id && product.category_id === p.target_id;
      if (p.type === 'global') return true;
      return false;
    });
    if (!applicable) return null;
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
      console.error("Error processing WhatsApp order:", error);
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
    <div className="min-h-screen bg-background flex">
      <Sidebar />
      
      <main className="flex-1 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold text-foreground">PDV - Ponto de Venda</h1>
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
                  {combos && combos.length > 0 && (
                    <div className="mb-6">
                      <h3 className="text-base font-semibold mb-2 text-primary border-b border-border pb-1">Combos</h3>
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
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
                    </div>
                  )}

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
                              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
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
                        onCheckedChange={setIncludeDelivery}
                      />
                    </div>
                  </div>

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
                      <option value="cartao_credito">Cartão de Crédito</option>
                      <option value="cartao_debito">Cartão de Débito</option>
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
                    {cart.map((item, idx) => (
                      <div key={`${item.id}-${idx}-${item.notes || ''}`} className="flex items-center justify-between p-2 border rounded">
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
                            {item.saucePrice ? ` + R$ ${item.saucePrice.toFixed(2)} (molhos)` : ''} cada
                          </p>
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
                            onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          
                          <span className="text-sm w-8 text-center">{item.quantity}</span>
                          
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                          
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => removeFromCart(item.id)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
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
                             <span>R$ {deliveryFee.toFixed(2)}</span>
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

      <PixPaymentModal
        open={showPixModal}
        onClose={() => setShowPixModal(false)}
        orderId={pendingOrderId}
        amount={pendingOrderAmount}
        onPaymentConfirmed={handlePixPaymentConfirmed}
      />
    </div>
  );
};

export default PDV;