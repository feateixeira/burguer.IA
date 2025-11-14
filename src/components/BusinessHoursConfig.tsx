import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Clock, Plus, Trash2, Save, AlertCircle } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { getDayName, type BusinessInterval } from "@/utils/businessHours";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface WeeklyHours {
  id?: string;
  estab_id: string;
  day_of_week: number;
  enabled: boolean;
  intervals: BusinessInterval[];
}

interface HoursOverride {
  id?: string;
  estab_id: string;
  date: string;
  is_closed: boolean;
  intervals: BusinessInterval[] | null;
  note?: string | null;
}

interface BusinessHoursConfigProps {
  establishmentId: string;
  timezone?: string;
  allowOrdersWhenClosed?: boolean;
  showScheduleOnMenu?: boolean;
}

// Fusos horários populares no Brasil
const TIMEZONES = [
  { value: "America/Sao_Paulo", label: "Brasília (GMT-3)" },
  { value: "America/Manaus", label: "Manaus (GMT-4)" },
  { value: "America/Belem", label: "Belém (GMT-3)" },
  { value: "America/Fortaleza", label: "Fortaleza (GMT-3)" },
  { value: "America/Recife", label: "Recife (GMT-3)" },
  { value: "America/Bahia", label: "Bahia (GMT-3)" },
  { value: "America/Rio_Branco", label: "Rio Branco (GMT-5)" },
];

