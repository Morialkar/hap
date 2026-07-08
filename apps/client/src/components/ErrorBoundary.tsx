import { Component, type ReactNode } from 'react';
import { useI18n } from '../contexts/I18nContext';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return <ErrorFallback error={this.state.error} reset={() => this.setState({ hasError: false, error: null })} />;
    }

    return this.props.children;
  }
}

function ErrorFallback({ error, reset }: { error: Error | null; reset: () => void }) {
  const { t } = useI18n();

  return (
    <div className="container-xl d-flex align-items-center justify-content-center" style={{ minHeight: '100vh' }}>
      <div className="card" style={{ maxWidth: '500px', width: '100%' }}>
        <div className="card-body p-4 text-center">
          <h1 className="display-1 text-danger mb-3">⚠️</h1>
          <h2 className="card-title mb-3">{t('error.title')}</h2>
          <p className="card-text text-muted mb-4">
            {error?.message || t('error.serverError')}
          </p>
          <button className="btn btn-primary" onClick={reset}>
            {t('error.tryAgain')}
          </button>
        </div>
      </div>
    </div>
  );
}
