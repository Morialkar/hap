import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider, useTheme, type Accent, type Appearance } from '../ThemeContext';

function wrapper({ children }: { children: React.ReactNode }) {
  return <ThemeProvider>{children}</ThemeProvider>;
}

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

describe('ThemeProvider', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createMemoryStorage());
    localStorage.clear();
    document.documentElement.removeAttribute('data-bs-theme');
    document.documentElement.removeAttribute('data-hap-accent');
    document.documentElement.classList.remove('theme-green-dark');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('persists independent appearance and accent preferences', async () => {
    const { result } = renderHook(() => useTheme(), { wrapper });

    act(() => {
      result.current.setAppearance('dark');
      result.current.setAccent('magenta');
    });

    await waitFor(() => {
      expect(document.documentElement).toHaveAttribute('data-bs-theme', 'dark');
      expect(document.documentElement).toHaveAttribute('data-hap-accent', 'magenta');
    });
    expect(localStorage.getItem('hap.appearance')).toBe('dark');
    expect(localStorage.getItem('hap.accent')).toBe('magenta');
  });

  it('migrates the legacy green-dark preference to dark with the heritage accent', async () => {
    localStorage.setItem('theme', 'green-dark');
    document.documentElement.classList.add('theme-green-dark');

    const { result } = renderHook(() => useTheme(), { wrapper });

    expect(result.current.appearance).toBe('dark');
    expect(result.current.accent).toBe('heritage-green');
    await waitFor(() => {
      expect(localStorage.getItem('hap.appearance')).toBe('dark');
      expect(localStorage.getItem('hap.accent')).toBe('heritage-green');
      expect(localStorage.getItem('theme')).toBeNull();
      expect(document.documentElement).not.toHaveClass('theme-green-dark');
    });
  });

  it('falls back safely when stored values are invalid', () => {
    localStorage.setItem('hap.appearance', 'sepia');
    localStorage.setItem('hap.accent', 'chartreuse');

    const { result } = renderHook(() => useTheme(), { wrapper });

    expect(result.current.appearance).toBe<Appearance>('light');
    expect(result.current.accent).toBe<Accent>('heritage-green');
  });

  it('keeps preferences usable when browser storage is unavailable', async () => {
    const unavailableStorage = createMemoryStorage();
    unavailableStorage.getItem = () => {
      throw new DOMException('Storage denied', 'SecurityError');
    };
    unavailableStorage.setItem = () => {
      throw new DOMException('Storage denied', 'SecurityError');
    };
    vi.stubGlobal('localStorage', unavailableStorage);

    const { result } = renderHook(() => useTheme(), { wrapper });

    act(() => {
      result.current.setAppearance('dark');
      result.current.setAccent('orange');
    });

    await waitFor(() => {
      expect(result.current.appearance).toBe('dark');
      expect(result.current.accent).toBe('orange');
      expect(document.documentElement).toHaveAttribute('data-bs-theme', 'dark');
      expect(document.documentElement).toHaveAttribute('data-hap-accent', 'orange');
    });
  });
});
