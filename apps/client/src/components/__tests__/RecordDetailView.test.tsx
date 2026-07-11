import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RecordDetailView } from '../RecordDetailView';
import { apiClient } from '../../lib/apiClient';
import { render } from '../../test/render';
import { type BuilderField } from '../../lib/fieldTypes';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, params, search, ...props }: any) => {
    return <a href={to} {...props}>{children}</a>;
  },
}));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

const mockFields: BuilderField[] = [
  {
    id: 'f1',
    name: 'Nom',
    type: 'title',
    position: 0,
    options: {},
    validation: { required: true },
  },
  {
    id: 'f2',
    name: 'Description',
    type: 'long_text',
    position: 1,
    options: {},
    validation: {},
  },
];

const mockRecord = {
  id: 'rec-1',
  table_id: 'tbl-1',
  data: {
    Nom: 'Badeaux',
    Description: 'Auteur québécois du 19e siècle.',
  },
  version: 1,
};

const mockReferencingRecords = {
  data: [
    {
      record_id: 'rec-2',
      table_id: 'tbl-2',
      field_id: 'f3',
      field_name: 'auteur',
      record_data: {
        Titre: 'Histoire du Canada',
      },
    },
  ],
};

const mockReferencingFields: BuilderField[] = [
  {
    id: 'f3',
    name: 'auteur',
    type: 'reference',
    position: 0,
    options: { target_table: 'tbl-1' },
    validation: {},
  },
  {
    id: 'f4',
    name: 'Titre',
    type: 'title',
    position: 1,
    options: {},
    validation: {},
  },
];

describe('RecordDetailView', () => {
  beforeEach(() => {
    queryClient.clear();
    vi.restoreAllMocks();
  });

  it('renders record fields and referencing records', async () => {
    vi.spyOn(apiClient, 'get').mockImplementation((url) => {
      if (url.startsWith('/fields?table_id=tbl-1')) {
        return Promise.resolve(mockFields);
      }
      if (url.startsWith('/fields?table_id=tbl-2')) {
        return Promise.resolve(mockReferencingFields);
      }
      if (url.startsWith('/views')) {
        return Promise.resolve({ data: [] });
      }
      if (url.startsWith('/records/rec-1/referencing-records')) {
        return Promise.resolve(mockReferencingRecords);
      }
      if (url.startsWith('/records/rec-1')) {
        return Promise.resolve(mockRecord);
      }
      if (url.startsWith('/tables')) {
        return Promise.resolve([
          { id: 'tbl-1', name: 'Auteurs' },
          { id: 'tbl-2', name: 'Ouvrages' },
        ]);
      }
      return Promise.reject(new Error(`Unexpected URL: ${url}`));
    });

    render(
      <QueryClientProvider client={queryClient}>
        <RecordDetailView databaseId="db-1" tableId="tbl-1" recordId="rec-1" />
      </QueryClientProvider>
    );

    // Verify record fields are loaded
    await waitFor(() => {
      expect(screen.getByText('Badeaux')).toBeInTheDocument();
    });
    expect(screen.getByText('Auteur québécois du 19e siècle.')).toBeInTheDocument();

    // Verify referencing records section (Fiches associées) is loaded
    await waitFor(() => {
      expect(screen.getByText('Fiches associées (1)')).toBeInTheDocument();
    });
    expect(screen.getByText('Histoire du Canada')).toBeInTheDocument();
    expect(screen.getByText('Ouvrages')).toHaveClass('hap-referencing-record-table');
    expect(screen.getByText('auteur')).toBeInTheDocument();
    expect(screen.getByText('Histoire du Canada').closest('.hap-referencing-record-title')).not.toBeNull();
  });
});
