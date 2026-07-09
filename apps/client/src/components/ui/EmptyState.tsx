import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon: string;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  testId?: string;
}

export function EmptyState({ icon, title, description, action, testId }: EmptyStateProps) {
  return (
    <div className="hap-empty-state" data-testid={testId}>
      <div className="hap-empty-state-icon">
        <i className={`ti ti-${icon}`} aria-hidden="true" />
      </div>
      <h2 className="h3">{title}</h2>
      {description && <p className="text-secondary">{description}</p>}
      {action}
    </div>
  );
}
