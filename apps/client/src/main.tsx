import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider, createRouter } from '@tanstack/react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { routeTree } from './routeTree.gen';
import { AuthProvider } from './contexts/AuthContext';
import { I18nProvider } from './contexts/I18nContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import './styles/app.scss';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000 },
  },
});

const router = createRouter({ routeTree, context: {} });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

async function bootstrap() {
  try {
    const res = await fetch('/app-config', { credentials: 'same-origin' });
    if (res.ok) {
      window.__APP__ = await (res.json() as Promise<NonNullable<Window['__APP__']>>);
    }
  } catch {
    // Dev mode with Vite proxy may not have /app-config — fall back to defaults
    window.__APP__ = { apiBase: '/api/v1', locale: 'fr' };
  }

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ErrorBoundary>
        <ThemeProvider>
          <I18nProvider>
            <AuthProvider>
              <QueryClientProvider client={queryClient}>
                <RouterProvider router={router} />
              </QueryClientProvider>
            </AuthProvider>
          </I18nProvider>
        </ThemeProvider>
      </ErrorBoundary>
    </StrictMode>
  );
}

void bootstrap();
