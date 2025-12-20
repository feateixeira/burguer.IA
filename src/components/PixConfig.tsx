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
import { normalizePhoneBRToE164 } from '@/utils/phoneNormalizer';

interface PixConfigProps {
  establishmentId: string;
  onSave?: () => void;
}

type PixKeyType = 'cpf' | 'cnpj' | 'email' | 'phone' | 'random';

interface PixConfig {
  pix_key_type: PixKeyType | null;
  pix_key_value: string | null;
  pix_bank_name: string | null;
  pix_holder_name: string | null;
  pix_key_locked: boolean;
}

interface PixAuditLog {
  id: string;
  establishment_id: string;
  old_pix_key: string | null;
  new_pix_key: string;
  old_pix_key_type: string | null;
  new_pix_key_type: string;
  old_pix_bank_name: string | null;
  new_pix_bank_name: string | null;
  old_pix_holder_name: string | null;
  new_pix_holder_name: string | null;
  changed_by: string;
  changed_at: string;
}

export const PixConfig = ({ establishmentId, onSave }: PixConfigProps) => {
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
  const [auditLogs, setAuditLogs] = useState<PixAuditLog[]>([]);

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

      if (error) {
        console.error('Error loading PIX config:', error);
        toast.error(`Erro ao carregar configurações PIX: ${error.message}`);
        return;
      }
      
      if (data) {
        setConfig({
          pix_key_type: data.pix_key_type as PixKeyType | null,
          pix_key_value: data.pix_key_value || null,
          pix_bank_name: data.pix_bank_name || null,
          pix_holder_name: data.pix_holder_name || null,
          pix_key_locked: data.pix_key_locked || false,
        });
      }
    } catch (error: any) {
      console.error('Error loading PIX config:', error);
      toast.error(`Erro ao carregar configurações PIX: ${error?.message || 'Erro desconhecido'}`);
    }
  };

  const loadAuditLogs = async () => {
    try {
      const { data, error } = await supabase
        .from('pix_key_audit')
        .select('*')
        .eq('establishment_id', establishmentId)
        .order('changed_at', { ascending: false })
        .limit(20);

      if (error) {
        console.error('Error loading PIX audit logs:', error);
        // Não mostrar erro ao usuário se a tabela não existir ainda
        if (error.code !== '42P01') {
          toast.error('Erro ao carregar histórico de alterações');
        }
        return;
      }
      setAuditLogs(data || []);
    } catch (error) {
      console.error('Error loading PIX audit logs:', error);
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

  // Normalizar chave PIX de telefone para formato E.164
  const normalizePixKey = (key: string | null, type: PixKeyType | null): string | null => {
    if (!key || !type) return key;
    
    if (type === 'phone') {
      // Remover espaços e caracteres especiais, mas manter dígitos e +
      let cleaned = key.trim();
      
      // Se já começa com +, remover temporariamente para normalizar
      const hasPlus = cleaned.startsWith('+');
      const keyWithoutPlus = hasPlus ? cleaned.substring(1) : cleaned;
      
      // Normalizar telefone para formato E.164 (sem +)
      // A função normalizePhoneBRToE164 retorna apenas dígitos (ex: 5511999999999)
      const normalized = normalizePhoneBRToE164(keyWithoutPlus);
      
      // Validar se a normalização foi bem-sucedida
      if (!normalized || normalized.length < 12) {
        console.error('Erro ao normalizar chave PIX de telefone:', { key, normalized });
        throw new Error('Número de telefone inválido. Use o formato (XX) XXXXX-XXXX ou +55XXXXXXXXXXX');
      }
      
      // Adicionar + no início (formato E.164 completo para armazenamento)
      // Exemplo: +5511999999999
      return `+${normalized}`;
    }
    
    return key.trim();
  };

  const saveConfig = async () => {
    setLoading(true);
    try {
      // Validações básicas
      if (!config.pix_key_type) {
        toast.error('Selecione o tipo de chave PIX');
        setLoading(false);
        return;
      }

      if (!config.pix_key_value || !config.pix_key_value.trim()) {
        toast.error('Digite a chave PIX');
        setLoading(false);
        return;
      }

      // Normalizar chave PIX se for telefone
      let normalizedKey: string | null;
      try {
        normalizedKey = normalizePixKey(config.pix_key_value, config.pix_key_type);
      } catch (error: any) {
        toast.error(error.message || 'Erro ao normalizar chave PIX');
        setLoading(false);
        return;
      }

      if (!normalizedKey) {
        toast.error('Chave PIX inválida após normalização');
        setLoading(false);
        return;
      }

      console.log('Salvando chave PIX:', {
        tipo: config.pix_key_type,
        original: config.pix_key_value,
        normalizada: normalizedKey
      });
      
      // Get current values before update
      const { data: currentData, error: fetchError } = await supabase
        .from('establishments')
        .select('pix_key_type, pix_key_value, pix_bank_name, pix_holder_name')
        .eq('id', establishmentId)
        .single();

      if (fetchError) {
        console.error('Erro ao buscar dados atuais:', fetchError);
        throw new Error(`Erro ao buscar configurações: ${fetchError.message}`);
      }

      const oldValues = currentData ? {
        pix_key_type: currentData.pix_key_type,
        pix_key_value: currentData.pix_key_value,
        pix_bank_name: currentData.pix_bank_name,
        pix_holder_name: currentData.pix_holder_name,
      } : null;

      const newValues = {
        pix_key_type: config.pix_key_type,
        pix_key_value: normalizedKey,
        pix_bank_name: config.pix_bank_name || null,
        pix_holder_name: config.pix_holder_name || null,
      };

      // Update establishment
      // O trigger audit_pix_changes irá registrar automaticamente na tabela pix_key_audit
      const { error: updateError } = await supabase
        .from('establishments')
        .update({
          pix_key_type: config.pix_key_type,
          pix_key_value: normalizedKey,
          pix_bank_name: config.pix_bank_name || null,
          pix_holder_name: config.pix_holder_name || null,
        })
        .eq('id', establishmentId);

      if (updateError) {
        console.error('Erro ao atualizar estabelecimento:', updateError);
        throw new Error(`Erro ao salvar: ${updateError.message}`);
      }

      toast.success('Configurações PIX salvas com sucesso!');
      
      // Recarregar configuração e histórico após salvar
      // Aguardar um pouco para garantir que o trigger foi executado
      await new Promise(resolve => setTimeout(resolve, 500));
      await loadConfig();
      await loadAuditLogs();
      
      // Call onSave callback if provided to reload establishment data
      if (onSave) {
        onSave();
      }
    } catch (error: any) {
      console.error('Error saving PIX config:', error);
      const errorMessage = error?.message || 'Erro desconhecido ao salvar configurações PIX';
      toast.error(errorMessage);
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
            <Label htmlFor="pix_key_value">
              Chave PIX
              {config.pix_key_type === 'phone' && (
                <span className="text-xs text-muted-foreground ml-2">
                  (Formato: (XX) XXXXX-XXXX ou +55XXXXXXXXXXX)
                </span>
              )}
            </Label>
            <Input
              id="pix_key_value"
              type={config.pix_key_type === 'phone' ? 'tel' : 'text'}
              value={config.pix_key_value || ''}
              onChange={(e) => {
                let value = e.target.value;
                // Para telefone, permite apenas números, espaços, parênteses, traços e +
                if (config.pix_key_type === 'phone') {
                  // Permite números, espaços, parênteses, traços e +
                  value = value.replace(/[^\d\s()\-+]/g, '');
                }
                setConfig(prev => ({ ...prev, pix_key_value: value }));
              }}
              placeholder={
                config.pix_key_type === 'phone' 
                  ? 'Ex: (11) 99999-9999 ou +5511999999999'
                  : config.pix_key_type === 'email'
                  ? 'Ex: exemplo@email.com'
                  : config.pix_key_type === 'cpf'
                  ? 'Ex: 12345678901'
                  : config.pix_key_type === 'cnpj'
                  ? 'Ex: 12345678000190'
                  : 'Digite a chave PIX'
              }
              disabled={config.pix_key_locked}
              className={config.pix_key_type === 'phone' && config.pix_key_value && config.pix_key_value.length > 0 && !config.pix_key_value.match(/^(\+?55)?[\d\s()\-]{10,}$/) ? 'border-yellow-500' : ''}
            />
            {config.pix_key_type === 'phone' && config.pix_key_value && config.pix_key_value.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {(() => {
                  try {
                    const normalized = normalizePixKey(config.pix_key_value, config.pix_key_type);
                    if (normalized) {
                      return `✓ Será salvo como: ${normalized}`;
                    }
                    return '⚠ Verifique o formato do número';
                  } catch (error: any) {
                    return `⚠ ${error.message || 'Formato inválido'}`;
                  }
                })()}
              </p>
            )}
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
                          <TableCell className="whitespace-nowrap">
                            {format(new Date(log.changed_at), 'dd/MM/yyyy HH:mm')}
                          </TableCell>
                          <TableCell>
                            <div className="text-sm space-y-1">
                              {log.old_pix_key_type && (
                                <div><strong>Tipo:</strong> {log.old_pix_key_type}</div>
                              )}
                              {log.old_pix_key && (
                                <div><strong>Chave:</strong> {log.old_pix_key}</div>
                              )}
                              {log.old_pix_bank_name && (
                                <div><strong>Banco:</strong> {log.old_pix_bank_name}</div>
                              )}
                              {log.old_pix_holder_name && (
                                <div><strong>Titular:</strong> {log.old_pix_holder_name}</div>
                              )}
                              {!log.old_pix_key_type && !log.old_pix_key && (
                                <div className="text-muted-foreground italic">Sem dados anteriores</div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm space-y-1">
                              {log.new_pix_key_type && (
                                <div><strong>Tipo:</strong> {log.new_pix_key_type}</div>
                              )}
                              {log.new_pix_key && (
                                <div><strong>Chave:</strong> {log.new_pix_key}</div>
                              )}
                              {log.new_pix_bank_name && (
                                <div><strong>Banco:</strong> {log.new_pix_bank_name}</div>
                              )}
                              {log.new_pix_holder_name && (
                                <div><strong>Titular:</strong> {log.new_pix_holder_name}</div>
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
