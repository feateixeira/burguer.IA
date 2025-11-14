import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { 
  Wallet, 
  Plus, 
  Minus, 
  X, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Truck
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface CashSession {
  id: string;
  establishment_id: string;
  opened_by: string;
  opened_at: string;
  opening_amount: number;
  closed_by: string | null;
  closed_at: string | null;
  closing_amount: number | null;
  expected_amount: number | null;
  difference_amount: number | null;
  notes: string | null;
  status: string;
  payment_method_counts: Record<string, number> | null;
}

interface CashTransaction {
  id: string;
  cash_session_id: string;
  type: 'withdraw' | 'deposit';
  amount: number;
  description: string | null;
  created_by: string;
  created_at: string;
}

const Cash = () => {
  const [currentSession, setCurrentSession] = useState<CashSession | null>(null);
  const [transactions, setTransactions] = useState<CashTransaction[]>([]);
  const [sessions, setSessions] = useState<CashSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [cashSales, setCashSales] = useState(0);
  const [deliveryBoysData, setDeliveryBoysData] = useState<any[]>([]);
  const [establishmentSettings, setEstablishmentSettings] = useState<any>(null);
  
  // Dialogs
  const [openDialog, setOpenDialog] = useState(false);
  const [closeDialog, setCloseDialog] = useState(false);
  const [withdrawDialog, setWithdrawDialog] = useState(false);
  const [depositDialog, setDepositDialog] = useState(false);
  const [reportDialog, setReportDialog] = useState(false);
  
  // Forms
  const [openingAmount, setOpeningAmount] = useState("0.00");
  const [openingNotes, setOpeningNotes] = useState("");
  const [closingAmounts, setClosingAmounts] = useState<Record<string, string>>({});
  const [closingNotes, setClosingNotes] = useState("");
  const [transactionAmount, setTransactionAmount] = useState("");
  const [transactionDescription, setTransactionDescription] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load profile
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: profileData } = await supabase
        .from("profiles")
        .select("*, establishment_id")
        .eq("user_id", session.user.id)
        .single();
      
      if (profileData) {
        setProfile(profileData);
        
        // Load establishment settings
        const { data: establishmentData } = await supabase
          .from("establishments")
          .select("settings")
          .eq("id", profileData.establishment_id)
          .single();
        
        if (establishmentData) {
          setEstablishmentSettings(establishmentData.settings || {});
        }
        
        // Load current session
        const { data: sessionData } = await supabase
          .from("cash_sessions")
          .select("*")
          .eq("establishment_id", profileData.establishment_id)
          .eq("status", "open")
          .order("opened_at", { ascending: false })
          .limit(1)
          .single();
        
        setCurrentSession(sessionData || null);
        
        if (sessionData) {
          // Load transactions
          const { data: transactionsData } = await supabase
            .from("cash_transactions")
            .select("*")
            .eq("cash_session_id", sessionData.id)
            .order("created_at", { ascending: false });
          
          setTransactions(transactionsData || []);
        }
        
        // Load recent sessions
        const { data: sessionsData } = await supabase
          .from("cash_sessions")
          .select("*")
          .eq("establishment_id", profileData.establishment_id)
          .order("opened_at", { ascending: false })
          .limit(10);
        
        setSessions(sessionsData || []);
      }
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCash = async () => {
    if (!profile) return;
    
    const amount = parseFloat(openingAmount.replace(",", "."));
    if (isNaN(amount) || amount < 0) {
      toast.error("Valor inválido");
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase
        .from("cash_sessions")
        .insert({
          establishment_id: profile.establishment_id,
          opened_by: session.user.id,
          opening_amount: amount,
          notes: openingNotes.trim() || null,
          status: "open",
        })
        .select()
        .single();

      if (error) throw error;

      toast.success("Caixa aberto com sucesso!");
      setOpenDialog(false);
      setOpeningAmount("0.00");
      setOpeningNotes("");
      loadData();
    } catch (error: any) {
      console.error("Error opening cash:", error);
      toast.error(error.message || "Erro ao abrir caixa");
    }
  };

  const handleCloseCash = async () => {
    if (!currentSession || !profile) return;

    // Calculate expected amount
    const totalDeposits = transactions
      .filter(t => t.type === 'deposit')
      .reduce((sum, t) => sum + t.amount, 0);
    
    const totalWithdraws = transactions
      .filter(t => t.type === 'withdraw')
      .reduce((sum, t) => sum + t.amount, 0);

    // Get orders total from today (cash payments only - dinheiro)
    const today = new Date(currentSession.opened_at);
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const { data: todayOrders } = await supabase
      .from("orders")
      .select("total_amount, payment_method")
      .eq("establishment_id", profile.establishment_id)
      .gte("created_at", today.toISOString())
      .lt("created_at", tomorrow.toISOString());

    const cashSales = (todayOrders || [])
      .filter((o: any) => o.payment_method === "dinheiro" || o.payment_method === "cash")
      .reduce((sum: number, o: any) => sum + (parseFloat(o.total_amount) || 0), 0);

    // Expected amount = opening + deposits - withdraws + cash sales
    const expectedAmount = currentSession.opening_amount + totalDeposits - totalWithdraws + cashSales;

    // Calculate closing amount from payment method counts
    const closingAmount = Object.values(closingAmounts).reduce((sum, val) => {
      const numVal = parseFloat(val.replace(",", ".")) || 0;
      return sum + numVal;
    }, 0);

    const difference = closingAmount - expectedAmount;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { error } = await supabase
        .from("cash_sessions")
        .update({
          closed_by: session.user.id,
          closed_at: new Date().toISOString(),
          closing_amount: closingAmount,
          expected_amount: expectedAmount,
          difference_amount: difference,
          notes: closingNotes.trim() || null,
          payment_method_counts: closingAmounts,
          status: "closed",
        })
        .eq("id", currentSession.id);

      if (error) throw error;

      toast.success("Caixa fechado com sucesso!");
      setCloseDialog(false);
      setClosingAmounts({});
      setClosingNotes("");
      loadData();
    } catch (error: any) {
      console.error("Error closing cash:", error);
      toast.error(error.message || "Erro ao fechar caixa");
    }
  };

  const handleTransaction = async (type: 'withdraw' | 'deposit') => {
    if (!currentSession) {
      toast.error("Nenhum caixa aberto");
      return;
    }

    const amount = parseFloat(transactionAmount.replace(",", "."));
    if (isNaN(amount) || amount <= 0) {
      toast.error("Valor inválido");
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { error } = await supabase
        .from("cash_transactions")
        .insert({
          cash_session_id: currentSession.id,
          establishment_id: currentSession.establishment_id,
          type,
          amount,
          description: transactionDescription.trim() || null,
          created_by: session.user.id,
        });

      if (error) throw error;

      toast.success(type === 'withdraw' ? "Sangria realizada!" : "Suprimento adicionado!");
      setWithdrawDialog(false);
      setDepositDialog(false);
      setTransactionAmount("");
      setTransactionDescription("");
      loadData();
    } catch (error: any) {
      console.error("Error creating transaction:", error);
      toast.error(error.message || "Erro ao criar transação");
    }
  };

  useEffect(() => {
    if (currentSession && profile) {
      const loadCashSales = async () => {
        const today = new Date(currentSession.opened_at);
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const { data: todayOrders } = await supabase
          .from("orders")
          .select("total_amount, payment_method")
          .eq("establishment_id", profile.establishment_id)
          .gte("created_at", today.toISOString())
          .lt("created_at", tomorrow.toISOString());

        const sales = (todayOrders || [])
          .filter((o: any) => o.payment_method === "dinheiro" || o.payment_method === "cash")
          .reduce((sum: number, o: any) => sum + (parseFloat(o.total_amount) || 0), 0);

        setCashSales(sales);
      };
      loadCashSales();
    } else {
      setCashSales(0);
    }
  }, [currentSession, profile]);

  const loadDeliveryBoysData = useCallback(async () => {
    if (!currentSession || !profile) return;

    try {
      const today = new Date(currentSession.opened_at);
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Buscar pedidos de entrega do dia
      const { data: deliveryOrders } = await supabase
        .from("orders")
        .select("id, delivery_boy_id, order_type")
        .eq("establishment_id", profile.establishment_id)
        .eq("order_type", "delivery")
        .not("delivery_boy_id", "is", null)
        .gte("created_at", today.toISOString())
        .lt("created_at", tomorrow.toISOString());

      if (!deliveryOrders || deliveryOrders.length === 0) {
        setDeliveryBoysData([]);
        return;
      }

      // Agrupar por motoboy
      const deliveryBoyIds = Array.from(new Set(deliveryOrders.map((o: any) => o.delivery_boy_id)));

      // Buscar dados dos motoboys
      const { data: deliveryBoys } = await supabase
        .from("delivery_boys")
        .select("id, name, daily_rate, delivery_fee")
        .in("id", deliveryBoyIds)
        .eq("active", true);

      if (deliveryBoys) {
        const boysData = deliveryBoys.map(boy => {
          const deliveries = deliveryOrders.filter((o: any) => o.delivery_boy_id === boy.id);
          const deliveriesCount = deliveries.length;
          const dailyRate = Number(boy.daily_rate) || 0;
          const deliveryFee = Number(boy.delivery_fee) || 0;
          const deliveriesTotal = deliveriesCount * deliveryFee;
          const total = (deliveriesCount > 0 ? dailyRate : 0) + deliveriesTotal;

          return {
            id: boy.id,
            name: boy.name,
            dailyRate: deliveriesCount > 0 ? dailyRate : 0,
            deliveryFee,
            deliveriesCount,
            deliveriesTotal,
            total
          };
        }).sort((a, b) => b.total - a.total);

        setDeliveryBoysData(boysData);
      }
    } catch (error) {
      console.error("Error loading delivery boys data:", error);
      setDeliveryBoysData([]);
    }
  }, [currentSession, profile]);

  useEffect(() => {
    if (closeDialog && currentSession && profile) {
      loadDeliveryBoysData();
    } else if (!closeDialog) {
      setDeliveryBoysData([]);
    }
  }, [closeDialog, currentSession, profile, loadDeliveryBoysData]);

  const calculateCurrentBalance = () => {
    if (!currentSession) return 0;

    const totalDeposits = transactions
      .filter(t => t.type === 'deposit')
      .reduce((sum, t) => sum + t.amount, 0);
    
    const totalWithdraws = transactions
      .filter(t => t.type === 'withdraw')
      .reduce((sum, t) => sum + t.amount, 0);

    return currentSession.opening_amount + totalDeposits - totalWithdraws + cashSales;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  const currentBalance = calculateCurrentBalance();

  return (
    <div className="space-y-6">
      {/* Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Status do Caixa
          </CardTitle>
        </CardHeader>
        <CardContent>
          {currentSession ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Caixa Aberto</p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(currentSession.opened_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                </div>
                <Badge className="bg-green-500">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Aberto
                </Badge>
              </div>
              
              <div className="grid grid-cols-3 gap-4 pt-4 border-t">
                <div>
                  <p className="text-sm text-muted-foreground">Saldo Inicial</p>
                  <p className="text-lg font-semibold">
                    R$ {currentSession.opening_amount.toFixed(2).replace(".", ",")}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Saldo Atual</p>
                  <p className="text-lg font-semibold text-primary">
                    R$ {currentBalance.toFixed(2).replace(".", ",")}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Transações</p>
                  <p className="text-lg font-semibold">{transactions.length}</p>
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setWithdrawDialog(true)}
                  className="flex-1"
                >
                  <Minus className="h-4 w-4 mr-2" />
                  Sangria
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setDepositDialog(true)}
                  className="flex-1"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Suprimento
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    // Initialize payment method counts
                    setClosingAmounts({
                      dinheiro: "",
                      pix: "",
                      cartao_debito: "",
                      cartao_credito: "",
                    });
                    setCloseDialog(true);
                  }}
                  className="flex-1"
                >
                  <X className="h-4 w-4 mr-2" />
                  Fechar Caixa
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Caixa Fechado</p>
                  <p className="text-xs text-muted-foreground">
                    Abra um novo caixa para começar
                  </p>
                </div>
                <Badge variant="destructive">
                  <X className="h-3 w-3 mr-1" />
                  Fechado
                </Badge>
              </div>
              
              <Button
                onClick={() => setOpenDialog(true)}
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                Abrir Caixa
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Transactions */}
      {currentSession && transactions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Transações do Dia</CardTitle>
            <CardDescription>
              Histórico de sangrias e suprimentos
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Hora</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Descrição</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((transaction) => (
                  <TableRow key={transaction.id}>
                    <TableCell>
                      {format(new Date(transaction.created_at), "HH:mm", { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      <Badge variant={transaction.type === 'deposit' ? 'default' : 'destructive'}>
                        {transaction.type === 'deposit' ? (
                          <TrendingUp className="h-3 w-3 mr-1" />
                        ) : (
                          <TrendingDown className="h-3 w-3 mr-1" />
                        )}
                        {transaction.type === 'deposit' ? 'Suprimento' : 'Sangria'}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">
                      R$ {transaction.amount.toFixed(2).replace(".", ",")}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {transaction.description || "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Recent Sessions */}
      {sessions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Sessões Recentes</CardTitle>
            <CardDescription>
              Histórico de aberturas e fechamentos
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Inicial</TableHead>
                  <TableHead>Fechamento</TableHead>
                  <TableHead>Diferença</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessions.map((session) => (
                  <TableRow key={session.id}>
                    <TableCell>
                      {format(new Date(session.opened_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      <Badge variant={session.status === 'open' ? 'default' : 'secondary'}>
                        {session.status === 'open' ? 'Aberto' : 'Fechado'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      R$ {session.opening_amount.toFixed(2).replace(".", ",")}
                    </TableCell>
                    <TableCell>
                      {session.closing_amount !== null ? (
                        <>R$ {session.closing_amount.toFixed(2).replace(".", ",")}</>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell>
                      {session.difference_amount !== null ? (
                        <span className={session.difference_amount >= 0 ? "text-green-600" : "text-red-600"}>
                          {session.difference_amount >= 0 ? "+" : ""}
                          R$ {session.difference_amount.toFixed(2).replace(".", ",")}
                        </span>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Open Dialog */}
      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Abrir Caixa</DialogTitle>
            <DialogDescription>
              Informe o saldo inicial e uma observação opcional
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="openingAmount">Saldo Inicial (R$)</Label>
              <Input
                id="openingAmount"
                type="text"
                value={openingAmount}
                onChange={(e) => setOpeningAmount(e.target.value)}
                placeholder="0,00"
              />
            </div>
            <div>
              <Label htmlFor="openingNotes">Observação (opcional)</Label>
              <Textarea
                id="openingNotes"
                value={openingNotes}
                onChange={(e) => setOpeningNotes(e.target.value)}
                placeholder="Observações sobre a abertura do caixa..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleOpenCash}>
              Abrir Caixa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Close Dialog */}
      <Dialog open={closeDialog} onOpenChange={setCloseDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Fechar Caixa</DialogTitle>
            <DialogDescription>
              Informe a contagem por meio de pagamento e reconcilie
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="dinheiro">Dinheiro (R$)</Label>
                <Input
                  id="dinheiro"
                  type="text"
                  value={closingAmounts.dinheiro || ""}
                  onChange={(e) => setClosingAmounts({ ...closingAmounts, dinheiro: e.target.value })}
                  placeholder="0,00"
                />
              </div>
              <div>
                <Label htmlFor="pix">PIX (R$)</Label>
                <Input
                  id="pix"
                  type="text"
                  value={closingAmounts.pix || ""}
                  onChange={(e) => setClosingAmounts({ ...closingAmounts, pix: e.target.value })}
                  placeholder="0,00"
                />
              </div>
              <div>
                <Label htmlFor="cartao_debito">Cartão Débito (R$)</Label>
                <Input
                  id="cartao_debito"
                  type="text"
                  value={closingAmounts.cartao_debito || ""}
                  onChange={(e) => setClosingAmounts({ ...closingAmounts, cartao_debito: e.target.value })}
                  placeholder="0,00"
                />
              </div>
              <div>
                <Label htmlFor="cartao_credito">Cartão Crédito (R$)</Label>
                <Input
                  id="cartao_credito"
                  type="text"
                  value={closingAmounts.cartao_credito || ""}
                  onChange={(e) => setClosingAmounts({ ...closingAmounts, cartao_credito: e.target.value })}
                  placeholder="0,00"
                />
              </div>
            </div>
            
            {/* Delivery Boys Section */}
            {deliveryBoysData.length > 0 ? (
              <div className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-2 mb-3">
                  <Truck className="h-4 w-4 text-muted-foreground" />
                  <h3 className="font-semibold text-sm">Motoboys - Entregas do Dia</h3>
                </div>
                {deliveryBoysData.map((boy) => (
                  <div key={boy.id} className="p-3 bg-muted rounded-md space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium">{boy.name}</h4>
                      <Badge variant="default" className="text-sm font-bold">
                        R$ {boy.total.toFixed(2).replace(".", ",")}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                      <div>
                        <span className="font-medium">Entregas:</span> {boy.deliveriesCount}x
                      </div>
                      {boy.dailyRate > 0 && (
                        <div>
                          <span className="font-medium">Diária:</span> R$ {boy.dailyRate.toFixed(2).replace(".", ",")}
                        </div>
                      )}
                      <div className="col-span-2">
                        <span className="font-medium">Total por entregas:</span> R$ {boy.deliveriesTotal.toFixed(2).replace(".", ",")}
                        {boy.deliveriesCount > 0 && (
                          <span className="ml-1 text-xs">
                            ({boy.deliveriesCount} × R$ {boy.deliveryFee.toFixed(2).replace(".", ",")})
                          </span>
                        )}
                      </div>
                      {boy.dailyRate > 0 && (
                        <div className="col-span-2 pt-2 border-t text-sm">
                          <span className="font-medium text-foreground">
                            Total: R$ {boy.dailyRate.toFixed(2).replace(".", ",")} + R$ {boy.deliveriesTotal.toFixed(2).replace(".", ",")} = R$ {boy.total.toFixed(2).replace(".", ",")}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="border rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Truck className="h-4 w-4 text-muted-foreground" />
                  <h3 className="font-semibold text-sm">Entregas do Dia</h3>
                </div>
                <div className="text-sm text-muted-foreground">
                  <p>Nenhum motoboy com entregas registradas hoje.</p>
                  {establishmentSettings?.delivery_fee && (
                    <p className="mt-1">
                      Taxa de entrega configurada: R$ {Number(establishmentSettings.delivery_fee).toFixed(2).replace(".", ",")}
                    </p>
                  )}
                </div>
              </div>
            )}
            
            {currentSession && (
              <div className="bg-muted p-4 rounded-md space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm">Saldo Esperado:</span>
                  <span className="font-semibold">
                    R$ {calculateCurrentBalance().toFixed(2).replace(".", ",")}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Saldo Contado:</span>
                  <span className="font-semibold">
                    R$ {Object.values(closingAmounts).reduce((sum, val) => {
                      return sum + (parseFloat(val.replace(",", ".")) || 0);
                    }, 0).toFixed(2).replace(".", ",")}
                  </span>
                </div>
                <div className="flex justify-between pt-2 border-t">
                  <span className="text-sm font-medium">Diferença:</span>
                  <span className={`font-bold ${
                    (Object.values(closingAmounts).reduce((sum, val) => {
                      return sum + (parseFloat(val.replace(",", ".")) || 0);
                    }, 0) - calculateCurrentBalance()) >= 0 
                      ? "text-green-600" 
                      : "text-red-600"
                  }`}>
                    {(() => {
                      const diff = Object.values(closingAmounts).reduce((sum, val) => {
                        return sum + (parseFloat(val.replace(",", ".")) || 0);
                      }, 0) - calculateCurrentBalance();
                      return `${diff >= 0 ? "+" : ""}R$ ${diff.toFixed(2).replace(".", ",")}`;
                    })()}
                  </span>
                </div>
              </div>
            )}
            
            <div>
              <Label htmlFor="closingNotes">Observação (opcional)</Label>
              <Textarea
                id="closingNotes"
                value={closingNotes}
                onChange={(e) => setClosingNotes(e.target.value)}
                placeholder="Observações sobre o fechamento do caixa..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCloseDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCloseCash}>
              Fechar Caixa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Withdraw Dialog */}
      <Dialog open={withdrawDialog} onOpenChange={setWithdrawDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sangria</DialogTitle>
            <DialogDescription>
              Retirar dinheiro do caixa
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="withdrawAmount">Valor (R$)</Label>
              <Input
                id="withdrawAmount"
                type="text"
                value={transactionAmount}
                onChange={(e) => setTransactionAmount(e.target.value)}
                placeholder="0,00"
              />
            </div>
            <div>
              <Label htmlFor="withdrawDescription">Descrição (opcional)</Label>
              <Textarea
                id="withdrawDescription"
                value={transactionDescription}
                onChange={(e) => setTransactionDescription(e.target.value)}
                placeholder="Motivo da sangria..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWithdrawDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={() => handleTransaction('withdraw')}>
              Confirmar Sangria
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deposit Dialog */}
      <Dialog open={depositDialog} onOpenChange={setDepositDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Suprimento</DialogTitle>
            <DialogDescription>
              Adicionar dinheiro ao caixa
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="depositAmount">Valor (R$)</Label>
              <Input
                id="depositAmount"
                type="text"
                value={transactionAmount}
                onChange={(e) => setTransactionAmount(e.target.value)}
                placeholder="0,00"
              />
            </div>
            <div>
              <Label htmlFor="depositDescription">Descrição (opcional)</Label>
              <Textarea
                id="depositDescription"
                value={transactionDescription}
                onChange={(e) => setTransactionDescription(e.target.value)}
                placeholder="Motivo do suprimento..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDepositDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={() => handleTransaction('deposit')}>
              Confirmar Suprimento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Cash;

