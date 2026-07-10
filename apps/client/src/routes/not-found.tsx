import { createFileRoute } from '@tanstack/react-router';
import { useI18n } from '../contexts/I18nContext';

export const Route = createFileRoute('/not-found')({
  component: NotFound,
});

function NotFound() {
  const { t } = useI18n();

  return (
    <div
      className="container-xl d-flex align-items-center justify-content-center"
      style={{ minHeight: '100vh' }}
    >
      <div className="card" style={{ maxWidth: '500px', width: '100%' }}>
        <div className="card-body p-4 text-center">
          <h1 className="display-1 text-muted mb-3">404</h1>
          <h2 className="card-title mb-3">{t('error.notFound')}</h2>
          <p className="card-text text-muted mb-4">The page you're looking for doesn't exist.</p>
          <a href="/" className="btn btn-primary">
            {t('common.back')}
          </a>
        </div>
      </div>
    </div>
  );
}
