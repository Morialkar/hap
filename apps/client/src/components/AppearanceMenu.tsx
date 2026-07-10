import { useEffect, useRef, useState } from 'react';
import { ACCENTS, useTheme, type Appearance } from '../contexts/ThemeContext';
import { useI18n } from '../contexts/I18nContext';

export function AppearanceMenu() {
  const { appearance, accent, setAppearance, setAccent } = useTheme();
  const { t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('pointerdown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [isOpen]);

  const appearances: Appearance[] = ['light', 'dark'];

  return (
    <div className="nav-item dropdown position-relative" ref={menuRef}>
      <button
        type="button"
        className="nav-link px-2"
        aria-label={t('theme.customize')}
        aria-expanded={isOpen}
        aria-controls="appearance-menu"
        onClick={() => setIsOpen((current) => !current)}
        data-testid="appearance-menu-toggle"
      >
        <i className="ti ti-palette" aria-hidden="true" />
      </button>

      {isOpen && (
        <div
          id="appearance-menu"
          className="dropdown-menu dropdown-menu-end show p-3 hap-appearance-menu"
          data-testid="appearance-menu"
        >
          <fieldset className="mb-3">
            <legend className="form-label mb-2">{t('theme.appearance')}</legend>
            <div className="btn-group w-100" role="group">
              {appearances.map((option) => (
                <button
                  key={option}
                  type="button"
                  className={`btn btn-sm ${
                    appearance === option ? 'btn-primary' : 'btn-outline-secondary'
                  }`}
                  aria-pressed={appearance === option}
                  onClick={() => setAppearance(option)}
                  data-testid={`appearance-${option}`}
                >
                  <i
                    className={`ti ti-${option === 'light' ? 'sun' : 'moon'} me-1`}
                    aria-hidden="true"
                  />
                  {t(`theme.appearance.${option}`)}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="form-label mb-2">{t('theme.accent')}</legend>
            <div className="hap-accent-grid">
              {ACCENTS.map((option) => (
                <button
                  key={option}
                  type="button"
                  className={`hap-accent-option ${accent === option ? 'is-active' : ''}`}
                  aria-pressed={accent === option}
                  onClick={() => setAccent(option)}
                  data-testid={`accent-${option}`}
                >
                  <span className="hap-accent-swatch" data-hap-accent={option} aria-hidden="true" />
                  <span>{t(`theme.accent.${option}`)}</span>
                  {accent === option && <i className="ti ti-check ms-auto" aria-hidden="true" />}
                </button>
              ))}
            </div>
          </fieldset>
        </div>
      )}
    </div>
  );
}
