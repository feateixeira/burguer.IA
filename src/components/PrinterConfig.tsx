import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Printer, Plus, Trash2, TestTube, Check, X } from "lucide-react";
import { toast } from "sonner";
import { printReceipt, ReceiptData } from "@/utils/receiptPrinter";

interface PrinterConfig {
  id: string;
  name: string;
  paperWidth: number; // 58mm or 80mm
  fontSize: number;
  isDefault: boolean;
}

export const PrinterConfigComponent = () => {
  const [printers, setPrinters] = useState<PrinterConfig[]>([]);
  const [newPrinterName, setNewPrinterName] = useState("");

  useEffect(() => {
    loadPrinters();
  }, []);

  const loadPrinters = () => {
    const saved = localStorage.getItem("printer_configs");
    if (saved) {
      setPrinters(JSON.parse(saved));
    }
  };

  const savePrinters = (updatedPrinters: PrinterConfig[]) => {
    localStorage.setItem("printer_configs", JSON.stringify(updatedPrinters));
    setPrinters(updatedPrinters);
  };


  const addPrinter = () => {
    if (!newPrinterName.trim()) {
      toast.error("Digite um nome para a impressora");
      return;
    }

    const newPrinter: PrinterConfig = {
      id: Date.now().toString(),
      name: newPrinterName,
      paperWidth: 80,
      fontSize: 28,
      isDefault: printers.length === 0,
    };

    savePrinters([...printers, newPrinter]);
    setNewPrinterName("");
    toast.success("Impressora adicionada com sucesso!");
  };

  const deletePrinter = (id: string) => {
    const updated = printers.filter(p => p.id !== id);
    
    // Se estava deletando a default, marca a primeira como default
    if (updated.length > 0 && !updated.some(p => p.isDefault)) {
      updated[0].isDefault = true;
    }
    
    savePrinters(updated);
    toast.success("Impressora removida!");
  };

  const updatePrinter = (id: string, field: keyof PrinterConfig, value: any) => {
    const updated = printers.map(p => {
      if (p.id === id) {
        // Se está marcando como default, desmarca as outras
        if (field === "isDefault" && value === true) {
          return { ...p, [field]: value };
        }
        return { ...p, [field]: value };
      }
      // Desmarca outras como default se está marcando uma nova
      if (field === "isDefault" && value === true) {
        return { ...p, isDefault: false };
      }
      return p;
    });
    
    savePrinters(updated);
  };

  const testPrinter = (printer: PrinterConfig) => {
    // Criar dados de teste
    const testData: ReceiptData = {
      orderNumber: "TESTE-001",
      customerName: "Cliente Teste",
      customerPhone: "(11) 99999-9999",
      customerAddress: "Rua Exemplo, 123 - Bairro Teste",
      items: [
        {
          name: "X-Burger Teste",
          quantity: 2,
          unitPrice: 25.00,
          totalPrice: 50.00,
          notes: "Sem cebola"
        },
        {
          name: "Coca-Cola 2L",
          quantity: 1,
          unitPrice: 10.00,
          totalPrice: 10.00
        }
      ],
      subtotal: 60.00,
      discountAmount: 5.00,
      deliveryFee: 8.00,
      totalAmount: 63.00,
      establishmentName: "burguer.IA",
      establishmentAddress: "Seu endereço aqui",
      establishmentPhone: "(00) 0000-0000",
      paymentMethod: "Dinheiro",
      orderType: "delivery"
    };

    // Persistir configs padrão antes do teste
    try {
      const current = JSON.parse(localStorage.getItem("printer_configs") || "[]");
      const withDefault = current.map((p: any) => ({ ...p, isDefault: p.id === printer.id }));
      localStorage.setItem("printer_configs", JSON.stringify(withDefault));
    } catch {}

    toast.info(`Imprimindo teste na impressora do sistema...`);
    printReceipt(testData);
  };

  return (
    <div className="space-y-6">
      <Card className="border-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Printer className="h-5 w-5 text-primary" />
            Adicionar Nova Impressora
          </CardTitle>
          <CardDescription>
            Configure impressoras térmicas para emissão de comprovantes
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <div className="flex-1">
              <Input
                placeholder="Nome da impressora (ex: Impressora Cozinha)"
                value={newPrinterName}
                onChange={(e) => setNewPrinterName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addPrinter()}
                className="h-11"
              />
            </div>
            <Button onClick={addPrinter} size="lg">
              <Plus className="h-4 w-4 mr-2" />
              Adicionar
            </Button>
          </div>
        </CardContent>
      </Card>

      {printers.length === 0 ? (
        <Card className="border-2 border-dashed">
          <CardContent className="py-16">
            <div className="text-center text-muted-foreground">
              <Printer className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg">Nenhuma impressora configurada</p>
              <p className="text-sm mt-2">Adicione uma impressora para começar a imprimir comprovantes</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {printers.map((printer) => (
            <Card key={printer.id} className={printer.isDefault ? "border-2 border-primary" : "border-2"}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Printer className="h-5 w-5" />
                    {printer.name}
                    {printer.isDefault && (
                      <span className="text-xs bg-primary text-primary-foreground px-2 py-1 rounded">
                        Padrão
                      </span>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deletePrinter(printer.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Largura do Papel</Label>
                    <Select
                      value={printer.paperWidth.toString()}
                      onValueChange={(value) => updatePrinter(printer.id, "paperWidth", parseInt(value))}
                    >
                      <SelectTrigger className="h-11">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="58">58mm</SelectItem>
                        <SelectItem value="80">80mm</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Tamanho da Fonte</Label>
                    <Select
                      value={printer.fontSize.toString()}
                      onValueChange={(value) => updatePrinter(printer.id, "fontSize", parseInt(value))}
                    >
                      <SelectTrigger className="h-11">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="22">Pequena (22px)</SelectItem>
                        <SelectItem value="24">Média-Pequena (24px)</SelectItem>
                        <SelectItem value="26">Média (26px)</SelectItem>
                        <SelectItem value="28">Média-Grande (28px)</SelectItem>
                        <SelectItem value="30">Grande (30px)</SelectItem>
                        <SelectItem value="32">Extra Grande (32px)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Impressora Padrão</Label>
                    <Button
                      variant={printer.isDefault ? "default" : "outline"}
                      className="w-full h-11"
                      onClick={() => updatePrinter(printer.id, "isDefault", !printer.isDefault)}
                    >
                      {printer.isDefault ? (
                        <>
                          <Check className="h-4 w-4 mr-2" />
                          Padrão
                        </>
                      ) : (
                        <>
                          <X className="h-4 w-4 mr-2" />
                          Não Padrão
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                <div className="pt-2">
                  <Button
                    variant="secondary"
                    className="w-full"
                    onClick={() => testPrinter(printer)}
                    size="lg"
                  >
                    <TestTube className="h-4 w-4 mr-2" />
                    Imprimir Comprovante Teste
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};