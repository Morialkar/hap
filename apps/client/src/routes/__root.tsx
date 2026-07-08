import { createRootRoute, Outlet, Link, useNavigate, useLocation } from '@tanstack/react-router';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { TanStackRouterDevtools } from '@tanstack/router-devtools';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';
import { useTheme } from '../contexts/ThemeContext';
import { LoadingSpinner } from '../components/LoadingSpinner';

export const Route = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
  const { isAuthenticated, isLoading, logout } = useAuth();
  const { t, locale, setLocale } = useI18n();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const isLoginPage = location.pathname === '/login';

  // Redirect to login if not authenticated
  if (!isLoading && !isAuthenticated && !isLoginPage) {
    const returnTo = location.pathname !== '/' ? location.pathname : null;
    navigate({ to: '/login', search: returnTo ? { returnTo } : undefined });
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
    <div className="app-shell">
      <nav className="navbar navbar-expand-lg navbar-dark bg-dark">
        <div className="container-xl">
          <Link to="/" className="navbar-brand">
            Heritage Archives Patrimoine
          </Link>
          <button
            className="navbar-toggler"
            type="button"
            data-bs-toggle="collapse"
            data-bs-target="#navbarNav"
          >
            <span className="navbar-toggler-icon"></span>
          </button>
          <div className="collapse navbar-collapse" id="navbarNav">
            <ul className="navbar-nav me-auto">
              <li className="nav-item">
                <Link to="/" className="nav-link" activeProps={{ className: 'nav-link active' }}>
                  {t('nav.home')}
                </Link>
              </li>
              <li className="nav-item">
                <Link to="/workspaces" className="nav-link" activeProps={{ className: 'nav-link active' }}>
                  {t('nav.workspaces')}
                </Link>
              </li>
              <li className="nav-item">
                <Link to="/ping" className="nav-link" activeProps={{ className: 'nav-link active' }}>
                  {t('nav.apiStatus')}
                </Link>
              </li>
            </ul>
            <div className="d-flex align-items-center gap-3">
              <button
                className="btn btn-link text-white nav-link"
                onClick={toggleTheme}
                style={{ textDecoration: 'none' }}
                title="Toggle theme"
              >
                {theme === 'light' ? '🌙' : theme === 'dark' ? '🌞' : '🌿'}
              </button>
              <button
                className="btn btn-link text-white nav-link"
                onClick={toggleLocale}
                style={{ textDecoration: 'none' }}
              >
                {locale === 'fr' ? 'EN' : 'FR'}
              </button>
              <button
                className="btn btn-outline-light btn-sm"
                onClick={handleLogout}
              >
                {t('nav.logout')}
              </button>
            </div>
          </div>
        </div>
      </nav>
      <main className="container-xl py-4">
        <Outlet />
      </main>
      {import.meta.env.DEV && (
        <>
          <ReactQueryDevtools initialIsOpen={false} />
          <TanStackRouterDevtools />
        </>
      )}
    </div>
  );
}
