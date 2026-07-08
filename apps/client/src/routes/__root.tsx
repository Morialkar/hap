import { createRootRoute, Outlet, Link } from '@tanstack/react-router';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { TanStackRouterDevtools } from '@tanstack/router-devtools';

export const Route = createRootRoute({
  component: () => (
    <>
      <nav className="navbar navbar-expand-lg navbar-dark bg-dark">
        <div className="container-xl">
          <Link to="/" className="navbar-brand">
            Heritage Archives Patrimoine
          </Link>
          <div className="navbar-nav">
            <Link to="/" className="nav-link" activeProps={{ className: 'nav-link active' }}>
              Home
            </Link>
            <Link to="/ping" className="nav-link" activeProps={{ className: 'nav-link active' }}>
              API Status
            </Link>
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
    </>
  ),
});
