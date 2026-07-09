import { createRootRoute, Outlet, Link, useNavigate, useLocation } from '@tanstack/react-router';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { TanStackRouterDevtools } from '@tanstack/router-devtools';
import { useEffect, useState } from 'react';
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
  const location = useLocation();
  const [isNavigationOpen, setIsNavigationOpen] = useState(false);

  const isLoginPage = location.pathname === '/login';

  useEffect(() => {
    if (isLoading || isAuthenticated || isLoginPage) return;

    const returnTo = location.pathname !== '/' ? location.pathname : null;
    navigate({ to: '/login', search: returnTo ? { returnTo } : undefined });
  }, [isAuthenticated, isLoading, isLoginPage, location.pathname, navigate]);

  // The redirect effect owns navigation; avoid rendering protected content while it runs.
  if (!isLoading && !isAuthenticated && !isLoginPage) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="d-flex align-items-center justify-content-center" style={{ minHeight: '100vh' }}>
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (isLoginPage) {
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
            <button type="button" className="btn btn-outline-secondary btn-sm" onClick={handleLogout}>
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
