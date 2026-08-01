import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { apiClient } from '../../lib/apiClient';
import { render } from '../../test/render';

/**
 * Captures the options the page passes to useBlocker so the test can ask the page
 * the same question the router would: "would leaving right now discard work?".
 */
let blockerOpts: { shouldBlockFn: () => boolean; enableBeforeUnload: () => boolean } | null = null;
let blockerResolver: any = { status: 'idle' };

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => () => ({}),
  useParams: () => ({ databaseId: 'db-1', tableId: 'tbl-1' }),
  useBlocker: (opts: any) => {
    blockerOpts = opts;
    return blockerResolver;
  },
}));

import StructureBuilder from '../builder.$databaseId.$tableId';

const mockDatabase = { id: 'db-1', name: 'Patrimoine', workspace_id: 'ws-1' };
const mockTable = { id: 'tbl-1', name: 'Ouvrages', database_id: 'db-1' };
const mockFields = [
  {
    id: 'f1',
    name: 'Titre',
    type: 'title',
    position: 0,
    options: {},
    validation: {},
    table_id: 'tbl-1',
  },
];

// The layout builder keys its columns by draft field id, which the page derives from the
// persisted id.
const mockViews = [
  {
    id: 'view-1',
    table_id: 'tbl-1',
    name: 'Fiche',
    type: 'card',
    config: { columnCount: 1, columns: [['draft-f1']] },
  },
];

function renderBuilder() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <StructureBuilder />
    </QueryClientProvider>
  );
}

describe('schema builder unsaved-changes guard', () => {
  beforeEach(() => {
    blockerOpts = null;
    blockerResolver = { status: 'idle' };
    vi.spyOn(apiClient, 'get').mockImplementation((url: string) => {
      if (url.startsWith('/databases/')) return Promise.resolve(mockDatabase) as any;
      if (url.startsWith('/tables/')) return Promise.resolve(mockTable) as any;
      if (url.startsWith('/fields?')) return Promise.resolve(mockFields) as any;
      if (url.startsWith('/tables?')) return Promise.resolve([mockTable]) as any;
      if (url.startsWith('/views')) return Promise.resolve(mockViews) as any;
      return Promise.resolve([]) as any;
    });
  });

  it('does not block navigation when the draft matches what was loaded', async () => {
    renderBuilder();

    expect(await screen.findByText('All changes saved')).toBeInTheDocument();
    expect(blockerOpts?.shouldBlockFn()).toBe(false);
    expect(blockerOpts?.enableBeforeUnload()).toBe(false);
  });

  it('blocks navigation and warns once a field is edited', async () => {
    const user = userEvent.setup();
    renderBuilder();

    const nameInput = await screen.findByLabelText('Field name');
    await user.type(nameInput, ' modifié');

    await waitFor(() => {
      expect(screen.getByText('Unsaved changes')).toBeInTheDocument();
    });

    // Both in-app navigation and tab close/reload must be guarded.
    expect(blockerOpts?.shouldBlockFn()).toBe(true);
    expect(blockerOpts?.enableBeforeUnload()).toBe(true);
  });

  it('blocks navigation once the layout tab holds unsaved edits', async () => {
    const user = userEvent.setup();
    renderBuilder();

    await user.click(await screen.findByTestId('layout-tab'));

    // The saved layout is loaded as-is, so nothing is at risk yet.
    const removeButton = await screen.findByTitle('Retirer');
    expect(blockerOpts?.shouldBlockFn()).toBe(false);

    // Pull the field out of its column without saving.
    await user.click(removeButton);

    await waitFor(() => {
      expect(blockerOpts?.shouldBlockFn()).toBe(true);
    });
    expect(blockerOpts?.enableBeforeUnload()).toBe(true);
  });

  it('offers to stay or leave when the router reports a blocked navigation', async () => {
    const user = userEvent.setup();
    const proceed = vi.fn();
    const reset = vi.fn();
    blockerResolver = { status: 'blocked', proceed, reset };

    renderBuilder();

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/have not been saved yet/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Stay on this page' }));
    expect(reset).toHaveBeenCalledTimes(1);
    expect(proceed).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Leave without saving' }));
    expect(proceed).toHaveBeenCalledTimes(1);
  });
});
