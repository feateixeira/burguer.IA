import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Minus, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Addon {
  id: string;
  name: string;
  description?: string;
  price: number;
}

interface AddonsModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (selectedAddons: Addon[]) => void;
  productId: string;
  categoryId?: string | null;
  establishmentId: string;
  productName: string;
  primaryColor?: string;
  secondaryColor?: string;
}

export const AddonsModal = ({
  open,
  onClose,
  onConfirm,
  productId,
  categoryId,
  establishmentId,
  productName,
  primaryColor = "#3b82f6",
  secondaryColor = "#8b5cf6",
}: AddonsModalProps) => {
  const [addons, setAddons] = useState<Addon[]>([]);
  const [selectedAddons, setSelectedAddons] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && establishmentId) {
      loadAddons();
    } else {
      // Reset quando fechar
      setAddons([]);
      setSelectedAddons(new Map());
    }
  }, [open, productId, categoryId, establishmentId]);

  const loadAddons = async () => {
    try {
      setLoading(true);
      setSelectedAddons(new Map());

      // Executar queries em paralelo para melhor performance
      const queries: Promise<any>[] = [];

      if (categoryId) {
        queries.push(
          supabase
            .from("category_addons")
            .select("addon_id, addons!inner(id, name, description, price, active)")
            .eq("category_id", categoryId)
            .eq("addons.active", true)
        );
      }

      queries.push(
        supabase
          .from("product_addons")
          .select("addon_id, addons!inner(id, name, description, price, active)")
          .eq("product_id", productId)
          .eq("addons.active", true)
      );

      const results = await Promise.all(queries);
      const addonsMap = new Map<string, Addon>();

      results.forEach((result) => {
        if (result.data) {
          result.data.forEach((item: any) => {
            if (item.addons && item.addons.active) {
              addonsMap.set(item.addon_id, item.addons);
            }
          });
        }
      });

      setAddons(Array.from(addonsMap.values()));
    } catch (error) {
      console.error("Error loading addons:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddonToggle = (addonId: string) => {
    setSelectedAddons((prev) => {
      const newMap = new Map(prev);
      if (newMap.has(addonId)) {
        newMap.delete(addonId);
      } else {
        newMap.set(addonId, 1);
      }
      return newMap;
    });
  };

  const handleQuantityChange = (addonId: string, delta: number) => {
    setSelectedAddons((prev) => {
      const newMap = new Map(prev);
      const currentQty = newMap.get(addonId) || 0;
      const newQty = Math.max(0, currentQty + delta);
      if (newQty === 0) {
        newMap.delete(addonId);
      } else {
        newMap.set(addonId, newQty);
      }
      return newMap;
    });
  };

  const handleConfirm = () => {
    const selectedAddonsList = Array.from(selectedAddons.entries()).map(
      ([addonId, quantity]) => {
        const addon = addons.find((a) => a.id === addonId);
        return { ...addon!, quantity };
      }
    );
    onConfirm(selectedAddonsList);
    onClose();
  };

  const getTotalAddonsPrice = () => {
    return Array.from(selectedAddons.entries()).reduce((total, [addonId, quantity]) => {
      const addon = addons.find((a) => a.id === addonId);
      return total + (addon?.price || 0) * quantity;
    }, 0);
  };

  if (!open) return null;

  const totalAddonsPrice = getTotalAddonsPrice();
  const hasSelectedAddons = selectedAddons.size > 0;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        {/* Header com gradiente */}
        <DialogHeader 
          className="px-6 pt-6 pb-4 relative overflow-hidden"
          style={{
            background: `linear-gradient(135deg, ${primaryColor}15 0%, ${secondaryColor}15 100%)`,
          }}
        >
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-5 w-5" style={{ color: primaryColor }} />
              <DialogTitle className="text-2xl font-bold">
                Personalize seu {productName}
              </DialogTitle>
            </div>
            <DialogDescription className="text-base text-muted-foreground">
              Você deseja adicionar ao seu lanche algum dos adicionais? 
              <span className="block mt-1 text-sm font-medium" style={{ color: primaryColor }}>
                Torne seu pedido ainda mais especial! ✨
              </span>
            </DialogDescription>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col px-6 py-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 mb-4" style={{ borderColor: primaryColor }}></div>
              <p className="text-sm text-muted-foreground">Carregando adicionais...</p>
            </div>
          ) : addons.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-4xl mb-4">🍔</div>
              <p className="text-base font-medium text-muted-foreground mb-2">
                Nenhum adicional disponível
              </p>
              <p className="text-sm text-muted-foreground mb-6">
                Este produto já está completo e delicioso!
              </p>
              <Button 
                onClick={onClose} 
                size="lg"
                style={{ backgroundColor: primaryColor, color: "#ffffff" }}
                className="px-8"
              >
                Continuar sem adicionais
              </Button>
            </div>
          ) : (
            <div className="flex-1 flex flex-col min-h-0">
              <p className="text-sm font-medium text-muted-foreground mb-4">
                Escolha quantos quiser - todos são opcionais! 😊
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 overflow-y-auto flex-1 pr-2 pb-2">
                {addons.map((addon) => {
                  const quantity = selectedAddons.get(addon.id) || 0;
                  const isSelected = quantity > 0;

                  return (
                    <div
                      key={addon.id}
                      className={`relative p-4 border-2 rounded-xl cursor-pointer transition-all duration-200 ${
                        isSelected 
                          ? "border-opacity-100 shadow-lg scale-[1.02]" 
                          : "border-opacity-30 hover:border-opacity-60 hover:shadow-md"
                      }`}
                      style={{
                        borderColor: isSelected ? primaryColor : "currentColor",
                        backgroundColor: isSelected ? `${primaryColor}08` : "transparent",
                      }}
                      onClick={() => handleAddonToggle(addon.id)}
                    >
                      {/* Badge de selecionado */}
                      {isSelected && (
                        <div 
                          className="absolute -top-2 -right-2 h-6 w-6 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-lg"
                          style={{ backgroundColor: primaryColor }}
                        >
                          ✓
                        </div>
                      )}

                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => handleAddonToggle(addon.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="mt-0.5"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <Label
                              htmlFor={`addon-${addon.id}`}
                              className="font-semibold text-base cursor-pointer leading-tight"
                            >
                              {addon.name}
                            </Label>
                            <div className="flex-shrink-0">
                              <span 
                                className="text-lg font-bold"
                                style={{ color: primaryColor }}
                              >
                                R$ {addon.price.toFixed(2)}
                              </span>
                            </div>
                          </div>
                          {addon.description && (
                            <p className="text-sm text-muted-foreground mb-3 leading-relaxed">
                              {addon.description}
                            </p>
                          )}
                          
                          {isSelected && (
                            <div
                              className="flex items-center gap-2 mt-3 pt-3 border-t"
                              onClick={(e) => e.stopPropagation()}
                              style={{ borderColor: `${primaryColor}20` }}
                            >
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => handleQuantityChange(addon.id, -1)}
                                className="h-8 w-8 p-0 rounded-full"
                                style={{ borderColor: primaryColor }}
                              >
                                <Minus className="h-4 w-4" style={{ color: primaryColor }} />
                              </Button>
                              <span 
                                className="w-10 text-center font-bold text-base"
                                style={{ color: primaryColor }}
                              >
                                {quantity}
                              </span>
                              <Button
                                type="button"
                                size="sm"
                                onClick={() => handleQuantityChange(addon.id, 1)}
                                className="h-8 w-8 p-0 rounded-full"
                                style={{ backgroundColor: primaryColor, color: "#ffffff" }}
                              >
                                <Plus className="h-4 w-4" />
                              </Button>
                              <span className="text-xs text-muted-foreground ml-auto">
                                Total: <span className="font-semibold" style={{ color: primaryColor }}>
                                  R$ {(addon.price * quantity).toFixed(2)}
                                </span>
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {!loading && addons.length > 0 && (
          <div 
            className="px-6 pb-6 pt-4 border-t space-y-4"
            style={{ borderColor: `${primaryColor}20` }}
          >
            {hasSelectedAddons && (
              <div 
                className="p-4 rounded-lg"
                style={{ backgroundColor: `${primaryColor}10` }}
              >
                <div className="flex justify-between items-center mb-2">
                  <span className="font-semibold text-base">Total de Adicionais:</span>
                  <span 
                    className="text-2xl font-bold"
                    style={{ color: primaryColor }}
                  >
                    R$ {totalAddonsPrice.toFixed(2)}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {selectedAddons.size} {selectedAddons.size === 1 ? 'adicional selecionado' : 'adicionais selecionados'}
                </p>
              </div>
            )}

            <div className="flex gap-3">
              <Button 
                variant="outline" 
                onClick={onClose} 
                size="lg"
                className="flex-1"
              >
                {hasSelectedAddons ? 'Continuar sem adicionais' : 'Pular'}
              </Button>
              <Button 
                onClick={handleConfirm} 
                size="lg"
                className="flex-1 font-semibold shadow-lg hover:shadow-xl transition-shadow"
                style={{ 
                  backgroundColor: hasSelectedAddons ? primaryColor : secondaryColor,
                  color: "#ffffff"
                }}
              >
                {hasSelectedAddons ? (
                  <>
                    Adicionar ao Pedido
                    <span className="ml-2 opacity-90">
                      (+R$ {totalAddonsPrice.toFixed(2)})
                    </span>
                  </>
                ) : (
                  <>
                    Continuar sem Adicionais
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
