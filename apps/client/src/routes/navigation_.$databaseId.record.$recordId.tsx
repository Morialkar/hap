import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useRepository } from '../contexts/RepositoryContext';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { RecordDetailView } from '../components/RecordDetailView';
import { useI18n } from '../contexts/I18nContext';
import { type BuilderField } from '../lib/fieldTypes';
import type { ApiRecord } from '../lib/apiTypes';
import { ShareModal } from '../components/ShareModal';

export const Route = createFileRoute('/navigation_/$databaseId/record/$recordId')({
  component: SingleRecordPage,
});

export function SingleRecordPage() {
  const { databaseId, recordId } = Route.useParams();
  const { t } = useI18n();
  const repository = useRepository();
  const navigate = useNavigate();
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  // 1. Fetch the record
  const recordQuery = useQuery<ApiRecord, Error>({
    queryKey: ['records', recordId],
    queryFn: () => repository.records.get(recordId),
    enabled: !!recordId,
  });

  const tableId = recordQuery.data?.table_id;

  // 2. Fetch the table details
  const tableQuery = useQuery<{ id: string; name: string }, Error>({
    queryKey: ['tables', tableId],
    queryFn: () => repository.tables.get(tableId!),
    enabled: !!tableId,
  });

  // 3. Fetch fields to extract the title/label
  const fieldsQuery = useQuery<BuilderField[], Error>({
    queryKey: ['fields', tableId],
    queryFn: () => repository.fields.listByTable(tableId!),
    enabled: !!tableId,
  });

  const isLoading = recordQuery.isLoading || tableQuery.isLoading || fieldsQuery.isLoading;

  if (isLoading) {
    return (
      <div className="d-flex justify-content-center p-5" data-testid="single-record-loading">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (recordQuery.isError || !recordQuery.data) {
    return (
      <div className="alert alert-danger" role="alert" data-testid="single-record-error">
        {recordQuery.error?.message || 'Record not found'}
      </div>
    );
  }

  const rData = recordQuery.data.data || {};
  const fields = fieldsQuery.data || [];
  const tableName = tableQuery.data?.name || 'Fiche';

  // Resolve main title/label
  let recordTitle: string;
  const titleField =
    fields.find((f) => f.options?.is_title === true) ?? fields.find((f) => f.type === 'title');
  if (
    titleField &&
    rData[titleField.name] !== undefined &&
    rData[titleField.name] !== null &&
    rData[titleField.name] !== ''
  ) {
    recordTitle = String(rData[titleField.name]);
  } else {
    const sortedFields = [...fields].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    const firstField = sortedFields[0];
    if (
      firstField &&
      rData[firstField.name] !== undefined &&
      rData[firstField.name] !== null &&
      rData[firstField.name] !== ''
    ) {
      recordTitle = String(rData[firstField.name]);
    } else {
      recordTitle = String(
        rData.name || rData.title || rData.nom || rData.titre || Object.values(rData)[0] || recordId
      );
    }
  }

  const handleBack = () => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      navigate({ to: '/navigation/$databaseId', params: { databaseId } });
    }
  };

  return (
    <div className="container py-4" data-testid="single-record-page">
      <div className="mb-3 d-flex justify-content-between align-items-center gap-3">
        <button
          type="button"
          className="btn btn-outline-secondary d-inline-flex align-items-center gap-1"
          onClick={handleBack}
        >
          <i className="ti ti-arrow-left" aria-hidden="true" />
          {t('common.back') || 'Retour'}
        </button>
        <div className="d-flex align-items-center gap-2">
          {tableId && (
            <button
              type="button"
              className="btn btn-outline-primary d-inline-flex align-items-center gap-1"
              onClick={() => setIsShareModalOpen(true)}
            >
              <i className="ti ti-share" aria-hidden="true" />
              Partager
            </button>
          )}
          {tableId && (
            <Link
              to="/tables/$databaseId/$tableId"
              params={{ databaseId, tableId }}
              search={{ action: 'edit', recordId, returnTo: 'single-record' }}
              className="btn btn-primary d-inline-flex align-items-center gap-1 flex-shrink-0"
              data-testid="single-record-edit"
            >
              <i className="ti ti-edit" aria-hidden="true" />
              Éditer la fiche
            </Link>
          )}
        </div>
      </div>

      <div className="card shadow-sm border-0">
        <div className="card-header bg-white py-3 border-bottom-0">
          <div className="d-flex flex-column gap-1">
            <div>
              <span className="badge text-bg-secondary px-2 py-1 text-uppercase">{tableName}</span>
            </div>
            <h1 className="h2 fw-bold text-primary mb-0 mt-1">{recordTitle}</h1>
          </div>
        </div>

        <div className="card-body pt-0">
          {tableId && (
            <RecordDetailView databaseId={databaseId} tableId={tableId} recordId={recordId} />
          )}
        </div>
      </div>

      {tableId && (
        <ShareModal
          databaseId={databaseId}
          targetType="record"
          targetId={recordId}
          targetName={recordTitle}
          isOpen={isShareModalOpen}
          onClose={() => setIsShareModalOpen(false)}
        />
      )}
    </div>
  );
}
