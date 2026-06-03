import React from 'react';
import { RefreshCw, AlertTriangle } from 'lucide-react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-surface-container-low flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant shadow-[0px_4px_20px_rgba(0,0,0,0.08)] p-8 max-w-md w-full text-center space-y-4">
            <div className="w-16 h-16 bg-error-container rounded-2xl flex items-center justify-center mx-auto">
              <AlertTriangle className="w-8 h-8 text-error" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-on-surface">Terjadi Kesalahan</h2>
              <p className="text-sm text-on-surface-variant mt-2">
                Halaman mengalami error yang tidak terduga. Muat ulang halaman untuk mencoba lagi.
              </p>
              {this.state.error && (
                <p className="text-xs text-error bg-error-container rounded-lg px-3 py-2 mt-3 text-left font-mono break-all">
                  {this.state.error.message}
                </p>
              )}
            </div>
            <button
              onClick={this.handleReset}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-on-primary rounded-xl font-semibold text-sm hover:bg-primary-container transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Muat Ulang Halaman
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
