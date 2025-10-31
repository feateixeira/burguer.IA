import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { 
  Users, 
  UserPlus, 
  Ban, 
  CheckCircle, 
  XCircle, 
  Bell,
  LogOut,
  Calendar,
  Trash2
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface User {
  id: string;
  email: string;
  name: string;
  establishment_name: string;
  created_at: string;
  status: 'active' | 'blocked' | 'cancelled';
}

export default function Admin() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [notificationDialogOpen, setNotificationDialogOpen] = useState(false);
  const [trialDialogOpen, setTrialDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  
  // Create user form
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserEstablishment, setNewUserEstablishment] = useState('');
  
  // Notification form
  const [notificationTitle, setNotificationTitle] = useState('');
  const [notificationMessage, setNotificationMessage] = useState('');
  
  // Trial form
  const [trialDays, setTrialDays] = useState('7');

  useEffect(() => {
    checkAdminAuth();
  }, []);

  const checkAdminAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      navigate('/');
      return;
    }

    // Check if user is admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('user_id', session.user.id)
      .single();

    if (!profile?.is_admin) {
      toast.error('Acesso negado. Apenas administradores podem acessar esta página.');
      navigate('/');
      return;
    }

    loadUsers();
  };

  const loadUsers = async () => {
    try {
      // Buscar profiles com establishment_id
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('user_id, full_name, created_at, status, is_admin, establishment_id')
        .eq('is_admin', false);

      if (error) throw error;

      const usersData: User[] = [];

      // Buscar todos os user_ids para obter os emails
      const userIds = (profiles || []).map(p => p.user_id);
      
      // Buscar emails via função RPC ou criar uma edge function
      // Por enquanto, vamos usar uma abordagem diferente: criar uma função RPC
      // ou buscar os emails via admin API (mas isso requer service role)
      // Solução temporária: vamos usar uma query que busca do auth.users via RPC
      
      // Vamos buscar os estabelecimentos em batch
      const establishmentIds = Array.from(
        new Set((profiles || [])
          .map(p => p.establishment_id)
          .filter(id => id !== null)
        )
      );

      // Buscar todos os estabelecimentos de uma vez
      const establishmentsMap = new Map<string, string>();
      if (establishmentIds.length > 0) {
        const { data: establishmentsData, error: estError } = await supabase
          .from('establishments')
          .select('id, name')
          .in('id', establishmentIds);

        if (establishmentsData && establishmentsData.length > 0) {
          establishmentsData.forEach(est => {
            establishmentsMap.set(est.id, est.name);
          });
        } else if (estError) {
          // Se não encontrou, pode ser problema de RLS - tentar buscar um por um
          for (const estId of establishmentIds) {
            try {
              const { data: estData } = await supabase
                .from('establishments')
                .select('id, name')
                .eq('id', estId)
                .maybeSingle();
              
              if (estData) {
                establishmentsMap.set(estData.id, estData.name);
              }
            } catch (err) {
              // Silenciar erro individual
            }
          }
        }
      }

      // Buscar emails via RPC (Edge Function tem problema de CORS, mas RPC funciona perfeitamente)
      const emailsMap = new Map<string, string>();
      
      if (userIds.length > 0) {
        try {
          const { data: emailsData, error: rpcError } = await supabase
            .rpc('get_user_emails', { user_ids: userIds });

          if (!rpcError && emailsData && Array.isArray(emailsData)) {
            emailsData.forEach((entry: any) => {
              if (entry.user_id && entry.email) {
                emailsMap.set(entry.user_id, entry.email);
              }
            });
          }
        } catch (error) {
          // Silenciar erro - usar UUID como fallback
        }
      }

      for (const profile of profiles || []) {
        // Buscar email do usuário
        const email = emailsMap.get(profile.user_id) || profile.user_id; // Fallback para UUID se não encontrar

        // Buscar nome do estabelecimento
        let establishmentName = 'N/A';
        if (profile.establishment_id) {
          const estName = establishmentsMap.get(profile.establishment_id);
          if (estName) {
            establishmentName = estName;
          } else {
            // Se não encontrou no map, pode ser que o establishment não existe mais
            establishmentName = 'Estabelecimento não encontrado';
          }
        } else {
          establishmentName = 'Sem estabelecimento';
        }
        
        // Não mostrar logs desnecessários - tudo está funcionando agora

        usersData.push({
          id: profile.user_id,
          email: email,
          name: profile.full_name || 'Sem nome',
          establishment_name: establishmentName,
          created_at: profile.created_at,
          status: (profile.status || 'active') as 'active' | 'blocked' | 'cancelled'
        });
      }

      setUsers(usersData);
    } catch (error) {
      console.error('Error loading users:', error);
      toast.error('Erro ao carregar usuários');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast.error('Sessão expirada. Por favor, faça login novamente.');
        navigate('/');
        return;
      }

      const response = await supabase.functions.invoke('create-user', {
        body: {
          email: newUserEmail,
          password: newUserPassword,
          name: newUserName,
          establishmentName: newUserEstablishment
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      // Log completo da resposta para debug
      console.log('Full response:', JSON.stringify(response, null, 2));

      // Se houver erro na resposta
      if (response.error) {
        let errorMessage = response.error.message || 'Erro desconhecido ao criar usuário';
        
        // Tentar obter mensagem do data se disponível (o Supabase às vezes coloca erro no data)
        if (response.data?.error) {
          errorMessage = response.data.error;
        }
        
        // Tentar obter do contexto do erro
        if (response.error.context?.body?.error) {
          errorMessage = response.error.context.body.error;
        }
        
        // Log detalhado
        console.error('Error in response:', {
          error: response.error,
          errorMessage: response.error.message,
          data: response.data,
          finalMessage: errorMessage
        });
        
        throw new Error(errorMessage);
      }

      // Verificar se a resposta tem erro no objeto data
      if (response.data?.error) {
        console.error('Error in response.data:', response.data.error);
        throw new Error(response.data.error);
      }

      // Verificar se foi bem-sucedido
      if (!response.data?.success) {
        throw new Error('Falha ao criar usuário. Tente novamente.');
      }

      toast.success('Usuário criado com sucesso!');
      setCreateDialogOpen(false);
      setNewUserEmail('');
      setNewUserPassword('');
      setNewUserName('');
      setNewUserEstablishment('');
      loadUsers();
    } catch (error: any) {
      // Mostrar mensagem de erro sem logs desnecessários
      const errorMessage = error?.message || error?.error || 'Erro desconhecido ao criar usuário';
      toast.error('Erro ao criar usuário: ' + errorMessage);
    }
  };

  const handleStatusChange = async (userId: string, newStatus: 'active' | 'blocked' | 'cancelled') => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ status: newStatus })
        .eq('user_id', userId);

      if (error) throw error;

      // Se cancelar, fazer logout do usuário se estiver logado
      if (newStatus === 'cancelled') {
        // Nota: Não podemos fazer logout direto, mas podemos tentar invalidar a sessão
        // O logout será feito automaticamente na próxima tentativa de login
      }

      toast.success(`Status do usuário atualizado para ${newStatus}`);
      loadUsers();
    } catch (error) {
      console.error('Error updating user status:', error);
      toast.error('Erro ao atualizar status do usuário');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Tem certeza que deseja excluir este usuário permanentemente? Esta ação não pode ser desfeita.')) {
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Sessão expirada. Por favor, faça login novamente.');
        return;
      }

      // Usa a Edge Function para deletar completamente, incluindo auth.users
      const response = await supabase.functions.invoke('delete-user', {
        body: { user_id: userId },
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      // Verificar se houve erro na resposta
      if (response.error) {
        let errorMessage = response.error.message || 'Erro desconhecido ao excluir usuário';
        
        // Tentar obter mensagem do data se disponível
        if (response.data?.error) {
          errorMessage = response.data.error;
        }
        
        throw new Error(errorMessage);
      }

      // Verificar se a resposta tem erro no objeto data
      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      // Verificar se foi bem-sucedido
      if (!response.data?.success) {
        throw new Error('Falha ao excluir usuário. Tente novamente.');
      }

      toast.success('Usuário excluído permanentemente do sistema e do banco de dados!');
      loadUsers();
    } catch (error: any) {
      console.error('Error deleting user:', error);
      toast.error('Erro ao excluir usuário: ' + (error.message || 'Erro desconhecido'));
    }
  };

  const handleSendNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedUser) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Sessão expirada');
        return;
      }

      const { error } = await supabase
        .from('user_notifications')
        .insert({
          user_id: selectedUser.id,
          title: notificationTitle,
          message: notificationMessage,
          type: 'payment',
          created_by: session.user.id
        });

      if (error) {
        console.error('Error inserting notification:', error);
        throw error;
      }
      
      console.log('Notification sent successfully to user:', selectedUser.id);

      toast.success('Notificação enviada com sucesso!');
      setNotificationDialogOpen(false);
      setNotificationTitle('');
      setNotificationMessage('');
      setSelectedUser(null);
    } catch (error) {
      console.error('Error sending notification:', error);
      toast.error('Erro ao enviar notificação');
    }
  };

  const handleSetTrial = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedUser) return;

    try {
      const trialEndDate = new Date();
      trialEndDate.setDate(trialEndDate.getDate() + parseInt(trialDays));

      const { error } = await supabase
        .from('profiles')
        .update({ trial_end_date: trialEndDate.toISOString() })
        .eq('user_id', selectedUser.id);

      if (error) throw error;

      toast.success(`${trialDays} dias de teste concedidos!`);
      setTrialDialogOpen(false);
      setTrialDays('7');
      setSelectedUser(null);
    } catch (error) {
      console.error('Error setting trial:', error);
      toast.error('Erro ao conceder dias de teste');
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-500">Ativo</Badge>;
      case 'blocked':
        return <Badge className="bg-red-500">Bloqueado</Badge>;
      case 'cancelled':
        return <Badge className="bg-gray-500">Cancelado</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users className="h-8 w-8" />
          <h1 className="text-3xl font-bold">Painel Administrativo</h1>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              Sair
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Fazer logout do painel admin</p>
          </TooltipContent>
        </Tooltip>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total de Usuários
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{users.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Ativos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {users.filter(u => u.status === 'active').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Bloqueados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {users.filter(u => u.status === 'blocked').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Cancelados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-600">
              {users.filter(u => u.status === 'cancelled').length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Gerenciar Usuários</CardTitle>
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DialogTrigger asChild>
                    <Button>
                      <UserPlus className="h-4 w-4 mr-2" />
                      Criar Usuário
                    </Button>
                  </DialogTrigger>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Criar novo usuário no sistema</p>
                </TooltipContent>
              </Tooltip>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Criar Novo Usuário</DialogTitle>
                  <DialogDescription>
                    Preencha os dados do novo usuário
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreateUser} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={newUserEmail}
                      onChange={(e) => setNewUserEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Senha Temporária *</Label>
                    <Input
                      id="password"
                      type="password"
                      value={newUserPassword}
                      onChange={(e) => setNewUserPassword(e.target.value)}
                      required
                      minLength={6}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="name">Nome</Label>
                    <Input
                      id="name"
                      value={newUserName}
                      onChange={(e) => setNewUserName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="establishment">Nome do Estabelecimento</Label>
                    <Input
                      id="establishment"
                      value={newUserEstablishment}
                      onChange={(e) => setNewUserEstablishment(e.target.value)}
                    />
                  </div>
                  <DialogFooter>
                    <Button type="submit">Criar Usuário</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Estabelecimento</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Criado em</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>{user.name}</TableCell>
                  <TableCell>{user.establishment_name}</TableCell>
                  <TableCell>{getStatusBadge(user.status)}</TableCell>
                  <TableCell>
                    {new Date(user.created_at).toLocaleDateString('pt-BR')}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      {user.status !== 'active' && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleStatusChange(user.id, 'active')}
                            >
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Ativar usuário</p>
                          </TooltipContent>
                        </Tooltip>
                      )}
                      {user.status !== 'blocked' && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleStatusChange(user.id, 'blocked')}
                            >
                              <Ban className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Bloquear usuário</p>
                          </TooltipContent>
                        </Tooltip>
                      )}
                      {user.status !== 'cancelled' && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleStatusChange(user.id, 'cancelled')}
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Cancelar usuário</p>
                          </TooltipContent>
                        </Tooltip>
                      )}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedUser(user);
                              setNotificationDialogOpen(true);
                            }}
                          >
                            <Bell className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Enviar notificação</p>
                        </TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedUser(user);
                              setTrialDialogOpen(true);
                            }}
                          >
                            <Calendar className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Conceder dias de teste</p>
                        </TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDeleteUser(user.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Excluir usuário permanentemente</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Notification Dialog */}
      <Dialog open={notificationDialogOpen} onOpenChange={setNotificationDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enviar Notificação</DialogTitle>
            <DialogDescription>
              Enviar notificação para {selectedUser?.email}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSendNotification} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="notif-title">Título *</Label>
              <Input
                id="notif-title"
                value={notificationTitle}
                onChange={(e) => setNotificationTitle(e.target.value)}
                placeholder="Ex: Falta de Pagamento"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notif-message">Mensagem *</Label>
              <Textarea
                id="notif-message"
                value={notificationMessage}
                onChange={(e) => setNotificationMessage(e.target.value)}
                placeholder="Ex: Sua mensalidade está em atraso"
                required
                rows={4}
              />
            </div>
            <DialogFooter>
              <Button type="submit">Enviar Notificação</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Trial Dialog */}
      <Dialog open={trialDialogOpen} onOpenChange={setTrialDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Conceder Dias de Teste</DialogTitle>
            <DialogDescription>
              Conceder dias de teste para {selectedUser?.email}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSetTrial} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="trial-days">Número de Dias *</Label>
              <Input
                id="trial-days"
                type="number"
                value={trialDays}
                onChange={(e) => setTrialDays(e.target.value)}
                min="1"
                max="365"
                required
              />
            </div>
            <DialogFooter>
              <Button type="submit">Conceder Teste</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
