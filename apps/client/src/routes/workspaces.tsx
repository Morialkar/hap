import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useI18n } from '../contexts/I18nContext';
import { useAuth } from '../contexts/AuthContext';
import type { Template } from '@hap/core';
import { useRepository } from '../contexts/RepositoryContext';
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
  is_front_facing?: boolean;
}

interface WorkspaceMember {
  workspace_id: string;
  role: string;
}

interface WorkspaceUser {
  workspace_members?: WorkspaceMember[];
}

function Workspaces() {
  const { t } = useI18n();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const repository = useRepository();
  const [newDatabaseName, setNewDatabaseName] = useState('');
  const [templateDbNames, setTemplateDbNames] = useState<Record<string, string>>({});
  const [newTableNameByDatabase, setNewTableNameByDatabase] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<'empty' | 'template'>('empty');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const databasesQuery = useQuery<Database[], Error>({
    queryKey: ['databases'],
    queryFn: () => repository.databases.list(),
  });

  const tablesQuery = useQuery<Table[], Error>({
    queryKey: ['tables'],
    queryFn: () => repository.tables.list(),
  });

  const templatesQuery = useQuery<Template[], Error>({
    queryKey: ['templates'],
    queryFn: () => repository.templates.list(),
  });

  // Find user owner workspace, fallback to first workspace or generate a new workspace UUID
  const workspaceUser = user as WorkspaceUser | null;
  const workspaceMember =
    workspaceUser?.workspace_members?.find((member) => member.role === 'owner') ||
    workspaceUser?.workspace_members?.[0];
  const workspaceId =
    workspaceMember?.workspace_id || databasesQuery.data?.[0]?.workspace_id || generateId();

  const createDatabase = useMutation({
    mutationFn: (name: string) => repository.databases.create({ name, workspace_id: workspaceId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['databases'] });
      setSuccessMsg(null);
      setErrorMsg(null);
    },
    onError: (err) => {
      setErrorMsg(err.message || 'Error creating database');
    },
  });

  const installTemplate = useMutation({
    mutationFn: ({ template, dbName }: { template: Template; dbName: string }) => {
      const payload = { ...template.payload };
      payload.database = { ...payload.database, name: dbName };
      return repository.templates.install(workspaceId, {
        format_version: template.format_version,
        template_version: template.template_version,
        name: dbName,
        payload,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['databases'] });
      queryClient.invalidateQueries({ queryKey: ['tables'] });
      setSuccessMsg(t('workspaces.installSuccess'));
      setErrorMsg(null);
    },
    onError: (err) => {
      setErrorMsg(err.message || 'Error installing template');
      setSuccessMsg(null);
    },
  });

  const createTable = useMutation({
    mutationFn: ({ databaseId, name }: { databaseId: string; name: string }) =>
      repository.tables.create({ name, database_id: databaseId }),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['tables'] });
      setNewTableNameByDatabase((prev) => ({ ...prev, [vars.databaseId]: '' }));
    },
  });

  const updateTable = useMutation({
    mutationFn: ({ id, isFrontFacing }: { id: string; isFrontFacing: boolean }) =>
      repository.tables.update(id, { is_front_facing: isFrontFacing }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tables'] });
    },
  });

  const isLoading = databasesQuery.isLoading || tablesQuery.isLoading;

  const tablesByDatabase = (tablesQuery.data ?? []).reduce<Record<string, Table[]>>(
    (acc, table) => {
      if (!acc[table.database_id]) acc[table.database_id] = [];
      acc[table.database_id].push(table);
      return acc;
    },
    {}
  );

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

      {errorMsg && (
        <div className="alert alert-danger alert-dismissible" role="alert">
          <div className="d-flex">
            <div>
              <i className="ti ti-alert-triangle me-2" />
            </div>
            <div>{errorMsg}</div>
          </div>
          <button
            type="button"
            className="btn-close"
            onClick={() => setErrorMsg(null)}
            aria-label="Close"
          />
        </div>
      )}

      {successMsg && (
        <div className="alert alert-success alert-dismissible" role="alert">
          <div className="d-flex">
            <div>
              <i className="ti ti-check me-2" />
            </div>
            <div>{successMsg}</div>
          </div>
          <button
            type="button"
            className="btn-close"
            onClick={() => setSuccessMsg(null)}
            aria-label="Close"
          />
        </div>
      )}

      <SurfaceCard className="mb-4">
        <div className="card-header">
          <ul className="nav nav-tabs card-header-tabs" data-bs-toggle="tabs">
            <li className="nav-item">
              <button
                type="button"
                className={`nav-link ${activeTab === 'empty' ? 'active' : ''}`}
                onClick={() => {
                  setActiveTab('empty');
                  setErrorMsg(null);
                  setSuccessMsg(null);
                }}
              >
                <i className="ti ti-database me-2" />
                {t('workspaces.newDatabase.placeholder')}
              </button>
            </li>
            <li className="nav-item">
              <button
                type="button"
                className={`nav-link ${activeTab === 'template' ? 'active' : ''}`}
                onClick={() => {
                  setActiveTab('template');
                  setErrorMsg(null);
                  setSuccessMsg(null);
                }}
              >
                <i className="ti ti-template me-2" />
                {t('workspaces.createFromTemplate')}
              </button>
            </li>
          </ul>
        </div>
        <div className="card-body">
          {activeTab === 'empty' ? (
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
                {createDatabase.isPending ? t('common.loading') : t('common.create')}
              </button>
            </div>
          ) : (
            <div>
              {templatesQuery.isLoading ? (
                <div className="d-flex justify-content-center p-3">
                  <LoadingSpinner size="md" />
                </div>
              ) : (templatesQuery.data ?? []).length === 0 ? (
                <div className="text-muted text-center p-3">Aucun modèle disponible.</div>
              ) : (
                <div className="row row-cards">
                  {(templatesQuery.data ?? []).map((template) => {
                    const dbName =
                      templateDbNames[template.id] !== undefined
                        ? templateDbNames[template.id]
                        : template.name;
                    const isLiterary = template.name.toLowerCase().includes('litt');
                    const iconClass = isLiterary ? 'ti-books text-azure' : 'ti-soup text-orange';
                    const translationKey = isLiterary
                      ? 'workspaces.template.literary'
                      : 'workspaces.template.recipe';

                    return (
                      <div className="col-md-6" key={template.id}>
                        <div
                          className="card h-100 border-0 shadow-sm"
                          style={{ background: 'var(--tblr-bg-surface-secondary)' }}
                        >
                          <div className="card-body d-flex flex-column">
                            <div className="d-flex align-items-center mb-3">
                              <span className="avatar avatar-md bg-transparent me-3">
                                <i className={`ti ${iconClass} fs-1`} />
                              </span>
                              <div>
                                <h3 className="card-title mb-0">{t(translationKey)}</h3>
                                <div className="text-muted small">v{template.template_version}</div>
                              </div>
                            </div>
                            <p className="text-muted flex-grow-1">{template.description}</p>

                            <div className="mt-3">
                              <label className="form-label small text-muted">
                                Nom de la base de données
                              </label>
                              <div className="input-group">
                                <input
                                  type="text"
                                  className="form-control"
                                  value={dbName}
                                  onChange={(e) =>
                                    setTemplateDbNames((prev) => ({
                                      ...prev,
                                      [template.id]: e.target.value,
                                    }))
                                  }
                                  placeholder={template.name}
                                />
                                <button
                                  type="button"
                                  className="btn btn-primary"
                                  onClick={() =>
                                    installTemplate.mutate({ template, dbName: dbName.trim() })
                                  }
                                  disabled={!dbName.trim() || installTemplate.isPending}
                                >
                                  {installTemplate.isPending
                                    ? t('workspaces.installing')
                                    : t('workspaces.install')}
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
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
                  <div className="d-flex align-items-center gap-2">
                    <h2 className="h4 mb-0">{database.name}</h2>
                    <Link
                      to="/shares/$databaseId"
                      params={{ databaseId: database.id }}
                      className="btn btn-sm btn-ghost-secondary px-2 py-0 border-0"
                      title="Gérer les liens de partage"
                    >
                      <i className="ti ti-share me-1" />
                      Partages
                    </Link>
                  </div>
                  <span className="text-muted small">
                    {tables.length} {t('workspaces.tables.count')}
                  </span>
                </div>
                <div className="card-body">
                  <div className="list-group list-group-flush mb-3">
                    {tables.length === 0 ? (
                      <div className="list-group-item text-muted">
                        {t('workspaces.tables.empty')}
                      </div>
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
                          <div className="d-flex align-items-center gap-3">
                            <div
                              className="form-check form-switch mb-0"
                              title={t('workspaces.table.isFrontFacing')}
                            >
                              <input
                                className="form-check-input cursor-pointer"
                                type="checkbox"
                                role="switch"
                                id={`front-facing-${table.id}`}
                                checked={table.is_front_facing ?? false}
                                onChange={(e) =>
                                  updateTable.mutate({
                                    id: table.id,
                                    isFrontFacing: e.target.checked,
                                  })
                                }
                                disabled={updateTable.isPending}
                                aria-label={t('workspaces.table.isFrontFacing')}
                              />
                              <label
                                className="form-check-label small text-muted ms-1 d-none d-sm-inline"
                                htmlFor={`front-facing-${table.id}`}
                              >
                                {t('workspaces.table.isFrontFacing')}
                              </label>
                            </div>
                            <Link
                              to="/builder/$databaseId/$tableId"
                              params={{ databaseId: database.id, tableId: table.id }}
                              className="btn btn-sm btn-outline-secondary"
                            >
                              {t('workspaces.builder.action')}
                            </Link>
                            <Link
                              to="/reports/$databaseId/$tableId"
                              params={{ databaseId: database.id, tableId: table.id }}
                              className="btn btn-sm btn-outline-secondary ms-2"
                            >
                              <i className="ti ti-chart-bar me-1" aria-hidden="true" />
                              {t('workspaces.reports.action')}
                            </Link>
                          </div>
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
