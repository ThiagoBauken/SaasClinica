import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Global Error Boundary - catches React rendering errors
 * Prevents the entire app from crashing on component errors
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });

    // Log to console in development
    if (process.env.NODE_ENV !== 'production') {
      console.error('ErrorBoundary caught:', error, errorInfo);
    }

    // Report to Sentry or similar service
    this.props.onError?.(error, errorInfo);

    // Could also send to backend error reporting endpoint
    try {
      fetch('/api/client-errors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: error.message,
          stack: error.stack,
          componentStack: errorInfo.componentStack,
          url: window.location.href,
          timestamp: new Date().toISOString(),
        }),
        credentials: 'include',
      }).catch(() => {
        // Silently fail - don't let error reporting cause more errors
      });
    } catch {
      // Ignore
    }
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  handleReload = (): void => {
    window.location.reload();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex items-center justify-center min-h-[400px] p-6">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-2" />
              <CardTitle className="text-lg">Algo deu errado</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground text-center">
                Ocorreu um erro inesperado. Tente recarregar a pagina ou voltar para o inicio.
              </p>

              {process.env.NODE_ENV !== 'production' && this.state.error && (
                <details className="mt-4 p-3 bg-muted rounded-md">
                  <summary className="text-xs font-medium cursor-pointer">
                    Detalhes do erro (dev only)
                  </summary>
                  <pre className="mt-2 text-xs overflow-auto max-h-48 whitespace-pre-wrap">
                    {this.state.error.message}
                    {'\n\n'}
                    {this.state.error.stack}
                  </pre>
                </details>
              )}

              <div className="flex gap-2 justify-center">
                <Button variant="outline" onClick={this.handleReset}>
                  Tentar novamente
                </Button>
                <Button onClick={this.handleReload}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Recarregar pagina
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

/**
 * Page-level error boundary with simpler fallback
 */
export class PageErrorBoundary extends Component<
  { children: ReactNode; pageName?: string },
  State
> {
  constructor(props: { children: ReactNode; pageName?: string }) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });
    console.error(`Error in ${this.props.pageName || 'page'}:`, error);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center p-8 text-center">
          <AlertTriangle className="h-8 w-8 text-destructive mb-3" />
          <h3 className="font-semibold mb-1">
            Erro ao carregar {this.props.pageName || 'esta pagina'}
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            Tente recarregar a pagina
          </p>
          <Button
            size="sm"
            onClick={() => {
              this.setState({ hasError: false, error: null, errorInfo: null });
            }}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Recarregar
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
