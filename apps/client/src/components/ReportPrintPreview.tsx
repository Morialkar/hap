import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../contexts/I18nContext';
import { LoadingSpinner } from './LoadingSpinner';

interface ReportPrintPreviewProps {
  tableId: string;
  reportName: string;
  query: unknown;
  layout: unknown;
}

/**
 * Shows the report document produced by the API — the very same HTML the PDF export
 * is rendered from — inside an iframe, and prints that document rather than the
 * surrounding page. Previously this screen re-implemented the layout in JSX, so the
 * printed result and the exported PDF drifted apart (different markup, and the
 * preview was paginated while the export was not).
 */
export function ReportPrintPreview({
  tableId,
  reportName,
  query,
  layout,
}: ReportPrintPreviewProps) {
  const { t } = useI18n();
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(false);

    fetch('/api/v1/reports/preview/html', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table_id: tableId, name: reportName, query, layout }),
    })
      .then((response) => {
        if (!response.ok) throw new Error('Preview failed');
        return response.text();
      })
      .then((text) => {
        if (!cancelled) {
          setHtml(text);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(true);
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [tableId, reportName, query, layout]);

  const handlePrint = () => {
    const frame = frameRef.current?.contentWindow;
    if (!frame) return;
    frame.focus();
    frame.print();
  };

  return (
    <div>
      <div className="d-flex justify-content-end mb-3">
        <button
          type="button"
          className="btn btn-primary"
          onClick={handlePrint}
          disabled={!html || isLoading}
        >
          <i className="ti ti-printer me-1" aria-hidden="true" />
          {t('reports.print')}
        </button>
      </div>

      {isLoading && (
        <div className="d-flex justify-content-center py-5">
          <LoadingSpinner size="lg" />
        </div>
      )}

      {error && <div className="alert alert-danger">{t('reports.printPreviewError')}</div>}

      {html && !error && (
        <iframe
          ref={frameRef}
          title={t('reports.preview.print')}
          srcDoc={html}
          data-testid="report-print-frame"
          className="w-100 border rounded bg-white"
          style={{ height: '75vh' }}
        />
      )}
    </div>
  );
}
