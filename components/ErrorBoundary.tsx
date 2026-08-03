import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleGlobalError = (event: ErrorEvent) => {
    console.error('Global error caught:', event.error);
    this.setState({
      hasError: true,
      error: event.error || new Error(event.message),
      errorInfo: null
    });
  };

  private handleUnhandledRejection = (event: PromiseRejectionEvent) => {
    console.error('Unhandled promise rejection caught:', event.reason);
    this.setState({
      hasError: true,
      error: event.reason instanceof Error ? event.reason : new Error(String(event.reason)),
      errorInfo: null
    });
  };

  public componentDidMount() {
    window.addEventListener('error', this.handleGlobalError);
    window.addEventListener('unhandledrejection', this.handleUnhandledRejection);
  }

  public componentWillUnmount() {
    window.removeEventListener('error', this.handleGlobalError);
    window.removeEventListener('unhandledrejection', this.handleUnhandledRejection);
  }

  public render() {
    if (this.state.hasError) {
      // Plain message, no special cases.
      //
      // This used to JSON.parse the message to unwrap the envelope
      // `utils/firebaseUtils.ts` threw for Firestore failures, and render it as
      // "Database Error (update): …". ADR-0005 deleted Firebase, so nothing
      // throws that shape any more — and the `isFirestoreError` flag it set was
      // already dead, which ESLint had been reporting as an unused variable.
      const errorMessage = this.state.error?.message || 'An unexpected error occurred.';

      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
          <div className="bg-white p-8 rounded-xl shadow-lg max-w-2xl w-full border border-red-100 text-center flex flex-col max-h-[90vh]">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 shrink-0">
              <AlertTriangle className="text-red-600" size={32} />
            </div>
            <h2 className="text-2xl font-bold text-slate-800 mb-2 shrink-0">App Crashed!</h2>
            <p className="text-slate-600 mb-4 shrink-0">Here is the error report to help you identify the issue:</p>
            
            <div className="bg-slate-900 p-4 rounded-lg text-left mb-6 overflow-auto flex-1 border border-slate-800 shadow-inner">
              <p className="text-sm text-red-400 font-mono break-words font-bold mb-2">
                Error: {errorMessage}
              </p>
              {this.state.errorInfo && (
                <pre className="text-xs text-slate-400 font-mono whitespace-pre-wrap mt-4 border-t border-slate-700 pt-4">
                  <span className="text-slate-300 font-bold">Crashed at:</span>
                  {this.state.errorInfo.componentStack}
                </pre>
              )}
              {this.state.error?.stack && !this.state.errorInfo && (
                <pre className="text-xs text-slate-400 font-mono whitespace-pre-wrap mt-4 border-t border-slate-700 pt-4">
                  <span className="text-slate-300 font-bold">Stack Trace:</span>
                  {'\n'}{this.state.error.stack}
                </pre>
              )}
            </div>
            
            <button
              onClick={() => window.location.reload()}
              className="flex items-center justify-center gap-2 w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors shrink-0"
            >
              <RefreshCw size={18} />
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
