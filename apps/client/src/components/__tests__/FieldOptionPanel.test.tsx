import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { FieldOptionPanel } from '../FieldOptionPanel';
import type { BuilderField } from '../../lib/fieldTypes';
import { render } from '../../test/render';

const baseField: BuilderField = {
  id: '1',
  name: 'Test field',
  type: 'text',
  position: 0,
  options: {},
  validation: {},
};

const tables = [
  { id: 'db-table-1', name: 'Auteurs' },
  { id: 'db-table-2', name: 'Ouvrages' },
];

describe('FieldOptionPanel', () => {
  it('renders field name and type inputs', () => {
    const onChange = vi.fn();
    render(<FieldOptionPanel field={baseField} onChange={onChange} />);

    const nameInput = screen.getByLabelText(/field name/i);
    expect(nameInput).toHaveValue('Test field');

    const typeSelect = screen.getByLabelText(/field type/i);
    expect(typeSelect).toHaveValue('text');
  });

  it('updates field name on input', () => {
    const onChange = vi.fn();
    render(<FieldOptionPanel field={baseField} onChange={onChange} />);

    const nameInput = screen.getByLabelText(/field name/i);
    fireEvent.change(nameInput, { target: { value: 'Updated name' } });

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Updated name' })
    );
  });

  it('renders text-specific options (max length, placeholder, char count)', () => {
    const onChange = vi.fn();
    render(<FieldOptionPanel field={baseField} onChange={onChange} />);

    expect(document.getElementById('option-max_length')).toBeInTheDocument();
    expect(document.getElementById('option-placeholder')).toBeInTheDocument();
    expect(screen.getByLabelText(/show character counter/i)).toBeInTheDocument();
  });

  it('renders text validation rules (required, min/max length, pattern)', () => {
    const onChange = vi.fn();
    render(<FieldOptionPanel field={baseField} onChange={onChange} />);

    expect(screen.getByLabelText(/^Required$/i)).toBeInTheDocument();
    expect(document.getElementById('option-minLength')).toBeInTheDocument();
    expect(document.getElementById('option-maxLength')).toBeInTheDocument();
    expect(screen.getByLabelText(/regular expression/i)).toBeInTheDocument();
  });

  it('updates number option value', () => {
    const onChange = vi.fn();
    const field: BuilderField = {
      ...baseField,
      type: 'number',
      options: {},
    };
    render(<FieldOptionPanel field={field} onChange={onChange} />);

    const minInput = screen.getByLabelText(/minimum value/i);
    fireEvent.change(minInput, { target: { value: '10' } });

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({ min: 10 }),
      })
    );
  });

  it('updates select option values from textarea', () => {
    const onChange = vi.fn();
    const field: BuilderField = {
      ...baseField,
      type: 'select',
      options: {},
    };
    render(<FieldOptionPanel field={field} onChange={onChange} />);

    const valuesTextarea = screen.getByLabelText(/allowed values/i);
    fireEvent.change(valuesTextarea, { target: { value: 'One\nTwo\nThree' } });

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({ values: ['One', 'Two', 'Three'] }),
      })
    );
  });

  it('updates boolean option through switch', () => {
    const onChange = vi.fn();
    const field: BuilderField = {
      ...baseField,
      type: 'text',
      options: {},
    };
    render(<FieldOptionPanel field={field} onChange={onChange} />);

    const checkbox = screen.getByLabelText(/show character counter/i);
    fireEvent.click(checkbox);

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({ showCharCount: true }),
      })
    );
  });

  it('renders reference target table dropdown with tables', () => {
    const onChange = vi.fn();
    const field: BuilderField = {
      ...baseField,
      type: 'reference',
      options: {},
    };
    render(
      <FieldOptionPanel field={field} availableTables={tables} onChange={onChange} />
    );

    const targetSelect = screen.getByLabelText(/target table/i);
    fireEvent.change(targetSelect, { target: { value: 'db-table-1' } });

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({ target_table: 'db-table-1' }),
      })
    );
  });

  it('switches field type and clears incompatible options metadata', () => {
    const onChange = vi.fn();
    const field: BuilderField = {
      ...baseField,
      type: 'text',
      options: { max_length: 140 },
    };
    render(<FieldOptionPanel field={field} onChange={onChange} />);

    const typeSelect = screen.getByLabelText(/field type/i);
    fireEvent.change(typeSelect, { target: { value: 'date' } });

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'date',
        options: expect.objectContaining({ max_length: 140 }),
      })
    );
  });
});
