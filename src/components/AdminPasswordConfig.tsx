import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Lock, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface AdminPasswordConfigProps {
  establishmentId: string;
  currentSettings?: {
    admin_password_hash?: string;
    admin_password_salt?: string;
    protected_pages?: string[];
    protected_actions?: Record<string, string[]>;
    admin_session_timeout?: number;
  };
  onSave?: () => void;
}

const PAGES = [
  { value: 'dashboard', label: 'Dashboard' },
  { value: 'pdv', label: 'PDV' },
  { value: 'products', label: 'Produtos' },
  { value: 'orders', label: 'Pedidos' },
  { value: 'customers', label: 'Clientes' },
  { value: 'costs', label: 'Custos' },
  { value: 'settings', label: 'Configurações' },
];

const PAGE_ACTIONS: Record<string, { value: string; label: string }[]> = {
  orders: [
    { value: 'delete', label: 'Excluir pedido' },
    { value: 'edit', label: 'Editar pedido' },
  ],
  customers: [
    { value: 'delete', label: 'Excluir cliente' },
    { value: 'edit', label: 'Editar cliente' },
  ],
  products: [
    { value: 'delete', label: 'Excluir produto' },
    { value: 'edit', label: 'Editar produto' },
  ],
  costs: [
    { value: 'create', label: 'Criar custo' },
    { value: 'delete', label: 'Excluir custo' },
  ],
};

export const AdminPasswordConfig = ({ establishmentId, currentSettings, onSave }: AdminPasswordConfigProps) => {
  const [isCreating, setIsCreating] = useState(!currentSettings?.admin_password_hash);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [sessionTimeout, setSessionTimeout] = useState((currentSettings?.admin_session_timeout || 900) / 60);
  const [protectedPages, setProtectedPages] = useState<string[]>(currentSettings?.protected_pages || []);
  const [protectedActions, setProtectedActions] = useState<Record<string, string[]>>(
    currentSettings?.protected_actions || {}
  );
  const [loading, setLoading] = useState(false);

  const togglePage = (page: string) => {
    setProtectedPages((prev) =>
      prev.includes(page) ? prev.filter((p) => p !== page) : [...prev, page]
    );
  };

  const toggleAction = (page: string, action: string) => {
    setProtectedActions((prev) => {
      const pageActions = prev[page] || [];
      const newPageActions = pageActions.includes(action)
        ? pageActions.filter((a) => a !== action)
        : [...pageActions, action];
      
      return {
        ...prev,
        [page]: newPageActions,
      };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword.length !== 4 || !/^\d{4}$/.test(newPassword)) {
      toast.error('A senha deve ter exatamente 4 dígitos');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('As senhas não coincidem');
      return;
    }

    // SECURITY: Verify current password server-side (no hash exposure)
    if (!isCreating && currentPassword) {
      try {
        const { data: verifyData, error: verifyError } = await supabase.functions.invoke('verify-admin-password', {
          body: {
            password: currentPassword,
          },
        });

        if (verifyError) throw verifyError;
        
        if (!verifyData?.valid) {
          toast.error('Senha atual incorreta');
          return;
        }
      } catch (error) {
        console.error('Error verifying current password:', error);
        toast.error('Erro ao verificar senha atual');
        return;
      }
    }

    setLoading(true);

    try {
      const { data: hashData, error: hashError } = await supabase.functions.invoke('hash-admin-password', {
        body: {
          action: 'hash',
          password: newPassword,
          establishmentId,
        },
      });

      if (hashError) throw hashError;

      const { hash } = hashData;

      // Prepare settings update
      const settingsUpdate: any = {
        protected_pages: protectedPages,
        protected_actions: protectedActions,
        admin_session_timeout: sessionTimeout * 60,
      };

      const { error: settingsError } = await supabase
        .from('establishments')
        .update({
          admin_password_hash: hash,
          settings: settingsUpdate,
        })
        .eq('id', establishmentId);

      if (settingsError) throw settingsError;

      toast.success(isCreating ? 'Senha de administrador criada com sucesso!' : 'Senha de administrador atualizada!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setIsCreating(false);
      
      if (onSave) onSave();
    } catch (error) {
      console.error('Error saving admin password:', error);
      toast.error('Erro ao salvar senha de administrador');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5" />
          <CardTitle>Senha de Administrador</CardTitle>
        </div>
        <CardDescription>
          Configure a senha de 4 dígitos para proteger áreas e ações sensíveis do sistema
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Password Section */}
          <div className="space-y-4 p-4 border rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Lock className="h-4 w-4" />
              <h3 className="font-semibold">
                {isCreating ? 'Criar Senha' : 'Alterar Senha'}
              </h3>
            </div>

            {!isCreating && (
              <div className="space-y-2">
                <Label htmlFor="currentPassword">Senha Atual *</Label>
                <Input
                  id="currentPassword"
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={4}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="••••"
                  required={!isCreating}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="newPassword">Nova Senha (4 dígitos) *</Label>
              <Input
                id="newPassword"
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="••••"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar Nova Senha *</Label>
              <Input
                id="confirmPassword"
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="••••"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="sessionTimeout">Tempo de Sessão (minutos)</Label>
              <Input
                id="sessionTimeout"
                type="number"
                min="1"
                max="120"
                value={sessionTimeout}
                onChange={(e) => setSessionTimeout(parseInt(e.target.value) || 15)}
              />
              <p className="text-xs text-muted-foreground">
                Após digitar a senha corretamente, o acesso fica liberado por este período
              </p>
            </div>
          </div>

          {/* Protected Pages */}
          <div className="space-y-4 p-4 border rounded-lg">
            <h3 className="font-semibold">Páginas Protegidas</h3>
            <p className="text-sm text-muted-foreground">
              Selecione as páginas que exigem senha de administrador para acesso
            </p>
            <div className="space-y-2">
              {PAGES.map((page) => (
                <div key={page.value} className="flex items-center space-x-2">
                  <Checkbox
                    id={`page-${page.value}`}
                    checked={protectedPages.includes(page.value)}
                    onCheckedChange={() => togglePage(page.value)}
                  />
                  <Label htmlFor={`page-${page.value}`} className="cursor-pointer">
                    {page.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {/* Protected Actions */}
          <div className="space-y-4 p-4 border rounded-lg">
            <h3 className="font-semibold">Ações Protegidas</h3>
            <p className="text-sm text-muted-foreground">
              Selecione ações específicas que exigem senha de administrador
            </p>
            <div className="space-y-4">
              {Object.entries(PAGE_ACTIONS).map(([page, actions]) => (
                <div key={page} className="space-y-2">
                  <h4 className="text-sm font-medium capitalize">{page}</h4>
                  <div className="space-y-2 ml-4">
                    {actions.map((action) => (
                      <div key={action.value} className="flex items-center space-x-2">
                        <Checkbox
                          id={`action-${page}-${action.value}`}
                          checked={protectedActions[page]?.includes(action.value)}
                          onCheckedChange={() => toggleAction(page, action.value)}
                        />
                        <Label htmlFor={`action-${page}-${action.value}`} className="cursor-pointer">
                          {action.label}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? 'Salvando...' : isCreating ? 'Criar Senha Admin' : 'Salvar Alterações'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
