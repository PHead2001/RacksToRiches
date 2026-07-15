import { Component, type ErrorInfo, type ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
  diagnosticReport: () => string;
  onError: (error: unknown) => void;
  onReturnToMenu: () => void;
  onExport: () => void;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  override state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    this.props.onError(
      new Error(
        `${error.message}\n${info.componentStack ?? "Component stack unavailable"}`,
      ),
    );
  }

  override render(): ReactNode {
    if (this.state.error === null) return this.props.children;
    return (
      <main className="fatal-screen" data-testid="error-boundary">
        <section className="panel fatal-card" role="alert">
          <p className="eyebrow">RECOVERY MODE</p>
          <h1>The interface hit a bad packet.</h1>
          <p>
            Your browser save has not been deleted. Copy diagnostics or export
            the active state before reloading.
          </p>
          <pre>{this.state.error.message}</pre>
          <div className="button-row">
            <button
              onClick={() => {
                void navigator.clipboard.writeText(
                  this.props.diagnosticReport(),
                );
              }}
            >
              Copy diagnostics
            </button>
            <button onClick={this.props.onExport}>Export active state</button>
            <button onClick={this.props.onReturnToMenu}>Return to menu</button>
            <button
              onClick={() => {
                window.location.reload();
              }}
            >
              Reload
            </button>
          </div>
        </section>
      </main>
    );
  }
}
