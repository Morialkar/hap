import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useI18n } from '../contexts/I18nContext';
import { apiClient } from '../lib/apiClient';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { generateId } from '../lib/id';
import { EmptyState } from '../components/ui/EmptyState';
import { PageHeader } from '../components/ui/PageHeader';
import { SurfaceCard } from '../components/ui/SurfaceCard';

export const Route = createFileRoute('/workspaces')({
  component: Workspaces,
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
}

function Workspaces() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [newDatabaseName, setNewDatabaseName] = useState('');
  const [newTableNameByDatabase, setNewTableNameByDatabase] = useState<Record<string, string>>({});

  const databasesQuery = useQuery<Database[], Error>({
    queryKey: ['databases'],
    queryFn: () => apiClient.get('/databases'),
  });

  const tablesQuery = useQuery<Table[], Error>({
    queryKey: ['tables'],
    queryFn: () => apiClient.get('/tables'),
  });

  const createDatabase = useMutation({
    mutationFn: (name: string) => apiClient.post<Database>('/databases', { name, workspace_id: generateId() }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['databases'] }),
  });

  const createTable = useMutation({
    mutationFn: ({ databaseId, name }: { databaseId: string; name: string }) =>
      apiClient.post<Table>('/tables', { name, database_id: databaseId }),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['tables'] });
      setNewTableNameByDatabase((prev) => ({ ...prev, [vars.databaseId]: '' }));
    },
  });

  const isLoading = databasesQuery.isLoading || tablesQuery.isLoading;

  const tablesByDatabase = (tablesQuery.data ?? []).reduce<Record<string, Table[]>>((acc, table) => {
    if (!acc[table.database_id]) acc[table.database_id] = [];
    acc[table.database_id].push(table);
    return acc;
  }, {});

  if (isLoading) {
    return (
      <div className="d-flex justify-content-center p-5">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title={t('nav.workspaces')} />

      <SurfaceCard className="mb-4">
        <div className="card-header">
          <h2 className="card-title mb-0">{t('common.create')}</h2>
        </div>
        <div className="card-body">
          <div className="input-group">
            <input
              type="text"
              className="form-control"
              placeholder={t('workspaces.newDatabase.placeholder')}
              value={newDatabaseName}
              onChange={(e) => setNewDatabaseName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newDatabaseName.trim()) {
                  createDatabase.mutate(newDatabaseName.trim());
                  setNewDatabaseName('');
                }
              }}
            />
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                if (newDatabaseName.trim()) {
                  createDatabase.mutate(newDatabaseName.trim());
                  setNewDatabaseName('');
                }
              }}
              disabled={!newDatabaseName.trim() || createDatabase.isPending}
            >
              {t('common.create')}
            </button>
          </div>
        </div>
      </SurfaceCard>

      {(databasesQuery.data ?? []).length === 0 ? (
        <SurfaceCard>
          <EmptyState
            icon="database-off"
            title={t('workspaces.empty.title')}
            description={t('workspaces.empty.message')}
          />
        </SurfaceCard>
      ) : (
        <div className="vstack gap-3">
          {(databasesQuery.data ?? []).map((database) => {
            const tables = tablesByDatabase[database.id] ?? [];
            const tableName = newTableNameByDatabase[database.id] ?? '';

            return (
              <SurfaceCard key={database.id}>
                <div className="card-header d-flex justify-content-between align-items-center">
                  <h2 className="h4 mb-0">{database.name}</h2>
                  <span className="text-muted small">
                    {tables.length} {t('workspaces.tables.count')}
                  </span>
                </div>
                <div className="card-body">
                  <div className="list-group list-group-flush mb-3">
                    {tables.length === 0 ? (
                      <div className="list-group-item text-muted">{t('workspaces.tables.empty')}</div>
                    ) : (
                      tables.map((table) => (
                        <div
                          key={table.id}
                          className="list-group-item d-flex justify-content-between align-items-center"
                        >
                          <Link
                            to="/tables/$databaseId/$tableId"
                            params={{ databaseId: database.id, tableId: table.id }}
                            search={{ action: undefined, recordId: undefined }}
                            className="fw-medium text-decoration-none text-dark"
                          >
                            <i className="ti ti-table me-2 text-muted" aria-hidden="true" />
                            {table.name}
                          </Link>
                          <Link
                            to="/builder/$databaseId/$tableId"
                            params={{ databaseId: database.id, tableId: table.id }}
                            className="btn btn-sm btn-outline-secondary"
                          >
                            {t('workspaces.builder.action')}
                          </Link>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="input-group input-group-sm">
                    <input
                      type="text"
                      className="form-control"
                      placeholder={t('workspaces.newTable.placeholder')}
                      value={tableName}
                      onChange={(e) =>
                        setNewTableNameByDatabase((prev) => ({
                          ...prev,
                          [database.id]: e.target.value,
                        }))
                      }
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && tableName.trim()) {
                          createTable.mutate({ databaseId: database.id, name: tableName.trim() });
                        }
                      }}
                    />
                    <button
                      type="button"
                      className="btn btn-outline-secondary"
                      onClick={() => {
                        if (tableName.trim()) {
                          createTable.mutate({ databaseId: database.id, name: tableName.trim() });
                        }
                      }}
                      disabled={!tableName.trim() || createTable.isPending}
                    >
                      {t('common.create')}
                    </button>
                  </div>
                </div>
              </SurfaceCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
