import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const DebugEnv = () => {
  const [envInfo, setEnvInfo] = useState<any>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Usar setTimeout para garantir que o componente renderize primeiro
    const timer = setTimeout(() => {
      try {
        const url = import.meta.env.VITE_SUPABASE_URL || "";
        const key = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
        
        const info: any = {
          VITE_SUPABASE_URL: url || "NÃO CONFIGURADO",
          VITE_SUPABASE_URL_LENGTH: url.length,
          VITE_SUPABASE_ANON_KEY: key 
            ? `${key.substring(0, 20)}... (${key.length} caracteres)` 
            : "NÃO CONFIGURADO",
          VITE_SUPABASE_ANON_KEY_LENGTH: key.length,
          MODE: import.meta.env.MODE,
          DEV: import.meta.env.DEV,
          PROD: import.meta.env.PROD,
          isSupabaseConfigured: !!(url && key && url !== "https://placeholder.supabase.co" && key !== "placeholder-key"),
        };

        // Adicionar informações do window apenas se disponível
        if (typeof window !== 'undefined') {
          info.windowEnv = (window as any).__ENV__ || null;
          info.userAgent = navigator.userAgent || 'N/A';
          info.location = window.location.href;
        }

        setEnvInfo(info);
      } catch (error: any) {
        setEnvInfo({
          error: error.message || "Erro desconhecido",
          errorType: error.name || "Unknown",
        });
      } finally {
        setLoading(false);
      }
    }, 100); // Pequeno delay para garantir renderização

    return () => clearTimeout(timer);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Carregando informações...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 bg-background">
      <Card className="max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle>Debug - Variáveis de Ambiente</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">Variáveis de Ambiente:</h3>
              <pre className="bg-muted p-4 rounded-lg overflow-auto text-xs">
                {JSON.stringify(envInfo, null, 2)}
              </pre>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Status:</h3>
              <div className="space-y-2">
                <div className={`p-2 rounded ${envInfo.VITE_SUPABASE_URL && envInfo.VITE_SUPABASE_URL !== "NÃO CONFIGURADO" ? "bg-green-100 dark:bg-green-900" : "bg-red-100 dark:bg-red-900"}`}>
                  VITE_SUPABASE_URL: {envInfo.VITE_SUPABASE_URL && envInfo.VITE_SUPABASE_URL !== "NÃO CONFIGURADO" ? "✓ Configurado" : "✗ NÃO CONFIGURADO"}
                </div>
                <div className={`p-2 rounded ${envInfo.VITE_SUPABASE_ANON_KEY && envInfo.VITE_SUPABASE_ANON_KEY !== "NÃO CONFIGURADO" ? "bg-green-100 dark:bg-green-900" : "bg-red-100 dark:bg-red-900"}`}>
                  VITE_SUPABASE_ANON_KEY: {envInfo.VITE_SUPABASE_ANON_KEY && envInfo.VITE_SUPABASE_ANON_KEY !== "NÃO CONFIGURADO" ? "✓ Configurado" : "✗ NÃO CONFIGURADO"}
                </div>
              </div>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Instruções:</h3>
              <ol className="list-decimal list-inside space-y-2 text-sm">
                <li>Acesse o Vercel Dashboard</li>
                <li>Vá em Settings → Environment Variables</li>
                <li>Certifique-se de que as seguintes variáveis estão configuradas:
                  <ul className="list-disc list-inside ml-4 mt-1">
                    <li>VITE_SUPABASE_URL</li>
                    <li>VITE_SUPABASE_ANON_KEY</li>
                  </ul>
                </li>
                <li>Certifique-se de que as variáveis estão disponíveis para "Production"</li>
                <li>Após adicionar/atualizar, faça um novo deploy</li>
              </ol>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

