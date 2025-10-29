import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";

interface CallingPassword {
  password_number: number;
  counter_number: string | null;
}

export default function PasswordDisplay() {
  const [callingPasswords, setCallingPasswords] = useState<CallingPassword[]>([]);
  const [lastCalled, setLastCalled] = useState<number | null>(null);

  useEffect(() => {
    loadCallingPasswords();

    // Subscribe to real-time updates
    const channel = supabase
      .channel('display-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'password_queue',
        },
        (payload) => {
          console.log('Change received!', payload);
          loadCallingPasswords();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadCallingPasswords = async () => {
    try {
      const { data, error } = await supabase
        .from("password_queue")
        .select("password_number, counter_number")
        .eq("status", "calling")
        .order("called_at", { ascending: false })
        .limit(5);

      if (error) throw error;
      
      if (data && data.length > 0) {
        setCallingPasswords(data);
        setLastCalled(data[0].password_number);
        
        // Play sound notification
        try {
          const audio = new Audio('/notification.mp3');
          audio.play().catch(e => console.log('Audio play failed:', e));
        } catch (e) {
          console.log('Audio not available:', e);
        }
      } else {
        setCallingPasswords([]);
      }
    } catch (error) {
      console.error("Error loading passwords:", error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/20 to-primary-glow/20 p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-6xl font-bold">Painel de Senhas</h1>
          <p className="text-2xl text-muted-foreground">
            Aguarde ser chamado
          </p>
        </div>

        {callingPasswords.length > 0 ? (
          <div className="grid gap-8">
            {/* Main calling password */}
            <Card className="p-12 bg-primary text-primary-foreground">
              <div className="text-center space-y-4">
                <p className="text-3xl font-semibold">Senha Chamada</p>
                <p className="text-9xl font-bold animate-pulse">
                  S{String(callingPasswords[0].password_number).padStart(3, "0")}
                </p>
                {callingPasswords[0].counter_number && (
                  <p className="text-4xl">
                    Balcão: {callingPasswords[0].counter_number}
                  </p>
                )}
              </div>
            </Card>

            {/* Recent calls */}
            {callingPasswords.length > 1 && (
              <div className="space-y-4">
                <h2 className="text-2xl font-semibold text-center">
                  Últimas Chamadas
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {callingPasswords.slice(1).map((pwd, idx) => (
                    <Card key={idx} className="p-6 text-center">
                      <p className="text-4xl font-bold">
                        S{String(pwd.password_number).padStart(3, "0")}
                      </p>
                      {pwd.counter_number && (
                        <p className="text-sm text-muted-foreground mt-2">
                          Balcão {pwd.counter_number}
                        </p>
                      )}
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <Card className="p-12">
            <div className="text-center space-y-4">
              <p className="text-4xl font-semibold text-muted-foreground">
                Aguardando próxima chamada...
              </p>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
