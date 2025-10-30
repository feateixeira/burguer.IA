import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
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
  const [showDialog, setShowDialog] = useState(false);
  const [selectedId, setSelectedId] = useState<string>("");
  const [inputPin, setInputPin] = useState("");
  const [pinError, setPinError] = useState("");

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
    // Só reabrir modal em rotas privadas
    if (!isPublic) setShowDialog(true);
  }, [setTeamUser, isPublic]);

  // Carrega user selecionado do localStorage
  useEffect(() => {
    const cached = window.localStorage.getItem(TEAM_USER_KEY);
    if (cached) {
      try {
        setTeamUserState(JSON.parse(cached));
      } catch (e) { setTeamUserState(null); }
    }
  }, [setTeamUser]);

  // Busca equipe atual do usuário supabase (apenas em rotas privadas)
  useEffect(() => {
    async function loadList() {
      if (isPublic) { setTeamList([]); setLoading(false); return; }
      setLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { setTeamList([]); setLoading(false); return; }
        // Carrega establishment_id do profile
        const { data: prof } = await supabase
          .from('profiles')
          .select('establishment_id')
          .eq('user_id', session.user.id)
          .maybeSingle();
        if (!prof?.establishment_id) { setTeamList([]); setLoading(false); return; }
        // Busca membros
        const { data: list } = await supabase
          .from('team_members')
          .select('*')
          .eq('establishment_id', prof.establishment_id)
          .eq('active', true)
          .order('role', { ascending: true });
        setTeamList(list || []);
      } catch (e) {
        setTeamList([]);
      } finally {
        setLoading(false);
      }
    }
    loadList();
  }, [teamUser, isPublic]);

  // Exibe o modal ao entrar (se não existir teamUser) apenas em rotas privadas/autenticadas
  useEffect(() => {
    if (isPublic) { setShowDialog(false); return; }
    if (!teamUser) setShowDialog(true);
  }, [teamUser, isPublic]);

  // Handler: seleciona usuário
  const handleSelectAndProceed = async () => {
    const sel = teamList.find(u => u.id === selectedId);
    if (!sel) return;
    setPinError("");
    // Master/Admin: exige PIN
    if (sel.role === 'master' || sel.role === 'admin') {
      if (!/^\d{4}$/.test(inputPin)) { setPinError('PIN precisa ter 4 dígitos'); return; }
      if (sel.pin !== inputPin) { setPinError("PIN incorreto"); return; }
      setTeamUser(sel);
      setShowDialog(false);
      setInputPin("");
      setPinError("");
    } else {
      setTeamUser(sel);
      setShowDialog(false);
      setInputPin("");
      setPinError("");
    }
  };

  // Logout da equipe
  const handleLogout = () => {
    setTeamUser(null);
    if (!isPublic) setShowDialog(true);
    setInputPin("");
    setSelectedId("");
    setPinError("");
  };

  // Contexto exportado
  const ctxValue: TeamUserContextType = { teamUser, setTeamUser, resetTeamUser: handleLogout };

  return (
    <TeamUserContext.Provider value={ctxValue}>
      {children}
      <Dialog open={showDialog}>
        <DialogContent>
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
                {teamList.length === 0 && <div className="text-sm text-muted-foreground">Nenhuma equipe cadastrada.</div>}
                {teamList.map(member => (
                  <label key={member.id} className={`flex items-center gap-2 border p-2 rounded-lg cursor-pointer transition-colors ${selectedId === member.id ? 'border-primary bg-primary/10' : 'border-input hover:bg-muted'}`}>
                    <input
                      type="radio"
                      checked={selectedId === member.id}
                      onChange={() => { setSelectedId(member.id); setInputPin(""); setPinError(""); }}
                      className="form-radio accent-primary"
                    />
                    <span className="font-medium">{member.name}</span>
                    <span className="text-xs px-2 py-0.5 rounded bg-muted uppercase">{member.role}</span>
                  </label>
                ))}
              </div>
              {selectedId && ["master", "admin"].includes(teamList.find(m => m.id === selectedId)?.role || "") && (
                <div className="space-y-2 mt-3">
                  <Input type="password" inputMode="numeric" pattern="\\d*" placeholder="PIN (4 dígitos)" maxLength={4} value={inputPin} onChange={e => setInputPin(e.target.value.replace(/\D/g, '').slice(0,4))} />
                  {pinError && <div className="text-xs text-red-600 font-medium">{pinError}</div>}
                </div>
              )}
              <DialogFooter>
                <Button className="w-full mt-2" disabled={!selectedId || (teamList.find(m => m.id === selectedId)?.role.match(/(master|admin)/) && inputPin.length !== 4)} onClick={handleSelectAndProceed}>
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
