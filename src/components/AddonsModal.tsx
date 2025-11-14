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
import { Plus, Minus } from "lucide-react";
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
}

export const AddonsModal = ({
  open,
  onClose,
  onConfirm,
  productId,
  categoryId,
  establishmentId,
  productName,
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

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-xl max-h-[85vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-3">
          <DialogTitle className="text-lg">Adicionais para {productName}</DialogTitle>
          <DialogDescription className="text-sm">
            Selecione os adicionais desejados
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col px-6">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
            </div>
          ) : addons.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground">
                Não há adicionais disponíveis para este produto
              </p>
              <Button onClick={onClose} size="sm" className="mt-4">
                Fechar
              </Button>
            </div>
          ) : (
            <div className="flex-1 flex flex-col min-h-0">
              <div className="space-y-2 overflow-y-auto flex-1 pr-2">
                {addons.map((addon) => {
                  const quantity = selectedAddons.get(addon.id) || 0;
                  const isSelected = quantity > 0;

                  return (
                    <div
                      key={addon.id}
                      className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-colors ${
                        isSelected ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                      }`}
                      onClick={() => handleAddonToggle(addon.id)}
                    >
                      <div className="flex items-center space-x-3 flex-1 min-w-0">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => handleAddonToggle(addon.id)}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <Label
                              htmlFor={`addon-${addon.id}`}
                              className="font-medium cursor-pointer text-sm"
                            >
                              {addon.name}
                            </Label>
                            {isSelected && (
                              <Badge variant="secondary" className="text-xs">
                                {quantity}x
                              </Badge>
                            )}
                          </div>
                          {addon.description && (
                            <p className="text-xs text-muted-foreground mt-0.5 truncate">
                              {addon.description}
                            </p>
                          )}
                          <p className="text-sm font-semibold text-primary mt-1">
                            R$ {addon.price.toFixed(2)}
                          </p>
                        </div>
                      </div>

                      {isSelected && (
                        <div
                          className="flex items-center space-x-2 ml-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleQuantityChange(addon.id, -1)}
                            className="h-7 w-7 p-0"
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="w-6 text-center font-medium text-sm">
                            {quantity}
                          </span>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleQuantityChange(addon.id, 1)}
                            className="h-7 w-7 p-0"
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {!loading && addons.length > 0 && (
          <div className="px-6 pb-6 pt-3 border-t space-y-3">
            {selectedAddons.size > 0 && (
              <div className="flex justify-between items-center">
                <span className="font-semibold text-sm">Total de Adicionais:</span>
                <span className="text-base font-bold text-primary">
                  R$ {getTotalAddonsPrice().toFixed(2)}
                </span>
              </div>
            )}

            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={onClose} size="sm">
                Cancelar
              </Button>
              <Button onClick={handleConfirm} size="sm">
                Confirmar
                {selectedAddons.size > 0 && ` (+R$ ${getTotalAddonsPrice().toFixed(2)})`}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
