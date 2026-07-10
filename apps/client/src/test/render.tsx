import { render as rtlRender, type RenderOptions } from '@testing-library/react';
import i18n from 'i18next';
import { I18nProvider } from '../contexts/I18nContext';

function Providers({ children }: { children: React.ReactNode }) {
  return <I18nProvider>{children}</I18nProvider>;
}

export function render(ui: React.ReactNode, options?: RenderOptions) {
  window.__APP__ = { apiBase: '/api/v1', locale: 'en' };
  i18n.changeLanguage('en');
  return rtlRender(<Providers>{ui}</Providers>, options);
}
