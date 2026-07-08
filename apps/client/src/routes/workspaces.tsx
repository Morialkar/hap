import { createFileRoute } from '@tanstack/react-router';
import { useI18n } from '../contexts/I18nContext';

export const Route = createFileRoute('/workspaces')({
  component: Workspaces,
});

function Workspaces() {
  const { t } = useI18n();

  return (
    <div>
      <h1>{t('nav.workspaces')}</h1>
      <p className="text-muted">Workspaces page - coming soon</p>
    </div>
  );
}
