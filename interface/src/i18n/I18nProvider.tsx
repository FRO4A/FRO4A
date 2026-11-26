import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  DEFAULT_LOCALE,
  LOCALE_STORAGE_KEY,
  isShippedLocale,
  languageDirection,
  localeFromLanguageTag,
  getLanguage,
  normalizeLocaleCode,
  type LanguageMeta,
  type LocaleCode,
} from './languages';
import { createTranslator, getDictionary } from './translator';
import type { Translate, TranslationDictionary } from './types';

interface I18nContextValue {
  locale: LocaleCode;
  language: LanguageMeta;
  dict: TranslationDictionary;
  /** Typed translation helper with automatic English fallback. */
  t: Translate;
  setLocale: (locale: LocaleCode) => void;
}

const I18nContext = createContext<I18nContextValue | null>(null);

interface TelegramLocaleSource {
  Telegram?: {
    WebApp?: {
      initDataUnsafe?: {
        user?: { language_code?: string };
      };
    };
  };
}

/**
 * Telegram Mini App first, then the browser locale list.
 *
 * Telegram's `language_code` is the most accurate signal inside the Mini App
 * (`zh-hans`, `pt-br`, `fil`, …); `navigator.languages` covers the regular web
 * build. Anything unsupported falls through to the next candidate.
 */
function detectPreferredLocale(): LocaleCode | null {
  if (typeof window === 'undefined') return null;
  const telegram = (window as unknown as TelegramLocaleSource).Telegram;
  const candidates: Array<string | null | undefined> = [
    telegram?.WebApp?.initDataUnsafe?.user?.language_code,
  ];
  if (typeof navigator !== 'undefined') {
    if (Array.isArray(navigator.languages)) candidates.push(...navigator.languages);
    candidates.push(navigator.language);
  }
  for (const candidate of candidates) {
    const detected = localeFromLanguageTag(candidate);
    if (isShippedLocale(detected)) return detected;
  }
  return null;
}

/**
 * Apply `<html lang>` / `<html dir>` before React's first paint so an
 * auto-detected Arabic/Urdu Telegram user never sees an LTR flash.
 */
function applyDocumentLocale(locale: LocaleCode): void {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = locale;
  document.documentElement.dir = languageDirection(locale);
}

/**
 * Initial locale: an explicit user choice always wins; otherwise auto-detect
 * from Telegram / the browser. Only `setLocale` persists a manual choice, so a
 * Telegram language change is picked up on the next cold start.
 */
function readInitialLocale(): LocaleCode {
  let resolved: LocaleCode | null = null;
  if (typeof window !== 'undefined') {
    try {
      const value = window.sessionStorage.getItem(LOCALE_STORAGE_KEY);
      // Legacy `zh` / `pt` values map to `zh-CN` / `pt-BR`; only a locale that
      // ships a complete dictionary may be restored.
      const normalized = normalizeLocaleCode(value);
      if (isShippedLocale(normalized)) resolved = normalized;
    } catch {
      // sessionStorage may be unavailable (private mode / embedded webview)
    }
  }
  const locale = resolved ?? detectPreferredLocale() ?? DEFAULT_LOCALE;
  applyDocumentLocale(locale);
  return locale;
}

export function I18nProvider({ children }: { children: ReactNode }): JSX.Element {
  const [locale, setLocaleState] = useState<LocaleCode>(readInitialLocale);

  const setLocale = useCallback((next: LocaleCode) => {
    // Registered-but-not-yet-shipped languages stay non-selectable.
    if (!isShippedLocale(next)) return;
    setLocaleState(next);
    try {
      // Preference only: sessionStorage, never cookies / localStorage / PII.
      window.sessionStorage.setItem(LOCALE_STORAGE_KEY, next);
    } catch {
      // preferences are best-effort; the UI still switches for this render
    }
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.lang = locale;
    // RTL scripts flip the document direction immediately on selection.
    document.documentElement.dir = languageDirection(locale);
    // The tab title is dictionary-driven: no hardcoded English survives in the UI.
    document.title = getDictionary(locale).common.documentTitle;
  }, [locale]);

  const value = useMemo<I18nContextValue>(() => {
    const dictionary = getDictionary(locale);
    return {
      locale,
      language: getLanguage(locale) ?? { code: locale, shortCode: locale.toUpperCase(), fullName: locale, nativeName: locale, dir: 'ltr' },
      dict: dictionary,
      t: createTranslator(dictionary),
      setLocale,
    };
  }, [locale, setLocale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const value = useContext(I18nContext);
  if (value === null) throw new Error('useI18n must be used inside <I18nProvider>');
  return value;
}

