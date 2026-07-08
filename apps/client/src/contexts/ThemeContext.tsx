import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

type Theme = 'light' | 'dark' | 'green-dark';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    const saved = localStorage.getItem('theme') as Theme | null;
    if (saved) return saved;
    return 'light';
  });

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem('theme', newTheme);
    document.documentElement.setAttribute('data-bs-theme', newTheme === 'green-dark' ? 'dark' : newTheme);
    
    if (newTheme === 'green-dark') {
      document.documentElement.classList.add('theme-green-dark');
    } else {
      document.documentElement.classList.remove('theme-green-dark');
    }
  };

  const toggleTheme = () => {
    const themes: Theme[] = ['light', 'dark', 'green-dark'];
    const currentIndex = themes.indexOf(theme);
    const nextTheme = themes[(currentIndex + 1) % themes.length];
    setTheme(nextTheme);
  };

  useEffect(() => {
    // Apply theme on mount
    document.documentElement.setAttribute('data-bs-theme', theme === 'green-dark' ? 'dark' : theme);
    if (theme === 'green-dark') {
      document.documentElement.classList.add('theme-green-dark');
    }
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
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
