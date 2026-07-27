import { Component, ReactNode } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

/**
 * Global error boundary that prevents the whole app from going blank
 * when a single component throws during render (a common cause of the
 * "white screen while scrolling on mobile" that required a hard reload).
 */
class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary] captured error", error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <div className="glass-card max-w-md w-full p-6 text-center space-y-4">
          <div className="mx-auto h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
          <div className="space-y-1">
            <h2 className="font-display text-xl font-bold">Algo deu errado</h2>
            <p className="text-sm text-muted-foreground">
              Encontramos um problema ao exibir esta parte da página. Você pode tentar novamente sem recarregar tudo.
            </p>
          </div>
          <div className="flex gap-2 justify-center">
            <Button variant="outline" onClick={this.handleReset}>
              Tentar novamente
            </Button>
            <Button onClick={this.handleReload}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Recarregar página
            </Button>
          </div>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
