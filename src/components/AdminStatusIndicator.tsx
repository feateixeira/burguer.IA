import { Shield, Clock } from 'lucide-react';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { cn } from '@/lib/utils';

export const AdminStatusIndicator = () => {
  const { isAdminAuthenticated, remainingMinutes, clearAdminSession } = useAdminAuth();

  if (!isAdminAuthenticated) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/50 text-muted-foreground text-sm">
        <Shield className="h-4 w-4" />
        <span>Modo Operacional</span>
      </div>
    );
  }

  return (
    <div 
      className={cn(
        "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm cursor-pointer transition-colors",
        remainingMinutes <= 5 
          ? "bg-destructive/10 text-destructive hover:bg-destructive/20" 
          : "bg-primary/10 text-primary hover:bg-primary/20"
      )}
      onClick={clearAdminSession}
      title="Clique para sair do modo admin"
    >
      <Shield className="h-4 w-4" />
      <span className="font-medium">Admin Ativo</span>
      <div className="flex items-center gap-1 text-xs">
        <Clock className="h-3 w-3" />
        <span>{remainingMinutes}min</span>
      </div>
    </div>
  );
};
