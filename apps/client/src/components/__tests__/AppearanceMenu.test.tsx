import { fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '../../contexts/ThemeContext';
import { render } from '../../test/render';
import { AppearanceMenu } from '../AppearanceMenu';

function createMemoryStorage(): Storage {
  const values = new Map<string, string>();

  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, value),
  };
}

describe('AppearanceMenu', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createMemoryStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('selects an appearance and any accent from the complete palette', () => {
    render(
      <ThemeProvider>
        <AppearanceMenu />
      </ThemeProvider>
    );

    fireEvent.click(screen.getByTestId('appearance-menu-toggle'));
    expect(screen.getAllByRole('button')).toHaveLength(15);

    fireEvent.click(screen.getByTestId('appearance-dark'));
    fireEvent.click(screen.getByTestId('accent-magenta'));

    expect(screen.getByTestId('appearance-dark')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('accent-magenta')).toHaveAttribute('aria-pressed', 'true');
    expect(document.documentElement).toHaveAttribute('data-bs-theme', 'dark');
    expect(document.documentElement).toHaveAttribute('data-hap-accent', 'magenta');
  });

  it('closes with Escape and returns its trigger to the collapsed state', () => {
    render(
      <ThemeProvider>
        <AppearanceMenu />
      </ThemeProvider>
    );

    const trigger = screen.getByTestId('appearance-menu-toggle');
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByTestId('appearance-menu')).not.toBeInTheDocument();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });
});
