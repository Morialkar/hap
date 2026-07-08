import { useI18n } from '../contexts/I18nContext';

interface DestructiveChangeImpact {
  affected_records: number;
  orphaned_values: number;
  coercion_required: boolean;
}

interface DestructiveChangeModalProps {
  title: string;
  message: string;
  impact: DestructiveChangeImpact;
  isOpen: boolean;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function DestructiveChangeModal({
  title,
  message,
  impact,
  isOpen,
  confirmLabel,
  onConfirm,
  onCancel,
}: DestructiveChangeModalProps) {
  const { t } = useI18n();

  if (!isOpen) return null;

  const affectedText = t('builder.destructive.affectedRecords', {
    count: impact.affected_records,
  });
  const orphanedText = t('builder.destructive.orphanedValues', {
    count: impact.orphaned_values,
  });

  return (
    <div
      className="modal show d-block"
      role="dialog"
      aria-modal="true"
      aria-labelledby="destructive-title"
    >
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header">
            <h5 id="destructive-title" className="modal-title text-danger">
              {title}
            </h5>
            <button
              type="button"
              className="btn-close"
              onClick={onCancel}
              aria-label={t('common.close')}
            />
          </div>
          <div className="modal-body">
            <p>{message}</p>
            <ul className="list-unstyled mb-0">
              <li>
                <i className="ti ti-alert-triangle text-warning me-2" />
                {affectedText}
              </li>
              {impact.orphaned_values > 0 && (
                <li>
                  <i className="ti ti-database text-info me-2" />
                  {orphanedText}
                </li>
              )}
              {impact.coercion_required && (
                <li>
                  <i className="ti ti-transform text-warning me-2" />
                  {t('builder.destructive.coercionRequired')}
                </li>
              )}
            </ul>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onCancel}>
              {t('common.cancel')}
            </button>
            <button type="button" className="btn btn-danger" onClick={onConfirm}>
              {confirmLabel || t('builder.destructive.confirmLabel')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
