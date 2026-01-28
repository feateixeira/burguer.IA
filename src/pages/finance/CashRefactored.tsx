import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AlertTriangle } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  Wallet, 
  Plus, 
  Minus, 
  X, 
  CheckCircle, 
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Eye,
  EyeOff,
  Truck
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useCashSession, CashSessionTotals } from "@/hooks/useCashSession";
import { useTeamUser } from "@/components/TeamUserProvider";
import { formatCurrency, parseCurrency, currencyMask } from "@/utils/currency";

interface CashTransaction {
  id: string;
  cash_session_id: string;
  type: 'withdraw' | 'deposit';
  amount: number;
  description: string | null;
  created_by: string;
  created_at: string;
}

interface CashSessionHistory {
  id: string;
  opened_at: string;
  closed_at: string | null;
  opening_amount: number;
  // Totais esperados salvos na sessão (incluem vendas do período)
  expected_cash: number | null;
  expected_pix: number | null;
  expected_debit: number | null;
  expected_credit: number | null;
  expected_total: number | null;
  difference_amount: number | null;
  closed_by: string | null;
}

interface DeliveryBoyData {
  id: string;
  name: string;
  dailyRate: number;
  deliveryFee: number;
  deliveriesCount: number;
  deliveriesTotal: number;
  total: number;
}

