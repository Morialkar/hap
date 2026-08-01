import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { CardLayoutBuilder } from '../CardLayoutBuilder';
import { type BuilderField } from '../../lib/fieldTypes';
import { render } from '../../test/render';
import { apiClient } from '../../lib/apiClient';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mockFields: BuilderField[] = [
  { id: 'f1', name: 'Author', type: 'text', position: 0, options: {}, validation: {} },
  { id: 'f2', name: 'Pages', type: 'number', position: 1, options: {}, validation: {} },
];

const mockViews = [
  {
    id: 'view-1',
    table_id: 'tbl-1',
    name: 'Card View 1',
    type: 'card',
    config: {
      columnCount: 2,
      columns: [['f1'], ['f2']],
    },
  },
];

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

describe('CardLayoutBuilder', () => {
  it('allows removing a field from a layout column back to unassigned list via remove button', async () => {
    vi.spyOn(apiClient, 'get').mockImplementation((url) => {
      if (url.startsWith('/views')) {
        return Promise.resolve(mockViews);
      }
      return Promise.reject(new Error('Unexpected URL'));
    });

    render(
      <QueryClientProvider client={queryClient}>
        <CardLayoutBuilder tableId="tbl-1" fields={mockFields} />
      </QueryClientProvider>
    );

    // Wait for the view to load and be selected
    await waitFor(() => {
      const select = screen.getByRole('combobox') as HTMLSelectElement;
      expect(select.value).toBe('view-1');
    });

    // Check that fields are rendered in layout
    expect(screen.getByText('Author')).toBeInTheDocument();
    expect(screen.getByText('Pages')).toBeInTheDocument();

    // Verify there is a "Retirer" button for the assigned fields
    const removeButtons = screen.getAllByTitle('Retirer');
    expect(removeButtons).toHaveLength(2);

    // Click the first remove button
    fireEvent.click(removeButtons[0]);

    // Author should now be moved to unassigned, and only 1 remove button (for Pages) should remain
    await waitFor(() => {
      expect(screen.getAllByTitle('Retirer')).toHaveLength(1);
    });
  });
});

describe('CardLayoutBuilder unsaved-changes signal', () => {
  function renderBuilder(onDirtyChange: (isDirty: boolean) => void) {
    // A fresh client per test, so a cached view list cannot leak between them.
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
      <QueryClientProvider client={client}>
        <CardLayoutBuilder tableId="tbl-1" fields={mockFields} onDirtyChange={onDirtyChange} />
      </QueryClientProvider>
    );
  }

  /** Wait for the saved view to load, then report the last dirty value seen. */
  async function lastDirty(onDirtyChange: ReturnType<typeof vi.fn>) {
    await waitFor(() => {
      expect(screen.getAllByTitle('Retirer')).toHaveLength(2);
    });
    return onDirtyChange.mock.calls.at(-1)?.[0];
  }

  beforeEach(() => {
    vi.spyOn(apiClient, 'get').mockImplementation((url) => {
      if (url.startsWith('/views')) {
        return Promise.resolve(mockViews);
      }
      return Promise.reject(new Error('Unexpected URL'));
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reports clean while the working layout still matches the saved view', async () => {
    const onDirtyChange = vi.fn();
    renderBuilder(onDirtyChange);

    expect(await lastDirty(onDirtyChange)).toBe(false);
  });

  it('reports dirty once a field is moved out of a column', async () => {
    const onDirtyChange = vi.fn();
    renderBuilder(onDirtyChange);

    expect(await lastDirty(onDirtyChange)).toBe(false);

    fireEvent.click(screen.getAllByTitle('Retirer')[0]);

    await waitFor(() => {
      expect(onDirtyChange.mock.calls.at(-1)?.[0]).toBe(true);
    });
  });

  it('reports dirty once the column count changes', async () => {
    const onDirtyChange = vi.fn();
    renderBuilder(onDirtyChange);

    expect(await lastDirty(onDirtyChange)).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: '3 columns' }));

    await waitFor(() => {
      expect(onDirtyChange.mock.calls.at(-1)?.[0]).toBe(true);
    });
  });

  it('reports clean again once the layout is saved', async () => {
    const put = vi.spyOn(apiClient, 'put').mockResolvedValue({});
    const onDirtyChange = vi.fn();
    renderBuilder(onDirtyChange);

    expect(await lastDirty(onDirtyChange)).toBe(false);

    fireEvent.click(screen.getAllByTitle('Retirer')[0]);
    await waitFor(() => {
      expect(onDirtyChange.mock.calls.at(-1)?.[0]).toBe(true);
    });

    fireEvent.click(screen.getByRole('button', { name: /Save Layout/ }));

    await waitFor(() => {
      expect(put).toHaveBeenCalledWith('/views/view-1', {
        config: { columnCount: 2, columns: [[], ['f2']], hiddenLabels: {} },
      });
    });
    await waitFor(() => {
      expect(onDirtyChange.mock.calls.at(-1)?.[0]).toBe(false);
    });
  });

  it('reports clean on unmount, since the working layout goes with it', async () => {
    const onDirtyChange = vi.fn();
    const { unmount } = renderBuilder(onDirtyChange);

    expect(await lastDirty(onDirtyChange)).toBe(false);

    fireEvent.click(screen.getAllByTitle('Retirer')[0]);
    await waitFor(() => {
      expect(onDirtyChange.mock.calls.at(-1)?.[0]).toBe(true);
    });

    unmount();
    expect(onDirtyChange.mock.calls.at(-1)?.[0]).toBe(false);
  });
});
