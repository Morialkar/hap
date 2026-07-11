import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SingleRecordPage } from '../navigation_.$databaseId.record.$recordId';
import { apiClient } from '../../lib/apiClient';
import { render } from '../../test/render';

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => () => ({
    useParams: () => ({ databaseId: 'db-1', recordId: 'rec-1' }),
  }),
  useParams: () => ({ databaseId: 'db-1' }),
  useNavigate: () => vi.fn(),
  Link: ({ children, to }: any) => <a href={to}>{children}</a>,
}));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

const mockRecord = {
  id: 'rec-1',
  table_id: 'tbl-1',
  data: {
    Nom: 'Badeaux',
  },
  version: 1,
};

const mockTable = {
  id: 'tbl-1',
  name: 'Auteurs',
  database_id: 'db-1',
};

const mockFields = [
  {
    id: 'f1',
    name: 'Nom',
    type: 'title',
    position: 0,
    options: {},
    validation: {},
  },
];

describe('SingleRecordPage Route', () => {
  beforeEach(() => {
    queryClient.clear();
    vi.restoreAllMocks();
  });

  it('renders table name, record title, and RecordDetailView', async () => {
    vi.spyOn(apiClient, 'get').mockImplementation((url) => {
      if (url.startsWith('/records/rec-1/referencing-records')) {
        return Promise.resolve({ data: [] });
      }
      if (url.startsWith('/records/rec-1')) {
        return Promise.resolve(mockRecord);
      }
      if (url.startsWith('/tables/tbl-1')) {
        return Promise.resolve(mockTable);
      }
      if (url.startsWith('/tables')) {
        return Promise.resolve([mockTable]);
      }
      if (url.startsWith('/fields?table_id=tbl-1')) {
        return Promise.resolve(mockFields);
      }
      if (url.startsWith('/views')) {
        return Promise.resolve({ data: [] });
      }
      return Promise.reject(new Error(`Unexpected URL: ${url}`));
    });


    render(
      <QueryClientProvider client={queryClient}>
        <SingleRecordPage />
      </QueryClientProvider>
    );

    // Verify it renders the table category badge
    await waitFor(() => {
      expect(screen.getByText('Auteurs')).toBeInTheDocument();
    });

    // Verify it renders the record title heading
    expect(screen.getByRole('heading', { name: 'Badeaux' })).toBeInTheDocument();

    // Verify the back button exists
    expect(screen.getByRole('button', { name: /Back|Retour/i })).toBeInTheDocument();
  });
});
