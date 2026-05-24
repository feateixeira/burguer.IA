import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  getInitialPaymentMethodSelection,
  PAYMENT_METHOD_OPTIONS,
  type OrderPaymentMethod,
} from "@/utils/paymentMethod";

interface OrderForPaymentChange {
  id: string;
  order_number: number | string;
  payment_method?: string | null;
}

interface ChangePaymentMethodModalProps {
  open: boolean;
  order: OrderForPaymentChange | null;
  onClose: () => void;
  onSave: (paymentMethod: OrderPaymentMethod) => Promise<void>;
  saving?: boolean;
}

export function ChangePaymentMethodModal({
  open,
  order,
  onClose,
  onSave,
  saving = false,
}: ChangePaymentMethodModalProps) {
  const [selected, setSelected] = useState<OrderPaymentMethod | null>(null);

  useEffect(() => {
    if (open && order) {
      setSelected(getInitialPaymentMethodSelection(order.payment_method));
    }
  }, [open, order?.id, order?.payment_method]);

  const handleSave = async () => {
    if (!selected) return;
    await onSave(selected);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-md p-6">
        <DialogHeader>
          <DialogTitle>
            Pedido #{order?.order_number ?? "—"} — Forma de Pagamento
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3 my-2">
          {PAYMENT_METHOD_OPTIONS.map(({ value, label, icon }) => (
            <button
              key={value}
              type="button"
              disabled={saving}
              onClick={() => setSelected(value)}
              className={cn(
                "flex flex-col items-center gap-2 py-5 px-4 text-[15px] font-semibold rounded-[10px] border-2 cursor-pointer transition-all duration-150",
                "border-gray-200 bg-white hover:border-[#f97316] hover:bg-[#fff7ed]",
                selected === value &&
                  "border-[#f97316] bg-[#fff7ed] text-[#ea580c]"
              )}
            >
              <span className="text-2xl leading-none">{icon}</span>
              <span>{label}</span>
            </button>
          ))}
        </div>

        <DialogFooter className="gap-3 sm:gap-3">
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={!selected || saving}
            className="bg-[#f97316] hover:bg-[#ea580c] text-white font-semibold disabled:opacity-40"
          >
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
