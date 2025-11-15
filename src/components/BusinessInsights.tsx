import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Sparkles, TrendingUp, TrendingDown, Package, Clock, AlertTriangle, X } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

interface BusinessInsight {
  id: string;
  title: string;
  body: string;
  type: 'weak_period' | 'peak_period' | 'product_tip' | 'margin_alert' | 'stock_alert' | 'sales_tip' | 'general';
  created_at: string;
  read: boolean;
}

const BusinessInsights = ({ tenantId }: { tenantId: string | null }) => {
  const [insights, setInsights] = useState<BusinessInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (tenantId) {
      loadInsights();
    }
  }, [tenantId]);

  const loadInsights = async () => {
    if (!tenantId) return;

    try {
      const twoDaysAgo = new Date();
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

      const { data, error } = await supabase
        .from("business_insights")
        .select("*")
        .eq("tenant_id", tenantId)
        .gte("created_at", twoDaysAgo.toISOString())
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) throw error;

      setInsights(data || []);
      setUnreadCount((data || []).filter(i => !i.read).length);
    } catch (error) {
      console.error("Error loading insights:", error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (insightId: string) => {
    try {
      const { error } = await supabase
        .from("business_insights")
        .update({ read: true })
        .eq("id", insightId);

      if (error) throw error;

      setInsights(prev =>
        prev.map(i => (i.id === insightId ? { ...i, read: true } : i))
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error("Error marking as read:", error);
      toast.error("Erro ao marcar como lido");
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'weak_period':
        return <TrendingDown className="h-4 w-4" />;
      case 'peak_period':
        return <TrendingUp className="h-4 w-4" />;
      case 'product_tip':
        return <Package className="h-4 w-4" />;
      case 'margin_alert':
      case 'stock_alert':
        return <AlertTriangle className="h-4 w-4" />;
      default:
        return <Sparkles className="h-4 w-4" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'weak_period':
        return 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20';
      case 'peak_period':
        return 'bg-green-500/10 text-green-600 border-green-500/20';
      case 'product_tip':
        return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
      case 'margin_alert':
        return 'bg-orange-500/10 text-orange-600 border-orange-500/20';
      case 'stock_alert':
        return 'bg-red-500/10 text-red-600 border-red-500/20';
      default:
        return 'bg-purple-500/10 text-purple-600 border-purple-500/20';
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'weak_period':
        return 'Horário Fraco';
      case 'peak_period':
        return 'Horário de Pico';
      case 'product_tip':
        return 'Dica de Produto';
      case 'margin_alert':
        return 'Alerta de Margem';
      case 'stock_alert':
        return 'Alerta de Estoque';
      case 'sales_tip':
        return 'Dica de Vendas';
      default:
        return 'Geral';
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Insights de Negócios
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (insights.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Insights de Negócios
          </CardTitle>
          <CardDescription>
            Insights automáticos baseados nos seus dados
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhum insight disponível no momento. Continue usando o sistema para receber insights automáticos.
          </p>
          <Link to="/gold/assistant">
            <Button variant="outline" className="w-full">
              Abrir Assistente IA
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            <CardTitle>Insights de Negócios</CardTitle>
            {unreadCount > 0 && (
              <Badge variant="destructive">{unreadCount}</Badge>
            )}
          </div>
          <Link to="/gold/assistant">
            <Button variant="outline" size="sm">
              Ver Todos
            </Button>
          </Link>
        </div>
        <CardDescription>
          Insights automáticos baseados nos seus dados
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px]">
          <div className="space-y-4">
            {insights.map((insight) => (
              <Card
                key={insight.id}
                className={`border ${
                  !insight.read ? 'border-primary/50 bg-primary/5' : ''
                }`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2 flex-1">
                      <div className={`p-1.5 rounded ${getTypeColor(insight.type)}`}>
                        {getTypeIcon(insight.type)}
                      </div>
                      <div className="flex-1">
                        <CardTitle className="text-base">{insight.title}</CardTitle>
                        <Badge
                          variant="outline"
                          className="mt-1 text-xs"
                        >
                          {getTypeLabel(insight.type)}
                        </Badge>
                      </div>
                    </div>
                    {!insight.read && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => markAsRead(insight.id)}
                        className="h-6 w-6 p-0"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {insight.body}
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    {new Date(insight.created_at).toLocaleString('pt-BR')}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export default BusinessInsights;

