import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Lock, Unlock, Save, History } from 'lucide-react';
import { AdminPasswordModal } from './AdminPasswordModal';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';

interface PixConfigProps {
  establishmentId: string;
}

type PixKeyType = 'cpf' | 'cnpj' | 'email' | 'phone' | 'random';

interface PixConfig {
  pix_key_type: PixKeyType | null;
  pix_key_value: string | null;
  pix_bank_name: string | null;
  pix_holder_name: string | null;
  pix_key_locked: boolean;
}

interface AuditLog {
  id: string;
  action: string;
  old_values: any;
  new_values: any;
  created_at: string;
  user_id: string;
}

export const PixConfig = ({ establishmentId }: PixConfigProps) => {
  const { authenticateAdmin } = useAdminAuth();
  const [config, setConfig] = useState<PixConfig>({
    pix_key_type: null,
    pix_key_value: null,
    pix_bank_name: null,
    pix_holder_name: null,
    pix_key_locked: false,
  });
  const [loading, setLoading] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [pendingChanges, setPendingChanges] = useState<Partial<PixConfig> | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  useEffect(() => {
    loadConfig();
    loadAuditLogs();
  }, [establishmentId]);

  const loadConfig = async () => {
    try {
      const { data, error } = await supabase
        .from('establishments')
        .select('pix_key_type, pix_key_value, pix_bank_name, pix_holder_name, pix_key_locked')
        .eq('id', establishmentId)
        .single();

      if (error) throw error;
      if (data) {
        setConfig({
          ...data,
          pix_key_type: data.pix_key_type as PixKeyType | null,
          pix_key_locked: data.pix_key_locked || false,
        });
      }
    } catch (error) {
      console.error('Error loading PIX config:', error);
      toast.error('Erro ao carregar configurações PIX');
    }
  };

  const loadAuditLogs = async () => {
    try {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('establishment_id', establishmentId)
        .eq('action', 'update_pix_key')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setAuditLogs(data || []);
    } catch (error) {
      console.error('Error loading audit logs:', error);
    }
  };

  const handleSave = async () => {
    if (config.pix_key_locked) {
      setPendingChanges(config);
      setShowPasswordModal(true);
      return;
    }

    await saveConfig();
  };

  const saveConfig = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('establishments')
        .update({
          pix_key_type: config.pix_key_type,
          pix_key_value: config.pix_key_value,
          pix_bank_name: config.pix_bank_name,
          pix_holder_name: config.pix_holder_name,
        })
        .eq('id', establishmentId);

      if (error) throw error;

      toast.success('Configurações PIX salvas com sucesso!');
      await loadAuditLogs();
    } catch (error) {
      console.error('Error saving PIX config:', error);
      toast.error('Erro ao salvar configurações PIX');
    } finally {
      setLoading(false);
    }
  };

  const toggleLock = async () => {
    if (!config.pix_key_locked) {
      setPendingChanges({ pix_key_locked: true });
      setShowPasswordModal(true);
      return;
    }

    setPendingChanges({ pix_key_locked: false });
    setShowPasswordModal(true);
  };

  const handlePasswordSuccess = async (password: string): Promise<boolean> => {
    const isValid = await authenticateAdmin(password);
    
    if (isValid) {
      setShowPasswordModal(false);
      
      if (pendingChanges?.pix_key_locked !== undefined) {
        const { data: { user } } = await supabase.auth.getUser();
        
        const { error } = await supabase
          .from('establishments')
          .update({
            pix_key_locked: pendingChanges.pix_key_locked,
            pix_key_locked_at: pendingChanges.pix_key_locked ? new Date().toISOString() : null,
            pix_key_locked_by: pendingChanges.pix_key_locked ? user?.id : null,
          })
          .eq('id', establishmentId);

        if (error) {
          toast.error('Erro ao alterar bloqueio');
          return false;
        }

        setConfig(prev => ({
          ...prev,
          pix_key_locked: pendingChanges.pix_key_locked!,
          pix_key_locked_at: pendingChanges.pix_key_locked ? new Date().toISOString() : null,
        }));

        toast.success(pendingChanges.pix_key_locked ? 'Chave PIX bloqueada' : 'Chave PIX desbloqueada');
      } else {
        await saveConfig();
      }
      
      setPendingChanges(null);
      return true;
    }
    
    return false;
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Configuração de Chave PIX
            <Button
              variant={config.pix_key_locked ? "destructive" : "outline"}
              size="sm"
              onClick={toggleLock}
            >
              {config.pix_key_locked ? (
                <>
                  <Lock className="h-4 w-4 mr-2" />
                  Bloqueada
                </>
              ) : (
                <>
                  <Unlock className="h-4 w-4 mr-2" />
                  Desbloqueada
                </>
              )}
            </Button>
          </CardTitle>
          <CardDescription>
            Configure a chave PIX oficial do estabelecimento. Uma vez bloqueada, só pode ser alterada com senha de administrador.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {config.pix_key_locked && (
            <Alert>
              <AlertDescription>
                Esta chave está bloqueada para edição. Desbloqueie com a senha de administrador para fazer alterações.
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="pix_key_type">Tipo de Chave</Label>
            <Select
              value={config.pix_key_type || ''}
              onValueChange={(value) => setConfig(prev => ({ ...prev, pix_key_type: value as PixKeyType }))}
              disabled={config.pix_key_locked}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o tipo de chave" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cpf">CPF</SelectItem>
                <SelectItem value="cnpj">CNPJ</SelectItem>
                <SelectItem value="email">E-mail</SelectItem>
                <SelectItem value="phone">Telefone</SelectItem>
                <SelectItem value="random">Chave Aleatória</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="pix_key_value">Chave PIX</Label>
            <Input
              id="pix_key_value"
              value={config.pix_key_value || ''}
              onChange={(e) => setConfig(prev => ({ ...prev, pix_key_value: e.target.value }))}
              placeholder="Digite a chave PIX"
              disabled={config.pix_key_locked}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="pix_bank_name">Banco</Label>
            <Input
              id="pix_bank_name"
              value={config.pix_bank_name || ''}
              onChange={(e) => setConfig(prev => ({ ...prev, pix_bank_name: e.target.value }))}
              placeholder="Nome do banco"
              disabled={config.pix_key_locked}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="pix_holder_name">Nome do Titular</Label>
            <Input
              id="pix_holder_name"
              value={config.pix_holder_name || ''}
              onChange={(e) => setConfig(prev => ({ ...prev, pix_holder_name: e.target.value }))}
              placeholder="Nome do titular da conta"
              disabled={config.pix_key_locked}
            />
          </div>

          <div className="flex gap-2">
            <Button onClick={handleSave} disabled={loading || config.pix_key_locked}>
              <Save className="h-4 w-4 mr-2" />
              Salvar Configurações
            </Button>

            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" onClick={loadAuditLogs}>
                  <History className="h-4 w-4 mr-2" />
                  Histórico de Alterações
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl">
                <DialogHeader>
                  <DialogTitle>Histórico de Alterações - Chave PIX</DialogTitle>
                </DialogHeader>
                <div className="max-h-96 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Valores Antigos</TableHead>
                        <TableHead>Valores Novos</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {auditLogs.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell>
                            {format(new Date(log.created_at), 'dd/MM/yyyy HH:mm')}
                          </TableCell>
                          <TableCell>
                            <div className="text-sm space-y-1">
                              {log.old_values?.pix_key_type && (
                                <div>Tipo: {log.old_values.pix_key_type}</div>
                              )}
                              {log.old_values?.pix_key_value && (
                                <div>Chave: {log.old_values.pix_key_value}</div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm space-y-1">
                              {log.new_values?.pix_key_type && (
                                <div>Tipo: {log.new_values.pix_key_type}</div>
                              )}
                              {log.new_values?.pix_key_value && (
                                <div>Chave: {log.new_values.pix_key_value}</div>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      {auditLogs.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center text-muted-foreground">
                            Nenhuma alteração registrada
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>

      <AdminPasswordModal
        open={showPasswordModal}
        onClose={() => {
          setShowPasswordModal(false);
          setPendingChanges(null);
        }}
        onSuccess={() => {}}
        onAuthenticate={handlePasswordSuccess}
        title="Senha de Administrador"
        description="Digite a senha de administrador para continuar"
      />
    </div>
  );
};
