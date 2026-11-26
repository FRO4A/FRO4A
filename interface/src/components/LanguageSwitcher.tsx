import { useState } from 'react';
import { Globe } from 'lucide-react';
import { useI18n } from '../i18n';
import { LanguageModal } from './LanguageModal';

/**
 * Monochrome Liquid Glass Globe trigger.
 *
 * The trigger deliberately shows no `RU` / `EN` text — the language name, code
 * and active checkmark live inside the top-layer `LanguageModal` portal.
 * Persistence is handled by I18nProvider through `sessionStorage` (`fro4a_lang`)
 * — never cookies or localStorage.
 */
export function LanguageSwitcher(): JSX.Element {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="glass-circle shrink-0 text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
        onClick={() => setOpen(true)}
        aria-label={t('language.open')}
        aria-haspopup="dialog"
        aria-expanded={open}
        title={t('language.label')}
      >
        <Globe size={17} strokeWidth={1.75} />
      </button>
      <LanguageModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}

