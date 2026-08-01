import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { apiClient } from '../../lib/apiClient';
import { render } from '../../test/render';

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => () => ({}),
  useParams: () => ({ databaseId: 'db-1', tableId: 'tbl-1' }),
  useNavigate: () => vi.fn(),
  Link: ({ children, to, ...props }: any) => {
    delete props.params;
    delete props.search;
    return (
      <a href={to} {...props}>
        {children}
      </a>
    );
  },
}));

import { ReportBuilderPage } from '../reports.$databaseId.$tableId';

const savedReport = {
  id: 'rep-1',
  table_id: 'tbl-1',
  name: 'Rapport sauvegarde',
  query: { select: ['Titre'], group_by: 'Ville', sort: [] },
  layout: {
    fields: [{ name: 'Titre', visible: true, order: 1 }],
    view_id: 'view-1',
    per_page: 10,
  },
};

const mockFields = [
  { id: 'f1', name: 'Titre', type: 'title', position: 0, options: {}, validation: {} },
  { id: 'f2', name: 'Ville', type: 'text', position: 1, options: {}, validation: {} },
];

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ReportBuilderPage />
    </QueryClientProvider>
  );
}

describe('report exports follow the on-screen configuration', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.spyOn(apiClient, 'get').mockImplementation((url: string) => {
      if (url.startsWith('/databases/'))
        return Promise.resolve({ id: 'db-1', name: 'Base' }) as any;
      if (url.startsWith('/tables/')) return Promise.resolve({ id: 'tbl-1', name: 'Table' }) as any;
      if (url.startsWith('/fields')) return Promise.resolve(mockFields) as any;
      if (url.startsWith('/reports')) return Promise.resolve([savedReport]) as any;
      if (url.startsWith('/views')) return Promise.resolve([]) as any;
      return Promise.resolve([]) as any;
    });
    vi.spyOn(apiClient, 'post').mockResolvedValue({ columns: ['Titre'], groups: [] } as any);

    fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => 'attachment; filename="rapport_apercu.csv"' },
      blob: async () => new Blob(['col']),
    });
    vi.stubGlobal('fetch', fetchMock);
    // The print tab queries this during render; jsdom does not provide it.
    window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as any;
    vi.stubGlobal('URL', {
      ...window.URL,
      createObjectURL: vi.fn(() => 'blob:mock'),
      revokeObjectURL: vi.fn(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('posts the live configuration instead of re-exporting the saved report', async () => {
    const user = userEvent.setup();
    renderPage();

    // Select the saved report: this is the case that used to bypass the live state.
    await user.click(await screen.findByRole('button', { name: /Rapport sauvegarde/ }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /CSV/ })).toBeEnabled();
    });

    await user.click(screen.getByRole('button', { name: /CSV/ }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    const [url, init] = fetchMock.mock.calls[0];
    // Previously this was GET /reports/rep-1/export/csv, which re-ran the *stored*
    // report and ignored anything edited since the last save.
    expect(url).toContain('/reports/preview/csv');
    expect(init.method).toBe('POST');

    const body = JSON.parse(init.body);
    expect(body.table_id).toBe('tbl-1');
    expect(body.query.select).toEqual(['Titre']);
    expect(body.layout.view_id).toBe('view-1');
  });

  it('sends the PDF export through the same live path', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('button', { name: /Rapport sauvegarde/ }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /PDF/ })).toBeEnabled();
    });

    await user.click(screen.getByRole('button', { name: /PDF/ }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/reports/preview/pdf');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body).name).toBe('Rapport sauvegarde');
  });
});
