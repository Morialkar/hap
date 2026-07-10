import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RecordForm } from '../RecordForm';
import { type BuilderField } from '../../lib/fieldTypes';
import { render } from '../../test/render';

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
    name: 'Titre',
    type: 'text',
    position: 0,
    options: { placeholder: "Titre de l'œuvre", max_length: 100 },
    validation: { required: true },
  },
  {
    id: 'f2',
    name: 'Description',
    type: 'long_text',
    position: 1,
    options: { rows: 6, max_length: 500 },
    validation: {},
  },
  {
    id: 'f3',
    name: 'Active',
    type: 'boolean',
    position: 2,
    options: {},
    validation: {},
  },
];

describe('RecordForm', () => {
  it('renders input fields with labels', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <RecordForm tableId="tbl-1" fields={mockFields} onCancel={vi.fn()} />
      </QueryClientProvider>
    );

    // Labels
    expect(screen.getByText(/Titre/)).toBeInTheDocument();
    expect(screen.getByText(/Description/)).toBeInTheDocument();
    expect(screen.getByText(/Active/)).toBeInTheDocument();

    // Placeholder
    const titreInput = screen.getByPlaceholderText("Titre de l'œuvre");
    expect(titreInput).toBeInTheDocument();
  });

  it('displays character counter when max_length option is defined', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <RecordForm tableId="tbl-1" fields={[mockFields[0]]} onCancel={vi.fn()} />
      </QueryClientProvider>
    );

    // Character counter should be rendered
    const counterText = screen.getByText('0 / 100 characters');
    expect(counterText).toBeInTheDocument();
  });

  it('renders boolean fields as toggle switches', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <RecordForm tableId="tbl-1" fields={[mockFields[2]]} onCancel={vi.fn()} />
      </QueryClientProvider>
    );

    const checkbox = screen.getByRole('switch');
    expect(checkbox).toBeInTheDocument();
    expect(checkbox).not.toBeChecked();
  });
});
