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
        // Carrega establishment_id do profile
        const { data: prof } = await supabase
          .from('profiles')
          .select('establishment_id')
          .eq('user_id', session.user.id)
          .maybeSingle();
        if (!prof?.establishment_id) { 
          setTeamList([]); 
          setLoading(false); 
          setInitialized(true);
          return; 
        }
        // Busca membros
        const { data: list } = await supabase
          .from('team_members')
          .select('*')
          .eq('establishment_id', prof.establishment_id)
          .eq('active', true)
          .order('role', { ascending: true });
        setTeamList(list || []);

        // Verifica se o usuário do localStorage ainda existe e está ativo na equipe
        const cached = window.localStorage.getItem(TEAM_USER_KEY);
        if (cached && list && list.length > 0) {
          try {
            const cachedUser = JSON.parse(cached);
            const userExists = list.find(u => u.id === cachedUser.id && u.active);
            if (userExists) {
              setTeamUser(cachedUser);
            } else {
              setTeamUser(null);
            }
          } catch (e) {
            setTeamUser(null);
          }
        } else if (cached) {
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

  // TEMPORARIAMENTE DESABILITADO - será arrumado amanhã
  // CALCULA se deve mostrar o dialog: SEMPRE quando não há teamUser em rotas privadas
  const mustShowDialog = useMemo(() => {
    // DESABILITADO TEMPORARIAMENTE
    return false; // !isPublic && initialized && !loading && !teamUser;
  }, [isPublic, initialized, loading, teamUser]);

  // Bloquear o conteúdo enquanto não houver teamUser em rotas privadas
  const shouldBlockContent = false; // mustShowDialog;

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
      
      {/* DIALOG SEMPRE ABERTO quando não tem teamUser - IMPOSSÍVEL FECHAR */}
      <Dialog 
        open={mustShowDialog}
        onOpenChange={() => {
          // COMPLETAMENTE IGNORA qualquer tentativa de fechar se não tem teamUser
          // Não faz NADA - o dialog é controlado apenas por mustShowDialog
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
          className="pointer-events-auto z-[101]"
        >
          {/* Remove botão X de fechar */}
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
          <DialogHeader>
            <DialogTitle>Quem vai usar o sistema?</DialogTitle>
            <DialogDescription>
              Selecione o usuário da equipe que tomará conta do sistema agora.
            </DialogDescription>
          </DialogHeader>
          {loading ? (
            <div className="py-8 text-center text-muted-foreground">Carregando equipe...</div>
          ) : (
            <>
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
