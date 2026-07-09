import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: ReactNode;
  pretitle?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}

export function PageHeader({ title, pretitle, description, actions }: PageHeaderProps) {
  return (
    <header className="page-header">
      <div className="row align-items-center g-3">
        <div className="col">
          {pretitle && <div className="page-pretitle">{pretitle}</div>}
          <h1 className="page-title">{title}</h1>
          {description && <div className="text-secondary mt-1">{description}</div>}
        </div>
        {actions && <div className="col-auto ms-auto">{actions}</div>}
      </div>
    </header>
  );
}

export function PageActions({ children }: { children: ReactNode }) {
  return <div className="btn-list">{children}</div>;
}
