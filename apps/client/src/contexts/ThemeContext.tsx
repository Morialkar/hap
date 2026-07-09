import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export type Appearance = 'light' | 'dark';

export const ACCENTS = [
  'heritage-green',
  'lime',
  'amber',
  'orange',
  'red',
  'rose',
  'magenta',
  'violet',
  'indigo',
  'blue',
  'cyan',
  'teal',
] as const;

export type Accent = (typeof ACCENTS)[number];

interface ThemePreferences {
  appearance: Appearance;
  accent: Accent;
}

interface ThemeContextType extends ThemePreferences {
  setAppearance: (appearance: Appearance) => void;
  setAccent: (accent: Accent) => void;
  toggleAppearance: () => void;
}

const APPEARANCE_STORAGE_KEY = 'hap.appearance';
const ACCENT_STORAGE_KEY = 'hap.accent';
const LEGACY_THEME_STORAGE_KEY = 'theme';
const DEFAULT_PREFERENCES: ThemePreferences = {
  appearance: 'light',
  accent: 'heritage-green',
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function isAppearance(value: string | null): value is Appearance {
  return value === 'light' || value === 'dark';
}

function isAccent(value: string | null): value is Accent {
  return ACCENTS.some((accent) => accent === value);
}

function readStoredPreferences(): ThemePreferences {
  try {
    const storedAppearance = localStorage.getItem(APPEARANCE_STORAGE_KEY);
    const legacyTheme = localStorage.getItem(LEGACY_THEME_STORAGE_KEY);
    const appearance = isAppearance(storedAppearance)
      ? storedAppearance
      : legacyTheme === 'dark' || legacyTheme === 'green-dark'
        ? 'dark'
        : DEFAULT_PREFERENCES.appearance;

    const storedAccent = localStorage.getItem(ACCENT_STORAGE_KEY);

    return {
      appearance,
      accent: isAccent(storedAccent) ? storedAccent : DEFAULT_PREFERENCES.accent,
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

function persistPreferences(preferences: ThemePreferences) {
  try {
    localStorage.setItem(APPEARANCE_STORAGE_KEY, preferences.appearance);
    localStorage.setItem(ACCENT_STORAGE_KEY, preferences.accent);
    localStorage.removeItem(LEGACY_THEME_STORAGE_KEY);
  } catch {
    // The visual preference still applies for this session when storage is unavailable.
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<ThemePreferences>(readStoredPreferences);

  const setAppearance = (appearance: Appearance) => {
    setPreferences((current) => ({ ...current, appearance }));
  };

  const setAccent = (accent: Accent) => {
    setPreferences((current) => ({ ...current, accent }));
  };

  const toggleAppearance = () => {
    setPreferences((current) => ({
      ...current,
      appearance: current.appearance === 'light' ? 'dark' : 'light',
    }));
  };

  useEffect(() => {
    document.documentElement.setAttribute('data-bs-theme', preferences.appearance);
    document.documentElement.setAttribute('data-hap-accent', preferences.accent);
    document.documentElement.classList.remove('theme-green-dark');
    persistPreferences(preferences);
  }, [preferences]);

  return (
    <ThemeContext.Provider
      value={{
        ...preferences,
        setAppearance,
        setAccent,
        toggleAppearance,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
