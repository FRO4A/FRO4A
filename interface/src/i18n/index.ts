import {
  AVAILABLE_LANGUAGES,
  DEFAULT_LOCALE,
  LANGUAGES,
  LEGACY_LOCALE_ALIASES,
  LOCALE_STORAGE_KEY,
  SHIPPED_LOCALE_CODES,
  filterLanguages,
  getLanguage,
  isLocaleCode,
  isShippedLocale,
  languageDirection,
  localeFromLanguageTag,
  normalizeLocaleCode,
  type LanguageMeta,
  type LocaleCode,
  type ShippedLocaleCode,
} from './languages';
import { createTranslator, getDictionary, interpolate, mergeDictionary, translate } from './translator';
import type { TranslationDictionary } from './types';

export interface LocaleDefinition {
  code: LocaleCode;
  label: string;
  dictionary: TranslationDictionary;
}

/**
 * Backwards-compatible view over `LANGUAGES`. Dictionaries are resolved lazily,
 * so registering 100+ locales in Stage 2 never builds every dictionary at boot.
 */
export const SUPPORTED_LOCALES: readonly LocaleDefinition[] = LANGUAGES.map((language) => ({
  code: language.code,
  label: language.fullName,
  get dictionary() {
    return getDictionary(language.code);
  },
}));

export {
  AVAILABLE_LANGUAGES,
  DEFAULT_LOCALE,
  LANGUAGES,
  LEGACY_LOCALE_ALIASES,
  LOCALE_STORAGE_KEY,
  SHIPPED_LOCALE_CODES,
  createTranslator,
  normalizeLocaleCode,
  filterLanguages,
  getDictionary,
  getLanguage,
  interpolate,
  isLocaleCode,
  isShippedLocale,
  languageDirection,
  localeFromLanguageTag,
  mergeDictionary,
  translate,
};
export type { LanguageMeta, LocaleCode, ShippedLocaleCode, TranslationDictionary };
export type {
  DeepPartial,
  Translate,
  TranslationKey,
  TranslationValue,
  TranslateVars,
} from './types';

export { I18nProvider, useI18n } from './I18nProvider';
