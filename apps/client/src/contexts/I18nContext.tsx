import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { format } from 'date-fns';
import { fr, enUS } from 'date-fns/locale';

interface I18nContextType {
  locale: 'fr' | 'en';
  setLocale: (locale: 'fr' | 'en') => void;
  t: (key: string, options?: Record<string, unknown>) => string;
  formatDate: (date: Date | string, formatStr?: string) => string;
  formatNumber: (number: number, options?: Intl.NumberFormatOptions) => string;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

const resources = {
  fr: {
    translation: {
      // Navigation
      'nav.home': 'Accueil',
      'nav.apiStatus': 'Statut API',
      'nav.workspaces': 'Espaces de travail',
      'nav.databases': 'Bases de données',
      'nav.tables': 'Tables',
      'nav.views': 'Vues',
      'nav.settings': 'Paramètres',
      'nav.logout': 'Déconnexion',
      
      // Auth
      'auth.login': 'Connexion',
      'auth.email': 'Courriel',
      'auth.password': 'Mot de passe',
      'auth.loginButton': 'Se connecter',
      'auth.logining': 'Connexion...',
      'auth.loginFailed': 'Échec de la connexion',
      'auth.logoutSuccess': 'Déconnexion réussie',
      
      // Common
      'common.loading': 'Chargement...',
      'common.save': 'Enregistrer',
      'common.cancel': 'Annuler',
      'common.delete': 'Supprimer',
      'common.edit': 'Modifier',
      'common.create': 'Créer',
      'common.search': 'Rechercher',
      'common.filter': 'Filtrer',
      'common.sort': 'Trier',
      'common.actions': 'Actions',
      'common.confirm': 'Confirmer',
      'common.back': 'Retour',
      'common.next': 'Suivant',
      'common.previous': 'Précédent',
      'common.close': 'Fermer',
      'common.yes': 'Oui',
      'common.no': 'Non',
      
      // Errors
      'error.title': 'Erreur',
      'error.notFound': 'Page non trouvée',
      'error.unauthorized': 'Non autorisé',
      'error.serverError': 'Erreur serveur',
      'error.networkError': 'Erreur réseau',
      'error.tryAgain': 'Réessayer',
      
      // Date formats
      'date.full': 'dd MMMM yyyy',
      'date.short': 'dd/MM/yyyy',
      'date.time': 'dd/MM/yyyy HH:mm',
      'date.relative': 'il y a {{time}}',
    },
  },
  en: {
    translation: {
      // Navigation
      'nav.home': 'Home',
      'nav.apiStatus': 'API Status',
      'nav.workspaces': 'Workspaces',
      'nav.databases': 'Databases',
      'nav.tables': 'Tables',
      'nav.views': 'Views',
      'nav.settings': 'Settings',
      'nav.logout': 'Logout',
      
      // Auth
      'auth.login': 'Login',
      'auth.email': 'Email',
      'auth.password': 'Password',
      'auth.loginButton': 'Sign In',
      'auth.logining': 'Signing in...',
      'auth.loginFailed': 'Login failed',
      'auth.logoutSuccess': 'Logout successful',
      
      // Common
      'common.loading': 'Loading...',
      'common.save': 'Save',
      'common.cancel': 'Cancel',
      'common.delete': 'Delete',
      'common.edit': 'Edit',
      'common.create': 'Create',
      'common.search': 'Search',
      'common.filter': 'Filter',
      'common.sort': 'Sort',
      'common.actions': 'Actions',
      'common.confirm': 'Confirm',
      'common.back': 'Back',
      'common.next': 'Next',
      'common.previous': 'Previous',
      'common.close': 'Close',
      'common.yes': 'Yes',
      'common.no': 'No',
      
      // Errors
      'error.title': 'Error',
      'error.notFound': 'Page not found',
      'error.unauthorized': 'Unauthorized',
      'error.serverError': 'Server error',
      'error.networkError': 'Network error',
      'error.tryAgain': 'Try again',
      
      // Date formats
      'date.full': 'MMMM dd, yyyy',
      'date.short': 'MM/dd/yyyy',
      'date.time': 'MM/dd/yyyy HH:mm',
      'date.relative': '{{time}} ago',
    },
  },
};

i18n.use(initReactI18next).init({
  resources,
  lng: window.__APP__?.locale || 'fr',
  fallbackLng: 'fr',
  interpolation: {
    escapeValue: false,
  },
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<'fr' | 'en'>(
    (window.__APP__?.locale as 'fr' | 'en') || 'fr'
  );

  const setLocale = (newLocale: 'fr' | 'en') => {
    setLocaleState(newLocale);
    i18n.changeLanguage(newLocale);
    localStorage.setItem('locale', newLocale);
  };

  useEffect(() => {
    const savedLocale = localStorage.getItem('locale') as 'fr' | 'en' | null;
    if (savedLocale && savedLocale !== locale) {
      setLocale(savedLocale);
    }
  }, []);

  const formatDate = (date: Date | string, formatStr?: string) => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    const localeObj = locale === 'fr' ? fr : enUS;
    const formatString = formatStr || i18n.t('date.full');
    return format(dateObj, formatString, { locale: localeObj });
  };

  const formatNumber = (number: number, options?: Intl.NumberFormatOptions) => {
    return new Intl.NumberFormat(locale, options).format(number);
  };

  return (
    <I18nContext.Provider
      value={{
        locale,
        setLocale,
        t: i18n.t,
        formatDate,
        formatNumber,
      }}
    >
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (context === undefined) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
}
