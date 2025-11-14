import { useState, useEffect } from "react";
import { useConfirm } from "@/hooks/useConfirm";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Printer, Plus, Trash2, Edit, TestTube, Power, MapPin, Settings } from "lucide-react";
import { printReceipt, ReceiptData } from "@/utils/receiptPrinter";

interface Printer {
  id: string;
  name: string;
  type: 'local' | 'network' | 'bluetooth';
  location: string | null;
  paper_width: number;
  font_size: number;
  font_family: string;
  ip_address: string | null;
  port: number | null;
  bluetooth_address: string | null;
  print_all: boolean;
  active: boolean;
}

export function PrintersManager({ establishmentId }: { establishmentId: string }) {
  const confirmDialog = useConfirm();
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPrinter, setEditingPrinter] = useState<Printer | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    type: 'network' as 'local' | 'network' | 'bluetooth',
    location: '',
    paper_width: 80,
    font_size: 12,
    font_family: 'monospace',
    ip_address: '',
    port: 9100,
    bluetooth_address: '',
    print_all: false,
    active: true
  });

  useEffect(() => {
    loadPrinters();
  }, [establishmentId]);

  const loadPrinters = async () => {
    try {
      const { data, error } = await supabase
        .from('printers')
        .select('*')
        .eq('establishment_id', establishmentId)
        .order('name');

      if (error) throw error;
      setPrinters((data || []) as Printer[]);
    } catch (error) {
      console.error('Error loading printers:', error);
      toast.error('Erro ao carregar impressoras');
    } finally {
      setLoading(false);
    }
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editingPrinter) {
        const { error } = await supabase
          .from('printers')
          .update(formData)
          .eq('id', editingPrinter.id);

        if (error) throw error;
        toast.success('Impressora atualizada com sucesso');
      } else {
        const { error } = await supabase
          .from('printers')
          .insert([{ ...formData, establishment_id: establishmentId }]);

        if (error) throw error;
        toast.success('Impressora cadastrada com sucesso');
      }

      setDialogOpen(false);
      resetForm();
      loadPrinters();
    } catch (error) {
      console.error('Error saving printer:', error);
      toast.error('Erro ao salvar impressora');
    }
  };

  const handleDelete = async (id: string) => {
    const ok = await confirmDialog({ title: 'Excluir impressora', description: 'Deseja realmente excluir esta impressora?' });
    if (!ok) return;

    try {
      const { error } = await supabase
        .from('printers')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Impressora excluída com sucesso');
      loadPrinters();
    } catch (error) {
      console.error('Error deleting printer:', error);
      toast.error('Erro ao excluir impressora');
    }
  };

  const handleToggleActive = async (printer: Printer) => {
    try {
      const { error } = await supabase
        .from('printers')
        .update({ active: !printer.active })
        .eq('id', printer.id);

      if (error) throw error;
      toast.success(`Impressora ${!printer.active ? 'ativada' : 'desativada'}`);
      loadPrinters();
    } catch (error) {
      console.error('Error toggling printer:', error);
      toast.error('Erro ao alterar status da impressora');
    }
  };

  const handleTestPrint = async (printer: Printer) => {
    try {
      // Define esta impressora como padrão para papel/fonte (salvar em localStorage para o receipt)
      const current = JSON.parse(localStorage.getItem("printer_configs") || "[]");
      const mapped = current.map((p: any) => ({ ...p, isDefault: false }));
      const def = { id: printer.id, name: printer.name, paperWidth: printer.paper_width, fontSize: Math.max(18, printer.font_size), isDefault: true };
      localStorage.setItem("printer_configs", JSON.stringify([def, ...mapped]));

      const testData: ReceiptData = {
        orderNumber: "TESTE-001",
        customerName: "Cliente Teste",
        customerPhone: "(11) 99999-9999",
        customerAddress: "Rua Exemplo, 123",
        items: [
          { name: "X-Burger", quantity: 2, unitPrice: 25, totalPrice: 50, notes: "Sem cebola" },
          { name: "Refrigerante 2L", quantity: 1, unitPrice: 10, totalPrice: 10 }
        ],
        subtotal: 60,
        discountAmount: 0,
        deliveryFee: 0,
        totalAmount: 60,
        establishmentName: "Teste",
        orderType: "balcao",
      } as any;

      toast.info(`Imprimindo teste na impressora do sistema...`);
      await printReceipt(testData);
      toast.success('Impressão de teste enviada');
    } catch (e) {
      console.error(e);
      toast.error('Falha ao enviar impressão');
    }
  };

  const openEditDialog = (printer: Printer) => {
    setEditingPrinter(printer);
    setFormData({
      name: printer.name,
      type: printer.type,
      location: printer.location || '',
      paper_width: printer.paper_width,
      font_size: printer.font_size,
      font_family: printer.font_family,
      ip_address: printer.ip_address || '',
      port: printer.port || 9100,
      bluetooth_address: printer.bluetooth_address || '',
      print_all: printer.print_all,
      active: printer.active
    });
    setDialogOpen(true);
  };

  const resetForm = () => {
    setEditingPrinter(null);
    setFormData({
      name: '',
      type: 'network',
      location: '',
      paper_width: 80,
      font_size: 12,
      font_family: 'monospace',
      ip_address: '',
      port: 9100,
      bluetooth_address: '',
      print_all: false,
      active: true
    });
  };

  const getPrinterTypeLabel = (type: string) => {
    const types = {
      local: 'Local',
      network: 'Rede',
      bluetooth: 'Bluetooth'
    };
    return types[type as keyof typeof types] || type;
  };

  if (loading) {
    return <div className="text-center py-8">Carregando impressoras...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Impressoras Cadastradas</h3>
          <p className="text-sm text-muted-foreground">
            Configure e gerencie suas impressoras de recibos
          </p>
        </div>
        <Button onClick={() => { resetForm(); setDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Impressora
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {printers.map((printer) => (
          <Card key={printer.id} className={!printer.active ? 'opacity-60' : ''}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <Printer className="h-5 w-5 text-primary" />
                  <div>
                    <CardTitle className="text-base">{printer.name}</CardTitle>
                    <CardDescription className="text-xs">
                      {getPrinterTypeLabel(printer.type)}
                    </CardDescription>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleToggleActive(printer)}
                    title={printer.active ? 'Desativar' : 'Ativar'}
                  >
                    <Power className={`h-4 w-4 ${printer.active ? 'text-green-500' : 'text-gray-400'}`} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleTestPrint(printer)}
                    title="Testar impressão"
                  >
                    <TestTube className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => openEditDialog(printer)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(printer.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {printer.location && (
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span>{printer.location}</span>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                {printer.print_all && (
                  <Badge variant="secondary">Imprime Tudo</Badge>
                )}
                <Badge variant="outline">{printer.paper_width}mm</Badge>
                <Badge variant="outline">Fonte {printer.font_size}pt</Badge>
                {printer.type === 'network' && printer.ip_address && (
                  <Badge variant="outline">{printer.ip_address}:{printer.port}</Badge>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {printers.length === 0 && (
        <Card>
          <CardContent className="text-center py-8">
            <Printer className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground mb-4">
              Nenhuma impressora cadastrada
            </p>
            <Button onClick={() => { resetForm(); setDialogOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" />
              Cadastrar Primeira Impressora
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingPrinter ? 'Editar Impressora' : 'Nova Impressora'}
            </DialogTitle>
            <DialogDescription>
              Configure os parâmetros da impressora de recibos
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Nome da Impressora *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  placeholder="Ex: Impressora Cozinha"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="type">Tipo de Conexão *</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value: 'local' | 'network' | 'bluetooth') => 
                    setFormData({ ...formData, type: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="local">Local (USB)</SelectItem>
                    <SelectItem value="network">Rede (IP)</SelectItem>
                    <SelectItem value="bluetooth">Bluetooth</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="location">Local</Label>
                <Input
                  id="location"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  placeholder="Ex: Cozinha, Balcão"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="paper_width">Largura do Papel (mm)</Label>
                <Input
                  id="paper_width"
                  type="number"
                  value={formData.paper_width}
                  onChange={(e) => setFormData({ ...formData, paper_width: parseInt(e.target.value) })}
                  min="58"
                  max="80"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="font_size">Tamanho da Fonte (pt)</Label>
                <Input
                  id="font_size"
                  type="number"
                  value={formData.font_size}
                  onChange={(e) => setFormData({ ...formData, font_size: parseInt(e.target.value) })}
                  min="8"
                  max="20"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="font_family">Família da Fonte</Label>
                <Select
                  value={formData.font_family}
                  onValueChange={(value) => setFormData({ ...formData, font_family: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monospace">Monospace</SelectItem>
                    <SelectItem value="sans-serif">Sans Serif</SelectItem>
                    <SelectItem value="serif">Serif</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {formData.type === 'network' && (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="ip_address">Endereço IP</Label>
                  <Input
                    id="ip_address"
                    value={formData.ip_address}
                    onChange={(e) => setFormData({ ...formData, ip_address: e.target.value })}
                    placeholder="192.168.1.100"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="port">Porta</Label>
                  <Input
                    id="port"
                    type="number"
                    value={formData.port}
                    onChange={(e) => setFormData({ ...formData, port: parseInt(e.target.value) })}
                    placeholder="9100"
                  />
                </div>
              </div>
            )}

            {formData.type === 'bluetooth' && (
              <div className="space-y-2">
                <Label htmlFor="bluetooth_address">Endereço Bluetooth</Label>
                <Input
                  id="bluetooth_address"
                  value={formData.bluetooth_address}
                  onChange={(e) => setFormData({ ...formData, bluetooth_address: e.target.value })}
                  placeholder="00:11:22:33:44:55"
                />
              </div>
            )}

            <div className="flex items-center space-x-2 pt-2">
              <Switch
                id="print_all"
                checked={formData.print_all}
                onCheckedChange={(checked) => setFormData({ ...formData, print_all: checked })}
              />
              <Label htmlFor="print_all" className="cursor-pointer">
                Imprimir todos os pedidos (sem roteamento)
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="active"
                checked={formData.active}
                onCheckedChange={(checked) => setFormData({ ...formData, active: checked })}
              />
              <Label htmlFor="active" className="cursor-pointer">
                Impressora ativa
              </Label>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit">
                {editingPrinter ? 'Salvar' : 'Cadastrar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
