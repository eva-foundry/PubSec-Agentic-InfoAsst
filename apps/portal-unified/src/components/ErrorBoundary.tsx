import { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RotateCcw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Global error boundary. Catches render-time exceptions in the component tree
 * and shows a friendly fallback with a Reload button. Logs the error so it
 * still appears in the console for debugging.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleHome = () => {
    window.location.assign("/");
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div
        role="alert"
        className="min-h-screen w-full bg-background text-foreground grid place-items-center px-4"
      >
        <div className="max-w-md w-full text-center space-y-5">
          <div className="mx-auto h-14 w-14 rounded-full bg-danger/15 grid place-items-center">
            <AlertTriangle className="h-7 w-7 text-danger" aria-hidden />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight">Something went wrong</h1>
            <p className="text-sm text-muted-foreground">
              An unexpected error interrupted the page. You can reload to try again
              or head back to the landing page.
            </p>
          </div>
          {this.state.error?.message && (
            <pre className="text-left text-[11px] font-mono bg-muted/50 border border-border rounded-md p-3 overflow-x-auto text-muted-foreground">
              {this.state.error.message}
            </pre>
          )}
          <div className="flex items-center justify-center gap-2">
            <Button onClick={this.handleReload} className="bg-gradient-accent">
              <RotateCcw className="h-4 w-4 mr-2" aria-hidden />
              Reload
            </Button>
            <Button variant="outline" onClick={this.handleHome}>
              <Home className="h-4 w-4 mr-2" aria-hidden />
              Go home
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
