import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useI18n } from '../contexts/I18nContext';
import { useRepository } from '../contexts/RepositoryContext';
import { PageHeader } from '../components/ui/PageHeader';
import { SurfaceCard } from '../components/ui/SurfaceCard';
import { LoadingSpinner } from '../components/LoadingSpinner';

export const Route = createFileRoute('/')({
  component: HomePage,
});

interface Database {
  id: string;
  name: string;
  workspace_id: string;
}

interface Table {
  id: string;
  name: string;
  database_id: string;
  is_front_facing?: boolean;
}

function HomePage() {
  const repository = useRepository();
  const { t } = useI18n();

  const databasesQuery = useQuery<Database[], Error>({
    queryKey: ['databases'],
    queryFn: () => repository.databases.list(),
  });

  const tablesQuery = useQuery<Table[], Error>({
    queryKey: ['tables'],
    queryFn: () => repository.tables.list(),
  });

  const isLoading = databasesQuery.isLoading || tablesQuery.isLoading;

  const frontFacingTables = useMemo(() => {
    return (tablesQuery.data ?? []).filter((table) => table.is_front_facing);
  }, [tablesQuery.data]);

  const databasesMap = useMemo(() => {
    return new Map((databasesQuery.data ?? []).map((db) => [db.id, db]));
  }, [databasesQuery.data]);

  if (isLoading) {
    return (
      <div className="d-flex justify-content-center p-5">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Heritage Archives Patrimoine"
        description="Open-source platform for cataloguing and preserving literary and cultural heritage collections."
      />

      <div className="row row-cards mt-4">
        {frontFacingTables.map((table) => {
          const db = databasesMap.get(table.database_id);
          const dbName = db ? db.name : 'Archive';

          return (
            <div className="col-md-4" key={table.id}>
              <SurfaceCard
                className="h-100 border-0 shadow-sm"
                style={{ background: 'var(--tblr-bg-surface-secondary)' }}
              >
                <div
                  className="card-body d-flex flex-column justify-content-between h-100"
                  style={{ minHeight: 140 }}
                >
                  <div>
                    <div className="text-muted small text-uppercase fw-bold mb-1">{dbName}</div>
                    <h3 className="card-title mb-3 fs-2">{table.name}</h3>
                  </div>
                  <div>
                    <Link
                      to="/navigation/$databaseId"
                      params={{ databaseId: table.database_id }}
                      search={{ tableId: table.id }}
                      className="btn btn-primary w-100"
                    >
                      <i className="ti ti-eye me-1" aria-hidden="true" />
                      {t('navigation.browse')}
                    </Link>
                  </div>
                </div>
              </SurfaceCard>
            </div>
          );
        })}

        {/* API Status card - always ends the list */}
        <div className="col-md-4">
          <SurfaceCard className="h-100">
            <div
              className="card-body d-flex flex-column justify-content-between h-100"
              style={{ minHeight: 140 }}
            >
              <div>
                <div className="text-muted small text-uppercase fw-bold mb-1">System</div>
                <h3 className="card-title mb-3 fs-2">API Status</h3>
              </div>
              <div>
                <Link to="/ping" className="btn btn-outline-secondary w-100">
                  View status
                </Link>
              </div>
            </div>
          </SurfaceCard>
        </div>
      </div>
    </div>
  );
}
