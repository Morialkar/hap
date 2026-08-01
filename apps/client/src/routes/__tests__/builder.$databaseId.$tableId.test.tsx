import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import StructureBuilder from '../builder.$databaseId.$tableId';
import { apiClient } from '../../lib/apiClient';
import { render } from '../../test/render';

// Captures the options the page passes to useBlocker, so a test can ask the page the
// same question the router would: "would leaving right now discard work?".
let blockerOpts: { shouldBlockFn: () => boolean } | null = null;

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => () => ({}),
  useParams: () => ({ databaseId: 'db-1', tableId: 'tbl-1' }),
  useBlocker: (opts: any) => {
    blockerOpts = opts;
    return { status: 'idle' };
  },
}));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false },
  },
});

const mockDatabase = { id: 'db-1', name: 'Patrimoine', workspace_id: 'ws-1' };
const mockTable = { id: 'tbl-1', name: 'Auteurs', database_id: 'db-1' };

function renderBuilder() {
  return render(
    <QueryClientProvider client={queryClient}>
      <StructureBuilder />
    </QueryClientProvider>
  );
}

describe('StructureBuilder save', () => {
  beforeEach(() => {
    queryClient.clear();
    vi.restoreAllMocks();
  });

  it('does not re-POST a field created in the same session on a second save', async () => {
    const user = userEvent.setup();
    const serverFields: Record<string, unknown>[] = [];

    vi.spyOn(apiClient, 'get').mockImplementation((url: string) => {
      if (url.startsWith('/databases/db-1')) return Promise.resolve(mockDatabase);
      if (url.startsWith('/tables/tbl-1')) return Promise.resolve(mockTable);
      if (url.startsWith('/tables?database_id=db-1')) return Promise.resolve([mockTable]);
      if (url.startsWith('/fields?table_id=tbl-1')) return Promise.resolve(serverFields);
      return Promise.reject(new Error(`Unexpected URL: ${url}`));
    });

    const post = vi.spyOn(apiClient, 'post').mockImplementation((_url, data) => {
      const created = { ...(data as Record<string, unknown>), id: 'field-created-1' };
      serverFields.push(created);
      return Promise.resolve(created);
    });

    const put = vi.spyOn(apiClient, 'put').mockImplementation((_url, data) => {
      return Promise.resolve({ ...(data as Record<string, unknown>), id: 'field-created-1' });
    });

    renderBuilder();

    await waitFor(() => {
      expect(screen.getByTestId('add-field-text')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('add-field-text'));

    const saveButton = screen.getByRole('button', { name: /save/i });

    await user.click(saveButton);
    await waitFor(() => {
      expect(post).toHaveBeenCalledTimes(1);
    });
    expect(post).toHaveBeenCalledWith('/fields', expect.objectContaining({ type: 'text' }));

    await user.click(saveButton);
    await waitFor(() => {
      expect(put).toHaveBeenCalledTimes(1);
    });

    // The field was created once and updated on the second save — never POSTed twice.
    expect(post).toHaveBeenCalledTimes(1);
    expect(put).toHaveBeenCalledWith(
      '/fields/field-created-1',
      expect.objectContaining({ type: 'text' })
    );

    // The saved field is no longer an unsaved change.
    expect(blockerOpts?.shouldBlockFn()).toBe(false);
  });

  it('keeps a field whose save failed as new and unsaved', async () => {
    const user = userEvent.setup();

    vi.spyOn(apiClient, 'get').mockImplementation((url: string) => {
      if (url.startsWith('/databases/db-1')) return Promise.resolve(mockDatabase);
      if (url.startsWith('/tables/tbl-1')) return Promise.resolve(mockTable);
      if (url.startsWith('/tables?database_id=db-1')) return Promise.resolve([mockTable]);
      if (url.startsWith('/fields?table_id=tbl-1')) return Promise.resolve([]);
      return Promise.reject(new Error(`Unexpected URL: ${url}`));
    });

    // The text field is accepted; the number field is rejected by the server.
    const post = vi.spyOn(apiClient, 'post').mockImplementation((_url, data) => {
      const payload = data as Record<string, unknown>;
      if (payload.type === 'number') return Promise.reject(new Error('boom'));
      return Promise.resolve({ ...payload, id: 'field-created-1' });
    });

    const put = vi.spyOn(apiClient, 'put').mockImplementation((_url, data) => {
      return Promise.resolve({ ...(data as Record<string, unknown>), id: 'field-created-1' });
    });

    renderBuilder();

    await waitFor(() => {
      expect(screen.getByTestId('add-field-text')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('add-field-text'));
    await user.click(screen.getByTestId('add-field-number'));

    const saveButton = screen.getByRole('button', { name: /save/i });

    await user.click(saveButton);
    await waitFor(() => {
      expect(post).toHaveBeenCalledTimes(2);
    });

    // The failed field never reached the server, so it stays an unsaved change.
    await waitFor(() => {
      expect(blockerOpts?.shouldBlockFn()).toBe(true);
    });

    await user.click(saveButton);
    await waitFor(() => {
      expect(put).toHaveBeenCalledTimes(1);
    });

    // The one that saved is updated; the one that failed is retried as a create.
    expect(put).toHaveBeenCalledWith(
      '/fields/field-created-1',
      expect.objectContaining({ type: 'text' })
    );
    expect(post).toHaveBeenCalledTimes(3);
    expect(post).toHaveBeenLastCalledWith('/fields', expect.objectContaining({ type: 'number' }));
  });
});
