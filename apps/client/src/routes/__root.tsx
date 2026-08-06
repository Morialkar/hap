import { createRootRoute, Outlet, Link, useNavigate, useLocation } from '@tanstack/react-router';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { TanStackRouterDevtools } from '@tanstack/router-devtools';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRepository } from '../contexts/RepositoryContext';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { AppearanceMenu } from '../components/AppearanceMenu';

export const Route = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
  const { isAuthenticated, isLoading, logout } = useAuth();
  const { t, locale, setLocale } = useI18n();
  const navigate = useNavigate();
  const repository = useRepository();
  const location = useLocation();
  const [isNavigationOpen, setIsNavigationOpen] = useState(false);

  const isLoginPage = location.pathname === '/login';
  const isPublicSharePage = location.pathname.startsWith('/public-shares/');
  const isTauriSpikePage = location.pathname === '/tauri-spike';
  const isBarePage = isLoginPage || isPublicSharePage || isTauriSpikePage;

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

  const databasesQuery = useQuery<Database[], Error>({
    queryKey: ['databases'],
    queryFn: () => repository.databases.list(),
    enabled: isAuthenticated,
  });

  const tablesQuery = useQuery<Table[], Error>({
    queryKey: ['tables'],
    queryFn: () => repository.tables.list(),
    enabled: isAuthenticated,
  });

  useEffect(() => {
    if (isLoading || isAuthenticated || isBarePage) return;

    const returnTo = location.pathname !== '/' ? location.pathname : null;
    navigate({ to: '/login', search: returnTo ? { returnTo } : undefined });
  }, [isAuthenticated, isLoading, isBarePage, location.pathname, navigate]);

  // The redirect effect owns navigation; avoid rendering protected content while it runs.
  if (!isLoading && !isAuthenticated && !isBarePage) {
    return null;
  }

  if (isLoading) {
    return (
      <div
        className="d-flex align-items-center justify-content-center"
        style={{ minHeight: '100vh' }}
      >
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (isBarePage) {
    return <Outlet />;
  }

  const handleLogout = async () => {
    await logout();
    navigate({ to: '/login' });
  };

  const toggleLocale = () => {
    setLocale(locale === 'fr' ? 'en' : 'fr');
  };

  return (
    <div className="page">
      <style>{`
        .hap-workspace-item {
          position: relative;
        }
        @media (min-width: 768px) {
          .nav-item.dropdown.hap-workspace-item:hover .dropdown-menu {
            display: block;
            margin-top: 0;
            position: absolute;
            top: 100%;
            left: 0;
            z-index: 1000;
          }
        }
      `}</style>
      <header className="navbar navbar-expand-md d-print-none hap-topbar">
        <div className="container-xl">
          <button
            type="button"
            className="navbar-toggler"
            aria-label={t('nav.toggle')}
            aria-controls="primary-navigation"
            aria-expanded={isNavigationOpen}
            onClick={() => setIsNavigationOpen((current) => !current)}
            data-testid="navigation-toggle"
          >
            <span className="navbar-toggler-icon" />
          </button>
          <Link to="/" className="navbar-brand navbar-brand-autodark">
            Heritage Archives Patrimoine
          </Link>
          <div className="navbar-nav flex-row order-md-last align-items-center gap-2">
            <AppearanceMenu />
            <button
              type="button"
              className="nav-link px-2"
              onClick={toggleLocale}
              aria-label={t('nav.changeLanguage')}
              data-testid="language-toggle"
            >
              {locale === 'fr' ? 'EN' : 'FR'}
            </button>
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm"
              onClick={handleLogout}
            >
              <i className="ti ti-logout me-1" aria-hidden="true" />
              <span className="d-none d-sm-inline">{t('nav.logout')}</span>
            </button>
          </div>
        </div>
      </header>
      <nav
        id="primary-navigation"
        className={`navbar navbar-expand-md hap-navbar ${
          isNavigationOpen ? 'd-block' : 'd-none d-md-flex'
        }`}
        aria-label={t('nav.primary')}
      >
        <div className="container-xl">
          <ul className="navbar-nav">
            <li className="nav-item">
              <Link
                to="/"
                className="nav-link"
                activeProps={{ className: 'nav-link active' }}
                onClick={() => setIsNavigationOpen(false)}
              >
                <i className="ti ti-home me-2" aria-hidden="true" />
                {t('nav.home')}
              </Link>
            </li>
            <li className="nav-item">
              <Link
                to="/workspaces"
                className="nav-link"
                activeProps={{ className: 'nav-link active' }}
                onClick={() => setIsNavigationOpen(false)}
              >
                <i className="ti ti-folders me-2" aria-hidden="true" />
                {t('nav.workspaces')}
              </Link>
            </li>
            {databasesQuery.data?.map((db: Database) => {
              const dbFrontTables = (tablesQuery.data ?? []).filter(
                (tbl) => tbl.is_front_facing && tbl.database_id === db.id
              );

              if (dbFrontTables.length === 0) return null;

              return (
                <li
                  className="nav-item dropdown hap-workspace-item text-nowrap ms-md-2 ms-0"
                  key={db.id}
                >
                  <a
                    className="nav-link dropdown-toggle cursor-pointer"
                    role="button"
                    data-bs-toggle="dropdown"
                    data-bs-auto-close="outside"
                    aria-expanded="false"
                  >
                    <i className="ti ti-folder me-2 text-muted" aria-hidden="true" />
                    {db.name}
                  </a>
                  <div className="dropdown-menu">
                    {dbFrontTables.map((tbl) => {
                      return (
                        <Link
                          key={tbl.id}
                          to="/navigation/$databaseId"
                          params={{ databaseId: db.id }}
                          search={{ tableId: tbl.id }}
                          className="dropdown-item d-flex align-items-center justify-content-between gap-3"
                          onClick={() => setIsNavigationOpen(false)}
                        >
                          <span>
                            <i className="ti ti-table me-2 text-muted" />
                            {tbl.name}
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                </li>
              );
            })}
            <li className="nav-item">
              <Link
                to="/ping"
                className="nav-link"
                activeProps={{ className: 'nav-link active' }}
                onClick={() => setIsNavigationOpen(false)}
              >
                <i className="ti ti-activity me-2" aria-hidden="true" />
                {t('nav.apiStatus')}
              </Link>
            </li>
          </ul>
        </div>
      </nav>
      <div className="page-wrapper">
        <main className="page-body">
          <div className="container-xl">
            <Outlet />
          </div>
        </main>
      </div>
      {import.meta.env.DEV && (
        <>
          <ReactQueryDevtools initialIsOpen={false} />
          <TanStackRouterDevtools />
        </>
      )}
    </div>
  );
}
