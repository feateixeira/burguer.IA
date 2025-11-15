import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Settings as SettingsIcon, Save, Building, User, Shield, Target, Phone, Mail, MapPin, Printer, CreditCard, Key, Copy, RefreshCw, Eye, EyeOff, Users, Plus, Trash2, Truck, Clock } from "lucide-react";
import { useConfirm } from "@/hooks/useConfirm";
import Sidebar from "@/components/Sidebar";
import { PrinterConfigComponent } from "@/components/PrinterConfig";
import { PrintersManager } from "@/components/printers/PrintersManager";
import { PrinterRouting } from "@/components/printers/PrinterRouting";
import { PixConfig } from "@/components/PixConfig";
import { DeliveryBoysManager } from "@/components/delivery/DeliveryBoysManager";
import { useTeamUser } from "@/components/TeamUserProvider";
import { useSidebarWidth } from "@/hooks/useSidebarWidth";
import { BusinessHoursConfig } from "@/components/BusinessHoursConfig";
import { useSearchParams } from "react-router-dom";


interface Profile {
  id: string;
  full_name: string;
  phone: string;
  establishment_id: string;
}

interface Establishment {
  id: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  cnpj?: string;
  logo_url?: string;
  settings: any;
  daily_goal?: number;
  weekly_goal?: number;
  monthly_goal?: number;
  monthly_orders_goal?: number;
  monthly_customers_goal?: number;
  api_key?: string;
  timezone?: string;
  allow_orders_when_closed?: boolean;
  show_schedule_on_menu?: boolean;
}