export function BusinessHoursConfig({
  establishmentId,
  timezone = "America/Sao_Paulo",
  allowOrdersWhenClosed = false,
  showScheduleOnMenu = true,
}: BusinessHoursConfigProps) {
  const [tz, setTz] = useState(timezone);
  const [allowOrders, setAllowOrders] = useState(allowOrdersWhenClosed);
  const [showSchedule, setShowSchedule] = useState(showScheduleOnMenu);
  const [weeklyHours, setWeeklyHours] = useState<WeeklyHours[]>([]);
  const [overrides, setOverrides] = useState<HoursOverride[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showOverrideDialog, setShowOverrideDialog] = useState(false);
  const [editingOverride, setEditingOverride] = useState<HoursOverride | null>(null);

  useEffect(() => {
    loadData();
  }, [establishmentId]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Carregar horários semanais
      const { data: weekly, error: weeklyError } = await supabase
        .from("establishment_hours")
        .select("*")
        .eq("estab_id", establishmentId)
        .order("day_of_week");

      if (weeklyError) throw weeklyError;

      // Se não existem horários, criar estrutura padrão
      if (!weekly || weekly.length === 0) {
        const defaultHours: WeeklyHours[] = Array.from({ length: 7 }, (_, i) => ({
          estab_id: establishmentId,
          day_of_week: i,
          enabled: i !== 0, // Domingo desabilitado por padrão
          intervals: i !== 0 ? [{ open: "10:00", close: "22:00" }] : [],
        }));
        setWeeklyHours(defaultHours);
      } else {
        setWeeklyHours(
          weekly.map((w) => ({
            ...w,
            intervals: (w.intervals as any) || [],
          }))
        );
      }

      // Carregar exceções (próximos 30 dias)
      const today = new Date();
      const futureDate = new Date(today);
      futureDate.setDate(futureDate.getDate() + 30);

      const { data: overridesData, error: overridesError } = await supabase
        .from("establishment_hours_overrides")
        .select("*")
        .eq("estab_id", establishmentId)
        .gte("date", today.toISOString().split("T")[0])
        .lte("date", futureDate.toISOString().split("T")[0])
        .order("date");

      if (overridesError) throw overridesError;
      setOverrides((overridesData || []).map(o => ({
        ...o,
        intervals: o.intervals ? (o.intervals as any) : null,
      })));
    } catch (error: any) {
      console.error("Error loading business hours:", error);
      toast.error("Erro ao carregar horários: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const updateWeeklyHours = (dayOfWeek: number, updates: Partial<WeeklyHours>) => {
    setWeeklyHours((prev) => {
      const existing = prev.find((w) => w.day_of_week === dayOfWeek);
      if (existing) {
        return prev.map((w) =>
          w.day_of_week === dayOfWeek ? { ...w, ...updates } : w
        );
      } else {
        return [...prev, { estab_id: establishmentId, day_of_week: dayOfWeek, enabled: false, intervals: [], ...updates }];
      }
    });
  };

  const addInterval = (dayOfWeek: number) => {
    const day = weeklyHours.find((w) => w.day_of_week === dayOfWeek);
    if (!day) {
      updateWeeklyHours(dayOfWeek, {
        enabled: true,
        intervals: [{ open: "10:00", close: "22:00" }],
      });
      return;
    }

    updateWeeklyHours(dayOfWeek, {
      intervals: [...day.intervals, { open: "10:00", close: "22:00" }],
    });
  };

  const removeInterval = (dayOfWeek: number, index: number) => {
    const day = weeklyHours.find((w) => w.day_of_week === dayOfWeek);
    if (!day) return;

    updateWeeklyHours(dayOfWeek, {
      intervals: day.intervals.filter((_, i) => i !== index),
    });
  };

  const updateInterval = (dayOfWeek: number, index: number, field: "open" | "close", value: string) => {
    const day = weeklyHours.find((w) => w.day_of_week === dayOfWeek);
    if (!day) return;

    const newIntervals = [...day.intervals];
    newIntervals[index] = { ...newIntervals[index], [field]: value };

    // Validar que open != close
    if (newIntervals[index].open === newIntervals[index].close) {
      toast.error("Horário de abertura e fechamento não podem ser iguais");
      return;
    }

    updateWeeklyHours(dayOfWeek, { intervals: newIntervals });
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      // Atualizar configurações do estabelecimento
      const { error: estabError } = await supabase
        .from("establishments")
        .update({
          timezone: tz,
          allow_orders_when_closed: allowOrders,
          show_schedule_on_menu: showSchedule,
        })
        .eq("id", establishmentId);

      if (estabError) throw estabError;

      // Salvar/atualizar horários semanais
      for (const weekly of weeklyHours) {
        if (weekly.id) {
          const { error } = await supabase
            .from("establishment_hours")
            .update({
              enabled: weekly.enabled,
              intervals: weekly.intervals,
            })
            .eq("id", weekly.id);

          if (error) throw error;
        } else {
          const { error } = await supabase.from("establishment_hours").insert({
            estab_id: weekly.estab_id,
            day_of_week: weekly.day_of_week,
            enabled: weekly.enabled,
            intervals: weekly.intervals,
          });

          if (error) throw error;
        }
      }

      toast.success("Horários salvos com sucesso!");
      await loadData();
    } catch (error: any) {
      console.error("Error saving business hours:", error);
      toast.error("Erro ao salvar horários: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveOverride = async (override: HoursOverride) => {
    try {
      if (override.id) {
        const { error } = await supabase
          .from("establishment_hours_overrides")
          .update({
            is_closed: override.is_closed,
            intervals: override.intervals,
            note: override.note || null,
          })
          .eq("id", override.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("establishment_hours_overrides")
          .insert({
            estab_id: establishmentId,
            date: override.date,
            is_closed: override.is_closed,
            intervals: override.intervals,
            note: override.note || null,
          });

        if (error) throw error;
      }

      toast.success("Exceção salva com sucesso!");
      setShowOverrideDialog(false);
      setEditingOverride(null);
      await loadData();
    } catch (error: any) {
      console.error("Error saving override:", error);
      toast.error("Erro ao salvar exceção: " + error.message);
    }
  };

  const handleDeleteOverride = async (id: string) => {
    try {
      const { error } = await supabase
        .from("establishment_hours_overrides")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast.success("Exceção removida!");
      await loadData();
    } catch (error: any) {
      console.error("Error deleting override:", error);
      toast.error("Erro ao remover exceção");
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Carregando horários...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Configurações Gerais */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Configurações Gerais
          </CardTitle>
          <CardDescription>
            Configure o fuso horário e comportamento dos pedidos
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="timezone">Fuso Horário</Label>
            <Select value={tz} onValueChange={setTz}>
              <SelectTrigger id="timezone">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIMEZONES.map((tz) => (
                  <SelectItem key={tz.value} value={tz.value}>
                    {tz.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50 border">
            <div className="space-y-0.5">
              <Label htmlFor="allow_orders" className="cursor-pointer">
                Permitir pedidos fora do horário
              </Label>
              <p className="text-sm text-muted-foreground">
                Se ativado, clientes poderão fazer pré-pedidos quando o estabelecimento estiver fechado
              </p>
            </div>
            <Switch
              id="allow_orders"
              checked={allowOrders}
              onCheckedChange={setAllowOrders}
            />
          </div>

          <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50 border">
            <div className="space-y-0.5">
              <Label htmlFor="show_schedule" className="cursor-pointer">
                Mostrar horários no cardápio
              </Label>
              <p className="text-sm text-muted-foreground">
                Exibir grade semanal de horários no cardápio online
              </p>
            </div>
            <Switch
              id="show_schedule"
              checked={showSchedule}
              onCheckedChange={setShowSchedule}
            />
          </div>
        </CardContent>
      </Card>

      {/* Horários Semanais */}
      <Card>
        <CardHeader>
          <CardTitle>Horários Semanais</CardTitle>
          <CardDescription>
            Configure os horários de funcionamento por dia da semana
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {Array.from({ length: 7 }, (_, i) => {
            const day = weeklyHours.find((w) => w.day_of_week === i) || {
              estab_id: establishmentId,
              day_of_week: i,
              enabled: false,
              intervals: [],
            };

            return (
              <div
                key={i}
                className="p-4 border rounded-lg space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={day.enabled}
                      onCheckedChange={(checked) =>
                        updateWeeklyHours(i, { enabled: checked })
                      }
                    />
                    <Label className="font-semibold">
                      {getDayName(i)}
                    </Label>
                  </div>
                  {day.enabled && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => addInterval(i)}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Adicionar Intervalo
                    </Button>
                  )}
                </div>

                {day.enabled && day.intervals.length > 0 && (
                  <div className="space-y-2 pl-8">
                    {day.intervals.map((interval, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-2"
                      >
                        <Input
                          type="time"
                          value={interval.open}
                          onChange={(e) =>
                            updateInterval(i, idx, "open", e.target.value)
                          }
                          className="w-32"
                        />
                        <span className="text-muted-foreground">até</span>
                        <Input
                          type="time"
                          value={interval.close}
                          onChange={(e) =>
                            updateInterval(i, idx, "close", e.target.value)
                          }
                          className="w-32"
                        />
                        {day.intervals.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeInterval(i, idx)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {day.enabled && day.intervals.length === 0 && (
                  <p className="text-sm text-muted-foreground pl-8">
                    Adicione pelo menos um intervalo de funcionamento
                  </p>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Exceções */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Exceções (Feriados / Fechamentos Especiais)</CardTitle>
              <CardDescription>
                Configure fechamentos ou horários especiais por data
              </CardDescription>
            </div>
            <Dialog open={showOverrideDialog} onOpenChange={setShowOverrideDialog}>
              <DialogTrigger asChild>
                <Button
                  onClick={() => {
                    setEditingOverride({
                      estab_id: establishmentId,
                      date: new Date().toISOString().split("T")[0],
                      is_closed: false,
                      intervals: null,
                      note: null,
                    });
                  }}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar Exceção
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>
                    {editingOverride?.id ? "Editar" : "Nova"} Exceção
                  </DialogTitle>
                </DialogHeader>
                {editingOverride && (
                  <OverrideForm
                    override={editingOverride}
                    onSave={handleSaveOverride}
                    onCancel={() => {
                      setShowOverrideDialog(false);
                      setEditingOverride(null);
                    }}
                  />
                )}
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {overrides.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhuma exceção configurada
            </p>
          ) : (
            <div className="space-y-2">
              {overrides.map((override) => (
                <div
                  key={override.id}
                  className="p-3 border rounded-lg flex items-center justify-between"
                >
                  <div className="flex-1">
                    <div className="font-medium">
                      {new Date(override.date).toLocaleDateString("pt-BR")}
                    </div>
                    {override.is_closed ? (
                      <span className="text-sm text-destructive">Fechado o dia todo</span>
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        Horários especiais
                      </span>
                    )}
                    {override.note && (
                      <p className="text-xs text-muted-foreground mt-1">{override.note}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditingOverride(override);
                        setShowOverrideDialog(true);
                      }}
                    >
                      Editar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => override.id && handleDeleteOverride(override.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Botão Salvar */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} size="lg">
          <Save className="h-4 w-4 mr-2" />
          {saving ? "Salvando..." : "Salvar Horários"}
        </Button>
      </div>
    </div>
  );
}

// Componente de formulário para exceções
function OverrideForm({
  override,
  onSave,
  onCancel,
}: {
  override: HoursOverride;
  onSave: (override: HoursOverride) => void;
  onCancel: () => void;
}) {
  const [date, setDate] = useState(override.date);
  const [isClosed, setIsClosed] = useState(override.is_closed);
  const [intervals, setIntervals] = useState<BusinessInterval[]>(
    override.intervals || []
  );
  const [note, setNote] = useState(override.note || "");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...override,
      date,
      is_closed: isClosed,
      intervals: isClosed ? null : intervals.length > 0 ? intervals : null,
      note: note || null,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="override_date">Data</Label>
        <Input
          id="override_date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
        />
      </div>

      <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50 border">
        <Label htmlFor="is_closed" className="cursor-pointer">
          Fechado o dia todo
        </Label>
        <Switch
          id="is_closed"
          checked={isClosed}
          onCheckedChange={setIsClosed}
        />
      </div>

      {!isClosed && (
        <div className="space-y-2">
          <Label>Horários Especiais (opcional)</Label>
          <div className="space-y-2">
            {intervals.map((interval, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <Input
                  type="time"
                  value={interval.open}
                  onChange={(e) => {
                    const newIntervals = [...intervals];
                    newIntervals[idx] = { ...newIntervals[idx], open: e.target.value };
                    setIntervals(newIntervals);
                  }}
                  className="w-32"
                />
                <span className="text-muted-foreground">até</span>
                <Input
                  type="time"
                  value={interval.close}
                  onChange={(e) => {
                    const newIntervals = [...intervals];
                    newIntervals[idx] = { ...newIntervals[idx], close: e.target.value };
                    setIntervals(newIntervals);
                  }}
                  className="w-32"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setIntervals(intervals.filter((_, i) => i !== idx))}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIntervals([...intervals, { open: "10:00", close: "22:00" }])}
            >
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Intervalo
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="override_note">Observação (opcional)</Label>
        <Textarea
          id="override_note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Ex: Feriado de Natal"
          rows={2}
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit">Salvar</Button>
      </div>
    </form>
  );
}