const CashRefactored = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { teamUser } = useTeamUser();
  const [profile, setProfile] = useState<any>(null);
  const [transactions, setTransactions] = useState<CashTransaction[]>([]);
  const [sessionsHistory, setSessionsHistory] = useState<CashSessionHistory[]>([]);
  const [deliveryBoysData, setDeliveryBoysData] = useState<DeliveryBoyData[]>([]);
  
  // Dialogs
  const [openDialog, setOpenDialog] = useState(false);
  const [closeDialog, setCloseDialog] = useState(false);
  const [withdrawDialog, setWithdrawDialog] = useState(false);
  const [depositDialog, setDepositDialog] = useState(false);
  const [showCashOpenWarning, setShowCashOpenWarning] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);
  
  // Forms
  const [openingAmount, setOpeningAmount] = useState("");
  const [openingNotes, setOpeningNotes] = useState("");
  const [countedCash, setCountedCash] = useState("");
  const [countedPix, setCountedPix] = useState("");
  const [countedDebit, setCountedDebit] = useState("");
  const [countedCredit, setCountedCredit] = useState("");
  const [closingNote, setClosingNote] = useState("");
  const [transactionAmount, setTransactionAmount] = useState("");
  const [transactionDescription, setTransactionDescription] = useState("");
  
  // RBAC - mostrar valores apenas para Master/Admin/Gerente
  const canViewTotals = teamUser?.role === "master" || teamUser?.role === "admin";
  const isAttendant = teamUser?.role === "atendente";
  const canCloseCash = canViewTotals || isAttendant; // Master/Admin e Atendentes podem fechar (mas com fluxos diferentes)
  const canOpenCash = canViewTotals || isAttendant; // Atendente pode abrir dependendo da política

  const { session, totals, loading, hasOpenSession, reload, closeSession } = useCashSession(profile?.establishment_id);

  useEffect(() => {
    loadProfile();
  }, []);

  useEffect(() => {
    if (profile?.establishment_id) {
      loadTransactions();
      loadHistory();
    }
  }, [profile, session]);

  // Removido: alerta de abrir caixa não é mais necessário

  // Interceptar navegação quando caixa está aberto
  const previousPathRef = useRef(location.pathname);
  const isNavigatingRef = useRef(false);
  
  useEffect(() => {
    if (!hasOpenSession || !session) {
      previousPathRef.current = location.pathname;
      isNavigatingRef.current = false;
      return;
    }

    // Interceptar cliques em links de navegação
    const handleLinkClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const link = target.closest('a[href]') as HTMLAnchorElement;
      
      if (link && link.href && !link.href.startsWith('mailto:') && !link.href.startsWith('tel:')) {
        const url = new URL(link.href);
        // Se for navegação interna e não for para a própria página de caixa
        if (url.origin === window.location.origin && url.pathname !== location.pathname && url.pathname !== '/finance/cash') {
          e.preventDefault();
          e.stopPropagation();
          setPendingNavigation(url.pathname);
          setShowCashOpenWarning(true);
        }
      }
    };

    // Interceptar navegação via React Router (mudança de location)
    if (!isNavigatingRef.current && previousPathRef.current.startsWith('/finance/cash') && !location.pathname.startsWith('/finance/cash')) {
      // Tentando sair da página de caixa
      isNavigatingRef.current = true;
      setPendingNavigation(location.pathname);
      setShowCashOpenWarning(true);
      // Reverter a navegação
      setTimeout(() => {
        navigate(previousPathRef.current, { replace: true });
        isNavigatingRef.current = false;
      }, 0);
    } else if (!isNavigatingRef.current) {
      previousPathRef.current = location.pathname;
    }

    document.addEventListener('click', handleLinkClick, true);

    return () => {
      document.removeEventListener('click', handleLinkClick, true);
    };
  }, [hasOpenSession, session, location.pathname, navigate]);

  useEffect(() => {
    if (closeDialog && session && profile) {
      loadDeliveryBoysData();
    } else if (!closeDialog) {
      setDeliveryBoysData([]);
    }
  }, [closeDialog, session, profile]);

  const loadProfile = async () => {
    try {
      const { data: { session: authSession } } = await supabase.auth.getSession();
      if (!authSession) return;

      const { data: profileData } = await supabase
        .from("profiles")
        .select("*, establishment_id")
        .eq("user_id", authSession.user.id)
        .single();
      
      if (profileData) {
        setProfile(profileData);
      }
    } catch (error) {
      console.error("Error loading profile:", error);
    }
  };

  const loadTransactions = async () => {
    if (!session) return;
    
    try {
      const { data } = await (supabase as any)
        .from("cash_transactions")
        .select("*")
        .eq("cash_session_id", session.id)
        .order("created_at", { ascending: false });
      
      setTransactions((data || []) as CashTransaction[]);
    } catch (error) {
      console.error("Error loading transactions:", error);
    }
  };

  const loadHistory = async () => {
    if (!profile?.establishment_id) return;
    
    try {
      const { data } = await supabase
        .from("cash_sessions")
        .select(`
          id,
          opened_at,
          closed_at,
          opening_amount,
          expected_cash,
          expected_pix,
          expected_debit,
          expected_credit,
          expected_total,
          difference_amount,
          closed_by
        `)
        .eq("establishment_id", profile.establishment_id)
        .order("opened_at", { ascending: false })
        .limit(10);
      
      setSessionsHistory((data || []) as CashSessionHistory[]);
    } catch (error) {
      console.error("Error loading history:", error);
    }
  };

  const loadDeliveryBoysData = async () => {
    if (!session || !profile) return;

    try {
      // Buscar entregas no período da sessão (de opened_at até agora)
      const openedAt = new Date(session.opened_at);
      const now = new Date();

      const { data: deliveryOrders } = await supabase
        .from("orders")
        .select("id, delivery_boy_id, order_type")
        .eq("establishment_id", profile.establishment_id)
        .eq("order_type", "delivery")
        .not("delivery_boy_id", "is", null)
        .gte("created_at", openedAt.toISOString())
        .lte("created_at", now.toISOString());

      if (!deliveryOrders || deliveryOrders.length === 0) {
        setDeliveryBoysData([]);
        return;
      }

      // Agrupar por motoboy
      const deliveryBoyIds = Array.from(new Set(deliveryOrders.map((o: any) => o.delivery_boy_id)));

      // Buscar dados dos motoboys
      const { data: deliveryBoys } = await (supabase as any)
        .from("delivery_boys")
        .select("id, name, daily_rate, delivery_fee")
        .in("id", deliveryBoyIds)
        .eq("active", true);

      if (deliveryBoys) {
        const boysData = deliveryBoys.map((boy: any) => {
          const deliveries = deliveryOrders.filter((o: any) => o.delivery_boy_id === boy.id);
          const deliveriesCount = deliveries.length;
          const dailyRate = Number(boy.daily_rate) || 0;
          const deliveryFee = Number(boy.delivery_fee) || 0;
          const deliveriesTotal = deliveriesCount * deliveryFee;
          // Diária aplicada apenas se houver entregas no período
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
  };

  const handleOpenCash = async () => {
    if (!profile) return;
    
    const amount = parseCurrency(openingAmount);
    if (isNaN(amount) || amount < 0) {
      toast.error("Valor inválido");
      return;
    }

    try {
      const { data: { session: authSession } } = await supabase.auth.getSession();
      if (!authSession) return;

      const { data, error } = await supabase
        .from("cash_sessions")
        .insert({
          establishment_id: profile.establishment_id,
          opened_by: authSession.user.id,
          opening_amount: amount,
          notes: openingNotes.trim() || null,
          status: "open",
        })
        .select()
        .single();

      if (error) throw error;

      // Criar audit log (compatibilidade: adiciona action se a coluna existir)
      const auditLogData: any = {
        establishment_id: profile.establishment_id,
        actor_id: authSession.user.id,
        event: "cash.open",
        payload: {
          session_id: data.id,
          opening_amount: amount,
          notes: openingNotes.trim() || null,
        },
      };
      
      // Adicionar action para compatibilidade se a coluna existir
      // (será ignorado se não existir)
      try {
        await supabase.from("audit_logs").insert(auditLogData);
      } catch (err: any) {
        // Se falhar por causa de action, tentar novamente sem action
        if (err.message?.includes('action')) {
          auditLogData.action = "cash.open";
          await supabase.from("audit_logs").insert(auditLogData);
        } else {
          throw err;
        }
      }

      toast.success("Caixa aberto com sucesso!");
      setOpenDialog(false);
      setOpeningAmount("");
      setOpeningNotes("");
      await reload();
      await loadHistory();
    } catch (error: any) {
      console.error("Error opening cash:", error);
      toast.error(error.message || "Erro ao abrir caixa");
    }
  };

  const handleCloseCash = async () => {
    if (!session) return;

    // Para atendentes, validar valores de contagem
    if (isAttendant) {
      const counted = parseCurrency(countedCash);
      const countedPixValue = parseCurrency(countedPix);
      const countedDebitValue = parseCurrency(countedDebit);
      const countedCreditValue = parseCurrency(countedCredit);

      if (isNaN(counted) || counted < 0) {
        toast.error("Valor de dinheiro inválido");
        return;
      }

      if (isNaN(countedPixValue) || countedPixValue < 0) {
        toast.error("Valor de PIX inválido");
        return;
      }

      if (isNaN(countedDebitValue) || countedDebitValue < 0) {
        toast.error("Valor de Débito inválido");
        return;
      }

      if (isNaN(countedCreditValue) || countedCreditValue < 0) {
        toast.error("Valor de Crédito inválido");
        return;
      }

      // Para atendentes, observação é sempre obrigatória
      if (!closingNote || !closingNote.trim()) {
        toast.error("Observação obrigatória para fechamento");
        return;
      }

      try {
        await closeSession(
          session.id, 
          counted, 
          closingNote.trim() || null,
          countedPixValue,
          countedDebitValue,
          countedCreditValue,
          isAttendant
        );
        setCloseDialog(false);
        setCountedCash("");
        setCountedPix("");
        setCountedDebit("");
        setCountedCredit("");
        setClosingNote("");
        await loadHistory();
      } catch (error) {
        // Erro já tratado no hook
      }
    } else {
      // Para master/admin, usar valores esperados calculados automaticamente
      // Não precisa de contagem manual, o sistema já calcula os valores esperados
      const expectedCash = totals?.expected_cash || 0;
      const expectedPix = totals?.expected_pix || 0;
      const expectedDebit = totals?.expected_debit || 0;
      const expectedCredit = totals?.expected_credit || 0;

      // Para master/admin, não há diferença a calcular pois usa valores esperados diretamente
      // Observação é opcional, a menos que haja alguma situação especial

      try {
        await closeSession(
          session.id, 
          expectedCash, 
          closingNote.trim() || null,
          expectedPix,
          expectedDebit,
          expectedCredit,
          false
        );
        setCloseDialog(false);
        setCountedCash("");
        setCountedPix("");
        setCountedDebit("");
        setCountedCredit("");
        setClosingNote("");
        await loadHistory();
      } catch (error) {
        // Erro já tratado no hook
      }
    }
  };

  const handleTransaction = async (type: 'withdraw' | 'deposit') => {
    if (!session) {
      toast.error("Nenhum caixa aberto");
      return;
    }

    const amount = parseCurrency(transactionAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Valor inválido");
      return;
    }

    try {
      const { data: { session: authSession } } = await supabase.auth.getSession();
      if (!authSession) return;

      const { error } = await (supabase as any)
        .from("cash_transactions")
        .insert({
          cash_session_id: session.id,
          establishment_id: session.establishment_id,
          type,
          amount,
          description: transactionDescription.trim() || null,
          created_by: authSession.user.id,
        });

      if (error) throw error;

      toast.success(type === 'withdraw' ? "Sangria realizada!" : "Suprimento adicionado!");
      setWithdrawDialog(false);
      setDepositDialog(false);
      setTransactionAmount("");
      setTransactionDescription("");
      await loadTransactions();
      await reload(); // Recalcula totais
    } catch (error: any) {
      console.error("Error creating transaction:", error);
      toast.error(error.message || "Erro ao criar transação");
    }
  };

  // Calcular diferença em tempo real (apenas para Master/Admin quando há contagem manual)
  // Para master/admin, não há contagem manual, então não calcula diferença
  const calculatedDifference = null; // Master/Admin não precisa de contagem manual

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Aviso: Caixa não foi fechado */}
      {hasOpenSession && session && (
        <Card className="border-orange-500 bg-orange-50 dark:bg-orange-950/20">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-orange-600 dark:text-orange-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-orange-900 dark:text-orange-100 mb-1">
                  Caixa Aberto - Não Fechado
                </h3>
                <p className="text-sm text-orange-800 dark:text-orange-200 mb-3">
                  Você tem um caixa aberto desde {format(new Date(session.opened_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}. 
                  É importante fechar o caixa para evitar problemas futuros.
                </p>
                <Button
                  onClick={() => setCloseDialog(true)}
                  className="bg-orange-600 hover:bg-orange-700 text-white"
                >
                  Fechar Caixa Agora
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Status do Caixa
          </CardTitle>
        </CardHeader>
        <CardContent>
          {hasOpenSession && session ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Caixa Aberto</p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(session.opened_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                </div>
                <Badge className="bg-green-500">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Aberto
                </Badge>
              </div>
              
              {totals && canViewTotals && (
                <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                  <div>
                    <p className="text-sm text-muted-foreground">Saldo Inicial</p>
                    <p className="text-lg font-semibold">
                      {formatCurrency(session.opening_amount)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Esperado</p>
                    <p className="text-lg font-semibold text-primary">
                      {formatCurrency(totals.expected_total)}
                    </p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-sm text-muted-foreground">
                      Total em pedidos recusados (não entra no caixa)
                    </p>
                    <p className="text-lg font-semibold text-red-600 dark:text-red-400">
                      {formatCurrency(totals.rejected_total)}
                    </p>
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-4">
                {canViewTotals && (
                  <>
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
                  </>
                )}
                {canCloseCash && (
                  <Button
                    variant="destructive"
                    onClick={() => {
                      setCountedCash("");
                      setClosingNote("");
                      setCloseDialog(true);
                    }}
                    className="flex-1"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Fechar Caixa
                  </Button>
                )}
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
              
              {canOpenCash && (
                <Button
                  onClick={() => setOpenDialog(true)}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Abrir Caixa
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Transactions - Apenas para Master/Admin */}
      {!isAttendant && session && transactions.length > 0 && (
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
                      {formatCurrency(transaction.amount)}
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

      {/* Recent Sessions - Apenas para Master/Admin */}
      {!isAttendant && sessionsHistory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Histórico de Sessões</CardTitle>
            <CardDescription>
              Aberturas e fechamentos recentes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data Abertura</TableHead>
                  <TableHead>Data Fechamento</TableHead>
                  <TableHead>Inicial</TableHead>
                  {canViewTotals && (
                    <>
                      <TableHead>Total (R$)</TableHead>
                      <TableHead>Dinheiro</TableHead>
                      <TableHead>PIX</TableHead>
                      <TableHead>Débito</TableHead>
                      <TableHead>Crédito</TableHead>
                      <TableHead>Diferença</TableHead>
                    </>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessionsHistory.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      {format(new Date(s.opened_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      {s.closed_at ? (
                        format(new Date(s.closed_at), "dd/MM/yyyy HH:mm", { locale: ptBR })
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell>
                      {formatCurrency(s.opening_amount)}
                    </TableCell>
                    {canViewTotals && (
                      <>
                        <TableCell>
                          {s.expected_total !== null ? formatCurrency(s.expected_total) : "-"}
                        </TableCell>
                        <TableCell>
                          {/* Em dinheiro, desconsiderar o valor de abertura para mostrar apenas as vendas */}
                          {s.expected_cash !== null
                            ? formatCurrency(s.expected_cash - s.opening_amount)
                            : "-"}
                        </TableCell>
                        <TableCell>
                          {s.expected_pix !== null ? formatCurrency(s.expected_pix) : "-"}
                        </TableCell>
                        <TableCell>
                          {s.expected_debit !== null ? formatCurrency(s.expected_debit) : "-"}
                        </TableCell>
                        <TableCell>
                          {s.expected_credit !== null ? formatCurrency(s.expected_credit) : "-"}
                        </TableCell>
                        <TableCell>
                          {s.difference_amount !== null ? (
                            <span className={s.difference_amount >= 0 ? "text-green-600" : "text-red-600"}>
                              {s.difference_amount >= 0 ? "+" : ""}
                              {formatCurrency(s.difference_amount)}
                            </span>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                      </>
                    )}
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
                onChange={(e) => setOpeningAmount(currencyMask(e.target.value))}
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

      {/* Close Dialog - REFATORADO */}
      <Dialog open={closeDialog} onOpenChange={setCloseDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {isAttendant ? "Fechar Caixa (Aguardar Conferência)" : "Fechar Caixa"}
            </DialogTitle>
            <DialogDescription>
              {isAttendant 
                ? "Informe os valores contados em cada método de pagamento. Os valores esperados não serão exibidos."
                : "O sistema calculou automaticamente os valores esperados. Informe os valores contados."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4 overflow-y-auto flex-1 min-h-0">
            {/* Resultado do Turno (Read-only) - Apenas para Master/Admin */}
            {canViewTotals && (
              <div className="space-y-3">
                <h4 className="font-semibold text-sm">Resultado do Turno</h4>
                <div className="bg-muted p-4 rounded-md space-y-2">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Dinheiro Esperado</p>
                      <p className="font-semibold">
                        {totals ? formatCurrency(totals.expected_cash) : "-"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        (Abertura: {formatCurrency(session?.opening_amount || 0)})
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">PIX Esperado</p>
                      <p className="font-semibold">
                        {totals ? formatCurrency(totals.expected_pix) : "-"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Débito Esperado</p>
                      <p className="font-semibold">
                        {totals ? formatCurrency(totals.expected_debit) : "-"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Crédito Esperado</p>
                      <p className="font-semibold">
                        {totals ? formatCurrency(totals.expected_credit) : "-"}
                      </p>
                    </div>
                  </div>
                  <div className="pt-2 border-t">
                    <div className="flex justify-between">
                      <span className="text-sm font-medium">Total Esperado:</span>
                      <span className="text-lg font-bold">
                        {totals ? formatCurrency(totals.expected_total) : "-"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Motoboys Section */}
            {deliveryBoysData.length > 0 ? (
              <div className="space-y-3">
                <h4 className="font-semibold text-sm">Motoboys - Entregas do Período</h4>
                <div className="border rounded-lg p-4 space-y-3">
                  {deliveryBoysData.map((boy) => (
                    <div key={boy.id} className="p-3 bg-muted rounded-md">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Truck className="h-4 w-4 text-muted-foreground" />
                          <h4 className="font-medium">{boy.name}</h4>
                        </div>
                        <Badge variant="default" className="text-sm font-bold">
                          {formatCurrency(boy.total)}
                        </Badge>
                      </div>
                      <div className="mt-2 text-sm text-muted-foreground">
                        {boy.dailyRate > 0 && boy.deliveriesCount > 0 && (
                          <span className="font-medium text-foreground">
                            {formatCurrency(boy.dailyRate)} dia
                          </span>
                        )}
                        {boy.dailyRate > 0 && boy.deliveriesCount > 0 && boy.deliveriesTotal > 0 && (
                          <span className="mx-1">+</span>
                        )}
                        {boy.deliveriesTotal > 0 && (
                          <span className="font-medium text-foreground">
                            {formatCurrency(boy.deliveriesTotal)}
                            <span className="text-xs text-muted-foreground ml-1">
                              ({boy.deliveriesCount} entregas)
                            </span>
                          </span>
                        )}
                        {boy.deliveriesCount === 0 && (
                          <span className="text-xs">Nenhuma entrega no período</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <h4 className="font-semibold text-sm">Motoboys - Entregas do Período</h4>
                <div className="border rounded-lg p-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Truck className="h-4 w-4" />
                    <p>Nenhum motoboy com entregas registradas no período.</p>
                  </div>
                </div>
              </div>
            )}

            {/* Contagem do Operador - Apenas para Atendentes */}
            {isAttendant && (
              <div className="space-y-3">
                <h4 className="font-semibold text-sm">Contagem do Operador</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="countedCash">Dinheiro Contado (R$)</Label>
                    <Input
                      id="countedCash"
                      type="text"
                      value={countedCash}
                      onChange={(e) => setCountedCash(currencyMask(e.target.value))}
                      placeholder="0,00"
                    />
                  </div>
                  <div>
                    <Label htmlFor="countedPix">PIX Contado (R$)</Label>
                    <Input
                      id="countedPix"
                      type="text"
                      value={countedPix}
                      onChange={(e) => setCountedPix(currencyMask(e.target.value))}
                      placeholder="0,00"
                    />
                  </div>
                  <div>
                    <Label htmlFor="countedDebit">Cartão de Débito Contado (R$)</Label>
                    <Input
                      id="countedDebit"
                      type="text"
                      value={countedDebit}
                      onChange={(e) => setCountedDebit(currencyMask(e.target.value))}
                      placeholder="0,00"
                    />
                  </div>
                  <div>
                    <Label htmlFor="countedCredit">Cartão de Crédito Contado (R$)</Label>
                    <Input
                      id="countedCredit"
                      type="text"
                      value={countedCredit}
                      onChange={(e) => setCountedCredit(currencyMask(e.target.value))}
                      placeholder="0,00"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="closingNote">
                    Observação <span className="text-red-500">*</span>
                  </Label>
                  <Textarea
                    id="closingNote"
                    value={closingNote}
                    onChange={(e) => setClosingNote(e.target.value)}
                    placeholder="Informe observações sobre o fechamento do caixa (obrigatório)..."
                    className={!closingNote.trim() ? "border-red-500" : ""}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    A observação é obrigatória para fechamento por atendente
                  </p>
                </div>
              </div>
            )}

            {/* Observação - Apenas para Master/Admin */}
            {canViewTotals && (
              <div className="space-y-3">
                <div>
                  <Label htmlFor="closingNote">
                    Observação (opcional)
                  </Label>
                  <Textarea
                    id="closingNote"
                    value={closingNote}
                    onChange={(e) => setClosingNote(e.target.value)}
                    placeholder="Observações sobre o fechamento do caixa (opcional)..."
                  />
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCloseDialog(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleCloseCash}
              disabled={isAttendant && !closingNote.trim()}
            >
              {isAttendant ? "Fechar e Aguardar Conferência" : "Fechar Caixa"}
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
                onChange={(e) => setTransactionAmount(currencyMask(e.target.value))}
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
                onChange={(e) => setTransactionAmount(currencyMask(e.target.value))}
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

      {/* Alerta personalizado para caixa aberto */}
      <AlertDialog open={showCashOpenWarning} onOpenChange={setShowCashOpenWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-900/20">
                <AlertTriangle className="h-5 w-5 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <AlertDialogTitle className="text-lg">Caixa Aberto</AlertDialogTitle>
                <AlertDialogDescription className="mt-1">
                  Você tem um caixa aberto no sistema.
                </AlertDialogDescription>
              </div>
            </div>
          </AlertDialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              É importante fechar o caixa antes de sair para evitar problemas futuros. 
              Deseja realmente sair sem fechar o caixa?
            </p>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowCashOpenWarning(false)}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowCashOpenWarning(false);
                isNavigatingRef.current = true;
                if (pendingNavigation) {
                  navigate(pendingNavigation);
                  setPendingNavigation(null);
                }
                setTimeout(() => {
                  isNavigatingRef.current = false;
                }, 100);
              }}
              className="bg-orange-600 hover:bg-orange-700"
            >
              Sair Mesmo Assim
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default CashRefactored;

