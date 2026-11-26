import { DEFAULT_LOCALE, normalizeLocaleCode } from './languages';
import { ar } from './locales/ar';
import { az } from './locales/az';
import { cs } from './locales/cs';
import { de } from './locales/de';
import { el } from './locales/el';
import { en } from './locales/en';
import { es } from './locales/es';
import { fr } from './locales/fr';
import { hi } from './locales/hi';
import { id } from './locales/id';
import { it } from './locales/it';
import { ja } from './locales/ja';
import { kk } from './locales/kk';
import { ko } from './locales/ko';
import { ky } from './locales/ky';
import { ms } from './locales/ms';
import { nl } from './locales/nl';
import { pl } from './locales/pl';
import { ptBR } from './locales/pt-BR';
import { ro } from './locales/ro';
import { ru } from './locales/ru';
import { sv } from './locales/sv';
import { tg } from './locales/tg';
import { th } from './locales/th';
import { tl } from './locales/tl';
import { tr } from './locales/tr';
import { uk } from './locales/uk';
import { ur } from './locales/ur';
import { uz } from './locales/uz';
import { vi } from './locales/vi';
import { zhCN } from './locales/zh-CN';
import { zhTW } from './locales/zh-TW';
import type { DeepPartial, Translate, TranslateVars, TranslationDictionary } from './types';

/**
 * Every locale module registered with the runtime. A module may be partial —
 * `getDictionary` deep-merges it over the English dictionary, so a missing key
 * can never render as `undefined`.
 *
 * Each shipped locale is a complete `TranslationDictionary`: no packed blobs, no
 * positional arrays, no condensed summaries — one explicit module per language,
 * key-for-key with `en.ts`. All 32 registered world languages carry a full
 * dictionary and are selectable in the LanguageModal.
 */
export const LOCALE_DICTIONARIES: Record<string, DeepPartial<TranslationDictionary>> = {
  en,
  'zh-CN': zhCN,
  es,
  de,
  fr,
  ja,
  'pt-BR': ptBR,
  ru,
  ko,
  it,
  ar,
  'zh-TW': zhTW,
  tr,
  hi,
  id,
  pl,
  nl,
  vi,
  th,
  sv,
  uk,
  cs,
  ro,
  el,
  ms,
  tl,
  ur,
  uz,
  ky,
  kk,
  tg,
  az,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Deep merge used for the English fallback (arrays are replaced atomically). */
function mergeValue(base: unknown, override: unknown): unknown {
  if (override === undefined || override === null) return base;
  if (Array.isArray(base)) return Array.isArray(override) ? override : base;
  if (isRecord(base)) {
    if (!isRecord(override)) return base;
    const merged: Record<string, unknown> = { ...base };
    for (const [key, value] of Object.entries(override)) {
      merged[key] = key in merged ? mergeValue(merged[key], value) : value;
    }
    return merged;
  }
  return override;
}

/** Merge a (possibly partial) locale over the complete English dictionary. */
export function mergeDictionary(override?: DeepPartial<TranslationDictionary>): TranslationDictionary {
  return mergeValue(en, override) as TranslationDictionary;
}

const dictionaryCache = new Map<string, TranslationDictionary>();

/**
 * Resolve a locale dictionary with automatic English fallback. Unknown locale
 * codes resolve to English instead of throwing, so a stale `sessionStorage`
 * value from an older build can never break the interface.
 */
export function getDictionary(code: string): TranslationDictionary {
  const resolved = normalizeLocaleCode(code) ?? DEFAULT_LOCALE;
  const cached = dictionaryCache.get(resolved);
  if (cached !== undefined) return cached;
  const dictionary = resolved === DEFAULT_LOCALE ? en : mergeDictionary(LOCALE_DICTIONARIES[resolved]);
  dictionaryCache.set(resolved, dictionary);
  return dictionary;
}

/** The canonical fallback dictionary (`en`). */
export function getFallbackDictionary(): TranslationDictionary {
  return en;
}

function resolvePath(root: unknown, path: string): unknown {
  return path
    .split('.')
    .reduce<unknown>((node, part) => (isRecord(node) ? node[part] : undefined), root);
}

/** `{name}` style interpolation — every placeholder is optional. */
export function interpolate(template: string, vars: TranslateVars): string {
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : match,
  );
}

/**
 * Resolve one dot-path against a dictionary and fall back to English when the
 * key is missing. Returns the key itself when neither locale defines it, which
 * makes an omission visible without crashing the UI.
 */
export function translate(dictionary: TranslationDictionary, key: string, vars?: TranslateVars): unknown {
  const value = resolvePath(dictionary, key);
  const resolved = value === undefined ? resolvePath(en, key) : value;
  if (resolved === undefined) return key;
  if (typeof resolved === 'string' && vars !== undefined) return interpolate(resolved, vars);
  return resolved;
}

/** Build the typed `t(...)` helper bound to one dictionary. */
export function createTranslator(dictionary: TranslationDictionary): Translate {
  const translateFn = (key: string, vars?: TranslateVars): unknown => translate(dictionary, key, vars);
  return translateFn as unknown as Translate;
}
