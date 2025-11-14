import { useState, useEffect } from "react";
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
  CheckCircle, 
  AlertCircle,
  Eye,
  X,
  TrendingUp,
  TrendingDown
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useTeamUser } from "@/components/TeamUserProvider";
import { formatCurrency, parseCurrency, currencyMask } from "@/utils/currency";

interface PendingCashSession {
  id: string;
  opened_at: string;
  closed_at: string;
  opening_amount: number;
  expected_cash: number | null;
  expected_pix: number | null;
  expected_debit: number | null;
  expected_credit: number | null;
  expected_total: number | null;
  counted_cash: number | null;
  counted_pix: number | null;
  counted_debit: number | null;
  counted_credit: number | null;
  notes: string | null;
  closed_by: string | null;
  closed_by_name?: string;
}

const CashReview = () => {
  const { teamUser } = useTeamUser();
  const [profile, setProfile] = useState<any>(null);
  const [pendingSessions, setPendingSessions] = useState<PendingCashSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [selectedSession, setSelectedSession] = useState<PendingCashSession | null>(null);
  const [finalCountedCash, setFinalCountedCash] = useState("");
  const [finalCountedPix, setFinalCountedPix] = useState("");
  const [finalCountedDebit, setFinalCountedDebit] = useState("");
  const [finalCountedCredit, setFinalCountedCredit] = useState("");
  const [adjustmentNote, setAdjustmentNote] = useState("");

  // Verificar se é Master ou Admin
  const canReview = teamUser?.role === "master" || teamUser?.role === "admin";

  useEffect(() => {
    if (!canReview) {
      toast.error("Acesso negado. Apenas Master e Admin podem acessar esta página.");
      return;
    }
    loadProfile();
  }, [canReview]);

  useEffect(() => {
    if (profile?.establishment_id) {
      loadPendingSessions();
    }
  }, [profile]);

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

  const loadPendingSessions = async () => {
    if (!profile?.establishment_id) return;

    try {
      setLoading(true);

      // Buscar sessões pendentes de conferência
      const { data: sessionsData, error } = await supabase
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
          counted_cash,
          counted_pix,
          counted_debit,
          counted_credit,
          notes,
          closed_by
        `)
        .eq("establishment_id", profile.establishment_id)
        .eq("status", "pending_review")
        .order("closed_at", { ascending: false });

      if (error) throw error;

      // Buscar nomes dos usuários que fecharam
      if (sessionsData && sessionsData.length > 0) {
        const userIds = Array.from(new Set(sessionsData.map((s: any) => s.closed_by).filter(Boolean)));
        
        if (userIds.length > 0) {
          const { data: usersData } = await supabase
            .from("profiles")
            .select("user_id, name")
            .in("user_id", userIds);

          const usersMap = new Map((usersData || []).map((u: any) => [u.user_id, u.name]));

          const sessionsWithNames = sessionsData.map((session: any) => ({
            ...session,
            closed_by_name: session.closed_by ? usersMap.get(session.closed_by) || "Usuário" : null
          }));

          setPendingSessions(sessionsWithNames as PendingCashSession[]);
        } else {
          setPendingSessions(sessionsData as PendingCashSession[]);
        }
      } else {
        setPendingSessions([]);
      }
    } catch (error: any) {
      console.error("Error loading pending sessions:", error);
      toast.error("Erro ao carregar sessões pendentes");
    } finally {
      setLoading(false);
    }
  };

  const openReviewDialog = (session: PendingCashSession) => {
    setSelectedSession(session);
    setFinalCountedCash(session.counted_cash?.toFixed(2).replace(".", ",") || "");
    setFinalCountedPix(session.counted_pix?.toFixed(2).replace(".", ",") || "");
    setFinalCountedDebit(session.counted_debit?.toFixed(2).replace(".", ",") || "");
    setFinalCountedCredit(session.counted_credit?.toFixed(2).replace(".", ",") || "");
    setAdjustmentNote("");
    setReviewDialogOpen(true);
  };

  const handleValidate = async () => {
    if (!selectedSession) return;

    const cash = parseCurrency(finalCountedCash);
    const pix = parseCurrency(finalCountedPix);
    const debit = parseCurrency(finalCountedDebit);
    const credit = parseCurrency(finalCountedCredit);

    if (isNaN(cash) || cash < 0 || isNaN(pix) || pix < 0 || 
        isNaN(debit) || debit < 0 || isNaN(credit) || credit < 0) {
      toast.error("Valores inválidos");
      return;
    }

    try {
      const { data: { session: authSession } } = await supabase.auth.getSession();
      if (!authSession) throw new Error("Usuário não autenticado");

      const { error } = await supabase.rpc("validate_cash_session", {
        p_session_id: selectedSession.id,
        p_validated_by: authSession.user.id,
        p_final_counted_cash: cash,
        p_final_counted_pix: pix,
        p_final_counted_debit: debit,
        p_final_counted_credit: credit,
        p_adjustment_note: adjustmentNote.trim() || null,
      });

      if (error) throw error;

      toast.success("Fechamento validado com sucesso!");
      setReviewDialogOpen(false);
      setSelectedSession(null);
      await loadPendingSessions();
    } catch (error: any) {
      console.error("Error validating session:", error);
      toast.error(error.message || "Erro ao validar fechamento");
    }
  };

  const calculateDifference = (session: PendingCashSession, method: 'cash' | 'pix' | 'debit' | 'credit' | 'total') => {
    if (!session.expected_cash || !session.counted_cash) return null;

    switch (method) {
      case 'cash':
        return (session.counted_cash || 0) - (session.expected_cash || 0);
      case 'pix':
        return (session.counted_pix || 0) - (session.expected_pix || 0);
      case 'debit':
        return (session.counted_debit || 0) - (session.expected_debit || 0);
      case 'credit':
        return (session.counted_credit || 0) - (session.expected_credit || 0);
      case 'total':
        const countedTotal = (session.counted_cash || 0) + 
                            (session.counted_pix || 0) + 
                            (session.counted_debit || 0) + 
                            (session.counted_credit || 0);
        return countedTotal - (session.expected_total || 0);
      default:
        return null;
    }
  };

  if (!canReview) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <p className="text-lg font-semibold">Acesso Negado</p>
          <p className="text-muted-foreground">
            Apenas Master e Admin podem acessar esta página.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Conferência de Caixa</CardTitle>
          <CardDescription>
            Sessões fechadas por atendentes aguardando validação
          </CardDescription>
        </CardHeader>
        <CardContent>
          {pendingSessions.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <p className="text-lg font-semibold">Nenhuma sessão pendente</p>
              <p className="text-muted-foreground">
                Todas as sessões foram validadas ou não há fechamentos pendentes.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingSessions.map((session) => {
                const totalDiff = calculateDifference(session, 'total');
                return (
                  <Card key={session.id} className="border-2">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-lg">
                            Sessão de {format(new Date(session.opened_at), "dd/MM/yyyy", { locale: ptBR })}
                          </CardTitle>
                          <CardDescription>
                            Fechada em {format(new Date(session.closed_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                            {session.closed_by_name && ` por ${session.closed_by_name}`}
                          </CardDescription>
                        </div>
                        <Badge variant={totalDiff === 0 ? "default" : totalDiff && totalDiff > 0 ? "secondary" : "destructive"}>
                          {totalDiff === 0 ? (
                            <CheckCircle className="h-3 w-3 mr-1" />
                          ) : totalDiff && totalDiff > 0 ? (
                            <TrendingUp className="h-3 w-3 mr-1" />
                          ) : (
                            <TrendingDown className="h-3 w-3 mr-1" />
                          )}
                          {totalDiff !== null 
                            ? `${totalDiff >= 0 ? "+" : ""}${formatCurrency(totalDiff)}`
                            : "Sem diferença"}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground">Dinheiro</p>
                          <div>
                            <p className="text-sm font-medium">Esperado: {formatCurrency(session.expected_cash || 0)}</p>
                            <p className="text-sm">Contado: {formatCurrency(session.counted_cash || 0)}</p>
                            {calculateDifference(session, 'cash') !== null && (
                              <p className={`text-xs font-semibold ${
                                calculateDifference(session, 'cash') === 0 
                                  ? "text-green-600" 
                                  : calculateDifference(session, 'cash')! > 0 
                                    ? "text-blue-600" 
                                    : "text-red-600"
                              }`}>
                                {calculateDifference(session, 'cash')! >= 0 ? "+" : ""}
                                {formatCurrency(calculateDifference(session, 'cash')!)}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground">PIX</p>
                          <div>
                            <p className="text-sm font-medium">Esperado: {formatCurrency(session.expected_pix || 0)}</p>
                            <p className="text-sm">Contado: {formatCurrency(session.counted_pix || 0)}</p>
                            {calculateDifference(session, 'pix') !== null && (
                              <p className={`text-xs font-semibold ${
                                calculateDifference(session, 'pix') === 0 
                                  ? "text-green-600" 
                                  : calculateDifference(session, 'pix')! > 0 
                                    ? "text-blue-600" 
                                    : "text-red-600"
                              }`}>
                                {calculateDifference(session, 'pix')! >= 0 ? "+" : ""}
                                {formatCurrency(calculateDifference(session, 'pix')!)}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground">Débito</p>
                          <div>
                            <p className="text-sm font-medium">Esperado: {formatCurrency(session.expected_debit || 0)}</p>
                            <p className="text-sm">Contado: {formatCurrency(session.counted_debit || 0)}</p>
                            {calculateDifference(session, 'debit') !== null && (
                              <p className={`text-xs font-semibold ${
                                calculateDifference(session, 'debit') === 0 
                                  ? "text-green-600" 
                                  : calculateDifference(session, 'debit')! > 0 
                                    ? "text-blue-600" 
                                    : "text-red-600"
                              }`}>
                                {calculateDifference(session, 'debit')! >= 0 ? "+" : ""}
                                {formatCurrency(calculateDifference(session, 'debit')!)}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground">Crédito</p>
                          <div>
                            <p className="text-sm font-medium">Esperado: {formatCurrency(session.expected_credit || 0)}</p>
                            <p className="text-sm">Contado: {formatCurrency(session.counted_credit || 0)}</p>
                            {calculateDifference(session, 'credit') !== null && (
                              <p className={`text-xs font-semibold ${
                                calculateDifference(session, 'credit') === 0 
                                  ? "text-green-600" 
                                  : calculateDifference(session, 'credit')! > 0 
                                    ? "text-blue-600" 
                                    : "text-red-600"
                              }`}>
                                {calculateDifference(session, 'credit')! >= 0 ? "+" : ""}
                                {formatCurrency(calculateDifference(session, 'credit')!)}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground">Total</p>
                          <div>
                            <p className="text-sm font-medium">Esperado: {formatCurrency(session.expected_total || 0)}</p>
                            <p className="text-sm">Contado: {formatCurrency(
                              (session.counted_cash || 0) + 
                              (session.counted_pix || 0) + 
                              (session.counted_debit || 0) + 
                              (session.counted_credit || 0)
                            )}</p>
                            {totalDiff !== null && (
                              <p className={`text-xs font-semibold ${
                                totalDiff === 0 
                                  ? "text-green-600" 
                                  : totalDiff > 0 
                                    ? "text-blue-600" 
                                    : "text-red-600"
                              }`}>
                                {totalDiff >= 0 ? "+" : ""}
                                {formatCurrency(totalDiff)}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>

                      {session.notes && (
                        <div className="mt-4 p-3 bg-muted rounded-md">
                          <p className="text-xs font-semibold text-muted-foreground mb-1">Observação do Atendente:</p>
                          <p className="text-sm whitespace-pre-wrap">{session.notes}</p>
                        </div>
                      )}

                      <div className="mt-4 flex justify-end">
                        <Button onClick={() => openReviewDialog(session)}>
                          <Eye className="h-4 w-4 mr-2" />
                          Validar Fechamento
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Review Dialog */}
      <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Validar Fechamento de Caixa</DialogTitle>
            <DialogDescription>
              Revise os valores contados pelo atendente e ajuste se necessário antes de validar.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4 overflow-y-auto flex-1 min-h-0">
            {selectedSession && (
              <>
                {/* Comparação lado a lado */}
                <div className="space-y-3">
                  <h4 className="font-semibold text-sm">Comparação de Valores</h4>
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Método</TableHead>
                          <TableHead className="text-right">Esperado</TableHead>
                          <TableHead className="text-right">Contado</TableHead>
                          <TableHead className="text-right">Diferença</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow>
                          <TableCell className="font-medium">Dinheiro</TableCell>
                          <TableCell className="text-right">{formatCurrency(selectedSession.expected_cash || 0)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(selectedSession.counted_cash || 0)}</TableCell>
                          <TableCell className={`text-right font-semibold ${
                            calculateDifference(selectedSession, 'cash') === 0 
                              ? "text-green-600" 
                              : calculateDifference(selectedSession, 'cash')! > 0 
                                ? "text-blue-600" 
                                : "text-red-600"
                          }`}>
                            {calculateDifference(selectedSession, 'cash') !== null && (
                              <>
                                {calculateDifference(selectedSession, 'cash')! >= 0 ? "+" : ""}
                                {formatCurrency(calculateDifference(selectedSession, 'cash')!)}
                              </>
                            )}
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-medium">PIX</TableCell>
                          <TableCell className="text-right">{formatCurrency(selectedSession.expected_pix || 0)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(selectedSession.counted_pix || 0)}</TableCell>
                          <TableCell className={`text-right font-semibold ${
                            calculateDifference(selectedSession, 'pix') === 0 
                              ? "text-green-600" 
                              : calculateDifference(selectedSession, 'pix')! > 0 
                                ? "text-blue-600" 
                                : "text-red-600"
                          }`}>
                            {calculateDifference(selectedSession, 'pix') !== null && (
                              <>
                                {calculateDifference(selectedSession, 'pix')! >= 0 ? "+" : ""}
                                {formatCurrency(calculateDifference(selectedSession, 'pix')!)}
                              </>
                            )}
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-medium">Débito</TableCell>
                          <TableCell className="text-right">{formatCurrency(selectedSession.expected_debit || 0)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(selectedSession.counted_debit || 0)}</TableCell>
                          <TableCell className={`text-right font-semibold ${
                            calculateDifference(selectedSession, 'debit') === 0 
                              ? "text-green-600" 
                              : calculateDifference(selectedSession, 'debit')! > 0 
                                ? "text-blue-600" 
                                : "text-red-600"
                          }`}>
                            {calculateDifference(selectedSession, 'debit') !== null && (
                              <>
                                {calculateDifference(selectedSession, 'debit')! >= 0 ? "+" : ""}
                                {formatCurrency(calculateDifference(selectedSession, 'debit')!)}
                              </>
                            )}
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-medium">Crédito</TableCell>
                          <TableCell className="text-right">{formatCurrency(selectedSession.expected_credit || 0)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(selectedSession.counted_credit || 0)}</TableCell>
                          <TableCell className={`text-right font-semibold ${
                            calculateDifference(selectedSession, 'credit') === 0 
                              ? "text-green-600" 
                              : calculateDifference(selectedSession, 'credit')! > 0 
                                ? "text-blue-600" 
                                : "text-red-600"
                          }`}>
                            {calculateDifference(selectedSession, 'credit') !== null && (
                              <>
                                {calculateDifference(selectedSession, 'credit')! >= 0 ? "+" : ""}
                                {formatCurrency(calculateDifference(selectedSession, 'credit')!)}
                              </>
                            )}
                          </TableCell>
                        </TableRow>
                        <TableRow className="bg-muted font-semibold">
                          <TableCell>TOTAL</TableCell>
                          <TableCell className="text-right">{formatCurrency(selectedSession.expected_total || 0)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(
                            (selectedSession.counted_cash || 0) + 
                            (selectedSession.counted_pix || 0) + 
                            (selectedSession.counted_debit || 0) + 
                            (selectedSession.counted_credit || 0)
                          )}</TableCell>
                          <TableCell className={`text-right ${
                            calculateDifference(selectedSession, 'total') === 0 
                              ? "text-green-600" 
                              : calculateDifference(selectedSession, 'total')! > 0 
                                ? "text-blue-600" 
                                : "text-red-600"
                          }`}>
                            {calculateDifference(selectedSession, 'total') !== null && (
                              <>
                                {calculateDifference(selectedSession, 'total')! >= 0 ? "+" : ""}
                                {formatCurrency(calculateDifference(selectedSession, 'total')!)}
                              </>
                            )}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </div>

                {/* Observação do atendente */}
                {selectedSession.notes && (
                  <div className="p-3 bg-muted rounded-md">
                    <p className="text-xs font-semibold text-muted-foreground mb-1">Observação do Atendente:</p>
                    <p className="text-sm whitespace-pre-wrap">{selectedSession.notes}</p>
                  </div>
                )}

                {/* Ajuste de valores */}
                <div className="space-y-3 border-t pt-4">
                  <h4 className="font-semibold text-sm">Ajustar Valores (Opcional)</h4>
                  <p className="text-xs text-muted-foreground">
                    Se necessário, ajuste os valores contados antes de validar o fechamento.
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="finalCash">Dinheiro Final (R$)</Label>
                      <Input
                        id="finalCash"
                        type="text"
                        value={finalCountedCash}
                        onChange={(e) => setFinalCountedCash(currencyMask(e.target.value))}
                        placeholder="0,00"
                      />
                    </div>
                    <div>
                      <Label htmlFor="finalPix">PIX Final (R$)</Label>
                      <Input
                        id="finalPix"
                        type="text"
                        value={finalCountedPix}
                        onChange={(e) => setFinalCountedPix(currencyMask(e.target.value))}
                        placeholder="0,00"
                      />
                    </div>
                    <div>
                      <Label htmlFor="finalDebit">Débito Final (R$)</Label>
                      <Input
                        id="finalDebit"
                        type="text"
                        value={finalCountedDebit}
                        onChange={(e) => setFinalCountedDebit(currencyMask(e.target.value))}
                        placeholder="0,00"
                      />
                    </div>
                    <div>
                      <Label htmlFor="finalCredit">Crédito Final (R$)</Label>
                      <Input
                        id="finalCredit"
                        type="text"
                        value={finalCountedCredit}
                        onChange={(e) => setFinalCountedCredit(currencyMask(e.target.value))}
                        placeholder="0,00"
                      />
                    </div>
                  </div>
                </div>

                {/* Nota de ajuste */}
                <div>
                  <Label htmlFor="adjustmentNote">Nota de Ajuste (Opcional)</Label>
                  <Textarea
                    id="adjustmentNote"
                    value={adjustmentNote}
                    onChange={(e) => setAdjustmentNote(e.target.value)}
                    placeholder="Informe o motivo do ajuste, se houver..."
                    rows={3}
                  />
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleValidate}>
              <CheckCircle className="h-4 w-4 mr-2" />
              Validar e Finalizar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CashReview;

