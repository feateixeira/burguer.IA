import { useState } from "react";
import { Input } from "@/components/ui/input";
import { CashSessionTotals } from "@/hooks/useCashSession";
import { formatCurrency, parseCurrency } from "@/utils/currency";
import { cn } from "@/lib/utils";

interface CashClosingConferenceProps {
  totals: CashSessionTotals;
  pedidosAConfirmar: number;
  openingAmount?: number;
}

const METHODS = [
  { key: "dinheiro" as const, label: "Dinheiro", totalKey: "expected_cash" as const },
  { key: "pix" as const, label: "PIX", totalKey: "expected_pix" as const },
  { key: "debito" as const, label: "Débito", totalKey: "expected_debit" as const },
  { key: "credito" as const, label: "Crédito", totalKey: "expected_credit" as const },
];

const DIFF_EPSILON = 0.009;

export function CashClosingConference({
  totals,
  pedidosAConfirmar,
  openingAmount = 0,
}: CashClosingConferenceProps) {
  const [valoresReais, setValoresReais] = useState<Record<string, string>>({});

  const getDiff = (totalKey: (typeof METHODS)[number]["totalKey"]) => {
    const inputKey = METHODS.find((m) => m.totalKey === totalKey)?.key;
    if (!inputKey) return null;
    const raw = valoresReais[inputKey];
    if (raw === undefined || raw.trim() === "") return null;
    const contado = parseCurrency(raw);
    if (Number.isNaN(contado)) return null;
    return contado - (totals[totalKey] || 0);
  };

  const formatDiffLabel = (diff: number) => {
    if (Math.abs(diff) < DIFF_EPSILON) return "✅ Bateu";
    if (diff > 0) return `+${formatCurrency(diff)}`;
    return `-${formatCurrency(Math.abs(diff))}`;
  };

  const getDiffTone = (diff: number | null) => {
    if (diff === null) return "vazio";
    if (Math.abs(diff) < DIFF_EPSILON) return "ok";
    if (diff > 0) return "sobra";
    return "falta";
  };

  return (
    <div className="space-y-3">
      <h4 className="font-semibold text-sm">Resultado do Turno</h4>

      {pedidosAConfirmar > 0 && (
        <div
          className="bg-[#fff7ed] border border-[#fed7aa] border-l-4 border-l-[#f97316] rounded-lg px-4 py-3 text-[#9a3412] text-[13px]"
          role="alert"
        >
          ⚠️ <strong>{pedidosAConfirmar} pedido(s)</strong> com pagamento{" "}
          <strong>À CONFIRMAR</strong> não estão incluídos nos valores abaixo. Corrija
          antes de fechar.
        </div>
      )}

      <div className="hidden sm:grid sm:grid-cols-[1fr_1fr_110px] gap-3 px-3 text-xs font-medium text-muted-foreground">
        <span>Esperado</span>
        <span>Valor contado</span>
        <span className="text-center">Diferença</span>
      </div>

      <div className="flex flex-col gap-3">
        {METHODS.map(({ key, label, totalKey }) => {
          const diff = getDiff(totalKey);
          const tone = getDiffTone(diff);
          return (
            <div
              key={key}
              className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_110px] items-center gap-3 p-3 bg-[#f9fafb] dark:bg-muted/40 rounded-lg"
            >
              <div>
                <span className="text-xs text-[#6b7280] dark:text-muted-foreground block sm:hidden mb-0.5">
                  {label} esperado
                </span>
                <span className="text-xs text-[#6b7280] dark:text-muted-foreground hidden sm:block">
                  {label} Esperado
                </span>
                <span className="text-base font-bold text-[#111827] dark:text-foreground">
                  {formatCurrency(totals[totalKey] || 0)}
                </span>
                {key === "dinheiro" && openingAmount > 0 && (
                  <span className="text-xs text-muted-foreground block mt-0.5">
                    (Abertura: {formatCurrency(openingAmount)})
                  </span>
                )}
              </div>
              <div>
                <span className="text-xs text-muted-foreground block sm:hidden mb-1">
                  Valor contado
                </span>
                <Input
                  type="text"
                  inputMode="decimal"
                  placeholder="0,00"
                  className="border-[1.5px] border-[#e5e7eb] focus-visible:ring-[#f97316] focus-visible:border-[#f97316]"
                  value={valoresReais[key] ?? ""}
                  onChange={(e) =>
                    setValoresReais((prev) => ({ ...prev, [key]: e.target.value }))
                  }
                />
              </div>
              <div className="flex flex-col items-center justify-center min-h-[40px]">
                <span className="text-xs text-muted-foreground block sm:hidden mb-1">
                  Diferença
                </span>
                <div
                  className={cn(
                    "text-[13px] font-bold text-center w-full py-1.5 rounded-md",
                    tone === "vazio" && "text-[#9ca3af]",
                    tone === "ok" && "text-[#16a34a] bg-green-50 dark:bg-green-950/30",
                    tone === "sobra" && "text-[#d97706] bg-amber-50 dark:bg-amber-950/30",
                    tone === "falta" && "text-[#dc2626] bg-red-50 dark:bg-red-950/30"
                  )}
                >
                  {diff === null ? "—" : formatDiffLabel(diff)}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="pt-2 border-t flex justify-between items-center">
        <span className="text-sm font-medium">Total Esperado:</span>
        <span className="text-lg font-bold">
          {formatCurrency(totals.expected_total || 0)}
        </span>
      </div>
    </div>
  );
}
