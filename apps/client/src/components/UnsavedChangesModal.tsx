import { useI18n } from '../contexts/I18nContext';

interface UnsavedChangesModalProps {
  isOpen: boolean;
  onLeave: () => void;
  onStay: () => void;
}

export function UnsavedChangesModal({ isOpen, onLeave, onStay }: UnsavedChangesModalProps) {
  const { t } = useI18n();

  if (!isOpen) return null;

  return (
    <div
      className="modal show d-block"
      role="dialog"
      aria-modal="true"
      aria-labelledby="unsaved-title"
    >
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header">
            <h5 id="unsaved-title" className="modal-title">
              {t('unsaved.title')}
            </h5>
            <button
              type="button"
              className="btn-close"
              onClick={onStay}
              aria-label={t('common.close')}
            />
          </div>
          <div className="modal-body">
            <p className="mb-0">{t('unsaved.message')}</p>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onStay}>
              {t('unsaved.stay')}
            </button>
            <button type="button" className="btn btn-danger" onClick={onLeave}>
              {t('unsaved.leave')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
