import { useI18n } from '../contexts/I18nContext';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  text?: string;
}

export function LoadingSpinner({ size = 'md', text }: LoadingSpinnerProps) {
  const { t } = useI18n();
  
  const sizeClasses = {
    sm: 'spinner-border-sm',
    md: '',
    lg: 'spinner-border-lg',
  };

  return (
    <div className="d-flex flex-column align-items-center justify-content-center gap-3">
      <div className={`spinner-border ${sizeClasses[size]}`} role="status">
        <span className="visually-hidden">{text || t('common.loading')}</span>
      </div>
      {text && <small className="text-muted">{text}</small>}
    </div>
  );
}