const Settings = () => {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [establishment, setEstablishment] = useState<Establishment | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [generatingApiKey, setGeneratingApiKey] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [userRole, setUserRole] = useState<'master' | 'admin' | 'atendente' | 'cozinha' | null>(null);
  const [team, setTeam] = useState<any[]>([]);
  const [teamLoading, setTeamLoading] = useState(false);
  const [memberName, setMemberName] = useState('');
  const [memberRole, setMemberRole] = useState<'master' | 'admin' | 'atendente' | 'cozinha'>('admin');
  const [memberPin, setMemberPin] = useState('');
  const [forceMasterDialog, setForceMasterDialog] = useState(false);
  const confirmDialog = useConfirm();
  const [showMemberForm, setShowMemberForm] = useState(false);
  const [memberFormStep, setMemberFormStep] = useState(0); // etapas: 0-início, 1-nome, 2-função, 3-pin
  const { setTeamUser } = useTeamUser();
  const sidebarWidth = useSidebarWidth();
  const [isDesktop, setIsDesktop] = useState(false);
  const [isNaBrasa, setIsNaBrasa] = useState(false);
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'establishment');
  
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  useEffect(() => {
    const checkDesktop = () => setIsDesktop(window.innerWidth >= 1024);
    checkDesktop();
    window.addEventListener('resize', checkDesktop);
    return () => window.removeEventListener('resize', checkDesktop);
  }, []);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Verifica se é admin do sistema
      const userIsSystemAdmin = session.user.email === 'fellipe_1693@outlook.com';

      // Load user profile
      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", session.user.id)
        .single();

      if (profileData) {
        setProfile(profileData);

        // Load establishment data
        const { data: establishmentData } = await supabase
          .from("establishments")
          .select("*")
          .eq("id", profileData.establishment_id)
          .single();

        if (establishmentData) {
          setEstablishment(establishmentData);
          
          // Verifica se é Na Brasa (somente se não for admin do sistema)
          if (!userIsSystemAdmin) {
            const establishmentName = establishmentData.name?.toLowerCase() || '';
            const isNaBrasaUser = establishmentName.includes('na brasa') || 
                                  establishmentName.includes('nabrasa') ||
                                  establishmentName === 'hamburgueria na brasa';
            setIsNaBrasa(isNaBrasaUser);
          } else {
            setIsNaBrasa(false);
          }
          
          // Carrega papel do usuário atual e equipe
          await loadUserRoleAndTeam(profileData.user_id, establishmentData.id);
          // Verifica se já existe Master
          await checkMaster(establishmentData.id);
        }
      }
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Erro ao carregar configurações");
    } finally {
      setLoading(false);
    }
  };

  const loadUserRoleAndTeam = async (userId: string, establishmentId: string) => {
    try {
      // Papel do usuário (se cadastrado como membro)
      const { data: myRole } = await supabase
        .from('team_members')
        .select('role')
        .eq('establishment_id', establishmentId)
        .eq('user_id', userId)
        .maybeSingle();
      setUserRole((myRole?.role as any) || null);

      // Lista da equipe (somente se master/admin)
      if (myRole?.role === 'master' || myRole?.role === 'admin') {
        setTeamLoading(true);
        const { data: members } = await supabase
          .from('team_members')
          .select('id, name, role, active, created_at')
          .eq('establishment_id', establishmentId)
          .order('role', { ascending: true });
        setTeam(members || []);
      } else {
        setTeam([]);
      }
    } catch (e) {
      console.error('loadUserRoleAndTeam error', e);
    } finally {
      setTeamLoading(false);
    }
  };

  const checkMaster = async (establishmentId: string) => {
    try {
      const { data, error } = await supabase
        .from('team_members')
        .select('id')
        .eq('establishment_id', establishmentId)
        .eq('role', 'master')
        .limit(1);
      if (error) throw error;
      setForceMasterDialog(!data || data.length === 0);
    } catch (e) {
      console.error('checkMaster error', e);
    }
  };

  const createMember = async () => {
    if (!establishment) return;
    // Somente Master/Admin podem cadastrar novos usuários
    if (!(userRole === 'master' || userRole === 'admin')) {
      toast.error('Apenas Master ou Admin podem cadastrar membros');
      return;
    }
    // Apenas Master pode criar outro Master (o select padrão não oferece master, exceto no fluxo forçado)
    if (memberRole === 'master' && userRole !== 'master') {
      toast.error('Apenas o Master pode criar outro Master');
      return;
    }
    if (!memberName.trim()) return toast.error('Informe o nome');
    if ((memberRole === 'admin' || memberRole === 'master') && (!/^\d{4}$/.test(memberPin))) return toast.error('PIN de 4 dígitos obrigatório para Master/Admin');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const payload: any = {
        establishment_id: establishment.id,
        name: memberName.trim(),
        role: memberRole,
        active: true,
      };
      if (memberRole === 'admin' || memberRole === 'master') payload.pin = memberPin;
      if (memberRole === 'master' && session?.user?.id) payload.user_id = session.user.id;
      const { data: created, error } = await supabase.from('team_members').insert([payload]).select('*').single();
      if (error) throw error;
      toast.success('Membro criado');
      const shouldUpdateMyRole = memberRole === 'master' && profile?.user_id && session?.user?.id === profile.user_id;
      if (created && memberRole === 'master' && shouldUpdateMyRole) {
        setTeamUser({ id: created.id, name: created.name, role: created.role, active: created.active, user_id: created.user_id });
        setForceMasterDialog(false);
        // Só aqui atualiza papel do logado
        await loadUserRoleAndTeam(profile!.id, establishment.id);
      } else {
        // Só recarrega lista, NÃO atualiza userRole do logado (mantém master/admin visualizando a aba!)
        const { data: members } = await supabase
          .from('team_members')
          .select('id, name, role, active, created_at')
          .eq('establishment_id', establishment.id)
          .order('role', { ascending: true });
        setTeam(members || []);
      }
      setMemberName('');
      setMemberPin('');
    } catch (e) {
      console.error(e);
      toast.error('Erro ao criar membro');
    }
  };

  const removeTeamMember = async (memberId: string) => {
    const ok = await confirmDialog({ title: 'Remover membro', description: 'Tem certeza que deseja remover este membro da equipe?' });
    if (!ok) {
      return;
    }
    try {
      const { error } = await supabase
        .from('team_members')
        .delete()
        .eq('id', memberId);
      if (error) throw error;
      toast.success('Membro removido com sucesso!');
      loadUserRoleAndTeam(profile!.id, establishment!.id);
    } catch (e) {
      console.error('removeTeamMember error', e);
      toast.error('Erro ao remover membro');
    }
  };

  const handleProfileSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);

    const formData = new FormData(e.currentTarget);

    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: formData.get("full_name") as string,
          phone: formData.get("phone") as string || null,
        })
        .eq("id", profile!.id);

      if (error) throw error;
      toast.success("Perfil atualizado com sucesso!");
      loadData();
    } catch (error) {
      console.error("Error updating profile:", error);
      toast.error("Erro ao atualizar perfil");
    } finally {
      setSaving(false);
    }
  };

  const handleEstablishmentSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);

    const formData = new FormData(e.currentTarget);

    try {
      // Update profile data
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          full_name: formData.get("user_full_name") as string,
          phone: formData.get("user_phone") as string || null,
        })
        .eq("id", profile!.id);

      if (profileError) throw profileError;

      // Update establishment data
      const settings = {
        ...establishment?.settings,
        enable_notifications: formData.get("enable_notifications") === "on",
        tax_rate: parseFloat(formData.get("tax_rate") as string) || 0,
        delivery_fee: parseFloat(formData.get("delivery_fee") as string) || 0,
      };

      const daily_goal = parseInt(formData.get("daily_goal") as string) || 0;
      const weekly_goal = parseInt(formData.get("weekly_goal") as string) || 0;
      const monthly_goal = parseInt(formData.get("monthly_goal") as string) || 0;
      const monthly_orders_goal = parseInt(formData.get("monthly_orders_goal") as string) || 0;
      const monthly_customers_goal = parseInt(formData.get("monthly_customers_goal") as string) || 0;

      const establishmentName = formData.get("establishment_name") as string;
      const establishmentEmail = formData.get("establishment_email") as string;
      
      if (!establishmentName || !establishmentEmail) {
        toast.error("Nome e email do estabelecimento são obrigatórios");
        return;
      }

      const { error } = await supabase
        .from("establishments")
        .update({
          name: establishmentName,
          email: establishmentEmail,
          phone: formData.get("phone") as string || null,
          address: formData.get("address") as string || null,
          cnpj: formData.get("cnpj") as string || null,
          pix_key: formData.get("pix_key") as string || null,
          settings,
          daily_goal,
          weekly_goal,
          monthly_goal,
          monthly_orders_goal,
          monthly_customers_goal,
        })
        .eq("id", establishment!.id);

      if (error) throw error;
      
      toast.success("Configurações atualizadas com sucesso!");
      loadData();
    } catch (error) {
      console.error("Error updating settings:", error);
      toast.error("Erro ao atualizar configurações");
    } finally {
      setSaving(false);
    }
  };

  const generateApiKey = async () => {
    if (!establishment) return;
    
    setGeneratingApiKey(true);
    try {
      const newApiKey = `bgia_${crypto.randomUUID().replace(/-/g, '')}`;
      
      const { error } = await supabase
        .from("establishments")
        .update({ api_key: newApiKey })
        .eq("id", establishment.id);

      if (error) throw error;
      
      toast.success("API Key gerada com sucesso!");
      loadData();
    } catch (error) {
      console.error("Error generating API key:", error);
      toast.error("Erro ao gerar API Key");
    } finally {
      setGeneratingApiKey(false);
    }
  };

  const copyApiKey = () => {
    if (establishment?.api_key) {
      navigator.clipboard.writeText(establishment.api_key);
      toast.success("API Key copiada!");
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      toast.error('As senhas não coincidem');
      return;
    }

    if (newPassword.length < 6) {
      toast.error('A nova senha deve ter no mínimo 6 caracteres');
      return;
    }

    setSaving(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user.email) {
        toast.error('Usuário não autenticado');
        return;
      }

      // Verify current password by signing in
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: session.user.email,
        password: currentPassword,
      });

      if (signInError) {
        toast.error('Senha atual incorreta');
        setSaving(false);
        return;
      }

      // Update password
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) throw updateError;

      toast.success('Senha alterada com sucesso!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      console.error('Error changing password:', error);
      toast.error('Erro ao alterar senha: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
          <p className="mt-4 text-muted-foreground">Carregando configurações...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <Sidebar />
        
        <main 
          className="transition-all duration-300 ease-in-out"
          style={{
            marginLeft: isDesktop ? `${sidebarWidth}px` : '0px',
            padding: '1.5rem',
            minHeight: '100vh',
            height: '100vh',
            overflowY: 'auto'
          }}
        >
          <div className="w-full">
            {/* Header */}
            <div className="mb-8">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-primary/10">
                  <SettingsIcon className="h-6 w-6 text-primary" />
                </div>
                <h1 className="text-3xl font-bold text-foreground">Configurações</h1>
              </div>
              <p className="text-muted-foreground ml-[52px]">
                Gerencie seu perfil, estabelecimento e configurações de segurança
              </p>
            </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6 tabs-compact">
            <TabsList className={`grid w-full h-auto p-1 ${isNaBrasa ? 'grid-cols-8' : 'grid-cols-7'}`}>
              <TabsTrigger value="establishment" className="flex items-center gap-2 py-3">
                <Building className="h-4 w-4" />
                <span className="hidden lg:inline">Estabelecimento</span>
              </TabsTrigger>
              {/* Aba API apenas para Na Brasa */}
              {isNaBrasa && (
                <TabsTrigger value="api" className="flex items-center gap-2 py-3">
                  <Key className="h-4 w-4" />
                  <span className="hidden lg:inline">API</span>
                </TabsTrigger>
              )}
              <TabsTrigger value="hours" className="flex items-center gap-2 py-3">
                <Clock className="h-4 w-4" />
                <span className="hidden lg:inline">Horários</span>
              </TabsTrigger>
              <TabsTrigger value="printers" className="flex items-center gap-2 py-3">
                <Printer className="h-4 w-4" />
                <span className="hidden lg:inline">Impressoras</span>
              </TabsTrigger>
              <TabsTrigger value="pix" className="flex items-center gap-2 py-3">
                <CreditCard className="h-4 w-4" />
                <span className="hidden lg:inline">PIX</span>
              </TabsTrigger>
              <TabsTrigger value="delivery" className="flex items-center gap-2 py-3">
                <Truck className="h-4 w-4" />
                <span className="hidden lg:inline">Delivery</span>
              </TabsTrigger>
              <TabsTrigger value="security" className="flex items-center gap-2 py-3">
                <Shield className="h-4 w-4" />
                <span className="hidden lg:inline">Segurança</span>
              </TabsTrigger>
              {(userRole === 'master' || userRole === 'admin') && (
                <TabsTrigger value="team" className="flex items-center gap-2 py-3">
                  <Users className="h-4 w-4" />
                  <span className="hidden lg:inline">Gerenciar Equipe</span>
                </TabsTrigger>
              )}
            </TabsList>
            {/* Team Management Tab */}
            {(userRole === 'master' || userRole === 'admin') && (
              <TabsContent value="team" className="space-y-4">
              {/* Dialog obrigatório para criação do Master se não existir */}
              {forceMasterDialog && (
                <div className="p-4 border rounded-lg bg-yellow-50 text-yellow-900 dark:bg-yellow-900/20 dark:text-yellow-100">
                  <p className="text-sm font-medium mb-2">Defina o Usuário Master</p>
                  <div className="grid gap-3 lg:grid-cols-3">
                    <div className="lg:col-span-2">
                      <Label>Nome do Master</Label>
                      <Input 
                        value={memberName} 
                        onChange={(e) => setMemberName(e.target.value)} 
                        placeholder="Ex.: Dono"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            if (memberName.trim() && memberPin.length === 4) {
                              setMemberRole('master');
                              createMember();
                            }
                          }
                        }}
                      />
                    </div>
                    <div>
                      <Label>PIN (4 dígitos)</Label>
                      <Input 
                        value={memberPin} 
                        onChange={(e) => setMemberPin(e.target.value.replace(/\D/g,'').slice(0,4))} 
                        placeholder="0000" 
                        maxLength={4}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            if (memberName.trim() && memberPin.length === 4) {
                              setMemberRole('master');
                              createMember();
                            }
                          }
                        }}
                      />
                    </div>
                  </div>
                  <div className="flex justify-end mt-3">
                    <Button onClick={() => { setMemberRole('master'); createMember(); }}>
                      Confirmar Master
                    </Button>
                  </div>
                </div>
              )}
                <Card className="card-dense">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5 text-primary" /> Equipe do Estabelecimento</CardTitle>
                    <CardDescription>Crie e gerencie usuários de equipe: Admin, Atendente e Cozinha.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4 list-dense">
                    <div className="mt-4">
                      <h4 className="text-sm font-semibold mb-2 flex items-center justify-between">
                        Membros
                        {(userRole === 'master' || userRole === 'admin') && (
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => { setShowMemberForm(show => !show); setMemberFormStep(1); setMemberName(''); setMemberRole('admin'); setMemberPin(''); }}
                          >
                            {showMemberForm ? 'Cancelar' : '+ Criar novo membro'}
                          </Button>
                        )}
                      </h4>

                      {showMemberForm && (userRole === 'master' || userRole === 'admin') && (
                        <div className="mb-4 border p-4 rounded-lg bg-muted/50 animate-in fade-in">
                          {memberFormStep === 1 && (
                            <div className="flex flex-col gap-2 lg:flex-row items-end">
                              <div className="flex-1">
                                <Label>Nome</Label>
                                <Input 
                                  value={memberName} 
                                  onChange={e => setMemberName(e.target.value)} 
                                  placeholder="Nome do membro"
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' && memberName.trim().length > 0) {
                                      e.preventDefault();
                                      setMemberFormStep(2);
                                    }
                                  }}
                                />
                              </div>
                              <Button
                                size="sm"
                                className="mt-2 lg:mt-0"
                                onClick={() => memberName.trim().length > 0 && setMemberFormStep(2)}
                                disabled={!memberName.trim()}
                              >
                                Avançar
                              </Button>
                            </div>
                          )}
                          {memberFormStep === 2 && (
                            <div className="flex flex-col gap-2 lg:flex-row items-end">
                              <div className="flex-1">
                                <Label>Função</Label>
                                <Select value={memberRole} onValueChange={v => setMemberRole(v as any)}>
                                  <SelectTrigger 
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        e.preventDefault();
                                        setMemberFormStep(3);
                                      }
                                    }}
                                  >
                                    <SelectValue placeholder="Selecione a função" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="admin">Admin</SelectItem>
                                    <SelectItem value="atendente">Atendente</SelectItem>
                                    <SelectItem value="cozinha">Cozinha</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="flex gap-2 mt-2 lg:mt-0">
                                <Button size="sm" variant="outline" onClick={() => setMemberFormStep(1)}>Voltar</Button>
                                <Button size="sm" onClick={() => setMemberFormStep(3)}>Avançar</Button>
                              </div>
                            </div>
                          )}
                          {memberFormStep === 3 && (
                            <>
                              {memberRole === 'admin' && (
                                <div className="flex flex-col gap-2 lg:flex-row items-end mb-2">
                                  <div className="flex-1">
                                    <Label>Senha (4 dígitos)</Label>
                                    <Input 
                                      value={memberPin} 
                                      onChange={e => setMemberPin(e.target.value.replace(/\D/g, '').slice(0,4))} 
                                      placeholder="0000" 
                                      maxLength={4}
                                      onKeyDown={async (e) => {
                                        if (e.key === 'Enter') {
                                          e.preventDefault();
                                          if (memberRole === 'admin' && memberPin.length === 4) {
                                            await createMember();
                                            setShowMemberForm(false);
                                            setMemberFormStep(0);
                                          } else if (memberRole !== 'admin') {
                                            await createMember();
                                            setShowMemberForm(false);
                                            setMemberFormStep(0);
                                          }
                                        }
                                      }}
                                    />
                                    <span className="text-xs text-muted-foreground">Obrigatório para Admin</span>
                                  </div>
                                </div>
                              )}
                              <div className="flex gap-2">
                                <Button size="sm" variant="outline" onClick={() => setMemberFormStep(2)}>Voltar</Button>
                                <Button
                                  size="sm"
                                  onClick={async () => {
                                    await createMember();
                                    setShowMemberForm(false);
                                    setMemberFormStep(0);
                                  }}
                                  disabled={memberRole === 'admin' && memberPin.length !== 4}
                                >
                                  Adicionar
                                </Button>
                              </div>
                            </>
                          )}
                        </div>
                      )}

                      {team.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Nenhum membro cadastrado.</p>
                      ) : (
                        <div className="grid gap-2">
                          {team.map((m) => (
                            <div key={m.id} className="flex items-center justify-between p-3 border rounded-md">
                              <div>
                                <div className="font-medium">{m.name}</div>
                                <div className="text-xs text-muted-foreground">{m.role} • {new Date(m.created_at).toLocaleDateString('pt-BR')}</div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant={m.active ? 'secondary' : 'outline'}>{m.active ? 'Ativo' : 'Inativo'}</Badge>
                                {/* Remover só aparece: se userRole é master E não é o próprio master */}
                                {userRole === 'master' && m.role !== 'master' && (
                                  <Button variant="ghost" size="icon" onClick={() => removeTeamMember(m.id)} title="Remover membro">
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            )}

            {/* Establishment Tab */}
            <TabsContent value="establishment" className="space-y-4">
              <Card className="border-2 card-dense">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building className="h-5 w-5 text-primary" />
                    Dados do Estabelecimento e Perfil
                  </CardTitle>
                  <CardDescription>
                    Configure as informações principais do seu negócio e perfil pessoal
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleEstablishmentSubmit} className="space-y-10">
                    {/* Personal Profile Section */}
                    <div className="space-y-6">
                      <div className="border-b pb-4">
                        <h3 className="text-base font-semibold text-foreground flex items-center gap-2 mb-1">
                          <User className="h-5 w-5 text-primary" />
                          Dados Pessoais
                        </h3>
                        <p className="text-sm text-muted-foreground ml-7">
                          Informações do responsável pelo estabelecimento
                        </p>
                      </div>
                      
                      <div className="grid gap-6 lg:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="user_full_name" className="text-sm font-medium">
                            Nome Responsável *
                          </Label>
                          <Input
                            id="user_full_name"
                            name="user_full_name"
                            defaultValue={profile?.full_name || ""}
                            required
                            className="h-11"
                            placeholder="Digite seu nome completo"
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor="user_phone" className="text-sm font-medium">
                            Telefone Pessoal
                          </Label>
                          <Input
                            id="user_phone"
                            name="user_phone"
                            defaultValue={profile?.phone || ""}
                            placeholder="(11) 99999-9999"
                            className="h-11"
                          />
                        </div>
                      </div>
                    </div>
                    
                    {/* Establishment Info Section */}
                    <div className="space-y-6">
                      <div className="border-b pb-4">
                        <h3 className="text-base font-semibold text-foreground flex items-center gap-2 mb-1">
                          <Building className="h-5 w-5 text-primary" />
                          Informações do Estabelecimento
                        </h3>
                        <p className="text-sm text-muted-foreground ml-7">
                          Dados principais da sua empresa ou negócio
                        </p>
                      </div>
                      
                      <div className="grid gap-6 lg:grid-cols-2">
                        <div className="space-y-2 lg:col-span-2">
                          <Label htmlFor="establishment_name" className="text-sm font-medium">
                            Nome do Estabelecimento *
                          </Label>
                          <Input
                            id="establishment_name"
                            name="establishment_name"
                            defaultValue={establishment?.name || ""}
                            required
                            className="h-11"
                            placeholder="Digite o nome do estabelecimento"
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor="establishment_email" className="text-sm font-medium flex items-center gap-2">
                            <Mail className="h-4 w-4 text-muted-foreground" />
                            Email *
                          </Label>
                          <Input
                            id="establishment_email"
                            name="establishment_email"
                            type="email"
                            defaultValue={establishment?.email || ""}
                            required
                            className="h-11"
                            placeholder="contato@estabelecimento.com"
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor="phone" className="text-sm font-medium flex items-center gap-2">
                            <Phone className="h-4 w-4 text-muted-foreground" />
                            Telefone
                          </Label>
                          <Input
                            id="phone"
                            name="phone"
                            defaultValue={establishment?.phone || ""}
                            placeholder="(11) 99999-9999"
                            className="h-11"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="cnpj" className="text-sm font-medium flex items-center gap-2">
                            <Building className="h-4 w-4 text-muted-foreground" />
                            CNPJ
                          </Label>
                          <Input
                            id="cnpj"
                            name="cnpj"
                            defaultValue={establishment?.cnpj || ""}
                            placeholder="00.000.000/0000-00"
                            className="h-11"
                            maxLength={18}
                            onChange={(e) => {
                              // Formata CNPJ enquanto digita
                              const value = e.target.value.replace(/\D/g, '');
                              if (value.length <= 14) {
                                const formatted = value
                                  .replace(/^(\d{2})(\d)/, '$1.$2')
                                  .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
                                  .replace(/\.(\d{3})(\d)/, '.$1/$2')
                                  .replace(/(\d{4})(\d)/, '$1-$2');
                                e.target.value = formatted;
                              }
                            }}
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            CNPJ do estabelecimento para cupons não fiscais
                          </p>
                        </div>

                        <div className="space-y-2 lg:col-span-2">
                          <Label htmlFor="address" className="text-sm font-medium flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-muted-foreground" />
                            Endereço Completo
                          </Label>
                          <Textarea
                            id="address"
                            name="address"
                            defaultValue={establishment?.address || ""}
                            rows={3}
                            className="resize-none"
                            placeholder="Rua, número, bairro, cidade - CEP"
                          />
                        </div>

                        <div className="space-y-2 lg:col-span-2">
                          <Label htmlFor="pix_key" className="text-sm font-medium flex items-center gap-2">
                            <CreditCard className="h-4 w-4 text-muted-foreground" />
                            Chave PIX
                          </Label>
                          <Input
                            id="pix_key"
                            name="pix_key"
                            defaultValue={establishment?.pix_key || establishment?.pix_key_value || ""}
                            placeholder="Chave PIX (CPF, CNPJ, Email, Telefone ou Chave Aleatória)"
                            className="h-11"
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            Esta chave será usada automaticamente na mensagem do WhatsApp quando enviar PIX por pedidos online
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Financial Settings */}
                    <div className="space-y-6">
                      <div className="border-b pb-4">
                        <h3 className="text-base font-semibold text-foreground flex items-center gap-2 mb-1">
                          <Target className="h-5 w-5 text-primary" />
                          Configurações Financeiras
                        </h3>
                        <p className="text-sm text-muted-foreground ml-7">
                          Defina taxas e valores padrão para seus pedidos
                        </p>
                      </div>
                      <div className="grid gap-6 lg:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="tax_rate" className="text-sm font-medium">
                            Taxa de Imposto (%)
                          </Label>
                          <Input
                            id="tax_rate"
                            name="tax_rate"
                            type="number"
                            step="0.01"
                            min="0"
                            max="100"
                            defaultValue={establishment?.settings?.tax_rate || ""}
                            placeholder="0.00"
                            className="h-11"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="delivery_fee" className="text-sm font-medium">
                            Taxa de Entrega Padrão (R$)
                          </Label>
                          <Input
                            id="delivery_fee"
                            name="delivery_fee"
                            type="number"
                            step="0.01"
                            min="0"
                            defaultValue={establishment?.settings?.delivery_fee || ""}
                            placeholder="0.00"
                            className="h-11"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Goals Section */}
                    <div className="space-y-6">
                      <div className="border-b pb-4">
                        <h3 className="text-base font-semibold text-foreground flex items-center gap-2 mb-1">
                          <Target className="h-5 w-5 text-primary" />
                          Metas de Vendas
                        </h3>
                        <p className="text-sm text-muted-foreground ml-7">
                          Defina suas metas de faturamento por período
                        </p>
                      </div>
                      <div className="grid gap-6 lg:grid-cols-3">
                        <div className="space-y-2">
                          <Label htmlFor="daily_goal" className="text-sm font-medium">
                            Meta Diária (R$)
                          </Label>
                          <Input
                            id="daily_goal"
                            name="daily_goal"
                            type="number"
                            step="1"
                            min="0"
                            defaultValue={establishment?.daily_goal || ""}
                            placeholder="5000"
                            className="h-11"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="weekly_goal" className="text-sm font-medium">
                            Meta Semanal (R$)
                          </Label>
                          <Input
                            id="weekly_goal"
                            name="weekly_goal"
                            type="number"
                            step="1"
                            min="0"
                            defaultValue={establishment?.weekly_goal || ""}
                            placeholder="20000"
                            className="h-11"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="monthly_goal" className="text-sm font-medium">
                            Meta Mensal (R$)
                          </Label>
                          <Input
                            id="monthly_goal"
                            name="monthly_goal"
                            type="number"
                            step="1"
                            min="0"
                            defaultValue={establishment?.monthly_goal || ""}
                            placeholder="50000"
                            className="h-11"
                          />
                        </div>
                      </div>
                      
                      <div className="grid gap-6 lg:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="monthly_orders_goal" className="text-sm font-medium">
                            Meta Mensal de Pedidos
                          </Label>
                          <Input
                            id="monthly_orders_goal"
                            name="monthly_orders_goal"
                            type="number"
                            step="1"
                            min="0"
                            defaultValue={establishment?.monthly_orders_goal || ""}
                            placeholder="300"
                            className="h-11"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="monthly_customers_goal" className="text-sm font-medium">
                            Meta Mensal de Novos Clientes
                          </Label>
                          <Input
                            id="monthly_customers_goal"
                            name="monthly_customers_goal"
                            type="number"
                            step="1"
                            min="0"
                            defaultValue={establishment?.monthly_customers_goal || ""}
                            placeholder="50"
                            className="h-11"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Notifications */}
                    <div className="flex items-center space-x-3 p-4 rounded-lg bg-muted/50 border">
                      <input
                        type="checkbox"
                        id="enable_notifications"
                        name="enable_notifications"
                        defaultChecked={establishment?.settings?.enable_notifications || false}
                        className="rounded border-input w-5 h-5"
                      />
                      <Label htmlFor="enable_notifications" className="cursor-pointer">
                        Habilitar notificações do sistema
                      </Label>
                    </div>
                    
                    <div className="flex justify-end pt-6 border-t">
                      <Button type="submit" disabled={saving} size="lg" className="min-w-[200px] h-11">
                        <Save className="mr-2 h-4 w-4" />
                        {saving ? "Salvando..." : "Salvar Configurações"}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>

            {/* API Tab - Apenas para Na Brasa */}
            {isNaBrasa && (
              <TabsContent value="api" className="space-y-4">
                <Card className="border-2 card-dense">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Key className="h-5 w-5 text-primary" />
                    Integração API
                  </CardTitle>
                  <CardDescription>
                    Configure a API Key para integração com seu site de pedidos
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <div className="p-4 rounded-lg bg-muted/50 border">
                      <h3 className="font-semibold mb-2">Endpoint de Integração</h3>
                      <code className="text-sm bg-background px-2 py-1 rounded">
                        POST {(import.meta.env.VITE_SUPABASE_URL?.replace('/rest/v1', '') || 'https://seu-projeto.supabase.co')}/functions/v1/online-order-intake
                      </code>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="api_key" className="flex items-center gap-2">
                        <Key className="h-4 w-4 text-muted-foreground" />
                        API Key
                      </Label>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <Input
                            id="api_key"
                            type={showApiKey ? "text" : "password"}
                            value={establishment?.api_key || "Nenhuma API Key gerada"}
                            readOnly
                            className="h-11 pr-10 font-mono text-sm"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 p-0"
                            onClick={() => setShowApiKey(!showApiKey)}
                          >
                            {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                        </div>
                        {establishment?.api_key && (
                          <Button
                            type="button"
                            variant="outline"
                            size="lg"
                            onClick={copyApiKey}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          type="button"
                          variant="default"
                          size="lg"
                          onClick={generateApiKey}
                          disabled={generatingApiKey}
                        >
                          <RefreshCw className={`h-4 w-4 ${generatingApiKey ? 'animate-spin' : ''}`} />
                        </Button>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {establishment?.api_key 
                          ? "Use esta chave no header X-Estab-Key das requisições"
                          : "Clique no botão para gerar uma nova API Key"}
                      </p>
                    </div>

                    <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
                      <h4 className="font-semibold text-sm mb-2 text-blue-900 dark:text-blue-100">
                        Como usar:
                      </h4>
                      <ol className="text-sm space-y-1 text-blue-800 dark:text-blue-200 list-decimal list-inside">
                        <li>Gere uma API Key clicando no botão de atualizar</li>
                        <li>Configure seu site para enviar o header <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">X-Estab-Key</code></li>
                        <li>Inclua também o header <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">Idempotency-Key</code> com um UUID único</li>
                        <li>Envie os pedidos no formato JSON especificado</li>
                      </ol>
                    </div>
                  </div>
                </CardContent>
              </Card>
              </TabsContent>
            )}

            {/* Business Hours Tab */}
            <TabsContent value="hours" className="space-y-6">
              {establishment && (
                <BusinessHoursConfig
                  establishmentId={establishment.id}
                  timezone={establishment.timezone || "America/Sao_Paulo"}
                  allowOrdersWhenClosed={establishment.allow_orders_when_closed || false}
                  showScheduleOnMenu={establishment.show_schedule_on_menu !== false}
                />
              )}
            </TabsContent>

            {/* Printers Tab */}
            <TabsContent value="printers" className="space-y-6">
              {establishment && (
                <>
                  <PrintersManager establishmentId={establishment.id} />
                  <PrinterRouting establishmentId={establishment.id} />
                </>
              )}
            </TabsContent>

            {/* PIX Tab */}
            <TabsContent value="pix">
              {establishment && <PixConfig establishmentId={establishment.id} />}
            </TabsContent>

            {/* Delivery Tab */}
            <TabsContent value="delivery" className="space-y-4">
              {establishment && <DeliveryBoysManager establishmentId={establishment.id} />}
            </TabsContent>

            {/* Security Tab */}
            <TabsContent value="security" className="space-y-4">
              <Card className="border-2 card-dense">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-primary" />
                    Alterar Senha
                  </CardTitle>
                  <CardDescription>
                    Troque sua senha de acesso ao sistema
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleChangePassword} className="space-y-4 form-dense">
                    <div className="space-y-2">
                      <Label htmlFor="current_password">Senha Atual *</Label>
                      <Input
                        id="current_password"
                        name="current_password"
                        type="password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="Digite sua senha atual"
                        required
                        className="h-11"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="new_password">Nova Senha *</Label>
                      <Input
                        id="new_password"
                        name="new_password"
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Digite a nova senha (mínimo 6 caracteres)"
                        required
                        minLength={6}
                        className="h-11"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="confirm_password">Confirmar Nova Senha *</Label>
                      <Input
                        id="confirm_password"
                        name="confirm_password"
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Confirme a nova senha"
                        required
                        minLength={6}
                        className="h-11"
                      />
                    </div>

                    <Button type="submit" disabled={saving} className="w-full">
                      <Save className="h-4 w-4 mr-2" />
                      {saving ? 'Salvando...' : 'Alterar Senha'}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Diálogo modal global para forçar criação do Master no primeiro acesso */}
          {forceMasterDialog && (
            <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/40"></div>
              <div className="relative w-full max-w-md rounded-xl border border-border bg-card text-card-foreground shadow-xl p-5">
                <h3 className="text-lg font-semibold mb-2">Definir Usuário Master</h3>
                <p className="text-sm text-muted-foreground mb-4">Crie o usuário Master (dono) deste estabelecimento. Ele terá acesso total.</p>
                <div className="grid gap-3">
                  <div>
                    <Label>Nome</Label>
                    <Input 
                      value={memberName} 
                      onChange={(e) => setMemberName(e.target.value)} 
                      placeholder="Ex.: Dono"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          if (memberName.trim() && memberPin.length === 4) {
                            setMemberRole('master');
                            createMember();
                          }
                        }
                      }}
                    />
                  </div>
                  <div>
                    <Label>PIN (4 dígitos)</Label>
                    <Input 
                      value={memberPin} 
                      onChange={(e) => setMemberPin(e.target.value.replace(/\D/g,'').slice(0,4))} 
                      placeholder="0000" 
                      maxLength={4}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          if (memberName.trim() && memberPin.length === 4) {
                            setMemberRole('master');
                            createMember();
                          }
                        }
                      }}
                    />
                    <p className="text-xs text-muted-foreground mt-1">Este PIN será solicitado para ações críticas.</p>
                  </div>
                </div>
                <div className="flex justify-end gap-2 mt-4">
                  <Button onClick={() => { setMemberRole('master'); createMember(); }}>
                    Confirmar Master
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Settings;