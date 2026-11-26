import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Search, X } from 'lucide-react';
import { filterLanguages, isShippedLocale, useI18n, type LocaleCode } from '../i18n';
import { cn } from '../utils/cn';

/**
 * Top-layer language portal.
 *
 * Rendered directly into `document.body` with `fixed inset-0 z-[9999]` so it can
 * never be clipped by the sticky header, an `overflow-hidden` glass card or the
 * floating bottom dock. Monochrome Liquid Glass in both Dark and Light themes.
 */
export function LanguageModal({ open, onClose }: { open: boolean; onClose: () => void }): JSX.Element | null {
  const { locale, t, setLocale } = useI18n();
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return undefined;
    setQuery('');
    const timer = window.setTimeout(() => inputRef.current?.focus(), 40);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  const results = useMemo(() => filterLanguages(query), [query]);

  if (!open || typeof document === 'undefined') return null;

  const select = (code: string): void => {
    // Validation + persistence (`sessionStorage` only) live in I18nProvider.
    setLocale(code as LocaleCode);
    onClose();
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-end justify-center bg-[rgba(15,23,42,0.32)] p-4 backdrop-blur-md sm:items-center"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="glass fade-in flex max-h-[min(88vh,42rem)] w-full max-w-[30rem] flex-col p-4 sm:p-5"
        role="dialog"
        aria-modal="true"
        aria-labelledby="language-modal-title"
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <h2 id="language-modal-title" className="text-lg font-semibold text-[var(--text-primary)]">
            {t('language.title')}
          </h2>
          <button type="button" className="icon-btn h-9 w-9" onClick={onClose} aria-label={t('common.close')}>
            <X size={18} strokeWidth={1.75} />
          </button>
        </div>

        <label className="glass-nested flex items-center gap-2 px-3 py-2 transition-colors focus-within:border-[var(--hairline-strong)]">
          <Search size={15} strokeWidth={1.75} className="shrink-0 text-[var(--text-muted)]" aria-hidden="true" />
          <span className="sr-only">{t('language.searchLabel')}</span>
          <input
            ref={inputRef}
            type="search"
            className="w-full bg-transparent text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)] focus:outline-none focus-visible:outline-none"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('language.searchPlaceholder')}
            aria-label={t('language.searchLabel')}
            autoComplete="off"
            spellCheck={false}
          />
        </label>

        <ul className="mt-3 min-h-0 flex-1 space-y-1 overflow-y-auto pr-0.5" aria-label={t('language.title')}>
          {results.map((language) => {
            const active = locale === language.code;
            const ready = isShippedLocale(language.code);
            return (
              <li key={language.code}>
                <button
                  type="button"
                  className={cn(
                    'flex w-full items-center justify-between gap-3 rounded-2xl border px-3 py-2.5 text-left transition-colors',
                    active
                      ? 'border-[var(--hairline-strong)] bg-[var(--fill-subtle)]'
                      : 'border-transparent hover:border-[var(--hairline)] hover:bg-[var(--fill-subtle)]',
                    !ready && 'cursor-not-allowed opacity-60 hover:border-transparent hover:bg-transparent',
                  )}
                  aria-pressed={active}
                  aria-disabled={!ready}
                  disabled={!ready}
                  title={ready ? language.fullName : `${language.fullName} — ${t('language.soon')}`}
                  onClick={() => {
                    if (!ready) return;
                    select(language.code);
                  }}
                >
                  <span className="min-w-0" dir={language.dir}>
                    <span className="block truncate text-sm font-semibold text-[var(--text-primary)]">
                      {language.fullName}
                    </span>
                    {language.nativeName !== language.fullName ? (
                      <span className="block truncate text-[11px] text-[var(--text-muted)]">{language.nativeName}</span>
                    ) : null}
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="pill pill-neutral px-2 text-[10px] font-bold uppercase tracking-[0.08em]">
                      {language.shortCode}
                    </span>
                    {!ready ? (
                      <span className="pill pill-neutral px-2 text-[10px]">{t('language.soon')}</span>
                    ) : active ? (
                      <>
                        <Check size={15} strokeWidth={2.25} className="text-[var(--text-primary)]" />
                        <span className="sr-only">{t('language.selected')}</span>
                      </>
                    ) : null}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        {results.length === 0 ? (
          <p className="mt-3 text-center text-sm text-secondary" role="status">
            {t('language.noResults')}
          </p>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
