import React, { createContext, useCallback, useContext, useEffect, useState, useMemo, useRef } from "react";
import { useLocation } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export type TeamRole = 'master' | 'admin' | 'atendente' | 'cozinha';

export interface TeamUser {
  id: string;
  name: string;
  role: TeamRole;
  pin?: string;
  active: boolean;
  user_id?: string | null;
}

interface TeamUserContextType {
  teamUser: TeamUser | null;
  setTeamUser: (user: TeamUser | null) => void;
  resetTeamUser: () => void;
}
const TeamUserContext = createContext<TeamUserContextType | undefined>(undefined);

export function useTeamUser() {
  const ctx = useContext(TeamUserContext);
  if (!ctx) throw new Error("useTeamUser deve ser usado dentro do TeamUserProvider");
  return ctx;
}

// Utilizado para garantir persistência entre F5/login
const TEAM_USER_KEY = "burgueria_team_user";

export const TeamUserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const publicRoutes = ['/', '/auth', '/landing', '/password-display', '/password-panel', '/totem'];
  // Rotas públicas também incluem cardápio online (menu-public e cardapio)
  const isPublicRoute = publicRoutes.includes(location.pathname) ||
    location.pathname.startsWith('/menu-public/') ||
    location.pathname.startsWith('/cardapio/');
  const isPublic = isPublicRoute;

  const [teamUser, setTeamUserState] = useState<TeamUser | null>(null);
  const [teamList, setTeamList] = useState<TeamUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string>("");
  const [inputPin, setInputPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [initialized, setInitialized] = useState(false);
  const [hasMaster, setHasMaster] = useState(false);
  const [establishmentId, setEstablishmentId] = useState<string | null>(null);
  const [masterName, setMasterName] = useState("");
  const [masterPin, setMasterPin] = useState("");
  const [masterError, setMasterError] = useState("");
  const [isSystemAdmin, setIsSystemAdmin] = useState(false);

  const setTeamUser = useCallback((u: TeamUser | null) => {
    setTeamUserState(u);
    if (u) {
      window.localStorage.setItem(TEAM_USER_KEY, JSON.stringify(u));
    } else {
      window.localStorage.removeItem(TEAM_USER_KEY);
    }
  }, []);

  const resetTeamUser = useCallback(() => {
    setTeamUser(null);
    setSelectedId("");
    setInputPin("");
    setPinError("");
  }, [setTeamUser]);

  // Busca equipe atual do usuário supabase (apenas em rotas privadas)
  useEffect(() => {
    async function loadList() {
      if (isPublic) {
        setTeamList([]);
        setLoading(false);
        setInitialized(true);
        return;
      }
      setLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          setTeamList([]);
          setLoading(false);
          setInitialized(true);
          return;
        }

        // Verifica se é o usuário admin do sistema
        const userIsSystemAdmin = session.user.email === 'fellipe_1693@outlook.com';
        setIsSystemAdmin(userIsSystemAdmin);

        if (userIsSystemAdmin) {
          // Para o admin do sistema, criar um teamUser virtual com permissões máximas
          // NÃO mostra diálogo e permite acesso direto
          const virtualTeamUser: TeamUser = {
            id: 'system-admin',
            name: 'Administrador do Sistema',
            role: 'master',
            active: true,
            user_id: session.user.id
          };
          setTeamUser(virtualTeamUser);
          setTeamList([]);
          setHasMaster(false); // Não precisa de master
          setLoading(false);
          setInitialized(true);
          return;
        }
        // Carrega establishment_id do profile
        const { data: prof } = await supabase
          .from('profiles')
          .select('establishment_id')
          .eq('user_id', session.user.id)
          .maybeSingle();
        if (!prof?.establishment_id) {
          // Se não tem establishment_id, mostra mensagem e permite criar master
          // O formulário de criação de master não precisa de establishment_id, 
          // mas vamos tentar criar um estabelecimento padrão se possível
          setTeamList([]);
          setLoading(false);
          setInitialized(true);
          setHasMaster(false);
          return;
        }
        setEstablishmentId(prof.establishment_id);

        // Busca membros
        const { data: list } = await supabase
          .from('team_members')
          .select('*')
          .eq('establishment_id', prof.establishment_id)
          .eq('active', true)
          .order('role', { ascending: true });
        setTeamList(list || []);

        // Verifica se existe algum membro na equipe. Se existir qualquer um, assumimos que o estabelecimento já tem master configurado.
        // Isso evita bugs onde o master não é retornado por algum motivo, mas bloqueia o acesso pedindo para criar novo.
        const hasMasterMember = list && list.length > 0;
        setHasMaster(hasMasterMember);

        // Verifica se o usuário do localStorage ainda existe e está ativo na equipe
        // IMPORTANTE: Não auto-seleciona usuário - sempre mostra diálogo para o usuário escolher
        const cached = window.localStorage.getItem(TEAM_USER_KEY);
        if (cached && list && list.length > 0) {
          try {
            const cachedUser = JSON.parse(cached);
            // Busca o usuário atualizado na lista para garantir dados corretos
            const userExists = list.find(u => u.id === cachedUser.id && u.active);
            if (userExists) {
              // Usa os dados atualizados da lista, não do cache
              // Só define se realmente existe na lista atual
              setTeamUser(userExists);
            } else {
              // Se não encontrou no cache, deixa null para mostrar diálogo
              setTeamUser(null);
            }
          } catch (e) {
            // Em caso de erro, deixa null para mostrar diálogo
            setTeamUser(null);
          }
        } else {
          // Sem cache ou sem lista - deixa null para mostrar diálogo
          setTeamUser(null);
        }
      } catch (e) {
        setTeamList([]);
        setTeamUser(null);
      } finally {
        setLoading(false);
        setInitialized(true);
      }
    }
    loadList();
  }, [isPublic, location.pathname]);

  // Handler: cria o primeiro master
  const handleCreateMaster = async () => {
    setMasterError("");
    if (!masterName.trim()) {
      setMasterError("Nome é obrigatório");
      return;
    }
    if (!/^\d{4}$/.test(masterPin)) {
      setMasterError("PIN precisa ter 4 dígitos");
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setMasterError("Sessão expirada. Faça login novamente.");
        return;
      }

      // Se não tem establishment_id, cria um estabelecimento primeiro usando RPC function
      let finalEstablishmentId = establishmentId;

      if (!finalEstablishmentId) {
        // Cria um estabelecimento com nome baseado no nome do master ou email
        const establishmentName = masterName.trim() || session.user.email?.split('@')[0] || 'Novo Estabelecimento';

        // Usa a função RPC que contorna RLS
        const { data: estabResult, error: estabError } = await supabase
          .rpc('create_establishment_for_user', {
            establishment_name: establishmentName,
            master_name: masterName.trim()
          });

        if (estabError) {
          throw new Error(`Erro ao criar estabelecimento: ${estabError.message}`);
        }

        // estabResult já é o JSON retornado pela função
        if (!estabResult || (estabResult as any)?.success !== true) {
          const errorMsg = (estabResult as any)?.error || 'Erro ao criar estabelecimento';
          throw new Error(errorMsg);
        }

        const establishmentIdFromRpc = (estabResult as any)?.establishment_id;
        if (!establishmentIdFromRpc) {
          throw new Error('Estabelecimento criado mas nenhum ID retornado');
        }

        finalEstablishmentId = establishmentIdFromRpc;
        setEstablishmentId(finalEstablishmentId);
      }

      // Verifica se já existe um master para este establishment antes de criar
      const { data: existingMaster } = await supabase
        .from('team_members')
        .select('*')
        .eq('establishment_id', finalEstablishmentId)
        .eq('role', 'master')
        .eq('active', true)
        .maybeSingle();

      let newMaster;

      if (existingMaster) {
        // Se já existe master, apenas atualiza o PIN e nome se necessário
        const { data: updatedMaster, error: updateError } = await supabase
          .from('team_members')
          .update({
            name: masterName.trim(),
            pin: masterPin
          })
          .eq('id', existingMaster.id)
          .select()
          .single();

        if (updateError) throw updateError;
        newMaster = updatedMaster;
      } else {
        // Cria novo master apenas se não existir
        const payload = {
          establishment_id: finalEstablishmentId,
          user_id: session.user.id,
          name: masterName.trim(),
          role: 'master',
          pin: masterPin,
          active: true,
        };

        const { data: createdMaster, error: insertError } = await supabase
          .from('team_members')
          .insert([payload])
          .select()
          .single();

        if (insertError) throw insertError;
        newMaster = createdMaster;
      }

      // Atualiza a lista e seleciona o master criado
      const { data: updatedList } = await supabase
        .from('team_members')
        .select('*')
        .eq('establishment_id', finalEstablishmentId)
        .eq('active', true)
        .order('role', { ascending: true });

      setTeamList(updatedList || []);

      if (newMaster) {
        // IMPORTANTE: Setar teamUser ANTES de setar hasMaster para evitar que o Dialog apareça
        setTeamUser(newMaster);
        setHasMaster(true);
        setMasterName("");
        setMasterPin("");

        // Força recarregamento do establishment_id no estado
        setEstablishmentId(finalEstablishmentId);

        // Recarrega o profile para garantir que está atualizado
        const { data: { session: refreshSession } } = await supabase.auth.getSession();
        if (refreshSession) {
          const { data: refreshedProfile } = await supabase
            .from('profiles')
            .select('establishment_id')
            .eq('user_id', refreshSession.user.id)
            .maybeSingle();

          if (refreshedProfile?.establishment_id) {
            setEstablishmentId(refreshedProfile.establishment_id);
          }
        }
      } else {
        setHasMaster(true);
      }
    } catch (e: any) {
      setMasterError(e.message || "Erro ao criar usuário master");
    }
  };

  // Handler: seleciona usuário
  const handleSelectAndProceed = async () => {
    try {
      const sel = teamList.find(u => u.id === selectedId);
      if (!sel) {
        setPinError("Usuário não encontrado. Tente novamente.");
        return;
      }

      setPinError("");

      // Master/Admin: exige PIN
      if (sel.role === 'master' || sel.role === 'admin') {
        if (!inputPin || inputPin.trim() === '') {
          setPinError('PIN é obrigatório para este usuário');
          return;
        }

        if (!/^\d{4}$/.test(inputPin)) {
          setPinError('PIN precisa ter exatamente 4 dígitos');
          return;
        }

        if (sel.pin !== inputPin) {
          setPinError("PIN incorreto. Verifique e tente novamente.");
          return;
        }
      }

      setTeamUser(sel);
      setSelectedId("");
      setInputPin("");
      setPinError("");
    } catch (error: any) {
      console.error('Erro ao selecionar usuário:', error);
      // Capturar erros específicos e mostrar mensagens amigáveis
      if (error.message?.includes('Invalid login credentials') ||
        error.message?.includes('Invalid credentials') ||
        error.message?.includes('Email ou senha')) {
        setPinError("PIN incorreto. Verifique e tente novamente.");
      } else if (error.message?.includes('API key') || error.message?.includes('API Key')) {
        // Este erro não deveria acontecer aqui, mas se acontecer, mostrar mensagem genérica
        setPinError("Erro ao autenticar. Tente novamente.");
      } else {
        setPinError(error.message || "Erro ao selecionar usuário. Tente novamente.");
      }
    }
  };

  // Logout da equipe
  const handleLogout = () => {
    setTeamUser(null);
    setSelectedId("");
    setInputPin("");
    setPinError("");
  };

  // Contexto exportado
  const ctxValue: TeamUserContextType = { teamUser, setTeamUser, resetTeamUser: handleLogout };

  // CALCULA se deve mostrar o dialog: SEMPRE quando não há teamUser em rotas privadas
  // NÃO mostra o dialog se o usuário é o admin do sistema (fellipe_1693@outlook.com)
  const mustShowDialog = useMemo(() => {
    // Mostra o dialog quando:
    // - Não é rota pública
    // - Já inicializou (terminou de carregar)
    // - Não está carregando
    // - Não há teamUser selecionado (usuário precisa escolher)
    // - NÃO é o admin do sistema
    const shouldShow = !isPublic && initialized && !loading && !teamUser && !isSystemAdmin;
    return shouldShow;
  }, [isPublic, initialized, loading, teamUser, isSystemAdmin]);

  // Bloquear o conteúdo enquanto não houver teamUser em rotas privadas
  // Só bloqueia se há master cadastrado e há membros na equipe
  // NÃO bloqueia quando não há master (novo usuário criando o master)
  const shouldBlockContent = mustShowDialog && hasMaster && teamList.length > 0;


  return (
    <TeamUserContext.Provider value={ctxValue}>
      {shouldBlockContent && (
        <div
          className="fixed inset-0 bg-background/95 backdrop-blur-sm"
          style={{
            pointerEvents: 'none',
            zIndex: 40
          }}
        />
      )}
      <div
        style={{
          pointerEvents: 'auto',
          opacity: shouldBlockContent ? 0.15 : 1,
          filter: shouldBlockContent ? 'blur(3px)' : 'none',
          userSelect: shouldBlockContent ? 'none' : 'auto',
          WebkitUserSelect: shouldBlockContent ? 'none' : 'auto'
        }}
      >
        {children}
      </div>

      {/* CSS para garantir que dialogs sempre apareçam acima do overlay de bloqueio */}
      <style dangerouslySetInnerHTML={{
        __html: `
        /* Garantir z-index alto para dialogs */
        [data-radix-dialog-portal] {
          z-index: 9999 !important;
        }
        [data-radix-dialog-overlay] {
          z-index: 9998 !important;
        }
        [data-radix-dialog-content] {
          z-index: 9999 !important;
        }
        /* Esconder dialogs do Radix APENAS quando está mostrando o modal customizado de criar master */
        /* IMPORTANTE: Não esconder se for admin do sistema ou se já tem teamUser (permite usar outros dialogs) */
        ${!hasMaster && mustShowDialog && !loading && !isSystemAdmin && !teamUser ? `
          [data-radix-dialog-overlay],
          [data-radix-dialog-portal],
          [data-radix-dialog-content],
          [role="dialog"] {
            display: none !important;
            visibility: hidden !important;
            opacity: 0 !important;
            pointer-events: none !important;
            z-index: -9999 !important;
          }
        ` : ''}
      `}} />

      {/* MODAL CUSTOMIZADO: Mostra APENAS quando NÃO há master E precisa criar o master */}
      {/* IMPORTANTE: Não mostrar se for admin do sistema ou se já tem teamUser */}
      {!hasMaster && mustShowDialog && !loading && !isSystemAdmin && !teamUser && (
        // Modal customizado usando o mesmo estilo dos outros modais do projeto
        <div
          className="fixed inset-0 z-[9999]"
          style={{
            pointerEvents: 'auto',
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 9999
          }}
          aria-hidden="false"
        >
          {/* Overlay de fundo - mesmo estilo do Radix Dialog */}
          <div
            className="fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
            style={{
              pointerEvents: 'none',
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 9998
            }}
          />

          {/* Modal Content - mesmo estilo do DialogContent */}
          <div
            className="fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg"
            style={{
              pointerEvents: 'auto',
              position: 'fixed',
              zIndex: 9999
            }}
          >
            {/* DialogHeader - usando div com mesmas classes */}
            <div className="flex flex-col space-y-1.5 text-center sm:text-left">
              <h2 className="text-lg font-semibold leading-none tracking-tight">
                Configurar usuário Master
              </h2>
              <p className="text-sm text-muted-foreground">
                Como este é seu primeiro acesso, crie o usuário master que terá controle total do sistema.
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="master-name-input">Nome do Master *</Label>
                <Input
                  id="master-name-input"
                  type="text"
                  placeholder="Digite o nome do usuário master"
                  value={masterName}
                  onChange={(e) => {
                    setMasterName(e.target.value);
                    setMasterError("");
                  }}
                  onFocus={(e) => {
                    e.stopPropagation();
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                  }}
                  autoFocus
                  style={{
                    pointerEvents: 'auto',
                    position: 'relative',
                    zIndex: 100000,
                    WebkitUserSelect: 'text',
                    userSelect: 'text'
                  }}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="master-pin-input">PIN (4 dígitos) *</Label>
                <Input
                  id="master-pin-input"
                  type="password"
                  inputMode="numeric"
                  pattern="\\d*"
                  placeholder="0000"
                  maxLength={4}
                  value={masterPin}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '').slice(0, 4);
                    setMasterPin(value);
                    setMasterError("");
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && masterName.trim() && masterPin.length === 4) {
                      e.preventDefault();
                      e.stopPropagation();
                      handleCreateMaster();
                    }
                  }}
                  onFocus={(e) => {
                    e.stopPropagation();
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                  }}
                  className="text-center text-lg tracking-widest"
                  style={{
                    pointerEvents: 'auto',
                    position: 'relative',
                    zIndex: 100000,
                    WebkitUserSelect: 'text',
                    userSelect: 'text'
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  Este PIN será necessário para acessar o sistema como master.
                </p>
              </div>

              {masterError && (
                <div className="text-xs text-red-600 font-medium text-center bg-red-50 dark:bg-red-900/20 p-2 rounded">
                  {masterError}
                </div>
              )}
            </div>

            {/* DialogFooter - usando div com mesmas classes */}
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2">
              <Button
                type="button"
                disabled={!masterName.trim() || masterPin.length !== 4}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleCreateMaster();
                }}
                style={{ pointerEvents: 'auto' }}
              >
                Criar Master e Entrar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* DIALOG DO RADIX: Mostra APENAS quando HÁ master e precisa selecionar usuário */}
      {/* IMPORTANTE: NUNCA renderizar quando não há master */}
      {hasMaster && mustShowDialog && !loading && teamList.length > 0 && teamUser === null && (
        <Dialog
          open={true}
          onOpenChange={(open) => {
            if (hasMaster && !teamUser && open === false) {
              // Não permite fechar sem selecionar um usuário quando há master
              return;
            }
          }}
          modal={true}
        >
          <DialogContent
            onInteractOutside={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onEscapeKeyDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onPointerDownOutside={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            className="z-[101]"
            style={{ zIndex: 101 }}
          >
            {/* Remove botão X de fechar completamente */}
            <style dangerouslySetInnerHTML={{
              __html: `
            [data-radix-dialog-content] button[data-radix-dialog-close],
            [data-radix-dialog-content] button[aria-label="Close"],
            [data-radix-dialog-content] > button:last-child:has(svg),
            [data-radix-dialog-content] button:has(svg[aria-label="Close"]),
            [data-radix-dialog-content] button:has(svg[class*="lucide"]):not([class*="mr-2"]):not([class*="ml-2"]) {
              display: none !important;
              visibility: hidden !important;
              pointer-events: none !important;
              opacity: 0 !important;
              width: 0 !important;
              height: 0 !important;
              position: absolute !important;
              left: -9999px !important;
            }
          `}} />

            {/* Sempre inclui DialogDescription para evitar warnings */}
            <DialogHeader>
              <DialogTitle>Quem vai usar o sistema?</DialogTitle>
              <DialogDescription>
                Selecione o usuário da equipe que tomará conta do sistema agora.
              </DialogDescription>
            </DialogHeader>

            {/* USUÁRIO EXISTENTE: Lista de usuários da equipe */}
            <div className="space-y-2 mt-3">
              {teamList.length === 0 && (
                <div className="text-sm text-muted-foreground text-center py-4">
                  Nenhuma equipe cadastrada. Configure a equipe em Configurações.
                </div>
              )}
              {teamList.map(member => (
                <label
                  key={member.id}
                  className={`flex items-center gap-2 border p-3 rounded-lg cursor-pointer transition-colors ${selectedId === member.id
                      ? 'border-primary bg-primary/10 ring-2 ring-primary'
                      : 'border-input hover:bg-muted'
                    }`}
                >
                  <input
                    type="radio"
                    checked={selectedId === member.id}
                    onChange={() => {
                      setSelectedId(member.id);
                      setInputPin("");
                      setPinError("");
                    }}
                    className="form-radio accent-primary"
                  />
                  <div className="flex-1">
                    <span className="font-medium">{member.name}</span>
                    <span className="ml-2 text-xs px-2 py-0.5 rounded bg-muted uppercase">
                      {member.role}
                    </span>
                  </div>
                </label>
              ))}
            </div>

            {selectedId && ["master", "admin"].includes(teamList.find(m => m.id === selectedId)?.role || "") && (
              <div className="space-y-2 mt-4">
                <Input
                  type="password"
                  inputMode="numeric"
                  pattern="\\d*"
                  placeholder="PIN (4 dígitos)"
                  maxLength={4}
                  value={inputPin}
                  onChange={e => setInputPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  className="text-center text-lg tracking-widest"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && inputPin.length === 4 && selectedId) {
                      e.preventDefault();
                      handleSelectAndProceed();
                    }
                  }}
                />
                {pinError && (
                  <div className="text-xs text-red-600 font-medium text-center">{pinError}</div>
                )}
              </div>
            )}

            <DialogFooter className="flex-col gap-2 mt-4">
              <Button
                className="w-full"
                disabled={
                  !selectedId ||
                  (teamList.find(m => m.id === selectedId)?.role &&
                    ["master", "admin"].includes(teamList.find(m => m.id === selectedId)?.role || "") &&
                    inputPin.length !== 4)
                }
                onClick={handleSelectAndProceed}
              >
                Entrar
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full text-muted-foreground hover:text-destructive"
                onClick={async () => {
                  // Limpar sessão
                  sessionStorage.clear();
                  localStorage.removeItem(TEAM_USER_KEY);
                  // Fazer logout
                  await supabase.auth.signOut();
                  // Redirecionar para login
                  window.location.href = '/auth';
                }}
              >
                <LogOut className="h-4 w-4 mr-2" />
                Voltar para Login
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </TeamUserContext.Provider>
  );
}
