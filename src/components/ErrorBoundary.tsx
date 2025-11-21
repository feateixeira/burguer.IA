import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Error Boundary para capturar erros não tratados e prevenir crashes da aplicação
 * 
 * CRÍTICO: Este componente é essencial para garantir que erros não quebrem
 * toda a aplicação. Sem ele, qualquer erro não tratado pode fazer o sistema
 * "cair do nada" como relatado pelos clientes.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    // Atualiza o state para que a próxima renderização mostre a UI de fallback
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log do erro para debugging
    console.error('ErrorBoundary capturou um erro:', error, errorInfo);
    
    // Atualizar state com informações do erro
    this.setState({
      error,
      errorInfo,
    });

    // Aqui você pode enviar o erro para um serviço de logging
    // Exemplo: logErrorToService(error, errorInfo);
  }

  handleReset = () => {
    // Resetar o estado do erro
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
    
    // Recarregar a página para garantir estado limpo
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      // Se houver um fallback customizado, usar ele
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // UI de fallback padrão
      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-background">
          <Card className="max-w-2xl w-full">
            <CardHeader>
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-6 w-6 text-destructive" />
                <CardTitle className="text-2xl">Ops! Algo deu errado</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                Ocorreu um erro inesperado. Não se preocupe, seus dados estão seguros.
                Por favor, recarregue a página para continuar.
              </p>
              
              {process.env.NODE_ENV === 'development' && this.state.error && (
                <div className="mt-4 p-4 bg-muted rounded-md">
                  <p className="text-sm font-mono text-destructive">
                    {this.state.error.toString()}
                  </p>
                  {this.state.errorInfo && (
                    <details className="mt-2">
                      <summary className="text-sm cursor-pointer text-muted-foreground">
                        Detalhes técnicos
                      </summary>
                      <pre className="mt-2 text-xs overflow-auto max-h-60">
                        {this.state.errorInfo.componentStack}
                      </pre>
                    </details>
                  )}
                </div>
              )}

              <div className="flex gap-2">
                <Button onClick={this.handleReset} className="flex-1">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Recarregar Página
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => window.location.href = '/auth'}
                  className="flex-1"
                >
                  Voltar ao Login
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

