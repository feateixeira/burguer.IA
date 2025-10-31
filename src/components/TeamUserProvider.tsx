import React, { createContext, useCallback, useContext, useEffect, useState, useMemo } from "react";
import { useLocation } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  const isPublic = publicRoutes.includes(location.pathname);

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
        const isSystemAdmin = session.user.email === 'fellipe_1693@outlook.com';
        
        if (isSystemAdmin) {
          // Para o admin do sistema, criar um teamUser virtual com permissões máximas
          const virtualTeamUser: TeamUser = {
            id: 'system-admin',
            name: 'Administrador do Sistema',
            role: 'master',
            active: true,
            user_id: session.user.id
          };
          setTeamUser(virtualTeamUser);
          setTeamList([]);
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
          console.warn('Usuário sem estabelecimento vinculado. Permitindo criar master.');
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
        
        // Verifica se existe algum master cadastrado
        const hasMasterMember = list?.some(member => member.role === 'master') || false;
        setHasMaster(hasMasterMember);

        // Verifica se o usuário do localStorage ainda existe e está ativo na equipe
        const cached = window.localStorage.getItem(TEAM_USER_KEY);
        if (cached && list && list.length > 0) {
          try {
            const cachedUser = JSON.parse(cached);
            // Busca o usuário atualizado na lista para garantir dados corretos
            const userExists = list.find(u => u.id === cachedUser.id && u.active);
            if (userExists) {
              // Usa os dados atualizados da lista, não do cache
              setTeamUser(userExists);
            } else {
              // Se não encontrou, tenta encontrar qualquer master ativo
              const activeMaster = list.find(u => u.role === 'master' && u.active);
              if (activeMaster) {
                setTeamUser(activeMaster);
              } else {
                setTeamUser(null);
              }
            }
          } catch (e) {
            // Em caso de erro, tenta encontrar um master ativo
            const activeMaster = list.find(u => u.role === 'master' && u.active);
            if (activeMaster) {
              setTeamUser(activeMaster);
            } else {
              setTeamUser(null);
            }
          }
        } else if (list && list.length > 0) {
          // Se não tem cache mas há lista, tenta encontrar master
          const activeMaster = list.find(u => u.role === 'master' && u.active);
          if (activeMaster) {
            setTeamUser(activeMaster);
          }
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
      
      const payload = {
        establishment_id: finalEstablishmentId,
        user_id: session.user.id,
        name: masterName.trim(),
        role: 'master',
        pin: masterPin,
        active: true,
      };
      
      const { data: newMaster, error } = await supabase
        .from('team_members')
        .insert([payload])
        .select()
        .single();
        
      if (error) throw error;
      
      // Atualiza a lista e seleciona o master criado
      const { data: updatedList } = await supabase
        .from('team_members')
        .select('*')
        .eq('establishment_id', finalEstablishmentId)
        .eq('active', true)
        .order('role', { ascending: true });
        
      setTeamList(updatedList || []);
      setHasMaster(true);
      
      if (newMaster) {
        // Salva o master no localStorage e state
        setTeamUser(newMaster);
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
      }
    } catch (e: any) {
      console.error("Erro ao criar master:", e);
      setMasterError(e.message || "Erro ao criar usuário master");
    }
  };

  // Handler: seleciona usuário
  const handleSelectAndProceed = async () => {
    const sel = teamList.find(u => u.id === selectedId);
    if (!sel) return;
    setPinError("");
    // Master/Admin: exige PIN
    if (sel.role === 'master' || sel.role === 'admin') {
      if (!/^\d{4}$/.test(inputPin)) { 
        setPinError('PIN precisa ter 4 dígitos'); 
        return; 
      }
      if (sel.pin !== inputPin) { 
        setPinError("PIN incorreto"); 
        return; 
      }
    }
    setTeamUser(sel);
    setSelectedId("");
    setInputPin("");
    setPinError("");
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
    // Verifica se é o admin do sistema
    let isSystemAdmin = false;
    if (teamUser && teamUser.id === 'system-admin') {
      isSystemAdmin = true;
    }
    
    // Mostra o dialog quando:
    // - Não é rota pública
    // - Já inicializou (terminou de carregar)
    // - Não está carregando
    // - Não há teamUser selecionado
    // - NÃO é o admin do sistema
    return !isPublic && initialized && !loading && !teamUser && !isSystemAdmin;
  }, [isPublic, initialized, loading, teamUser]);

  // Bloquear o conteúdo enquanto não houver teamUser em rotas privadas
  // Só bloqueia se há master cadastrado e há membros na equipe
  const shouldBlockContent = mustShowDialog && hasMaster && teamList.length > 0;

  return (
    <TeamUserContext.Provider value={ctxValue}>
      {shouldBlockContent && (
        <div 
          className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-sm" 
          style={{ pointerEvents: 'auto' }}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onContextMenu={(e) => {
            e.preventDefault();
          }}
        />
      )}
      <div 
        style={{ 
          pointerEvents: shouldBlockContent ? 'none' : 'auto', 
          opacity: shouldBlockContent ? 0.15 : 1,
          filter: shouldBlockContent ? 'blur(3px)' : 'none',
          userSelect: shouldBlockContent ? 'none' : 'auto',
          WebkitUserSelect: shouldBlockContent ? 'none' : 'auto'
        }}
        className={shouldBlockContent ? 'pointer-events-none' : ''}
      >
        {children}
      </div>
      
      {/* DIALOG: Mostra formulário de criação para novos usuários ou seleção para usuários existentes */}
      <Dialog 
        open={mustShowDialog}
        onOpenChange={(open) => {
          // Permite fechar apenas se não há master cadastrado (novo usuário pode ir em Configurações)
          // Se há master, obriga selecionar um usuário
          if (!hasMaster && open === false) {
            // Permite fechar para novo usuário
            return;
          }
          if (hasMaster && !teamUser && open === false) {
            // Não permite fechar sem selecionar um usuário quando há master
            return;
          }
        }}
        modal={true}
      >
        <DialogContent 
          onInteractOutside={(e) => {
            // Permite fechar apenas se não há master
            if (!hasMaster) {
              return; // Permite fechar
            }
            e.preventDefault();
            e.stopPropagation();
          }} 
          onEscapeKeyDown={(e) => {
            // Permite fechar apenas se não há master
            if (!hasMaster) {
              return; // Permite fechar
            }
            e.preventDefault();
            e.stopPropagation();
          }}
          onPointerDownOutside={(e) => {
            // Permite fechar apenas se não há master
            if (!hasMaster) {
              return; // Permite fechar
            }
            e.preventDefault();
            e.stopPropagation();
          }}
          className="pointer-events-auto z-[101]"
        >
          {/* Remove botão X de fechar apenas se há master (obriga selecionar) */}
          {hasMaster && (
            <style dangerouslySetInnerHTML={{__html: `
              [data-radix-dialog-content] button,
              [data-radix-dialog-content] button[aria-label="Close"],
              [data-radix-dialog-content] > button:last-child,
              button:has(svg[aria-label="Close"]) {
                display: none !important;
                visibility: hidden !important;
                pointer-events: none !important;
                opacity: 0 !important;
                width: 0 !important;
                height: 0 !important;
              }
            `}} />
          )}
          
          {loading ? (
            <>
              <DialogHeader>
                <DialogTitle>Carregando...</DialogTitle>
              </DialogHeader>
              <div className="py-8 text-center text-muted-foreground">Carregando equipe...</div>
            </>
          ) : !hasMaster ? (
            // NOVO USUÁRIO: Formulário para criar o primeiro master
            <>
              <DialogHeader>
                <DialogTitle>Configurar usuário Master</DialogTitle>
                <DialogDescription>
                  Como este é seu primeiro acesso, crie o usuário master que terá controle total do sistema.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Nome do Master *</label>
                  <Input
                    type="text"
                    placeholder="Digite o nome do usuário master"
                    value={masterName}
                    onChange={e => {
                      setMasterName(e.target.value);
                      setMasterError("");
                    }}
                    autoFocus
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">PIN (4 dígitos) *</label>
                  <Input
                    type="password"
                    inputMode="numeric"
                    pattern="\\d*"
                    placeholder="0000"
                    maxLength={4}
                    value={masterPin}
                    onChange={e => {
                      setMasterPin(e.target.value.replace(/\D/g, '').slice(0, 4));
                      setMasterError("");
                    }}
                    className="text-center text-lg tracking-widest"
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
              <DialogFooter>
                <Button
                  className="w-full mt-2"
                  disabled={!masterName.trim() || masterPin.length !== 4}
                  onClick={handleCreateMaster}
                >
                  Criar Master e Entrar
                </Button>
              </DialogFooter>
            </>
          ) : (
            // USUÁRIO EXISTENTE: Lista de usuários da equipe
            <>
              <DialogHeader>
                <DialogTitle>Quem vai usar o sistema?</DialogTitle>
                <DialogDescription>
                  Selecione o usuário da equipe que tomará conta do sistema agora.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2 mt-3">
                {teamList.length === 0 && (
                  <div className="text-sm text-muted-foreground text-center py-4">
                    Nenhuma equipe cadastrada. Configure a equipe em Configurações.
                  </div>
                )}
                {teamList.map(member => (
                  <label 
                    key={member.id} 
                    className={`flex items-center gap-2 border p-3 rounded-lg cursor-pointer transition-colors ${
                      selectedId === member.id 
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
                    onChange={e => setInputPin(e.target.value.replace(/\D/g, '').slice(0,4))} 
                    className="text-center text-lg tracking-widest"
                    autoFocus
                  />
                  {pinError && (
                    <div className="text-xs text-red-600 font-medium text-center">{pinError}</div>
                  )}
                </div>
              )}
              <DialogFooter>
                <Button 
                  className="w-full mt-2" 
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
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </TeamUserContext.Provider>
  );
}
